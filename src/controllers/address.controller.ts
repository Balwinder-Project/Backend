import { Request, Response } from 'express';
import User from '../models/user.model';
import { AddressService } from '../services/address.service';

// Helper: resolve internal MongoDB user _id from Firebase UID
async function resolveUserId(firebaseUid: string): Promise<string> {
  const user = await User.findOne({ firebaseUid });
  if (!user) throw new Error('User not found');
  return (user._id as any).toString();
}

export const getAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    const addresses = await AddressService.getUserAddresses(userId);

    res.status(200).json({
      success: true,
      message: 'Addresses fetched successfully',
      data: addresses,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch addresses' });
  }
};

export const createAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    const address = await AddressService.createAddress(userId, req.body);

    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: address,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create address' });
  }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    const address = await AddressService.updateAddress(req.params.id, userId, req.body);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: address,
    });
  } catch (error: any) {
    if (error.message === 'Address not found') {
      res.status(404).json({ success: false, message: 'Address not found' });
      return;
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to update address' });
  }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    await AddressService.deleteAddress(req.params.id, userId);

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Address not found') {
      res.status(404).json({ success: false, message: 'Address not found' });
      return;
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to delete address' });
  }
};

export const setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    const address = await AddressService.setDefault(req.params.id, userId);

    res.status(200).json({
      success: true,
      message: 'Default address updated',
      data: address,
    });
  } catch (error: any) {
    if (error.message === 'Address not found') {
      res.status(404).json({ success: false, message: 'Address not found' });
      return;
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to set default address' });
  }
};
