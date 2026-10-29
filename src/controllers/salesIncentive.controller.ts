import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { auth } from '../config/firebase';
import Salesman from '../models/salesman.model';
import IncentiveLedgerEntry from '../models/incentiveLedger.model';
import Retailer from '../models/retailer.model';

const fail = (res: Response, error: unknown, message: string) => {
  console.error(message, error);
  res.status(500).json({ success: false, message });
};

/**
 * Exchange a verified phone-auth session for the existing salesman account.
 * The phone token proves possession of the number; the database mapping chooses
 * the pre-provisioned salesman UID so incentive records remain attached to it.
 */
export const exchangeSalesmanPhoneToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const phoneIdToken = String(req.body?.phoneIdToken || '').trim();
    if (!phoneIdToken) {
      res.status(400).json({ success: false, message: 'A verified phone sign-in token is required' });
      return;
    }

    const decoded = await auth.verifyIdToken(phoneIdToken);
    const verifiedPhone = String(decoded.phone_number || '');
    const verifiedDigits = verifiedPhone.replace(/\D/g, '').slice(-10);
    if (!verifiedDigits || verifiedDigits.length !== 10) {
      res.status(401).json({ success: false, message: 'A verified Indian mobile number is required' });
      return;
    }

    const salesman = await Salesman.findOne({ phone: verifiedDigits, status: 'active' }).select('firebaseUid');
    if (!salesman?.firebaseUid) {
      res.status(403).json({ success: false, message: 'No active salesman account is linked to this mobile number. Contact the administrator.' });
      return;
    }

    const customToken = await auth.createCustomToken(salesman.firebaseUid, { role: 'salesman' });
    res.json({ success: true, customToken });
  } catch (error: any) {
    if (error?.code === 'auth/argument-error' || error?.code === 'auth/id-token-expired' || error?.code === 'auth/invalid-id-token') {
      res.status(401).json({ success: false, message: 'Phone verification expired. Please request a new OTP.' });
      return;
    }
    fail(res, error, 'Phone sign-in could not be completed');
  }
};

export const listSalesmen = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const filter: Record<string, any> = {};
    if (search) {
      // Escape regular-expression metacharacters so searches are literal and predictable.
      const safeSearch = search.split('').map((char) => '.+?^${}()|[]\\'.includes(char) ? '\\' + char : char).join('');
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    const [salesmen, total] = await Promise.all([
      Salesman.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Salesman.countDocuments(filter),
    ]);
    const ids = salesmen.map((s: any) => s._id);
    const ledger = await IncentiveLedgerEntry.aggregate([
      { $match: { salesmanId: { $in: ids } } },
      { $group: { _id: '$salesmanId', earned: { $sum: { $cond: [{ $in: ['$status', ['approved', 'payable', 'paid']] }, '$amount', 0] } }, payable: { $sum: { $cond: [{ $eq: ['$status', 'payable'] }, '$amount', 0] } }, paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } }, orders: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'order'] }, { $in: ['$status', ['payable', 'paid']] }] }, 1, 0] } }, wholesalers: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'wholesaler_registration'] }, { $ne: ['$status', 'reversed'] }] }, 1, 0] } } } },
    ]);
    const totals = new Map(ledger.map((x: any) => [String(x._id), x]));
    res.json({ success: true, data: salesmen.map((s: any) => {
      const t: any = totals.get(String(s._id)) || {};
      return { id: String(s._id), name: s.name, email: s.email, phone: s.phone, status: s.status, earnedAmount: t.earned || 0, payableAmount: t.payable || 0, paidAmount: t.paid || 0, eligibleOrderCount: t.orders || 0, wholesalerCount: t.wholesalers || 0 };
    }), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { fail(res, error, 'Failed to list salesmen'); }
};

export const createSalesman = async (req: Request, res: Response): Promise<void> => {
  let firebaseUid: string | undefined;
  let salesmanId: mongoose.Types.ObjectId | undefined;
  try {
    const { name, email, phone, registrationIncentiveMode, registrationIncentiveValue, orderIncentiveMode, orderIncentiveValue } = req.body;
    if (!String(name || '').trim() || !String(email || '').trim() || !String(phone || '').trim()) {
      res.status(400).json({ success: false, message: 'Name, email and phone are required' }); return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ success: false, message: 'Enter a valid email address' }); return;
    }
    // Create a random, undisclosed password and require the salesman to set their own.
    const temporaryPassword = randomBytes(24).toString('base64url') + 'aA1!';
    const user = await auth.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      displayName: String(name).trim(),
      emailVerified: false,
      disabled: false,
    });
    firebaseUid = user.uid;
    await auth.setCustomUserClaims(user.uid, { role: 'salesman' });
    const salesman = await Salesman.create({
      name, email: normalizedEmail, phone, firebaseUid: user.uid,
      registrationIncentiveMode, registrationIncentiveValue,
      orderIncentiveMode, orderIncentiveValue,
    });
    salesmanId = salesman._id as mongoose.Types.ObjectId;
    const passwordSetupLink = await auth.generatePasswordResetLink(normalizedEmail);
    res.status(201).json({
      success: true,
      message: 'Salesman profile and login created. Share the password setup link securely with the salesman.',
      data: { ...salesman.toJSON(), passwordSetupLink },
    });
  } catch (error: any) {
    // Roll back partially provisioned records so retries cannot leave orphan accounts.
    if (salesmanId) {
      try { await Salesman.findByIdAndDelete(salesmanId); } catch (rollbackError) { console.error('Salesman profile rollback failed', rollbackError); }
    }
    if (firebaseUid) {
      try { await auth.deleteUser(firebaseUid); } catch (rollbackError) { console.error('Salesman Firebase rollback failed', rollbackError); }
    }
    if (error?.code === 11000) { res.status(409).json({ success: false, message: 'A salesman with this email or phone already exists' }); return; }
    if (error?.code === 'auth/email-already-exists') { res.status(409).json({ success: false, message: 'An account with this email already exists in Firebase' }); return; }
    if (error?.code?.startsWith?.('auth/')) { res.status(400).json({ success: false, message: 'Could not provision the salesman login. Check Firebase Auth configuration and authorized domains.' }); return; }
    if (error?.name === 'ValidationError') { res.status(400).json({ success: false, message: error.message }); return; }
    fail(res, error, 'Failed to create salesman and login');
  }
};

export const updateSalesman = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid salesman ID' }); return; }
    const allowed = ['name', 'email', 'phone', 'status', 'registrationIncentiveMode', 'registrationIncentiveValue', 'orderIncentiveMode', 'orderIncentiveValue'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
    const salesman = await Salesman.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!salesman) { res.status(404).json({ success: false, message: 'Salesman not found' }); return; }
    res.json({ success: true, data: salesman });
  } catch (error: any) {
    if (error?.code === 11000) { res.status(409).json({ success: false, message: 'Email or phone already exists' }); return; }
    if (error?.name === 'ValidationError') { res.status(400).json({ success: false, message: error.message }); return; }
    fail(res, error, 'Failed to update salesman');
  }
};

export const getSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalSalesmen, activeSalesmen, wholesalersAttributed, eligibleOrders, grouped] = await Promise.all([
      Salesman.countDocuments(),
      Salesman.countDocuments({ status: 'active' }),
      IncentiveLedgerEntry.countDocuments({ type: 'wholesaler_registration', status: { $ne: 'reversed' } }),
      // Only delivered/payable or paid orders are eligible; pending orders are not yet eligible.
      IncentiveLedgerEntry.countDocuments({ type: 'order', status: { $in: ['payable', 'paid'] } }),
      IncentiveLedgerEntry.aggregate([{ $group: { _id: '$status', amount: { $sum: '$amount' } } }]),
    ]);
    const amounts = new Map(grouped.map((x: any) => [x._id, x.amount]));
    const earnedAmount = (amounts.get('approved') || 0) + (amounts.get('payable') || 0) + (amounts.get('paid') || 0);
    res.json({ success: true, data: { totalSalesmen, activeSalesmen, wholesalersAttributed, eligibleOrders, earnedAmount, payableAmount: amounts.get('payable') || 0, paidAmount: amounts.get('paid') || 0 } });
  } catch (error) { fail(res, error, 'Failed to load incentive summary'); }
};

export const listLedger = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter: Record<string, any> = {};
    if (req.query.salesmanId) {
      if (!mongoose.isValidObjectId(String(req.query.salesmanId))) { res.status(400).json({ success: false, message: 'Invalid salesman ID' }); return; }
      filter.salesmanId = req.query.salesmanId;
    }
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.type) filter.type = String(req.query.type);
    const [data, total] = await Promise.all([
      IncentiveLedgerEntry.find(filter).populate('salesmanId', 'name email phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      IncentiveLedgerEntry.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { fail(res, error, 'Failed to load incentive ledger'); }
};

export const updateLedgerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, reason, payoutReference } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid ledger entry ID' }); return; }
    if (typeof status !== 'string' || !['pending', 'approved', 'payable', 'paid', 'reversed'].includes(status)) { res.status(400).json({ success: false, message: 'Invalid incentive status' }); return; }
    if (status === 'reversed' && !String(reason || '').trim()) { res.status(400).json({ success: false, message: 'A reason is required to reverse an incentive' }); return; }
    if (status === 'paid' && !String(payoutReference || '').trim()) { res.status(400).json({ success: false, message: 'Payout reference is required before marking an incentive paid' }); return; }
    const entry = await IncentiveLedgerEntry.findById(req.params.id);
    if (!entry) { res.status(404).json({ success: false, message: 'Ledger entry not found' }); return; }
    if (entry.status === status) { res.json({ success: true, data: entry, message: 'Incentive already has this status' }); return; }
    if (entry.status === 'paid' || entry.status === 'reversed') { res.status(409).json({ success: false, message: 'Paid and reversed entries are immutable; create an audited adjustment instead' }); return; }

    // Explicit transition allow-list prevents an admin action from resetting a paid
    // entry, paying a pending order, or manually marking an undelivered order payable.
    const allowedTransitions: Record<string, string[]> = entry.type === 'order'
      ? { pending: ['reversed'], payable: ['paid', 'reversed'] }
      : { pending: ['approved', 'reversed'], approved: ['paid', 'reversed'] };
    if (!(allowedTransitions[entry.status] || []).includes(status)) {
      res.status(409).json({
        success: false,
        message: entry.type === 'order'
          ? 'Order incentives can only be paid after delivery makes them payable; pending orders may only be reversed'
          : 'Registration incentives must be approved before payout',
      });
      return;
    }
    entry.status = status;
    if (status === 'paid') { entry.payoutReference = String(payoutReference).trim(); entry.paidAt = new Date(); }
    if (reason) entry.description = [entry.description, 'Admin adjustment: ' + String(reason).trim()].filter(Boolean).join(' | ').slice(0, 500);
    await entry.save();
    res.json({ success: true, data: entry });
  } catch (error) { fail(res, error, 'Failed to update incentive entry'); }
};

export const assignWholesalerToSalesman = async (req: Request, res: Response): Promise<void> => {
  try {
    const { retailerId, salesmanId } = req.body as { retailerId: string; salesmanId: string };
    if (!mongoose.isValidObjectId(retailerId) || !mongoose.isValidObjectId(salesmanId)) {
      res.status(400).json({ success: false, message: 'Valid wholesaler and salesman IDs are required' }); return;
    }
    const [retailer, salesman] = await Promise.all([
      Retailer.findById(retailerId),
      Salesman.findOne({ _id: salesmanId, status: 'active' }),
    ]);
    if (!retailer) { res.status(404).json({ success: false, message: 'Wholesaler not found' }); return; }
    if (!salesman) { res.status(404).json({ success: false, message: 'Active salesman not found' }); return; }
    if (retailer.referredBySalesmanId && String(retailer.referredBySalesmanId) !== salesmanId) {
      res.status(409).json({ success: false, message: 'Wholesaler is already attributed to another salesman' }); return;
    }
    retailer.referredBySalesmanId = new mongoose.Types.ObjectId(salesmanId);
    await retailer.save();
    await IncentiveLedgerEntry.updateOne(
      { idempotencyKey: `registration:${String(retailer._id)}` },
      { $setOnInsert: {
        salesmanId: salesman._id,
        type: 'wholesaler_registration',
        status: 'approved',
        retailerId: retailer._id,
        amount: salesman.registrationIncentiveValue,
        idempotencyKey: `registration:${String(retailer._id)}`,
        description: 'Approved wholesaler referral incentive',
      } },
      { upsert: true },
    );
    retailer.referralIncentiveGrantedAt = new Date();
    await retailer.save();
    res.json({ success: true, message: 'Wholesaler attributed and registration incentive recorded', data: { retailerId, salesmanId } });
  } catch (error) { fail(res, error, 'Failed to assign wholesaler to salesman'); }
};


/** Salesman-scoped dashboard endpoints. Every query is restricted to the authenticated Firebase UID. */
const getAuthenticatedSalesman = async (uid: string) =>
  Salesman.findOne({ firebaseUid: uid, status: 'active' });

export const getMySalesmanSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const salesman = await getAuthenticatedSalesman(req.user!.uid);
    if (!salesman) { res.status(403).json({ success: false, message: 'Active salesman profile not found' }); return; }
    const [wholesalersAttributed, eligibleOrders, grouped] = await Promise.all([
      Retailer.countDocuments({ referredBySalesmanId: salesman._id }),
      IncentiveLedgerEntry.countDocuments({ salesmanId: salesman._id, type: 'order', status: { $in: ['payable', 'paid'] } }),
      IncentiveLedgerEntry.aggregate([
        { $match: { salesmanId: salesman._id } },
        { $group: { _id: '$status', amount: { $sum: '$amount' } } },
      ]),
    ]);
    const amounts = new Map(grouped.map((item: any) => [item._id, item.amount]));
    res.json({ success: true, data: {
      name: salesman.name,
      wholesalersAttributed,
      eligibleOrders,
      earnedAmount: (amounts.get('approved') || 0) + (amounts.get('payable') || 0) + (amounts.get('paid') || 0),
      payableAmount: amounts.get('payable') || 0,
      paidAmount: amounts.get('paid') || 0,
    } });
  } catch (error) { fail(res, error, 'Failed to load salesman dashboard'); }
};

export const getMySalesmanLedger = async (req: Request, res: Response): Promise<void> => {
  try {
    const salesman = await getAuthenticatedSalesman(req.user!.uid);
    if (!salesman) { res.status(403).json({ success: false, message: 'Active salesman profile not found' }); return; }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter: Record<string, unknown> = { salesmanId: salesman._id };
    if (req.query.status) filter.status = String(req.query.status);
    const [data, total] = await Promise.all([
      IncentiveLedgerEntry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      IncentiveLedgerEntry.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { fail(res, error, 'Failed to load salesman ledger'); }
};

export const getMySalesmanWholesalers = async (req: Request, res: Response): Promise<void> => {
  try {
    const salesman = await getAuthenticatedSalesman(req.user!.uid);
    if (!salesman) { res.status(403).json({ success: false, message: 'Active salesman profile not found' }); return; }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter = { referredBySalesmanId: salesman._id };
    const [data, total] = await Promise.all([
      Retailer.find(filter).select('name email phone city state createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Retailer.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { fail(res, error, 'Failed to load referred wholesalers'); }
};
