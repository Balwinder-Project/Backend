import Address, { IAddress } from '../models/address.model';

interface CreateAddressData {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  type?: 'home' | 'office' | 'other';
  isDefault?: boolean;
}

type UpdateAddressData = Partial<CreateAddressData>;

export class AddressService {
  static async getUserAddresses(userId: string): Promise<IAddress[]> {
    return Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
  }

  static async createAddress(userId: string, data: CreateAddressData): Promise<IAddress> {
    if (data.isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    const [address] = await Address.create([{ userId, ...data }]);
    return address;
  }

  static async updateAddress(id: string, userId: string, data: UpdateAddressData): Promise<IAddress> {
    if (data.isDefault) {
      await Address.updateMany({ userId, _id: { $ne: id } }, { isDefault: false });
    }

    const address = await Address.findOneAndUpdate(
      { _id: id, userId },
      data,
      { new: true, runValidators: true }
    );

    if (!address) {
      throw new Error('Address not found');
    }

    return address;
  }

  static async deleteAddress(id: string, userId: string): Promise<void> {
    const address = await Address.findOneAndDelete({ _id: id, userId });

    if (!address) {
      throw new Error('Address not found');
    }
  }

  static async setDefault(id: string, userId: string): Promise<IAddress> {
    await Address.updateMany({ userId }, { isDefault: false });

    const address = await Address.findOneAndUpdate(
      { _id: id, userId },
      { isDefault: true },
      { new: true }
    );

    if (!address) {
      throw new Error('Address not found');
    }

    return address;
  }
}
