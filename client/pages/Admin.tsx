import { Add } from "@mui/icons-material";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/services/api";

type User = {
  id: string;
  nom: string;
  email: string;
  role: string;
  canal: string;
  derniere: string;
  statut: "Actif" | "Invité" | "Suspendu";
};

type Role = {
  id: string;
  nom: string;
  utilisateurs: number;
  hebergement: "Total" | "Modif." | "Lecture" | "Aucun";
  restaurant: "Total" | "Modif." | "Lecture" | "Aucun";
  stock: "Total" | "Modif." | "Lecture" | "Aucun";
  facturation: "Total" | "Modif." | "Lecture" | "Création" | "Aucun";
  rapports: "Total" | "Lecture" | "Aucun";
};

// Les utilisateurs sont désormais gérés via le store mock (useUsers)

const initialRoles: Omit<Role, "utilisateurs">[] = [
  {
    id: "r1",
    nom: "Admin",
    hebergement: "Total",
    restaurant: "Total",
    stock: "Total",
    facturation: "Total",
    rapports: "Total",
  },
  {
    id: "r2",
    nom: "Responsable Hébergement",
    hebergement: "Modif.",
    restaurant: "Lecture",
    stock: "Modif.",
    facturation: "Lecture",
    rapports: "Lecture",
  },
  {
    id: "r3",
    nom: "Staff Restaurant",
    hebergement: "Aucun",
    restaurant: "Modif.",
    stock: "Lecture",
    facturation: "Aucun",
    rapports: "Aucun",
  },
  {
    id: "r4",
    nom: "Responsable Restaurant",
    hebergement: "Lecture",
    restaurant: "Modif.",
    stock: "Modif.",
    facturation: "Lecture",
    rapports: "Lecture",
  },
];

export default function AdminPage() {
  const role = useAppSelector((s) => s.session.role);
  if (role !== "admin") return <Navigate to="/dashboard?notice=admin-only" replace />;
  const { data: usersData } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const users: User[] = useMemo(() => {
    // Adapter Utilisateur -> User (email = login, rôle affiché en libellé)
    const toLabel = (r: string) => {
      const map: Record<string, string> = {
        admin: "Admin",
        reception: "Responsable Hébergement",
        "responsable hebergement": "Responsable Hébergement",
        chef_salle: "Responsable Restaurant",
        "responsable restaurant": "Responsable Restaurant",
        serveur: "Staff Restaurant",
        cuisine: "Staff Restaurant",
        bar: "Staff Restaurant",
        comptoir: "Staff Restaurant",
        economat: "Économat",
        comptable: "Comptable",
        direction: "Admin",
        staff_restaurant: "Staff Restaurant",
        saff_restaurant: "Staff Restaurant",
      };
      return map[r] || r;
    };
    return (usersData || []).map((u) => ({
      id: u.id,
      nom: u.nom,
      email: u.login,
      role: toLabel(u.role),
      canal: "Tous",
      derniere: "",
      statut: "Actif",
    }));
  }, [usersData]);
  const [roles, setRoles] = useState<Omit<Role, "utilisateurs">[]>([
    ...initialRoles,
    {
      id: "r5",
      nom: "Comptable",
      hebergement: "Aucun",
      restaurant: "Aucun",
      stock: "Aucun",
      facturation: "Total",
      rapports: "Lecture",
    },
    {
      id: "r6",
      nom: "Économat",
      hebergement: "Aucun",
      restaurant: "Aucun",
      stock: "Total",
      facturation: "Aucun",
      rapports: "Lecture",
    },
  ]);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Actif" | "Suspendu">("all");
  
  // Modal de gestion utilisateur
  const [modalOpen, setModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<User>({
    id: "",
    nom: "",
    email: "",
    role: "Serveur",
    canal: "Restaurant",
    derniere: "",
    statut: "Actif",
  });
  const [password, setPassword] = useState<string>("");

  // Filtrage des utilisateurs
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.nom.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.role.toLowerCase().includes(query) ||
          u.canal.toLowerCase().includes(query)
      );
    }
    
    // Filtre par statut
    if (statusFilter !== "all") {
      filtered = filtered.filter((u) => u.statut === statusFilter);
    }
    
    return filtered;
  }, [users, searchQuery, statusFilter]);

  // Ouvrir le modal pour créer un utilisateur
  function openCreateModal() {
    setIsCreating(true);
    setEditingUser(null);
    setUserForm({
      id: "",
      nom: "",
      email: "",
      role: "Serveur",
      canal: "Restaurant",
      derniere: "",
      statut: "Actif",
    });
    setModalOpen(true);
  }

  // Ouvrir le modal d'édition
  function openEditModal(user: User) {
    setIsCreating(false);
    setEditingUser(user);
    setUserForm({ ...user });
    setModalOpen(true);
  }

  // Sauvegarder les modifications ou créer un nouvel utilisateur
  function saveUser() {
    const roleKey = (() => {
      const map: Record<string, string> = {
        Admin: "admin",
        "Responsable Hébergement": "reception",
        "Responsable Restaurant": "chef_salle",
        "Staff Restaurant": "serveur",
        "Économat": "economat",
        Comptable: "comptable",
      };
      return map[userForm.role] || userForm.role;
    })();

    if (isCreating) {
      createUser.mutate({ nom: userForm.nom, login: userForm.email, role: roleKey as any, password }, {
        onSuccess: () => {
          setModalOpen(false);
          setEditingUser(null);
          setIsCreating(false);
          setPassword("");
        },
      });
    } else {
      if (!editingUser) return;
      updateUser.mutate({ id: editingUser.id, nom: userForm.nom, login: userForm.email, role: roleKey as any, password }, {
        onSuccess: () => {
          setModalOpen(false);
          setEditingUser(null);
          setIsCreating(false);
          setPassword("");
        },
      });
    }
  }

  // Supprimer un utilisateur
  function deleteUser(userId: string) {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
      deleteUserMutation.mutate({ id: userId });
    }
  }

  // Calculer le nombre d'utilisateurs par rôle
  const rolesWithUserCount = useMemo(() => {
    return roles.map((role) => ({
      ...role,
      utilisateurs: users.filter((u) => u.role === role.nom).length,
    }));
  }, [roles, users]);

  // Mettre à jour un rôle
  function updateRolePermission(
    roleId: string,
    field: keyof Omit<Role, "id" | "nom" | "utilisateurs">,
    value: string
  ) {
    setRoles((prev) =>
      prev.map((r) =>
        r.id === roleId ? { ...r, [field]: value } : r
      )
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={2}>
        Utilisateurs & Rôles
      </Typography>
      
      {/* Filtres */}
      <Box sx={{ mb: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Filtres
          </Typography>
          <TextField
            size="small"
            placeholder="Rechercher un utilisateur, un rôle..."
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
            <Chip
              size="small"
              label="Tous"
              variant={statusFilter === "all" ? "filled" : "outlined"}
              color={statusFilter === "all" ? "primary" : "default"}
              onClick={() => setStatusFilter("all")}
            />
            <Chip
              size="small"
              label="Actifs"
              variant={statusFilter === "Actif" ? "filled" : "outlined"}
              color={statusFilter === "Actif" ? "primary" : "default"}
              onClick={() => setStatusFilter("Actif")}
            />
            <Chip
              size="small"
              label="Suspendus"
              variant={statusFilter === "Suspendu" ? "filled" : "outlined"}
              color={statusFilter === "Suspendu" ? "primary" : "default"}
              onClick={() => setStatusFilter("Suspendu")}
            />
          </Stack>
        </Paper>
      </Box>

      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Chip label={`Utilisateurs actifs ${users.filter(u=>u.statut==='Actif').length}` } />
          
          <Box sx={{ flex: 1 }} />
          <Button startIcon={<Add />} variant="contained" onClick={openCreateModal}>
            Nouvel utilisateur
          </Button>
        </Stack>

        {/* Liste des utilisateurs */}
        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Utilisateurs
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 140px 160px 100px 100px",
              px: 1,
              py: 1,
              color: "text.secondary",
              fontWeight: 700,
            }}
          >
            <Box>Utilisateur</Box>
            <Box>Rôle</Box>
            <Box>Canal</Box>
            <Box>Dernière activité</Box>
            <Box>Statut</Box>
            <Box>Actions</Box>
          </Box>
          {filteredUsers.map((u) => (
            <Box
              key={u.id}
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 140px 160px 100px 100px",
                px: 1,
                py: 1,
                borderTop: "1px solid",
                borderColor: "divider",
                alignItems: "center",
              }}
            >
              <Box>
                <Typography fontWeight={700}>{u.nom}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {u.email}
                </Typography>
              </Box>
              <Box>{u.role}</Box>
              <Box>{u.canal}</Box>
              <Box>{u.derniere || "—"}</Box>
              <Box>
                <Chip
                  size="small"
                  label={u.statut}
                  color={
                    u.statut === "Actif"
                      ? "success"
                      : u.statut === "Invité"
                        ? "warning"
                        : "default"
                  }
                />
              </Box>
              <Box>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => openEditModal(u)}>
                    Gérer
                  </Button>
                  <Button 
                    size="small" 
                    color="error" 
                    onClick={() => deleteUser(u.id)}
                  >
                    Suppr.
                  </Button>
                </Stack>
              </Box>
            </Box>
          ))}
        </Paper>

        {/* Tableau des rôles avec permissions modifiables */}
        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Rôles et permissions
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 120px 120px 120px 120px 120px",
              px: 1,
              py: 1,
              color: "text.secondary",
              fontWeight: 700,
              fontSize: "0.875rem",
            }}
          >
            <Box>Nom du rôle</Box>
            <Box>Utilisateurs</Box>
            <Box>Hébergement</Box>
            <Box>Restaurant</Box>
            <Box>Stocks</Box>
            <Box>Facturation</Box>
            <Box>Rapports</Box>
          </Box>
          {rolesWithUserCount.map((r) => (
            <Box
              key={r.id}
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 120px 120px 120px 120px 120px",
                px: 1,
                py: 1,
                borderTop: "1px solid",
                borderColor: "divider",
                alignItems: "center",
              }}
            >
              <Box fontWeight={700}>{r.nom}</Box>
              <Box>{r.utilisateurs}</Box>
              <Box>
                <Select
                  size="small"
                  value={r.hebergement}
                  onChange={(e) =>
                    updateRolePermission(r.id, "hebergement", e.target.value)
                  }
                  sx={{ minWidth: 100 }}
                >
                  <MenuItem value="Total">Total</MenuItem>
                  <MenuItem value="Modif.">Modif.</MenuItem>
                  <MenuItem value="Lecture">Lecture</MenuItem>
                  <MenuItem value="Aucun">Aucun</MenuItem>
                </Select>
              </Box>
              <Box>
                <Select
                  size="small"
                  value={r.restaurant}
                  onChange={(e) =>
                    updateRolePermission(r.id, "restaurant", e.target.value)
                  }
                  sx={{ minWidth: 100 }}
                >
                  <MenuItem value="Total">Total</MenuItem>
                  <MenuItem value="Modif.">Modif.</MenuItem>
                  <MenuItem value="Lecture">Lecture</MenuItem>
                  <MenuItem value="Aucun">Aucun</MenuItem>
                </Select>
              </Box>
              <Box>
                <Select
                  size="small"
                  value={r.stock}
                  onChange={(e) =>
                    updateRolePermission(r.id, "stock", e.target.value)
                  }
                  sx={{ minWidth: 100 }}
                >
                  <MenuItem value="Total">Total</MenuItem>
                  <MenuItem value="Modif.">Modif.</MenuItem>
                  <MenuItem value="Lecture">Lecture</MenuItem>
                  <MenuItem value="Aucun">Aucun</MenuItem>
                </Select>
              </Box>
              <Box>
                <Select
                  size="small"
                  value={r.facturation}
                  onChange={(e) =>
                    updateRolePermission(r.id, "facturation", e.target.value)
                  }
                  sx={{ minWidth: 100 }}
                >
                  <MenuItem value="Total">Total</MenuItem>
                  <MenuItem value="Modif.">Modif.</MenuItem>
                  <MenuItem value="Création">Création</MenuItem>
                  <MenuItem value="Lecture">Lecture</MenuItem>
                  <MenuItem value="Aucun">Aucun</MenuItem>
                </Select>
              </Box>
              <Box>
                <Select
                  size="small"
                  value={r.rapports}
                  onChange={(e) =>
                    updateRolePermission(r.id, "rapports", e.target.value)
                  }
                  sx={{ minWidth: 100 }}
                >
                  <MenuItem value="Total">Total</MenuItem>
                  <MenuItem value="Lecture">Lecture</MenuItem>
                  <MenuItem value="Aucun">Aucun</MenuItem>
                </Select>
              </Box>
            </Box>
          ))}
        </Paper>
      </Stack>

      {/* Modal de création/édition utilisateur */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isCreating ? "Nouvel utilisateur" : "Gérer l'utilisateur"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nom complet"
              value={userForm.nom}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, nom: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={userForm.email}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, email: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            <TextField
              label="Rôle"
              select
              value={userForm.role}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, role: e.target.value }))
              }
              fullWidth
            >
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Responsable Hébergement">Responsable Hébergement</MenuItem>
              <MenuItem value="Responsable Restaurant">Responsable Restaurant</MenuItem>
              <MenuItem value="Staff Restaurant">Staff Restaurant</MenuItem>
              <MenuItem value="Économat">Économat</MenuItem>
              <MenuItem value="Comptable">Comptable</MenuItem>
            </TextField>
            <TextField
              label="Canal"
              select
              value={userForm.canal}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, canal: e.target.value }))
              }
              fullWidth
            >
              <MenuItem value="Tous">Tous</MenuItem>
              <MenuItem value="Hébergement">Hébergement</MenuItem>
              <MenuItem value="Restaurant">Restaurant</MenuItem>
            </TextField>
            <TextField
              label="Statut"
              select
              value={userForm.statut}
              onChange={(e) =>
                setUserForm((f) => ({
                  ...f,
                  statut: e.target.value as User["statut"],
                }))
              }
              fullWidth
            >
              <MenuItem value="Actif">Actif</MenuItem>
              {/* <MenuItem value="Invité">Invité</MenuItem> */}
              <MenuItem value="Suspendu">Suspendu</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={saveUser}>
            {isCreating ? "Créer" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
