## Portée
- Cible unique: `client/pages/restaurant/Plan.tsx` (vue Plan)
- Garder le routage inchangé: `client/App.tsx:77–84` pour `"/resto/plan"`
- Respecter la garde: `client/components/RouteGuard.tsx:5–15`

## Contexte technique
- Hooks de données: `client/services/api.ts:125` (`useTables`), `230` (`useTodayRestoReservations`), `571` (`useEndOfService`)
- Mock de données: `client/services/mock.ts:154–167` (tables), `186–221` (réservations)
- Store/RBAC: `client/store/index.ts:3–22`, `client/hooks/useRBAC.ts:22–27`
- Contexte Auth: `client/contexts/AuthContext.tsx:14–21,26–49,52–69`

## Points d’attache
- UI locale principale: `client/pages/restaurant/Plan.tsx` (imports, état, filtres, actions)
- Statut visuel: `client/components/StatusChip.tsx:35–53`
- Providers: `client/App.tsx:138–149` (Redux, Query, Theme, Auth)

## Règles d’isolation
- Ne pas modifier les composants UI partagés dans `client/components/ui/*`; créer une variante locale si nécessaire.
- Ne pas changer les hooks existants dans `client/services/api.ts`; ajouter de nouveaux hooks/fonctions avec clés de requête spécifiques au restaurant si besoin.
- Ne pas toucher au `RouteGuard` ni au RBAC à moins d’un changement de règle métier.
- Limiter les styles aux classes locales dans `Plan.tsx` ou via MUI `sx` pour éviter les fuites globales.
- Toute nouvelle logique reste encapsulée dans `Plan.tsx` ou sous-composants internes au dossier restaurant.

## Étapes de mise en œuvre
1. Cartographier précisément l’usage actuel dans `Plan.tsx` (filtres, actions, formulaires) et lister les points à modifier.
2. Introduire sous-composants locaux (ex: `TableGrid`, `ReservationPanel`) dans `Plan.tsx` pour isoler la nouvelle logique.
3. Si une nouvelle donnée est requise, ajouter un hook dédié dans `client/services/api.ts` (sans altérer ceux utilisés ailleurs) et le câbler uniquement depuis `Plan.tsx`.
4. Ajuster les interactions (création/mise à jour/suppression) en s’appuyant sur `useCreateRestoReservation` (`client/services/api.ts:336`), `useUpdateRestoReservation` (`370`), `useDeleteRestoReservation` (`409`).
5. Garder les clés React Query et selectors spécifiques au restaurant pour éviter de toucher le cache d’autres domaines.
6. Vérifier l’affichage et la navigation au sein de `"/resto/plan"` sans incidences sur `"/resto/reservations"`, `"/resto/menu"` etc.

## Validation
- Navigation protégée via `RouteGuard` confirmée (`client/App.tsx:77–84`, `RouteGuard.tsx:5–15`).
- Vérifier les requêtes (mock/local) et le cache React Query: mutations invalidant uniquement les queries restaurant.
- Tests manuels: filtres, création/édition/suppression de réservations, stats et fin de service.

## Risques et mitigations
- Risque: altérer un composant partagé → mitigation: variante locale/scoped styles.
- Risque: collision de clés React Query → mitigation: préfixes dédiés restaurant dans les nouvelles queries.
- Risque: régression RBAC → mitigation: ne pas modifier `useRBAC.ts` sans justification et test dédié.

## Livrables
- Modifications confinées à `Plan.tsx` et éventuels sous-composants locaux.
- Éventuels nouveaux hooks API ajoutés sans toucher aux existants.
- Journal des impacts avec références de fichiers/ligne pour traçabilité.