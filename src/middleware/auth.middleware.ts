import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../utils/firebase.utils';
import {
  AdminPermission,
  hasAdminPermission,
  hasAnyAdminPermission,
} from '../constants/adminRoles';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * Middleware to verify Firebase authentication token
 * Expects token in Authorization header as "Bearer <token>"
 */
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
      return;
    }

    // Extract token
    const token = authHeader.split('Bearer ')[1];

    // Verify token
    const decodedToken = await verifyIdToken(token);

    // Attach user info to request
    req.user = {
      ...decodedToken,
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Middleware to verify user has specific custom claims
 * @param requiredClaims - Object with required claim keys and values
 */
export const requireClaims = (requiredClaims: Record<string, any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if user has all required claims with matching values
      const hasRequiredClaims = Object.entries(requiredClaims).every(
        ([key, value]) => req.user && req.user[key] === value
      );

      if (!hasRequiredClaims) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(403).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = requireClaims({ role: 'admin' });

export const requireAdminPermission = (permission: AdminPermission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!hasAdminPermission(req.user, permission)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(403).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};

export const requireAnyAdminPermission = (permissions: AdminPermission[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!hasAnyAdminPermission(req.user, permissions)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(403).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};
