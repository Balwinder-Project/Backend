import { Request, Response } from 'express';
import { auth } from '../config/firebase';
import { AdminService, type DashboardRange } from '../services/admin.service';
import { ADMIN_PERMISSIONS, normalizeAdminRoles } from '../constants/adminRoles';

interface CreateAdminUserRequest {
  email: string;
  password: string;
  displayName?: string;
}

const DASHBOARD_RANGES: DashboardRange[] = ['7d', '30d', '90d'];

const listAllFirebaseUsers = async () => {
  const users = [];
  let nextPageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return users;
};

/**
 * Create a new admin user in Firebase Auth with custom claims
 * POST /api/admin/create-admin-user
 */
export const createAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName }: CreateAdminUserRequest = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
      return;
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      emailVerified: false
    });

    // Set custom claims for admin role
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      adminRoles: []
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: 'admin',
        adminRoles: []
      }
    });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    
    // Handle Firebase-specific errors
    if (error.code === 'auth/email-already-exists') {
      res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
      return;
    }

    if (error.code === 'auth/invalid-password') {
      res.status(400).json({
        success: false,
        message: 'Invalid password. Password must be at least 6 characters long'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create admin user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const listAdminPermissions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await listAllFirebaseUsers();
    const admins = users
      .filter((user) => user.customClaims?.role === 'admin')
      .map((user) => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        disabled: user.disabled,
        adminRoles: normalizeAdminRoles(user.customClaims?.adminRoles),
        createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime,
      }));

    res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error: any) {
    console.error('Error listing admin permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list admin permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateAdminPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid } = req.params;
    const { adminRoles } = req.body;

    if (!Array.isArray(adminRoles)) {
      res.status(400).json({
        success: false,
        message: 'adminRoles must be an array',
      });
      return;
    }

    const normalizedRoles = normalizeAdminRoles(adminRoles);
    if (normalizedRoles.length !== new Set(adminRoles).size) {
      res.status(400).json({
        success: false,
        message: `Invalid admin role. Allowed roles: ${ADMIN_PERMISSIONS.join(', ')}`,
      });
      return;
    }

    const userRecord = await auth.getUser(uid);
    const existingClaims = userRecord.customClaims || {};

    await auth.setCustomUserClaims(uid, {
      ...existingClaims,
      role: 'admin',
      adminRoles: normalizedRoles,
    });

    res.status(200).json({
      success: true,
      message: 'Admin permissions updated successfully',
      data: {
        uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: 'admin',
        adminRoles: normalizedRoles,
      },
    });
  } catch (error: any) {
    console.error('Error updating admin permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid } = req.params;

    if (!uid) {
      res.status(400).json({
        success: false,
        message: 'Admin UID is required',
      });
      return;
    }

    if (req.user?.uid === uid) {
      res.status(400).json({
        success: false,
        message: 'You cannot remove your own admin account',
      });
      return;
    }

    const userRecord = await auth.getUser(uid);
    if (userRecord.customClaims?.role !== 'admin') {
      res.status(400).json({
        success: false,
        message: 'Only admin accounts can be removed here',
      });
      return;
    }

    await auth.deleteUser(uid);

    res.status(200).json({
      success: true,
      message: 'Admin account removed successfully',
    });
  } catch (error: any) {
    console.error('Error deleting admin user:', error);

    if (error.code === 'auth/user-not-found') {
      res.status(404).json({
        success: false,
        message: 'Admin account not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to remove admin account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedRange = req.query.range as DashboardRange | undefined;
    const range = requestedRange && DASHBOARD_RANGES.includes(requestedRange) ? requestedRange : '30d';

    const summary = await AdminService.getDashboardSummary(range);

    res.status(200).json({
      success: true,
      message: 'Dashboard summary fetched successfully',
      data: summary,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
