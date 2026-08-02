import { Request, Response } from 'express';
import multer from 'multer';
import { DesignRequestService } from '../services/designRequest.service';
import { DesignRequestStatus } from '../models/designRequest.model';
import { uploadMultipleImages } from '../utils/imageUpload';

// Dedicated uploader for design reference images (public form, up to 10MB each)
const designUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 8,
  },
}).array('images', 8);

/**
 * Multer middleware wrapper that returns JSON errors instead of HTML.
 */
export const designRequestUpload = (req: Request, res: Response, next: () => void): void => {
  designUpload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'Each image must be 10MB or smaller',
        });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        res.status(400).json({
          success: false,
          message: 'You can upload up to 8 reference images',
        });
        return;
      }
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    if (err) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'File upload failed',
      });
      return;
    }
    next();
  });
};

/**
 * POST /api/v1/design-requests
 * Public (optional auth) — submit a design brief with reference images.
 */
export const createDesignRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least 1 reference image is required',
      });
      return;
    }

    const imageUrls = await uploadMultipleImages(
      files.map((f) => ({ buffer: f.buffer, filename: f.originalname })),
      'design-requests'
    );

    const request = await DesignRequestService.create({
      name: String(req.body.name || '').trim(),
      subject: String(req.body.subject || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase(),
      phone: String(req.body.phone || '').replace(/[^\d+]/g, ''),
      requirements: String(req.body.requirements || '').trim(),
      images: imageUrls,
      firebaseUid: req.user?.uid || null,
    });

    res.status(201).json({
      success: true,
      message: 'Design request submitted successfully',
      data: {
        id: (request as any).id || (request._id as any).toString(),
        name: request.name,
        subject: request.subject,
        email: request.email,
        phone: request.phone,
        imageCount: request.images.length,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Create design request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit design request',
    });
  }
};

/**
 * GET /api/v1/design-requests/admin/all
 */
export const listDesignRequestsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const limit = parseInt(String(req.query.limit || '20'), 10) || 20;
    const status = (req.query.status as DesignRequestStatus | undefined) || '';
    const search = String(req.query.search || '');

    const result = await DesignRequestService.listAdmin({
      page,
      limit,
      status: status || undefined,
      search,
    });

    res.status(200).json({
      success: true,
      message: 'Design requests fetched successfully',
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    console.error('List design requests error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch design requests',
    });
  }
};

/**
 * GET /api/v1/design-requests/admin/:id
 */
export const getDesignRequestAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await DesignRequestService.getById(req.params.id);
    if (!request) {
      res.status(404).json({ success: false, message: 'Design request not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Design request fetched successfully',
      data: request,
    });
  } catch (error: any) {
    console.error('Get design request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch design request',
    });
  }
};

/**
 * PUT /api/v1/design-requests/admin/:id
 */
export const updateDesignRequestAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, adminNotes } = req.body;
    if (status === undefined && adminNotes === undefined) {
      res.status(400).json({
        success: false,
        message: 'Provide status and/or adminNotes to update',
      });
      return;
    }

    const request = await DesignRequestService.update(req.params.id, {
      status,
      adminNotes,
    });

    res.status(200).json({
      success: true,
      message: 'Design request updated successfully',
      data: request,
    });
  } catch (error: any) {
    if (error.message === 'Design request not found') {
      res.status(404).json({ success: false, message: 'Design request not found' });
      return;
    }
    console.error('Update design request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update design request',
    });
  }
};
