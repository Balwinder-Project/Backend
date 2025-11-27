import { Router, Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import {
  getUserByUid,
  setCustomClaims,
  getDocument,
  setDocument,
} from '../utils/firebase.utils';

const router = Router();

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const userRecord = await getUserByUid(req.user.uid);

    res.json({
      success: true,
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        photoURL: userRecord.photoURL,
        disabled: userRecord.disabled,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
        },
        customClaims: userRecord.customClaims,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
    });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile from Firestore
 * @access  Private
 */
router.get('/profile', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const profile = await getDocument('users', req.user.uid);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(404).json({
      success: false,
      message: 'Profile not found',
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile in Firestore
 * @access  Private
 */
router.put('/profile', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const { displayName, photoURL, bio, phoneNumber } = req.body;

    const profileData = {
      uid: req.user.uid,
      email: req.user.email,
      displayName,
      photoURL,
      bio,
      phoneNumber,
      updatedAt: new Date().toISOString(),
    };

    await setDocument('users', req.user.uid, profileData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profileData,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
    });
  }
});

/**
 * @route   POST /api/auth/set-admin/:uid
 * @desc    Set admin role for a user
 * @access  Admin only
 */
router.post(
  '/set-admin/:uid',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.params;
      const { admin } = req.body;

      await setCustomClaims(uid, { admin: admin === true });

      res.json({
        success: true,
        message: `Admin role ${admin ? 'granted' : 'revoked'} for user ${uid}`,
      });
    } catch (error) {
      console.error('Error setting admin role:', error);
      res.status(500).json({
        success: false,
        message: 'Error setting admin role',
      });
    }
  }
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token (test endpoint)
 * @access  Private
 */
router.get('/verify', authenticateUser, (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user,
  });
});

export default router;

