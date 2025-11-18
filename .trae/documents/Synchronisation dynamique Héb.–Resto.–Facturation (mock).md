## État actuel (confirmé)

* Données mock et hooks `react-query` centralisés (`client/services/api.ts`), clés `keys.*` (`client/services/api.ts:26–37`).

* Hébergement → création automatique de facture uniquement à l’arrivée:

  * Mise à jour: `client/services/api.ts:153–171`.

  * Création: `client/services/api.ts:199–218`.

* Restaurant → commandes et réservations sans facturation automatique:

  * Envoi/servi: `client/services/api.ts:501–529`.

* Table ↔ réservation synchro: création/maj/suppression (`client/services/api.ts:334–365`, `368–404`, `407–432`).

* Dashboard alertes avec double select pour le stock (`client/pages/Dashboard.tsx:219–243`).

* Planning restaurant horaire: grille journalière (`client/pages/restaurant/Plan.tsx:234–303`) + formulaire (`430–616`).

* Admin rôles affichés (non normalisés) (`client/pages/Admin.tsx:391–507`) et RBAC (`client/hooks/useRBAC.ts:4–15`, `40–75`).

## Objectif global

Rendre les flux de données entièrement dynamiques et reliés entre modules (hébergement, restaurant, facturation, dashboard), sans backend pour l’instant, avec synchronisation côté client via `react-query` et logique métier commune.

## 1) Chaînage Hébergement ↔ Calendrier ↔ Facturation ↔ Clients

* Étendre la logique de facture à la confirmation:

  * Ajouter la création de facture lorsque le statut passe à `confirmee` (en plus de `arrivee`) dans:

    * `useUpdateHebergementReservation` (`client/services/api.ts:143–180`).

    * `useCreateHebergementReservation` (`client/services/api.ts:183–226`).

  * Inclure sur la facture les dates d’arrivée/départ dans la ligne: "Nuitée chambre X (du JJ/MM au JJ/MM)".

* Assurer la mise à jour calendrier via invalidations existantes (`client/services/api.ts:176–179`, `221–224`). Le rendu est déjà cohérent (`client/components/RoomCalendar.tsx:61–89`, `91–99`).

* Historique client: déjà alimenté par les réservations (`client/pages/hebergement/Clients.tsx:25`). Aucun changement requis, juste s’assurer que les nouvelles confirmations alimentent l’historique.

## 2) Restaurant ↔ Facturation (liaison client héb. optionnelle)

* Ajout d’un champ "Facturer à" côté restaurant:

  * Option A: dans le formulaire `NewReservationForm` (`client/pages/restaurant/Plan.tsx:418–617`) pour lier la réservation resto à un client hébergement ou saisir un nom libre.

  * Option B: dans `CommandesModal` (`client/components/CommandesModal.tsx:88–160`) afin de capturer le client au moment des commandes.

* Créer la facture "Restaurant" automatiquement lorsque le service pour la réservation est marqué "servi":

  * Étendre `useMarkServed` (`client/services/api.ts:516–529`) pour:

    * Agréger les lignes `commandes` de la réservation, calculer total TTC.

    * Créer une facture via `useCreateFacture` (source "Restaurant", `client/services/api.ts:621–644`).

    * Renseigner `clientNom` selon le lien (client héb. existant ou nom saisi).

    * Invalider `keys.factures` pour synchroniser Financier/Dashboard.

* Si un client hébergement souhaite regrouper sa note resto sur sa facture hébergement, prévoir une case "Regrouper" qui passe `source: Hebergement` avec mention (ou numéro de chambre) pour la traçabilité.

## 3) Facturation: changement de statut et impact rapports

* Ajouter mutation `useUpdateFactureStatut` dans `client/services/api.ts` pour mettre `statut: "payee" | "annulee" | "emise"` par `id` et invalider `keys.factures`.

* UI: dans `client/pages/Financier.tsx`:

  * Dans "Détail facture sélectionnée" (`322–374`), ajouter un `Select` pour le statut et un bouton "Mettre à jour".

  * Les graphiques s’alimentent déjà de `statut === "payee"` (`185–194`). L’impact sera immédiat.

* Facture hébergement: inclure explicitement les dates d’arrivée/départ sur les lignes auto (voir §1).

## 4) Dashboard — Alertes et layout

* Remplacer les deux `Select` par un seul filtre (famille) et conserver un tri par sous-catégorie via chips ou menu contextuel:

  * Modifier `client/pages/Dashboard.tsx:219–243` pour n’avoir qu’un seul `Select` (Restaurant/Hébergement/Toutes) et filtrer alertes stock (`88–95`).

* Vérifier la hauteur et overflow de la carte alertes: déjà contrainte à `height: 360` avec `overflow: auto` (`185–206`, `248–276`). Ajuster marges si nécessaire.

* Les alertes doivent combiner stock hébergement et resto: c’est déjà le cas via `stockProduits` communs (`client/services/api.ts:39–44`).

## 5) Resto/Plan — Planning horaire synchronisé

* Normaliser la comparaison des heures au format `HH:mm` dans la grille journalière (`client/pages/restaurant/Plan.tsx:254–263`) pour éviter les décalages (préfixe zéro).

* S’assurer que l’occupation de table se reflète:

  * À la création (`client/services/api.ts:352–357`).

  * À la mise à jour (`client/services/api.ts:375–396`).

  * À la suppression (`client/services/api.ts:415–421`).

* Supprimer/masquer l’ancienne page non horaire si non utilisée (`client/pages/restaurant/Reservations.tsx`), ou l’aligner sur `Plan` si conservée.

## 6) Administration — Normalisation des rôles

* Définir un set réduit et standard:

  * `admin`, `resp_hebergement`, `resp_resto`, `staff_resto`, `comptable`.

* Adapter `useRBAC` (`client/hooks/useRBAC.ts:4–15`, mapping `40–75`) pour ces rôles et sections correspondantes.

* Adapter l’UI Admin (`client/pages/Admin.tsx`):

  * Mettre à jour la liste des rôles du tableau et du select utilisateur (`555–564`).

  * Mapper automatiquement les anciens rôles vers les nouveaux (ex.: `serveur` → `staff_resto`, `chef_salle` → `resp_resto`, `reception` → `resp_hebergement`).

* Conserver la compatibilité avec les comptes mock (`client/contexts/AuthContext.tsx:24–37`).

## 7) Optimisations & nettoyage

* Centraliser les calculs d’occupation et de collisions (déjà en place côté hooks) et éviter la duplication entre pages.

* Ajouter une mutation "batch" pour clôture de service qui agrège en une fois les effets (commande → facture, stock) en étendant `useEndOfService` (`client/services/api.ts:545–554`).

* Nettoyer composants UI non utilisés si détectés (contrôle à faire après branchements).

## 8) Micro‑animations et UX

* Appliquer transitions légères sur cellules de planning (hover/focus) et apparition des cartes avec `Fade`/`Grow` MUI là où pertinent (grilles des disponibilités, listes de factures).

* Ajouter smooth scroll déjà utilisé (`client/pages/restaurant/Plan.tsx:145–149`, `326–334`).

## Vérifications

* Cohérence `react-query`: invalider `keys.reservations`, `keys.tables`, `keys.factures` après toutes mutations critiques.

* Tester scénarios:

  * Hébergement: créer/mettre à jour en confirmée → facture créée; arrivée → facture éventuellement enrichie.

  * Restaurant: saisir commandes → envoyer/servir → facture créée, liée au client.

  * Financier: basculer statut → tableaux et graphiques réagissent.

  * Dashboard: alertes filtrées avec un seul select; calendrier et KPIs synchronisés.

Si vous validez ce plan, je implémente les mutations manquantes, ajuste les UIs et vérifie chaque flux avec des données mock en temps réel.
