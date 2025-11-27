import { auth } from '../config/firebase';
import Retailer, { IRetailer } from '../models/retailer.model';

interface CreateRetailerData {
  name: string;
  city: string;
  state: string;
  pincode: string;
  email: string;
  phone: string;
  password: string;
}

interface UpdateRetailerData {
  name?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export class RetailerService {
  /**
   * Create a new retailer in Firebase Auth and MongoDB
   */
  static async createRetailer(data: CreateRetailerData): Promise<IRetailer> {
    let firebaseUid: string | null = null;

    try {
      // Create user in Firebase Auth
      const userRecord = await auth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.name,
        emailVerified: false
      });

      firebaseUid = userRecord.uid;

      // Set custom claims for retailer role
      await auth.setCustomUserClaims(userRecord.uid, {
        role: 'retailer'
      });

      // Create retailer in MongoDB
      const retailer = await Retailer.create({
        name: data.name,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        email: data.email,
        phone: data.phone,
        firebaseUid: userRecord.uid
      });

      return retailer;
    } catch (error: any) {
      // Rollback: Delete Firebase user if MongoDB creation fails
      if (firebaseUid) {
        try {
          await auth.deleteUser(firebaseUid);
        } catch (deleteError) {
          console.error('Failed to rollback Firebase user:', deleteError);
        }
      }

      throw error;
    }
  }

  /**
   * Get all retailers with pagination
   */
  static async getAllRetailers(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ retailers: IRetailer[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    // Build search query
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const [retailers, total] = await Promise.all([
      Retailer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Retailer.countDocuments(query)
    ]);

    return {
      retailers,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get retailer by ID
   */
  static async getRetailerById(id: string): Promise<IRetailer | null> {
    return await Retailer.findById(id);
  }

  /**
   * Get retailer by Firebase UID
   */
  static async getRetailerByFirebaseUid(firebaseUid: string): Promise<IRetailer | null> {
    return await Retailer.findOne({ firebaseUid });
  }

  /**
   * Update retailer
   */
  static async updateRetailer(id: string, data: UpdateRetailerData): Promise<IRetailer | null> {
    const retailer = await Retailer.findById(id);
    
    if (!retailer) {
      return null;
    }

    try {
      // Update Firebase Auth user if email or password changed
      const firebaseUpdates: any = {};
      
      if (data.email && data.email !== retailer.email) {
        firebaseUpdates.email = data.email;
      }
      
      if (data.password) {
        firebaseUpdates.password = data.password;
      }
      
      if (data.name) {
        firebaseUpdates.displayName = data.name;
      }

      if (Object.keys(firebaseUpdates).length > 0) {
        await auth.updateUser(retailer.firebaseUid, firebaseUpdates);
      }

      // Update MongoDB document
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.city) updateData.city = data.city;
      if (data.state) updateData.state = data.state;
      if (data.pincode) updateData.pincode = data.pincode;
      if (data.email) updateData.email = data.email;
      if (data.phone) updateData.phone = data.phone;

      const updatedRetailer = await Retailer.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      return updatedRetailer;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Delete retailer from both Firebase Auth and MongoDB
   */
  static async deleteRetailer(id: string): Promise<boolean> {
    const retailer = await Retailer.findById(id);
    
    if (!retailer) {
      return false;
    }

    try {
      // Delete from Firebase Auth
      await auth.deleteUser(retailer.firebaseUid);
      
      // Delete from MongoDB
      await Retailer.findByIdAndDelete(id);
      
      return true;
    } catch (error: any) {
      // If Firebase deletion fails but user doesn't exist, still delete from MongoDB
      if (error.code === 'auth/user-not-found') {
        await Retailer.findByIdAndDelete(id);
        return true;
      }
      
      throw error;
    }
  }
}

