# Comptes et niveaux d’accès (démo)

Ce document récapitule les comptes mock disponibles pour la démo et leurs niveaux d’accès. L’authentification est entièrement côté client (sans backend), les mots de passe sont en clair et destinés uniquement à des tests.

## Comptes disponibles

Tous les comptes ci‑dessous ont le mot de passe par défaut `okalodge2025`.

- Administrateur — login `admin@okalodge.local`
- Réception — login `reception@okalodge.local`
- Chef de salle — login `chef.salle@okalodge.local`
- Serveur — login `serveur@okalodge.local`
- Cuisine — login `cuisine@okalodge.local`
- Bar — login `bar@okalodge.local`
- Comptoir — login `comptoir@okalodge.local`
- Économat — login `economat@okalodge.local`
- Comptable — login `comptable@okalodge.local`
- Direction — login `direction@okalodge.local`

Source des comptes: `client/services/mock.ts` (`utilisateurs` et `userAuth`).

## Rôles et sections visibles (menu)

Le menu est construit via `client/hooks/useRBAC.ts` en fonction du rôle Redux.

- `admin`: Hébergement, Restaurant, Financier, Administration
- `reception`: Hébergement, Restaurant (Plan), Financier
- `chef_salle`: Restaurant
- `serveur`: Restaurant
- `cuisine`: Restaurant
- `bar`: Restaurant
- `comptoir`: Restaurant, Financier
- `economat`: Hébergement
- `comptable`: Financier
- `direction`: Hébergement, Restaurant, Financier

## Accès aux pages (garde de routes)

Les pages sont protégées via `client/components/RouteGuard.tsx` et configurées dans `client/App.tsx`.

- Hébergement
  - `/hebergement/gestion`: `admin`, `reception`, `economat`, `direction`
  - `/hebergement/clients`: `admin`, `reception`, `economat`, `direction`
  - `/hebergement/stock`: `admin`, `economat`, `direction`
  - `/hebergement/tarifs`: `admin`, `direction`
- Restaurant
  - `/resto/plan`: `admin`, `reception`, `chef_salle`, `serveur`, `cuisine`, `bar`, `comptoir`, `direction`
  - `/resto/menu`: `admin`, `chef_salle`, `serveur`, `cuisine`, `bar`, `comptoir`, `direction`
  - `/resto/stock`: `admin`, `comptoir`, `direction`
  - `/resto/evenements`: `admin`, `chef_salle`, `serveur`, `cuisine`, `bar`, `comptoir`, `direction`
- Financier
  - `/financier`: `admin`, `comptable`, `comptoir`, `direction`, `reception`
- Administration
  - `/admin`: `admin`
- Dashboard
  - `/dashboard`: accessible à tous (après login)

Si un rôle non autorisé tente d’ouvrir une page, il est redirigé vers `/dashboard`.

## Fonctionnement de l’authentification (mock)

- Le formulaire de login (`client/pages/Login.tsx`) utilise le contexte `AuthContext`.
- `AuthContext` valide l’email/mot de passe contre `utilisateurs` et `userAuth` (mock en mémoire).
- En cas de succès, il met à jour `user` dans le contexte et synchronise le rôle via Redux (`setRole`).
- L’application affiche alors le layout et le menu filtré par rôle.

Note: il n’y a pas de persistance de session (pas de JWT, pas de storage). Un rechargement de page réinitialise l’état `isAuthenticated`.

## Statuts des factures

Les statuts sont normalisés dans le frontend: `"emise" | "payee" | "annulee"`.
- La création de facture dans le menu et la page Financier utilise `statut: "emise"`.
- Les pages Dashboard, Financier, Menu et Evenements filtrent désormais sur `"emise"`.

## Pistes restantes avant intégration backend

- Persistance de session (localStorage) et sécurisation (hash des mots de passe, jetons).
- API REST pour: utilisateurs (CRUD), clients, réservations, menu, commandes, événements, factures.
- Enforcements côté serveur du RBAC; le guard actuel est uniquement frontend.
- Liaison stricte facture ↔ événement/réservation (id et références plutôt que nom).
- Tests unitaires/integ pour Auth, RBAC et flux facturation.
- Gestion des erreurs et toasts plus explicites (succès/échec) pour CRUD utilisateurs et factures.
- Paramétrage et cohérence des statuts (réservation, commande, stock) avec le backend.