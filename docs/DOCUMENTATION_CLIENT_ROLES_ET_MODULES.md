# 📖 Guide & Documentation Client — ResHPro / ResiPro

Bienvenue dans le guide complet d'utilisation de **ResHPro**, la plateforme de gestion hôtelière et de restauration multi-établissements de nouvelle génération.

---

## 📑 Sommaire
1. [Architecture & Isolation Multi-Établissement](#1-architecture--isolation-multi-%C3%A9tablissement)
2. [Matrice des 12 Rôles Métier & Permissions](#2-matrice-des-12-r%C3%B4les-m%C3%A9tier--permissions)
3. [Module Hébergement & Formules de Séjour](#3-module-h%C3%A9bergement--formules-de-s%C3%A9jour)
4. [Module Facturation & Conformité Fiscale](#4-module-facturation--conformit%C3%A9-fiscale)
5. [Module Restaurant, Fiches Techniques & Qualité](#5-module-restaurant-fiches-techniques--qualit%C3%A9)
6. [Gestion Centralisée des Stocks](#6-gestion-centralis%C3%A9e-des-stocks)

---

## 1. Architecture & Isolation Multi-Établissement

ResHPro repose sur une architecture Cloud Firestore en temps réel :
- **Chaque établissement possède son espace étanche** accessible via son URL personnalisée : `https://domaine.app/{nom_etablissement}/...` (ex : `/demo`, `/okalodge`, `/kanana`).
- **Aucune interférence** : Les clients, chambres, tables, menus, stocks et factures sont cloisonnés et sécurisés.

---

## 2. Matrice des 12 Rôles Métier & Permissions

Chaque collaborateur dispose d'un compte avec un rôle précis adapté à sa fonction :

| Rôle Métier | Hébergement | Restaurant | Stock | Facturation | Rapports | Description du Poste |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Admin** | Total | Total | Total | Total | Total | Administrateur technique et supervision complète. |
| **Direction** | Total | Total | Lecture | Total | Total | Direction générale, vision globale et validation financière. |
| **Responsable Hébergement** | Total | Lecture | Modif. | Lecture | Lecture | Supervision du pôle hébergement, chambres et réservations. |
| **Réception / Accueil** | Modif. | Aucun | Lecture | Création | Aucun | Check-in / check-out, saisie des séjours et encaissements client. |
| **Responsable Restaurant** | Lecture | Total | Modif. | Lecture | Lecture | Gestion de la salle, du menu, des événements et des cartes. |
| **Chef de Salle / Maître d'Hôtel** | Aucun | Modif. | Lecture | Création | Lecture | Organisation des tables, service en salle et facturation resto. |
| **Staff Restaurant / Serveur** | Aucun | Modif. | Lecture | Aucun | Aucun | Prise de commandes sur table et suivi du service. |
| **Chef Cuisinier / Cuisine** | Aucun | Modif. | Modif. | Aucun | Aucun | Préparation des commandes, fiches techniques et stocks cuisine. |
| **Barman / Bar** | Aucun | Modif. | Modif. | Aucun | Aucun | Gestion du bar, cocktails et stocks de boissons. |
| **Comptoir / Caisse** | Lecture | Modif. | Lecture | Création | Lecture | Vente directe, encaissements rapides et clôtures journalières. |
| **Économat / Gestionnaire Stock** | Lecture | Lecture | Total | Aucun | Lecture | Réapprovisionnements, inventaires et gestion des écarts. |
| **Comptable / Trésorerie** | Lecture | Lecture | Lecture | Total | Total | Gestion financière, états comptables, relances et bilans. |

---

## 3. Module Hébergement & Formules de Séjour

### A. Catégories de Chambres Personnalisables
- L'établissement peut créer et nommer librement ses catégories (*Standard, Suite VIP, Bungalow Vue Mer, Villa Familiale, Dortoir, etc.*) depuis la page **Hébergement ➔ Tarifs**.
- Les tarifs de base par nuitée et les capacités d'accueil sont configurables en Ariary (Ar).

### B. Formules & Packs de Séjour
L'établissement peut configurer ses offres forfaitaires :
- **Chambre Seule** : Nuitée standard simple.
- **Formule Petit-Déjeuner (B&B)** : Supplément par personne / par nuit.
- **Formule Demi-Pension** : Petit-déjeuner + Dîner par personne / par nuit.
- **Formule Pension Complète** : Ensemble des repas par personne / par nuit.
- **Forfait Séjour Sur-Mesure** : Montant forfaitaire fixe pour le séjour (ex : *Pack Romance, Forfait Weekend*).

### C. Réservation & Simulation en Direct
- Lors de la réservation sur le planning dynamique, le réceptionniste choisit la chambre, les dates, le nombre de personnes et la **Formule / Pack**.
- L'interface calcule en temps réel le total estimé : `Coût chambre + Supplément Formule = Total Séjour`.

---

## 4. Module Facturation & Conformité Fiscale

Accessible sous `/{tenantId}/financier` :

### A. Mentions Légales & Fiscale Automatiques
- **NIF & STAT** de l'établissement rattaché, avec logo et coordonnées officielles.
- Bouton de mise à jour instantanée des données fiscales de l'établissement.

### B. Prise en Compte des Agences de Voyage
- Possibilité d'associer chaque client à son agence de voyage partenaire.
- Filtres rapides : *Toutes*, *Clients Directs*, *Factures Agences*.

### C. Remises Commerciales Réglementées (0 à 10%)
- Possibilité d'accorder un rabais commercial plafonné à 10% avec calcul automatique du sous-total, de la remise et du Net TTC.

### D. Export & Impression PDF A4 Haute Définition
- Génération d'une facture A4 soignée et prête pour l'impression, comprenant les coordonnées, le détail des lignes, le mode de règlement et l'espace de signature/tampon.

---

## 5. Module Restaurant, Fiches Techniques & Qualité

- **Plan de salle interactif** : Visualisation en direct de l'état des tables (Libre, Occupée, Réservée, Addition demandée).
- **Menu & Fiches Techniques** : Chaque plat est relié à sa recette (ingrédients en stock et grammages).
- **Qualité & Rentabilité (Analyse des Écarts)** :
  - Module d'inventaire à l'aveugle.
  - Détection automatique du Top 5 des écarts de consommation.
  - Enregistrement des pertes justifiées (casse, péremption) avec motifs.

---

## 6. Gestion Centralisée des Stocks

- **Stock Hébergement** : Consommables et linge hôtelier (draps, serviettes, savons, papier toilette, kits douche).
- **Stock Restaurant** : Ingrédients, viandes, légumes, épicerie, boissons.
- **Alertes de réapprovisionnement** : Alertes automatiques en cas de seuil critique ou rupture de stock.
