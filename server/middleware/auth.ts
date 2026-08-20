import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../firebaseAdmin';

export interface AuthenticatedRequest extends Request {
  user?: any; // Décoded token
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // First, verify token
  requireAuth(req, res, () => {
    // Then check claims
    if (req.user && (req.user.role === 'admin' || req.user.superAdmin)) {
      next();
    } else {
      return res.status(403).json({ success: false, error: 'Forbidden: Requires admin privileges' });
    }
  });
};
