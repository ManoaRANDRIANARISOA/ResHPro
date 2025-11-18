import { Box, Typography } from "@mui/material";
import { addDays, addHours, eachDayOfInterval, endOfMonth, endOfWeek, format, isWithinInterval, setHours, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Fragment } from "react";
import { chambres as chambresData } from "@/services/mock";
import type { Reservation, Chambre } from "@shared/api";

type View = "month" | "week" | "day";

function reservationColor(r: Reservation, cellDate: Date) {
  const now = new Date();
  const dStart = new Date(r.dateDebut);
  const dEnd = new Date(r.dateFin || r.dateDebut);
  const nowInStay = now >= dStart && now < dEnd;
  if (r.statut === "arrivee" && nowInStay) return "#EF5350"; // occupée - rouge (en cours)
  return "#66BB6A"; // réservée - vert (futur ou confirmé)
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
  onCellClick?: (chambreId: string, date: Date) => void;
  chambres?: Chambre[];
}

export function RoomCalendar({ 
  view, 
  dateRef, 
  statusFilter, 
  reservations,
  compact = false,
  onCellClick,
  chambres,
}: RoomCalendarProps) {
  const range = intervalFor(view, dateRef);

  const roomsData = chambres ?? chambresData;

  function roomDerivedStatus(roomId: string) {
    const room = roomsData.find(c => c.id === roomId)!;
    if (room.statut === "maintenance") return "maintenance" as const;
    const hasOverlap = reservations.some(r => {
      if (r.type !== 'hebergement' || r.chambreId !== roomId) return false;
      const resDebut = new Date(r.dateDebut);
      const resFin = r.dateFin ? new Date(r.dateFin) : addDays(resDebut, 1);
      const rangeStart = range.start;
      const rangeEnd = range.end;
      return resDebut < rangeEnd && resFin > rangeStart;
    });
    if (hasOverlap) {
      const now = new Date();
      const inStayNow = reservations.some(r => {
        if (r.type !== 'hebergement' || r.chambreId !== roomId) return false;
        const resDebut = new Date(r.dateDebut);
        const resFin = r.dateFin ? new Date(r.dateFin) : addDays(resDebut, 1);
        return r.statut === 'arrivee' && now >= resDebut && now < resFin;
      });
      return inStayNow ? 'occupee' : 'reservee';
    }
    return "libre" as const;
  }

  const rooms = roomsData.filter(c => 
    statusFilter === 'all' ? true : roomDerivedStatus(c.id) === statusFilter
  );

  function hasReservation(cId: string, dStart: Date, dEnd: Date) {
    const r = reservations.find(rr => {
      if (rr.type !== 'hebergement' || rr.chambreId !== cId) return false;
      const resDebut = new Date(rr.dateDebut);
      const resFin = rr.dateFin ? new Date(rr.dateFin) : addDays(resDebut, 1);
      return resDebut < dEnd && resFin > dStart;
    });
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
                return (
                  <Box 
                    key={`${c.id}-${i}`} 
                    onClick={() => onCellClick?.(c.id, d)}
                    sx={{ 
                      height: compact ? 20 : 32,
                      bgcolor: r ? reservationColor(r, d) : roomStatusColor(c.statut),
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { opacity: 0.8, cursor: onCellClick ? 'pointer' : 'default' }
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
                return (
                  <Box 
                    key={`${c.id}-${i}`} 
                    onClick={() => onCellClick?.(c.id, d)}
                    sx={{ 
                      height: compact ? 32 : 32,
                      bgcolor: r ? reservationColor(r, d) : roomStatusColor(c.statut),
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { opacity: 0.8, cursor: onCellClick ? 'pointer' : 'default' }
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
              return (
                <Box 
                  key={`${c.id}-${i}`} 
                  onClick={() => onCellClick?.(c.id, h)}
                  sx={{ 
                    height: compact ? 24 : 32,
                    bgcolor: r ? reservationColor(r, h) : roomStatusColor(c.statut),
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { opacity: 0.8, cursor: onCellClick ? 'pointer' : 'default' }
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