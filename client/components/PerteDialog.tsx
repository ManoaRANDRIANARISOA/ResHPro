import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

interface PerteDialogProps {
  open: boolean;
  onClose: () => void;
  produitNom: string;
  unite: string;
  onSubmit: (quantite: number, motif: string) => void;
}

export function PerteDialog({ open, onClose, produitNom, unite, onSubmit }: PerteDialogProps) {
  const [quantite, setQuantite] = useState<string>("");
  const [motif, setMotif] = useState<string>("");

  const handleSubmit = () => {
    const q = parseFloat(quantite);
    if (!isNaN(q) && q > 0 && motif.trim() !== "") {
      onSubmit(q, motif.trim());
      setQuantite("");
      setMotif("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Déclarer une casse ou avarie</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Produit : <strong>{produitNom}</strong>
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label={`Quantité perdue (${unite})`}
          type="number"
          fullWidth
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          inputProps={{ min: "0", step: "0.1" }}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label="Motif (ex: Tombé, Périmé...)"
          type="text"
          fullWidth
          multiline
          rows={2}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Annuler</Button>
        <Button 
          onClick={handleSubmit} 
          color="error" 
          variant="contained" 
          disabled={!quantite || parseFloat(quantite) <= 0 || !motif.trim()}
        >
          Déclarer la perte
        </Button>
      </DialogActions>
    </Dialog>
  );
}
