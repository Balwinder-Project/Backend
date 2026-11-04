import { Request, Response } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import WholesaleEnquiry from '../models/wholesaleEnquiry.model';
import { uploadImageToB2 } from '../utils/imageUpload';
import { s3Client, B2_BUCKET_NAME, B2_PUBLIC_URL } from '../config/b2';

const clean = (value: unknown) => String(value || '').trim();

export const submitWholesaleEnquiry = async (req: Request, res: Response): Promise<void> => {
  try {
    const businessName = clean(req.body.businessName);
    const contactPerson = clean(req.body.contactPerson);
    const email = clean(req.body.email).toLowerCase();
    const phone = clean(req.body.phone).replace(/\D/g, '').slice(-10);
    const state = clean(req.body.state);
    const address = clean(req.body.address);
    const requirement = clean(req.body.requirement);

    const errors: string[] = [];
    if (businessName.length < 2) errors.push('Business / shop name is required');
    if (contactPerson.length < 2) errors.push('Contact person is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('A valid email address is required');
    if (!/^[6-9]\d{9}$/.test(phone)) errors.push('Enter a valid 10 digit Indian mobile number');
    if (!state) errors.push('State is required');
    if (address.length < 8) errors.push('Complete address is required');
    if (errors.length) {
      res.status(400).json({ success: false, message: 'Please check the enquiry details', errors });
      return;
    }

    let visitingCardUrl: string | undefined;
    let visitingCardName: string | undefined;
    if (req.file) {
      visitingCardName = req.file.originalname;
      if (req.file.mimetype === 'application/pdf') {
        const key = `balwinder/wholesale-enquiries/${randomUUID()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: B2_BUCKET_NAME, Key: key, Body: req.file.buffer,
          ContentType: 'application/pdf', ContentDisposition: 'inline',
        }));
        visitingCardUrl = `${B2_PUBLIC_URL}/${key}`;
      } else {
        visitingCardUrl = await uploadImageToB2(req.file.buffer, req.file.originalname, 'wholesale-enquiries');
      }
    }

    const enquiry = await WholesaleEnquiry.create({
      businessName, contactPerson, email, phone, state, address, requirement,
      visitingCardUrl, visitingCardName,
    });
    res.status(201).json({
      success: true,
      message: 'Wholesale enquiry submitted successfully. Our team will contact you soon.',
      data: { id: enquiry.id },
    });
  } catch (error: any) {
    console.error('Wholesale enquiry submission failed:', error);
    res.status(500).json({ success: false, message: 'Unable to submit enquiry right now. Please try again.' });
  }
};

export const getWholesaleEnquiries = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const search = clean(req.query.search);
    const status = clean(req.query.status);
    const query: any = {};
    if (status && ['pending', 'contacted', 'closed'].includes(status)) query.status = status;
    if (search) query.$or = [
      { businessName: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { state: { $regex: search, $options: 'i' } },
    ];
    const [items, total, pending, contacted, closed] = await Promise.all([
      WholesaleEnquiry.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      WholesaleEnquiry.countDocuments(query),
      WholesaleEnquiry.countDocuments({ status: 'pending' }),
      WholesaleEnquiry.countDocuments({ status: 'contacted' }),
      WholesaleEnquiry.countDocuments({ status: 'closed' }),
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, summary: { total: await WholesaleEnquiry.countDocuments(), pending, contacted, closed } });
  } catch (error) {
    console.error('Failed to fetch wholesale enquiries:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch wholesale enquiries' });
  }
};

export const updateWholesaleEnquiry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, internalNotes } = req.body;
    const update: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!['pending', 'contacted', 'closed'].includes(status)) {
        res.status(400).json({ success: false, message: 'Invalid enquiry status' });
        return;
      }
      update.status = status;
    }
    if (internalNotes !== undefined) update.internalNotes = clean(internalNotes).slice(0, 5000);
    const enquiry = await WholesaleEnquiry.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!enquiry) {
      res.status(404).json({ success: false, message: 'Wholesale enquiry not found' });
      return;
    }
    res.json({ success: true, message: 'Enquiry updated successfully', data: enquiry });
  } catch (error) {
    console.error('Failed to update wholesale enquiry:', error);
    res.status(500).json({ success: false, message: 'Failed to update enquiry' });
  }
};
