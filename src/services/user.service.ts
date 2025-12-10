import { auth } from '../config/firebase';
import User, { IUser } from '../models/user.model';
import { WalletService } from './wallet.service';

interface CreateUserFromGoogleData {
  firebaseUid: string;
  email: string;
  name: string;
  profilePicture?: string;
}

interface UpdateUserData {
  name?: string;
  email?: string;
  profilePicture?: string;
}

export class UserService {
  /**
   * Create or get user from Google sign-in
   * Auto-creates user in MongoDB if doesn't exist
   */
  static async createOrGetUserFromGoogle(data: CreateUserFromGoogleData): Promise<IUser> {
    try {
      // Check if user already exists
      let user = await User.findOne({ firebaseUid: data.firebaseUid });
      
      if (user) {
        // Update user info if changed (Google profile might have been updated)
        const updates: any = {};
        if (data.name && data.name !== user.name) updates.name = data.name;
        if (data.email && data.email !== user.email) updates.email = data.email;
        if (data.profilePicture && data.profilePicture !== user.profilePicture) {
          updates.profilePicture = data.profilePicture;
        }
        
        if (Object.keys(updates).length > 0) {
          user = await User.findByIdAndUpdate(
            user._id,
            updates,
            { new: true, runValidators: true }
          );
        }
        
        return user!;
      }

      // Set custom claims for user role in Firebase
      await auth.setCustomUserClaims(data.firebaseUid, {
        role: 'user'
      });

      // Create new user in MongoDB
      user = await User.create({
        name: data.name,
        email: data.email,
        profilePicture: data.profilePicture,
        firebaseUid: data.firebaseUid,
        role: 'user'
      });

      // Create wallet for the new user
      try {
        await WalletService.createWallet({
          ownerId: user._id.toString(),
          ownerType: 'user'
        });
      } catch (walletError) {
        console.error('Failed to create wallet for user:', walletError);
        // Don't fail user creation if wallet creation fails
        // Wallet can be created manually later if needed
      }

      return user;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get all users with pagination
   */
  static async getAllUsers(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ users: IUser[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    // Build search query
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<IUser | null> {
    return await User.findById(id);
  }

  /**
   * Get user by Firebase UID
   */
  static async getUserByFirebaseUid(firebaseUid: string): Promise<IUser | null> {
    return await User.findOne({ firebaseUid });
  }

  /**
   * Update user
   */
  static async updateUser(id: string, data: UpdateUserData): Promise<IUser | null> {
    const user = await User.findById(id);
    
    if (!user) {
      return null;
    }

    try {
      // Update Firebase Auth user if email or name changed
      const firebaseUpdates: any = {};
      
      if (data.email && data.email !== user.email) {
        firebaseUpdates.email = data.email;
      }
      
      if (data.name) {
        firebaseUpdates.displayName = data.name;
      }

      if (data.profilePicture) {
        firebaseUpdates.photoURL = data.profilePicture;
      }

      if (Object.keys(firebaseUpdates).length > 0) {
        await auth.updateUser(user.firebaseUid, firebaseUpdates);
      }

      // Update MongoDB document
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.email) updateData.email = data.email;
      if (data.profilePicture) updateData.profilePicture = data.profilePicture;

      const updatedUser = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      return updatedUser;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Delete user from both Firebase Auth and MongoDB
   */
  static async deleteUser(id: string): Promise<boolean> {
    const user = await User.findById(id);
    
    if (!user) {
      return false;
    }

    try {
      // Delete from Firebase Auth
      await auth.deleteUser(user.firebaseUid);
      
      // Delete from MongoDB
      await User.findByIdAndDelete(id);
      
      return true;
    } catch (error: any) {
      // If Firebase deletion fails but user doesn't exist, still delete from MongoDB
      if (error.code === 'auth/user-not-found') {
        await User.findByIdAndDelete(id);
        return true;
      }
      
      throw error;
    }
  }
}

