## Diagnostic
- Reset après création: le parent ne reçoit pas les mises à jour locales du planning; lors de la création, il reconstruit la liste sans vos modifications et le planning se resynchronise en perdant l’état.
- Cause directe: `DynamicSchedule` met à jour un état interne et peut notifier le parent via `onReservationUpdate` (client/components/DynamicSchedule.tsx:198–205, 260–263, 396–398), mais `Plan.tsx` ne passe pas ce callback (client/pages/restaurant/Plan.tsx:263–276). Un effet de sync remplace ensuite l’état local (client/components/DynamicSchedule.tsx:227–234).
- Incohérence: la section «Réservations du jour» lit les données du hook au lieu de l’état local (client/pages/restaurant/Plan.tsx:315–326), donc «Voir» sélectionne une réservation sans vos modifications.
- Formulaire en lecture seule: les champs «view» sont désactivés dans les détails (client/pages/restaurant/Plan.tsx:528, 535, 541, 548, 555, 562).
- Mock trop riche: plusieurs réservations démarrent avec `heureArrivee`/`heureDepart` (client/services/mock.ts:191–201, 215–221, 232–238).

## Corrections Fonctionnelles
1. Connecter la remontée des mises à jour
- Passer `onReservationUpdate={handleReservationUpdate}` à `DynamicSchedule` et conserver l’état unique `localEnrichedReservations` comme source de vérité côté page.
- En `handleReservationUpdate`, mettre à jour la réservation sélectionnée si présente (déjà prêt dans Plan.tsx:77–86).

2. Unifier la liste «Réservations du jour»
- Faire consommer `localEnrichedReservations` au lieu de refetch interne; fournir la table et le client déjà enrichis pour affichage cohérent.
- `onViewReservation` sélectionne l’objet issu de l’état local (avec vos modifications), garantissant la continuité.

3. Édition dans «Détails de la réservation»
- Retirer `disabled={mode === "view"}` sur les champs pour permettre la modification.
- Sur «Mettre à jour», pousser les changements via `useUpdateRestoReservation` et mettre à jour `localEnrichedReservations` par `map` (déjà implémenté), puis resélectionner la version mise à jour.

4. Prioriser heures réelles dans l’affichage
- Conserver le démarrage sur `heureArrivee || heureDebut || heure` et la durée dynamique jusqu’à l’instant ou 1h par défaut si arrivée ≠ heure prévue (client/components/DynamicSchedule.tsx:507–531). Aucun clignotement.

5. Désactiver l’animation d’alerte
- Retirer l’animation «strongPulse» pour les dépassements afin d’éviter l’effet d’alerte non souhaité (client/components/DynamicSchedule.tsx:706–720).

6. Ajuster les libellés et couleurs des actions
- Renommer «Marquer No-Show ⚠️» en «Marquer non arrivé» et passer le bouton au vert. Conserver la logique: n’afficher que si la réservation est passée et sans arrivée (client/components/DynamicSchedule.tsx:654–688).
- Mettre le texte d’état «no_show» à «Non arrivé» (au lieu de «Terminé») dans `getStatusText`.

7. Simplifier les données mock
- Supprimer `heureArrivee`/`heureDepart` des réservations mock; ne garder que: client, table, heure prévue, durée, nb personnes, statut de base.
- Laisser ces champs vides pour que l’utilisateur les renseigne; les statuts évolueront via les boutons.

## Implémentation Précise
- Modifier `Plan.tsx`:
  - Ajouter `onReservationUpdate={handleReservationUpdate}` à `DynamicSchedule`.
  - Remplacer `ReservationsList` pour accepter les réservations enrichies du parent et les afficher; cliquer «Voir» utilise l’objet local.
  - Retirer les `disabled` des champs dans le formulaire en mode «view».
- Modifier `DynamicSchedule.tsx`:
  - Supprimer l’animation dans le style du bloc de réservation.
  - Renommer et recolorer le bouton «Marquer non arrivé» en vert; ajuster libellé.
  - Ajuster `getStatusText` pour `no_show` -> «Non arrivé».
- Modifier `client/services/mock.ts`:
  - Retirer `heureArrivee`/`heureDepart` des entrées existantes.

## Vérifications
- Chemin critique: modifier une réservation (arrivée/départ) puis créer une nouvelle → aucune perte d’état; le planning garde vos changements.
- «Voir» une réservation depuis «Réservations du jour», éditer, sauvegarder → la carte sur le planning se met à jour instantanément.
- Tester au moins 3 cas: arrivée en avance, arrivée en retard, non arrivé.

## Choix UX
- Conserver le bouton «Marquer non arrivé» et le rendre vert pour simplifier la discrimination visuelle, avec statut `no_show` mais affichage «Non arrivé». Si vous préférez le retirer, je l’ôterai dans la même passe.