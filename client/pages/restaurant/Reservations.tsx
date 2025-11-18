import { Box, Button, Chip, Grid, Paper, Typography } from "@mui/material";
import { addHours, isAfter, parseISO } from "date-fns";
import { useAssignTable, useRestoReservations } from "@/services/api";
import { Reservation } from "@shared/api";
import CommandesModal from "@/components/CommandesModal";

const SLOT_HOURS = 2; // default from paramètres stub

import { Fragment, useState } from "react";

export default function RestoReservations() {
  const { data: reservations } = useRestoReservations();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const assign = useAssignTable();

  const hours = [10, 12, 14, 18, 20];

  function canMarkNoShow(r: Reservation) {
    if (!r.heure) return false;
    const base = new Date();
    const [h, m] = r.heure.split(":").map(Number);
    base.setHours(h, m || 0, 0, 0);
    const limit = addHours(base, Math.max(0, r.gracePeriodMinutes / 60));
    return isAfter(new Date(), limit) && r.statut === "confirmee" && !r.tableId;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={2}>
        Réservations
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Grid container>
          <Grid item xs={12}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `160px repeat(${hours.length}, 1fr)`,
                gap: 1,
              }}
            >
              <Box />
              {hours.map((h) => (
                <Box
                  key={h}
                  sx={{ textAlign: "center", color: "text.secondary" }}
                >{`${h}:00`}</Box>
              ))}
              {reservations?.map((r) => (
                <Fragment key={r.id}>
                  <Box
                    key={`${r.id}-label`}
                    sx={{ py: 1, color: "text.secondary" }}
                  >
                    {r.clientId ?? "Client"}
                  </Box>
                  {hours.map((h, idx) => {
                    const isSlot = r.heure === `${h}:00`;
                    return (
                      <Box key={`${r.id}-${h}`} sx={{ p: 1 }}>
                        {isSlot && (
                          <Paper
                            sx={{
                              p: 1,
                              bgcolor: "primary.light",
                              color: "primary.contrastText",
                            }}
                          >
                            <Typography fontWeight={700}>
                              {r.nbPersonnes ?? 0} pers
                            </Typography>
                            <Typography variant="caption">
                              Statut: {r.statut}
                            </Typography>
                            {r.heureArrivee && (
                              <Typography variant="caption" sx={{ color: '#4CAF50', display: 'block' }}>
                                Arrivée: {r.heureArrivee}
                              </Typography>
                            )}
                            {r.heureDepart && (
                              <Typography variant="caption" sx={{ color: '#F44336', display: 'block' }}>
                                Départ: {r.heureDepart}
                              </Typography>
                            )}
                            {r.heureArrivee && !r.heureDepart && r.statut !== 'terminee' && (
                              <Chip 
                                label="Attente départ" 
                                size="small" 
                                color="warning" 
                                sx={{ mt: 0.5, height: 20 }}
                              />
                            )}
                            <Box
                              sx={{
                                mt: 1,
                                display: "flex",
                                gap: 1,
                                flexWrap: "wrap",
                              }}
                            >
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => setOpenFor(r.id)}
                              >
                                Commandes
                              </Button>
                              {!r.tableId && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    assign.mutate({
                                      tableId: `t${idx + 1}`,
                                      reservationId: r.id,
                                    })
                                  }
                                >
                                  Assigner
                                </Button>
                              )}
                              {canMarkNoShow(r) && (
                                <Chip
                                  label="No-show"
                                  color="default"
                                  size="small"
                                />
                              )}
                              {r.heureArrivee && !r.heureDepart && r.statut !== 'terminee' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="error"
                                  onClick={() => {
                                    // Quick mark as departed with current time
                                    const now = new Date();
                                    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                                    // In a real app, this would call an API
                                    r.heureDepart = currentTime;
                                    r.statut = 'terminee';
                                  }}
                                  sx={{ fontSize: '11px', py: 0.5 }}
                                >
                                  Client Parti
                                </Button>
                              )}
                            </Box>
                          </Paper>
                        )}
                      </Box>
                    );
                  })}
                </Fragment>
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>
      <CommandesModal
        reservationId={openFor ?? ""}
        open={!!openFor}
        onClose={() => setOpenFor(null)}
      />
    </Box>
  );
}
