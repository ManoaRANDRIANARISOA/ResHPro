import { Box, Typography } from "@mui/material";
import { addDays, addHours, eachDayOfInterval, endOfMonth, endOfWeek, format, isWithinInterval, setHours, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Fragment } from "react";
import type { Reservation, Chambre, ChambreMaintenance } from "@shared/api";
import { sortChambres } from "@/services/firestore/chambres";
import {
  getReservationRoomInterval,
  isRoomReservedDuring,
  reservationHasRoom,
} from "@/services/firestore/reservations";

type View = "month" | "week" | "day";

function reservationColor(r: Reservation, cellDate: Date, roomId?: string) {
  const now = new Date();
  const { resDebut, resFin, stay: matchedStay } = getReservationRoomInterval(r, roomId, cellDate);
  const nowInStay = now >= resDebut && now < resFin;

  // Brouillon / En attente / Devis : Jaune / Ambre (seulement si aucun acompte n'est versé)
  const hasAcompte = Number((r as any).accompte || 0) > 0;
  if (r.statut === "en_attente" && !hasAcompte) return "#F59E0B";
  if (matchedStay?.statut === "en_attente" && !hasAcompte) return "#F59E0B";

  if (r.statut === "arrivee" && nowInStay) return "#EF5350"; // occupée - rouge (en cours)
  return "#66BB6A"; // réservée / confirmée - vert
}

function roomStatusColor(statut: string) {
  if (statut === "maintenance") return "#9E9E9E"; // hors service - gris
  return "#FFFFFF"; // libre si pas de resa - blanc
}

function intervalFor(view: View, base: Date) {
  if (view === "month") {
    const start = startOfMonth(base);
    const end = endOfMonth(base);
    return { start, end };
  }
  if (view === "week") {
    const start = startOfWeek(base, { weekStartsOn: 1 });
    const end = endOfWeek(base, { weekStartsOn: 1 });
    return { start, end };
  }
  const start = startOfDay(base);
  const end = addHours(start, 24);
  return { start, end };
}

interface RoomCalendarProps {
  view: View;
  dateRef: Date;
  statusFilter: "all" | "libre" | "reservee" | "occupee" | "maintenance";
  reservations: Reservation[];
  compact?: boolean;
  onCellClick?: (chambreId: string, date: Date, r?: Reservation) => void;
  onSelectReservation?: (r: Reservation) => void;
  chambres?: Chambre[];
  maintenance?: ChambreMaintenance[];
}

export function RoomCalendar({ 
  view, 
  dateRef, 
  statusFilter, 
  reservations,
  compact = false,
  onCellClick,
  onSelectReservation,
  chambres,
  maintenance,
}: RoomCalendarProps) {
  const range = intervalFor(view, dateRef);

  const roomsData = sortChambres(chambres ?? []);

  function hasMaintenance(roomId: string, rangeStart: Date, rangeEnd: Date) {
    return (maintenance || []).some((m: any) => {
      if (m.chambreId !== roomId) return false;
      const start = new Date(m.dateDebut || m.start);
      const rawEnd = m.dateFin || m.end;
      let end = rawEnd ? new Date(rawEnd) : addDays(start, 1);
      if (end <= start) end = addDays(start, 1);
      return start < rangeEnd && end > rangeStart;
    });
  }

  function roomDerivedStatus(roomId: string) {
    const room = roomsData.find(c => c.id === roomId)!;
    if (room?.statut === "maintenance") return "maintenance" as const;
    if (hasMaintenance(roomId, range.start, range.end)) return "maintenance" as const;
    const hasOverlap = reservations.some(r => isRoomReservedDuring(r, roomId, range.start, range.end));
    if (hasOverlap) {
      const now = new Date();
      const inStayNow = reservations.some(r => {
        if (r.statut !== 'arrivee') return false;
        if (!reservationHasRoom(r, roomId)) return false;
        const { resDebut, resFin } = getReservationRoomInterval(r, roomId);
        return now >= resDebut && now < resFin;
      });
      return inStayNow ? 'occupee' : 'reservee';
    }
    return "libre" as const;
  }

  const rooms = roomsData.filter(c => 
    statusFilter === 'all' ? true : roomDerivedStatus(c.id) === statusFilter
  );

  function hasReservation(cId: string, dStart: Date, dEnd: Date) {
    const inMaint = hasMaintenance(cId, dStart, dEnd);
    if (inMaint) return { type: "maintenance" } as any;
    const r = reservations.find(rr => isRoomReservedDuring(rr, cId, dStart, dEnd));
    return r;
  }

  if (view === 'month') {
    const start = startOfMonth(dateRef);
    const end = endOfMonth(dateRef);
    const days = eachDayOfInterval({ start, end });
    
    return (
      <Box sx={{ overflowX: 'auto', overflowY: 'visible' }}>
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: `${compact ? '50px' : '60px'} repeat(${days.length}, minmax(${compact ? '24px' : '32px'}, 1fr))`, 
          gap: compact ? 0.3 : 0.5, 
          alignItems: 'center', 
          minWidth: 'max-content' 
        }}>
          <Box sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }} />
          {days.map((d) => (
            <Box 
              key={d.toISOString()} 
              sx={{ 
                textAlign: 'center', 
                fontSize: compact ? '0.65rem' : '0.75rem', 
                fontWeight: 600, 
                color: 'text.secondary', 
                py: 0.5 
              }}
            >
              {format(d, 'd')}
            </Box>
          ))}
          {rooms.map((c) => (
            <Fragment key={c.id}>
              <Box sx={{ 
                position: 'sticky', 
                left: 0, 
                bgcolor: 'background.paper', 
                zIndex: 2, 
                py: compact ? 0.3 : 0.5, 
                pr: 1, 
                borderTop: '1px solid', 
                borderColor: 'divider' 
              }}>
                <Typography variant="body2" fontWeight={700} fontSize={compact ? '0.7rem' : undefined}>
                  {c.numero}
                </Typography>
                {!compact && (
                  <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
                    {c.categorie}
                  </Typography>
                )}
              </Box>
              {days.map((d, i) => {
                const r = hasReservation(c.id, d, addDays(d, 1));
                const isMaint = r && (r as any).type === 'maintenance';
                const reservationObj = (r && !isMaint) ? (r as Reservation) : undefined;
                return (
                  <Box 
                    key={`${c.id}-${i}`} 
                    onClick={() => {
                      if (reservationObj && onSelectReservation) {
                        onSelectReservation(reservationObj);
                        return;
                      }
                      onCellClick?.(c.id, d, reservationObj);
                    }}
                    sx={{ 
                      height: compact ? 20 : 32,
                      bgcolor: r ? (r as any).type === 'maintenance' ? '#9E9E9E' : reservationColor(r as Reservation, d, c.id) : roomStatusColor(c.statut),
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { opacity: 0.8, cursor: (onSelectReservation || onCellClick) ? 'pointer' : 'default' }
                    }} 
                  />
                );
              })}
            </Fragment>
          ))}
        </Box>
      </Box>
    );
  }

  if (view === 'week') {
    const start = startOfWeek(dateRef, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    
    return (
      <Box sx={{ overflowX: 'auto', overflowY: 'visible' }}>
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: `${compact ? '50px' : '60px'} repeat(7, minmax(${compact ? '60px' : '80px'}, 1fr))`, 
          gap: compact ? 0.3 : 0.5, 
          alignItems: 'center', 
          minWidth: 'max-content' 
        }}>
          <Box sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }} />
          {days.map((d) => (
            <Box 
              key={d.toISOString()} 
              sx={{ 
                textAlign: 'center', 
                fontSize: compact ? '0.65rem' : '0.75rem', 
                fontWeight: 600, 
                color: 'text.secondary', 
                py: 0.5 
              }}
            >
              {format(d, 'EEE d', { locale: fr })}
            </Box>
          ))}
          {rooms.map((c) => (
            <Fragment key={c.id}>
              <Box sx={{ 
                position: 'sticky', 
                left: 0, 
                bgcolor: 'background.paper', 
                zIndex: 2, 
                py: compact ? 0.3 : 0.5, 
                pr: 1, 
                borderTop: '1px solid', 
                borderColor: 'divider' 
              }}>
                <Typography variant="body2" fontWeight={700} fontSize={compact ? '0.7rem' : undefined}>
                  {c.numero}
                </Typography>
                {!compact && (
                  <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
                    {c.categorie}
                  </Typography>
                )}
              </Box>
              {days.map((d, i) => {
                const r = hasReservation(c.id, d, addDays(d, 1));
                const isMaint = r && (r as any).type === 'maintenance';
                const reservationObj = (r && !isMaint) ? (r as Reservation) : undefined;
                return (
                  <Box 
                    key={`${c.id}-${i}`} 
                    onClick={() => {
                      if (reservationObj && onSelectReservation) {
                        onSelectReservation(reservationObj);
                        return;
                      }
                      onCellClick?.(c.id, d, reservationObj);
                    }}
                    sx={{ 
                      height: compact ? 32 : 32,
                      bgcolor: r ? (r as any).type === 'maintenance' ? '#9E9E9E' : reservationColor(r as Reservation, d, c.id) : roomStatusColor(c.statut),
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { opacity: 0.8, cursor: (onSelectReservation || onCellClick) ? 'pointer' : 'default' }
                    }} 
                  />
                );
              })}
            </Fragment>
          ))}
        </Box>
      </Box>
    );
  }

  // day view: 24 hours
  const start = startOfDay(dateRef);
  const hours = Array.from({ length: 24 }).map((_, i) => setHours(start, i));
  
  return (
    <Box sx={{ overflowX: 'auto', overflowY: 'visible' }}>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: `${compact ? '50px' : '60px'} repeat(24, minmax(${compact ? '30px' : '40px'}, 1fr))`, 
        gap: compact ? 0.3 : 0.5, 
        alignItems: 'center', 
        minWidth: 'max-content' 
      }}>
        <Box sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }} />
        {hours.map((h, i) => (
          <Box 
            key={i} 
            sx={{ 
              textAlign: 'center', 
              fontSize: compact ? '0.6rem' : '0.7rem', 
              fontWeight: 600, 
              color: 'text.secondary', 
              py: 0.5 
            }}
          >
            {format(h, 'HH')}
          </Box>
        ))}
        {rooms.map((c) => (
          <Fragment key={c.id}>
            <Box sx={{ 
              position: 'sticky', 
              left: 0, 
              bgcolor: 'background.paper', 
              zIndex: 2, 
              py: compact ? 0.3 : 0.5, 
              pr: 1, 
              borderTop: '1px solid', 
              borderColor: 'divider' 
            }}>
              <Typography variant="body2" fontWeight={700} fontSize={compact ? '0.7rem' : undefined}>
                {c.numero}
              </Typography>
              {!compact && (
                <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
                  {c.categorie}
                </Typography>
              )}
            </Box>
            {hours.map((h, i) => {
              const r = hasReservation(c.id, h, addHours(h, 1));
              const isMaint = r && (r as any).type === 'maintenance';
              const reservationObj = (r && !isMaint) ? (r as Reservation) : undefined;
              return (
                <Box 
                  key={`${c.id}-${i}`} 
                  onClick={() => {
                    if (reservationObj && onSelectReservation) {
                      onSelectReservation(reservationObj);
                      return;
                    }
                    onCellClick?.(c.id, h, reservationObj);
                  }}
                  sx={{ 
                    height: compact ? 24 : 32,
                    bgcolor: r ? (r as any).type === 'maintenance' ? '#9E9E9E' : reservationColor(r as Reservation, h, c.id) : roomStatusColor(c.statut),
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { opacity: 0.8, cursor: (onSelectReservation || onCellClick) ? 'pointer' : 'default' }
                  }} 
                />
              );
            })}
          </Fragment>
        ))}
      </Box>
    </Box>
  );
}