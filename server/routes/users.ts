import { Router, Response } from 'express';
import { adminAuth, adminDb } from '../firebaseAdmin';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.post('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, nom, login, password, role } = req.body;

  if (!tenantId || !nom || !login || !password || !role) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Isolation check: An admin can only create users for their own tenant
  if (!req.user?.superAdmin && req.user?.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cannot create user for another tenant' });
  }

  try {
    // 1. Create Firebase Auth User
    const userRecord = await adminAuth.createUser({
      email: login,
      password: password,
      displayName: nom,
    });

    // 2. Set Custom Claims
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      tenantId: tenantId,
      role: role
    });

    // 3. Create UI Profile in Firestore
    const userProfile = {
      nom,
      login,
      role,
      statut: "Actif"
    };

    await adminDb.collection(`tenants/${tenantId}/utilisateurs`).doc(userRecord.uid).set(userProfile);

    res.status(201).json({ success: true, user: { id: userRecord.uid, ...userProfile } });
  } catch (error: any) {
    console.error('Error creating user:', error);
    // Return a structured error if possible
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

export default router;
