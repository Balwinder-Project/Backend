import { Router, Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import {
  getUserByUid,
  getUserByEmail,
  setCustomClaims,
  getDocument,
  setDocument,
} from '../utils/firebase.utils';
import { googleSignIn } from '../controllers/user.controller';
import { validateRequest } from '../middleware/validateRequest';
import { googleSignInValidator } from '../validators/user.validator';

const router = Router();

/**
 * @route   POST /api/v1/auth/google-signin
 * @desc    Google sign-in - create or get user
 * @access  Public
 */
router.post('/google-signin', googleSignInValidator, validateRequest, googleSignIn);

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
 * @desc    Grant or revoke admin role for a user
 * @access  Admin only
 */
router.post(
  '/set-admin/:uid',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.params;
      const { grant } = req.body;

      await setCustomClaims(uid, grant !== false ? { role: 'admin', adminRoles: [] } : {});

      res.json({
        success: true,
        message: `Admin role ${grant !== false ? 'granted' : 'revoked'} for user ${uid}`,
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
 * @route   POST /api/auth/bootstrap-admin
 * @desc    One-time bootstrap: grant admin to a UID using a server secret.
 *          Set ADMIN_BOOTSTRAP_SECRET in .env. Keep this secret — do not expose publicly.
 * @access  Public (secret-gated)
 */
router.post('/bootstrap-admin', async (req: Request, res: Response) => {
  try {
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!secret) {
      res.status(503).json({ success: false, message: 'Bootstrap not configured' });
      return;
    }

    const { uid, email, bootstrapSecret } = req.body;

    if ((!uid && !email) || bootstrapSecret !== secret) {
      res.status(403).json({ success: false, message: 'Invalid bootstrap secret' });
      return;
    }

    const userRecord = email ? await getUserByEmail(email) : await getUserByUid(uid);

    await setCustomClaims(userRecord.uid, { role: 'admin', adminRoles: [] });

    res.json({ success: true, message: `Admin role granted to ${userRecord.email || userRecord.uid}` });
  } catch (error) {
    console.error('Bootstrap admin error:', error);
    res.status(500).json({ success: false, message: 'Failed to bootstrap admin' });
  }
});

/**
 * @route   POST /api/auth/bootstrap-owner
 * @desc    One-time bootstrap: grant OWNER admin role to a UID using a server secret.
 *          Set ADMIN_BOOTSTRAP_SECRET in .env. Keep this secret — do not expose publicly.
 * @access  Public (secret-gated)
 */
router.post('/bootstrap-owner', async (req: Request, res: Response) => {
  try {
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!secret) {
      res.status(503).json({ success: false, message: 'Bootstrap not configured' });
      return;
    }

    const { email, bootstrapSecret } = req.body;

    if (!email || bootstrapSecret !== secret) {
      res.status(403).json({ success: false, message: 'Invalid bootstrap secret' });
      return;
    }

    const userRecord = await getUserByEmail(email);

    await setCustomClaims(userRecord.uid, { role: 'admin', adminRoles: ['OWNER'] });

    res.json({
      success: true,
      message: `OWNER role granted to ${userRecord.email || userRecord.uid}`,
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        role: 'admin',
        adminRoles: ['OWNER'],
      },
    });
  } catch (error) {
    console.error('Bootstrap owner error:', error);
    res.status(500).json({ success: false, message: 'Failed to bootstrap owner' });
  }
});

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
