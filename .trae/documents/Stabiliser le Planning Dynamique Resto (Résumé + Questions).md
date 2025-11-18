## Objectifs
- État local unique pour le planning afin d’éviter tout reset après création/mise à jour; brancher la remontée des changements (“onReservationUpdate”).
- Rendre «Détails de la réservation» éditable en mode «view» et répercuter immédiatement sur le planning.
- Respecter statuts/couleurs: Réservé (vert), Occupé (rouge), Terminé (gris); «Non arrivé» affiché vert historique.
- Heures service 08:00–22:00: garder la ligne courante visible et empêcher tout dépassement; enlever tout gradient sur l’affichage des heures si présent.

## Implémentation
- `Plan.tsx` (client/pages/restaurant/Plan.tsx):
  - Passer `onReservationUpdate={handleReservationUpdate}` au planning pour conserver l’état (263–276 et 77–86).
  - Utiliser `localEnrichedReservations` pour «Réservations du jour» (315–326) et ouvrir «Voir» sur l’objet local modifié.
  - Rendre les champs éditables en mode «view» et pousser via `useUpdateRestoReservation` puis mise à jour locale immédiate (452–486; retirer `disabled` 528, 535, 541, 548, 555, 562).
- `DynamicSchedule.tsx` (client/components/DynamicSchedule.tsx):
  - Arrivée maintenant: positionner `heureArrivee` à l’heure courante; si ≠ heure prévue, attribuer 60 min d’occupation; statut «Occupé» rouge (582–616, 507–531).
  - Dépassement: prolonger automatiquement au-delà de 60 min sans départ, garder l’animation de dépassement; fin à «Client Parti» (706–720, 755–797, 618–653).
  - «Marquer non arrivé»: bouton vert, visible uniquement si fin prévue passée et sans arrivée; conserver bloc historique (vert) et libérer la table à partir de la fin prévue du créneau (654–688 + logique libération différée via api).
  - Priorité d’affichage: `heureArrivee`/`heureDepart` priment (507–545).
  - Auto‑scroll: suivre la ligne rouge chaque seconde sans dépasser 22:00, garder le comportement de lissage actuel; enlever tout gradient si détecté sur la colonne d’heures.
- `api.ts` (client/services/api.ts):
  - Mises à jour CRUD immédiates (`setQueryData`) déjà en place pour create/update/delete (382–389, 403–407, 455–458).
  - No‑show: lors du marquage, passer la table en `libre` à partir de la fin prévue (libération différée). Annuler les commandes en «saisie»/«envoyee», garder «servie», et rafraîchir factures si nécessaire (469–587). 
- `mock.ts` (client/services/mock.ts):
  - Ne pas modifier les mocks comme demandé; conserver les champs et laisser la logique dépendre de l’heure actuelle.

## Règles Métier
- Non arrivé: bloc visible en historique (vert), libération table à fin prévue; action déclenchée par bouton utilisateur.
- Durée d’occupation: champ dans «Détails/Nouvelle réservation»; défaut 60 min si non saisi.
- Édition heure/table: appliquer directement sans contrôle de collision (simplification), avec possibilité d’ajouter une vérification non bloquante plus tard.

## Vérifications
- Modifier arrivée/départ/durée puis créer une nouvelle réservation → aucun reset; planning et «Réservations du jour» cohérents.
- Cas test: arrivée en avance/retard, non arrivé, dépassement avec animation, durée personnalisée.
- Heures 08–22: la ligne courante reste dans la fenêtre; pas de scroll au‑delà; pas de gradient.

## Nettoyage
- Aligner Plan.tsx et supprimer Plan-fixed.tsx après migration et validation.

Confirmez pour que je procède aux modifications.