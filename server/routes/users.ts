import { Router, Response } from 'express';
import { adminAuth, adminDb } from '../firebaseAdmin';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ==========================================
// 1. CRÉATION D'UTILISATEUR (AUTH + FIRESTORE)
// ==========================================
router.post('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, nom, login, password, role, statut } = req.body;

  if (!tenantId || !nom || !login || !password || !role) {
    return res.status(400).json({ success: false, error: 'Champs obligatoires manquants' });
  }

  // Contrôle d'isolation multi-tenant
  if (!req.user?.superAdmin && req.user?.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Accès interdit : locataire non autorisé' });
  }

  try {
    let uid = '';

    try {
      // 1. Créer le compte Firebase Auth
      const userRecord = await adminAuth.createUser({
        email: login.trim().toLowerCase(),
        password: password.trim(),
        displayName: nom.trim(),
      });
      uid = userRecord.uid;
    } catch (authErr: any) {
      // Si l'utilisateur existe déjà dans Firebase Auth, on le récupère et on met à jour son mdp
      if (authErr.code === 'auth/email-already-exists') {
        const existing = await adminAuth.getUserByEmail(login.trim().toLowerCase());
        uid = existing.uid;
        await adminAuth.updateUser(uid, {
          password: password.trim(),
          displayName: nom.trim(),
        });
      } else {
        throw authErr;
      }
    }

    // 2. Définir les Custom Claims (rôle + tenantId pour RBAC)
    await adminAuth.setCustomUserClaims(uid, {
      tenantId: tenantId,
      role: role,
    });

    // 3. Créer ou mettre à jour le profil dans Firestore
    const userProfile = {
      nom: nom.trim(),
      login: login.trim().toLowerCase(),
      role: role,
      statut: statut || "Actif",
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection(`tenants/${tenantId}/utilisateurs`).doc(uid).set(userProfile, { merge: true });

    res.status(201).json({ success: true, user: { id: uid, ...userProfile } });
  } catch (error: any) {
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur interne du serveur' });
  }
});

// ==========================================
// 2. MODIFICATION D'UTILISATEUR (AUTH + FIRESTORE)
// ==========================================
router.put('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { tenantId, nom, login, password, role, statut } = req.body;

  if (!tenantId || !id) {
    return res.status(400).json({ success: false, error: 'Identifiant et locataire requis' });
  }

  // Contrôle d'isolation multi-tenant
  if (!req.user?.superAdmin && req.user?.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Accès interdit : locataire non autorisé' });
  }

  try {
    let authUid: string | null = null;

    // 1. Chercher l'utilisateur dans Firebase Auth par son UID
    try {
      const userRecord = await adminAuth.getUser(id);
      authUid = userRecord.uid;
    } catch (e1) {
      // Si pas trouvé par UID (ex: doc Firestore avec ID auto), chercher par email
      if (login) {
        try {
          const userByEmail = await adminAuth.getUserByEmail(login.trim().toLowerCase());
          authUid = userByEmail.uid;
        } catch (e2) {}
      }
    }

    // 2. Mettre à jour Firebase Auth
    if (authUid) {
      const updateData: any = {};
      if (nom) updateData.displayName = nom.trim();
      if (login) updateData.email = login.trim().toLowerCase();
      if (password && password.trim().length > 0) updateData.password = password.trim();

      await adminAuth.updateUser(authUid, updateData);

      if (role) {
        await adminAuth.setCustomUserClaims(authUid, {
          tenantId: tenantId,
          role: role,
        });
      }
    } else if (login && password && password.trim().length > 0) {
      // L'utilisateur n'existait pas encore dans Firebase Auth (ex: créé initialement hors Auth)
      try {
        const newAuth = await adminAuth.createUser({
          email: login.trim().toLowerCase(),
          password: password.trim(),
          displayName: nom || login,
        });
        authUid = newAuth.uid;
        await adminAuth.setCustomUserClaims(authUid, {
          tenantId: tenantId,
          role: role || "admin",
        });
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-exists') {
          const existing = await adminAuth.getUserByEmail(login.trim().toLowerCase());
          authUid = existing.uid;
          await adminAuth.updateUser(authUid, {
            password: password.trim(),
            displayName: nom || login,
          });
          await adminAuth.setCustomUserClaims(authUid, {
            tenantId: tenantId,
            role: role || "admin",
          });
        } else {
          console.warn("Impossible de créer dans Firebase Auth:", authErr);
        }
      }
    }

    // 3. Mettre à jour Firestore
    const userProfile: any = {};
    if (nom !== undefined) userProfile.nom = nom.trim();
    if (login !== undefined) userProfile.login = login.trim().toLowerCase();
    if (role !== undefined) userProfile.role = role;
    if (statut !== undefined) userProfile.statut = statut;
    userProfile.updatedAt = new Date().toISOString();

    await adminDb.collection(`tenants/${tenantId}/utilisateurs`).doc(id).set(userProfile, { merge: true });

    res.json({ success: true, user: { id, ...userProfile } });
  } catch (error: any) {
    console.error('Erreur modification utilisateur:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur interne du serveur' });
  }
});

// ==========================================
// 3. SUPPRESSION D'UTILISATEUR (AUTH + FIRESTORE)
// ==========================================
router.delete('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = (req.query.tenantId as string) || req.body?.tenantId;

  if (!tenantId || !id) {
    return res.status(400).json({ success: false, error: 'Identifiant et locataire requis' });
  }

  // Contrôle d'isolation multi-tenant
  if (!req.user?.superAdmin && req.user?.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Accès interdit' });
  }

  try {
    // 1. Supprimer de Firebase Auth (si existe)
    try {
      await adminAuth.deleteUser(id);
    } catch (authErr) {
      // Ignorer si déjà absent d'Auth
    }

    // 2. Supprimer de Firestore
    await adminDb.collection(`tenants/${tenantId}/utilisateurs`).doc(id).delete();

    res.json({ success: true });
  } catch (error: any) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur interne du serveur' });
  }
});

export default router;
