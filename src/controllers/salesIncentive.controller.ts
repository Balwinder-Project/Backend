import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Salesman from '../models/salesman.model';
import IncentiveLedgerEntry from '../models/incentiveLedger.model';
import Retailer from '../models/retailer.model';

const fail = (res: Response, error: unknown, message: string) => {
  console.error(message, error);
  res.status(500).json({ success: false, message });
};

export const listSalesmen = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const filter: Record<string, any> = {};
    if (search) {
      // Escape regular-expression metacharacters so searches are literal and predictable.
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\      const safeSearch = search.split('').map((char) => '.+?^${}()|[]\\'.includes(char) ? '\\' + char : char).join('');');
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
  try {
    const { name, email, phone, registrationIncentiveMode, registrationIncentiveValue, orderIncentiveMode, orderIncentiveValue } = req.body;
    if (!name || !email || !phone) { res.status(400).json({ success: false, message: 'Name, email and phone are required' }); return; }
    const salesman = await Salesman.create({ name, email, phone, registrationIncentiveMode, registrationIncentiveValue, orderIncentiveMode, orderIncentiveValue });
    res.status(201).json({ success: true, data: salesman });
  } catch (error: any) {
    if (error?.code === 11000) { res.status(409).json({ success: false, message: 'A salesman with this email or phone already exists' }); return; }
    if (error?.name === 'ValidationError') { res.status(400).json({ success: false, message: error.message }); return; }
    fail(res, error, 'Failed to create salesman');
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
