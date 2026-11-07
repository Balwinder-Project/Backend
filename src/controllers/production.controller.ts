import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { auth } from '../config/firebase';
import Order from '../models/order.model';

const WORKFLOW = ['design_check', 'printing', 'cutting', 'packing', 'ready_for_dispatch'] as const;
type WorkflowStatus = typeof WORKFLOW[number];

const isProductionStaff = (req: Request) => req.user?.role === 'production_staff';

const staffSafeOrder = (order: any) => ({
  id: String(order._id),
  orderNumber: order.orderNumber,
  createdAt: order.createdAt,
  status: order.status,
  items: (order.items || []).map((item: any) => {
    const product = item.productId && typeof item.productId === 'object' ? item.productId : null;
    return {
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      variant: item.variant,
      previewImage: product?.images?.[0] || product?.designImage || null,
    };
  }),
  customer: {
    name: order.shippingAddress?.name || '',
    phone: order.shippingAddress?.phone || '',
    addressLine1: order.shippingAddress?.addressLine1 || '',
    addressLine2: order.shippingAddress?.addressLine2 || '',
    city: order.shippingAddress?.city || '',
    state: order.shippingAddress?.state || '',
    pincode: order.shippingAddress?.pincode || '',
    country: order.shippingAddress?.country || '',
  },
  production: {
    workflowStatus: order.productionAssignment?.workflowStatus || 'design_check',
    remarks: order.productionAssignment?.remarks || '',
    updatedAt: order.productionAssignment?.updatedAt || order.productionAssignment?.assignedAt || null,
    history: (order.productionAssignment?.history || []).map((entry: any) => ({
      status: entry.status, changedAt: entry.changedAt, remarks: entry.remarks || '',
    })),
  },
});

export const listProductionStaff = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await auth.listUsers(1000);
    const staff = result.users
      .filter(user => user.customClaims?.role === 'production_staff')
      .map(user => ({
        uid: user.uid, email: user.email, displayName: user.displayName,
        disabled: user.disabled, createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime,
      }));
    res.status(200).json({ success: true, data: staff });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to list production staff' });
  }
};

export const createProductionStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').trim();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || password.length < 8 || displayName.length < 2) {
      res.status(400).json({ success: false, message: 'Enter a valid email, a name (at least 2 characters), and a password of at least 8 characters.' });
      return;
    }
    const user = await auth.createUser({ email, password, displayName, emailVerified: false });
    await auth.setCustomUserClaims(user.uid, { role: 'production_staff' });
    res.status(201).json({ success: true, message: 'Production staff account created.', data: { uid: user.uid, email: user.email, displayName: user.displayName, disabled: false } });
  } catch (error: any) {
    const status = error.code === 'auth/email-already-exists' ? 409 : 500;
    res.status(status).json({ success: false, message: error.code === 'auth/email-already-exists' ? 'An account with this email already exists.' : 'Could not create production staff account.' });
  }
};

export const deleteProductionStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid } = req.params;
    const user = await auth.getUser(uid);
    if (user.customClaims?.role !== 'production_staff') {
      res.status(404).json({ success: false, message: 'Production staff account not found.' });
      return;
    }
    await auth.updateUser(uid, { disabled: true });
    await auth.setCustomUserClaims(uid, { role: 'production_staff_disabled' });
    res.status(200).json({ success: true, message: 'Production staff account deactivated.' });
  } catch (error: any) {
    res.status(error.code === 'auth/user-not-found' ? 404 : 500).json({ success: false, message: 'Could not deactivate production staff account.' });
  }
};

export const assignProductionOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const staffUid = String(req.body?.staffUid || '');
    if (!mongoose.Types.ObjectId.isValid(orderId) || !staffUid) {
      res.status(400).json({ success: false, message: 'A valid order and staff account are required.' });
      return;
    }
    const staff = await auth.getUser(staffUid);
    if (staff.disabled || staff.customClaims?.role !== 'production_staff') {
      res.status(400).json({ success: false, message: 'Select an active production staff account.' });
      return;
    }
    const order: any = await Order.findById(orderId);
    if (!order) { res.status(404).json({ success: false, message: 'Order not found.' }); return; }
    const now = new Date();
    const priorHistory = order.productionAssignment?.history || [];
    order.productionAssignment = {
      staffUid, staffName: staff.displayName || staff.email || 'Production Staff',
      staffEmail: staff.email || '', assignedBy: req.user?.uid || '',
      assignedAt: now, workflowStatus: 'design_check', updatedAt: now,
      history: [...priorHistory, { status: 'assigned', changedBy: req.user?.uid || '', changedAt: now }],
    };
    await order.save();
    res.status(200).json({ success: true, message: 'Order assigned to production staff.', data: { orderId: String(order._id), staffUid, staffName: order.productionAssignment.staffName, workflowStatus: 'design_check' } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to assign order.' });
  }
};

export const getAssignedProductionOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isProductionStaff(req)) { res.status(403).json({ success: false, message: 'Production staff access required.' }); return; }
    const orders = await Order.find({ 'productionAssignment.staffUid': req.user!.uid })
      .populate({ path: 'items.productId', select: 'images designImage' })
      .sort({ 'productionAssignment.updatedAt': -1, createdAt: -1 })
      .limit(200);
    res.status(200).json({ success: true, data: orders.map(staffSafeOrder) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load assigned production orders.' });
  }
};

export const updateProductionProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isProductionStaff(req)) { res.status(403).json({ success: false, message: 'Production staff access required.' }); return; }
    const { orderId } = req.params;
    const workflowStatus = req.body?.workflowStatus as WorkflowStatus;
    const remarks = String(req.body?.remarks || '').trim().slice(0, 1000);
    if (!mongoose.Types.ObjectId.isValid(orderId) || !WORKFLOW.includes(workflowStatus)) {
      res.status(400).json({ success: false, message: 'Choose a valid production stage.' }); return;
    }
    const order: any = await Order.findOne({ _id: orderId, 'productionAssignment.staffUid': req.user!.uid });
    if (!order) { res.status(404).json({ success: false, message: 'Assigned order not found.' }); return; }
    const now = new Date();
    order.productionAssignment.workflowStatus = workflowStatus;
    order.productionAssignment.updatedAt = now;
    order.productionAssignment.remarks = remarks;
    order.productionAssignment.history.push({ status: workflowStatus, changedBy: req.user!.uid, changedAt: now, remarks });
    await order.save();
    res.status(200).json({ success: true, message: 'Production progress updated.', data: { orderId: String(order._id), workflowStatus, updatedAt: now, remarks } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Could not update production progress.' });
  }
};
