export interface FicheTechniqueIngredient {
  produitId: string; // Fait référence à un StockProduit
  quantite: number;
  unite: string;
}

export interface FicheTechnique {
  id: string;
  menuItemId: string; // Fait référence à un MenuItem
  portions: number;
  ingredients: FicheTechniqueIngredient[];
  instructions?: string;
  tempsPreparation?: number; // en minutes
  tempsCuisson?: number; // en minutes
  createdAt: string;
  updatedAt: string;
}

export interface AnalyseEcartLigne {
  produitId: string;
  stockInitial: number;
  achats: number;
  consommationTheorique: number;
  stockFinalPrevu: number;
  stockFinalReel: number;
  ecartAbsolu: number;
  ecartPourcent: number;
  coutEcart: number;
}

export interface AnalyseEcart {
  id: string;
  periodeDebut: string;
  periodeFin: string;
  lignes: AnalyseEcartLigne[];
  totalCoutEcart: number;
  statut: "brouillon" | "valide";
  createdAt: string;
  createdBy: string;
}
