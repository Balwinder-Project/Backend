import { Request, Response } from 'express';
import User from '../models/user.model';
import { AddressService } from '../services/address.service';

// Resolve the internal MongoDB user id from the verified Firebase user.
// Some Firebase users (especially email/password users) may not have a
// MongoDB User document yet, so create/sync it automatically before saving
// or loading an address.
async function resolveUserId(req: Request): Promise<string> {
  const firebaseUid = req.user!.uid;
  const email = req.user!.email;

  let user = await User.findOne({ firebaseUid });

  if (!user) {
    if (!email) {
      throw new Error('Authenticated user email is missing');
    }

    const name = String(req.user!.name || email.split('@')[0] || 'User').trim();
    const profilePicture = req.user!.picture || req.user!.photoURL;

    user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        $set: {
          firebaseUid,
          name,
          ...(profilePicture ? { profilePicture } : {}),
        },
        $setOnInsert: {
          role: 'user',
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );
  }

  if (!user) throw new Error('Unable to create or find user');
  return (user._id as any).toString();
}

export const getAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const addresses = await AddressService.getUserAddresses(userId);

    res.status(200).json({
      success: true,
      message: 'Addresses fetched successfully',
      data: addresses,
    });
  } catch (error: any) {
    console.error('Get addresses error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch addresses' });
  }
};

export const createAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    const address = await AddressService.createAddress(userId, req.body);

    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: address,
    });
  } catch (error: any) {
    console.error('Create address error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create address' });
  }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
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
    console.error('Update address error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update address' });
  }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
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
    console.error('Delete address error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete address' });
  }
};

export const setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
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
    console.error('Set default address error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to set default address' });
  }
};