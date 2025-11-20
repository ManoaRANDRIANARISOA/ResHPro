import React, { useState, useEffect } from 'react';
import { Box, Tooltip, Typography, Button, Grid } from '@mui/material';
import { Reservation, TableResto, Client } from '../../shared/api';

const SERVICE_START = 8; // 8h
const SERVICE_END = 22; // 22h
const TOTAL_MINUTES = (SERVICE_END - SERVICE_START) * 60; // 840 minutes
const DEFAULT_DURATION = 60; // 60 minutes par défaut

export interface EnrichedReservation extends Reservation {
  client?: Client;
}

interface DynamicScheduleProps {
  reservations: EnrichedReservation[];
  tables: TableResto[];
  clients?: Client[];
  onReservationClick?: (reservation: EnrichedReservation) => void;
  onReservationUpdate?: (updatedReservations: EnrichedReservation[]) => void;
  onMarkNoShow?: (reservationId: string) => void;
}

function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours - SERVICE_START) * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) + SERVICE_START;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function getCurrentTimeInMinutes(): number {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  return (currentHours - SERVICE_START) * 60 + currentMinutes;
}

function validateReservationTime(startMinutes: number, duration: number): { startMinutes: number; duration: number; endMinutes: number; isValid: boolean } {
  const endMinutes = startMinutes + duration;
  
  // Check if reservation starts before opening time
  if (startMinutes < 0) {
    return { startMinutes: 0, duration, endMinutes: duration, isValid: false };
  }
  
  // Check if reservation ends after closing time
  if (endMinutes > TOTAL_MINUTES) {
    const adjustedDuration = TOTAL_MINUTES - startMinutes;
    return { startMinutes, duration: adjustedDuration, endMinutes: TOTAL_MINUTES, isValid: false };
  }
  
  return { startMinutes, duration, endMinutes, isValid: true };
}

interface ReservationDisplayInfo {
  status: string;
  color: string;
  text: string;
  isExtended: boolean;
  isOverdue: boolean;
  plannedEndMinutes: number;
  actualEndMinutes?: number;
}

// Fonction optimisée avec cache pour éviter les recalculs
function getCachedReservationDisplayStatus(
  reservation: EnrichedReservation, 
  currentTimeMinutes: number,
  cache: React.MutableRefObject<Map<string, ReservationDisplayInfo>>
): ReservationDisplayInfo {
  const cacheKey = `${reservation.id}-${currentTimeMinutes}-${reservation.heureArrivee || 'no-arrivee'}-${reservation.heureDepart || 'no-depart'}`;
  
  if (cache.current.has(cacheKey)) {
    return cache.current.get(cacheKey)!;
  }
  
  const result = getReservationDisplayStatus(reservation, currentTimeMinutes);
  cache.current.set(cacheKey, result);
  
  // Limiter la taille du cache
  if (cache.current.size > 100) {
    const firstKey = cache.current.keys().next().value;
    cache.current.delete(firstKey);
  }
  
  return result;
}

function getReservationDisplayStatus(reservation: EnrichedReservation, currentTimeMinutes: number): ReservationDisplayInfo {
  const startMinutes = timeToMinutes(reservation.heureArrivee || reservation.heureDebut || reservation.heure || '00:00');
  const duration = reservation.duree || DEFAULT_DURATION;
  const plannedEndMinutes = startMinutes + duration;

  // CLIENT PARTI - gris seulement si l'heure de départ est passée OU statut terminé
  if (reservation.heureDepart) {
    const departMinutes = timeToMinutes(reservation.heureDepart);
    if (currentTimeMinutes >= departMinutes) {
      return { status: 'terminee', color: '#9E9E9E', text: 'Terminé', isExtended: false, isOverdue: false, plannedEndMinutes, actualEndMinutes: departMinutes };
    }
    // Si heureDepart est dans le futur, ne pas afficher "Terminé" - afficher selon l'état normal
  }

  // ANNULÉ - gris (mais NO-SHOW reste vert comme réservé avec indication spéciale)
  if (reservation.statut === 'annulee') {
    return { status: 'terminee', color: '#9E9E9E', text: 'Annulé', isExtended: false, isOverdue: false, plannedEndMinutes };
  }
  
  // NO-SHOW - reste vert mais avec indication spéciale
  if (reservation.statut === 'no_show') {
    return { status: 'no_show', color: '#66BB6A', text: 'Non arrivé', isExtended: false, isOverdue: false, plannedEndMinutes };
  }

  // CLIENT ARRIVÉ - toujours rouge (peu importe l'heure réelle)
  if (reservation.heureArrivee) {
    const arriveeMinutes = timeToMinutes(reservation.heureArrivee);
    if (currentTimeMinutes >= arriveeMinutes) {
      // Client présent = OCCUPÉ (même en avance, même en dépassement)
      return { 
        status: 'occupe', 
        color: '#EF5350', 
        text: 'Occupé', 
        isExtended: currentTimeMinutes > plannedEndMinutes, 
        isOverdue: currentTimeMinutes > plannedEndMinutes, 
        plannedEndMinutes,
        actualEndMinutes: currentTimeMinutes 
      };
    }
  }

  // PAS ENCORE ARRIVÉ - vert
  return { 
    status: 'reserve', 
    color: '#66BB6A', 
    text: 'Réservé', 
    isExtended: false, 
    isOverdue: false, 
    plannedEndMinutes 
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'reserve':
    case 'confirmee':
    case 'en_attente':
      return '#66BB6A';
    case 'occupe':
    case 'arrivee':
    case 'attente_depart':
    case 'depassement':
      return '#EF5350'; // Rouge pour occupé (standard du projet)
    case 'terminee':
    case 'annulee':
    case 'no_show':
      return '#9E9E9E'; // Gris pour terminé/annulé
    default:
      return '#E0E0E0'; // Gris clair par défaut
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'reserve':
    case 'confirmee':
      return 'Réservé';
    case 'en_attente':
      return 'En attente';
    case 'arrivee':
    case 'occupe':
      return 'Occupé';
    case 'attente_depart':
      return 'Attente départ';
    case 'depassement':
      return 'Dépassement';
    case 'terminee':
    case 'annulee':
      return 'Terminé';
    case 'no_show':
      return 'Non arrivé';
    default:
      return 'Disponible';
  }
}

function getClientName(reservation: EnrichedReservation, clients?: Client[]): string {
  // First check if the reservation has enriched client data (from Plan.tsx)
  if (reservation.client && reservation.client.nom) {
    return reservation.client.nom;
  }
  
  // Fallback to finding client in the clients array
  if (!reservation.clientId || !clients) return 'Client inconnu';
  const client = clients.find(c => c.id === reservation.clientId);
  return client?.nom || 'Client inconnu';
}

export default function DynamicSchedule({ reservations, tables, clients, onReservationClick, onReservationUpdate, onMarkNoShow }: DynamicScheduleProps) {
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(getCurrentTimeInMinutes());
  const [selectedReservation, setSelectedReservation] = useState<EnrichedReservation | null>(null);
  const [showTimeControls, setShowTimeControls] = useState(false);
  const [manualArrivalTime, setManualArrivalTime] = useState('');
  const [manualDepartureTime, setManualDepartureTime] = useState('');
  // État local pour les mises à jour instantanées
  const [localReservations, setLocalReservations] = useState<EnrichedReservation[]>(reservations);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  
  // Mémoriser les statuts d'affichage pour éviter les recalculs répétitifs
  const displayStatusCache = React.useRef<Map<string, ReservationDisplayInfo>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeMinutes(getCurrentTimeInMinutes());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const containerHeight = el.clientHeight;
    const lineTop = (currentTimeMinutes / TOTAL_MINUTES) * el.scrollHeight;
    const target = Math.max(0, Math.min(lineTop - containerHeight / 2, el.scrollHeight - containerHeight));
    el.scrollTo({ top: target, behavior: 'smooth' });
  }, [currentTimeMinutes]);

  // Nettoyer le cache toutes les 30 secondes pour éviter les fuites mémoire
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      displayStatusCache.current.clear();
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Synchroniser les props avec l'état local - OPTIMISÉ
  useEffect(() => {
    // Ne mettre à jour que si les données ont réellement changé
    const hasChanges = JSON.stringify(reservations) !== JSON.stringify(localReservations);
    if (hasChanges) {
      setLocalReservations(reservations);
    }
  }, [reservations]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReservationClick = (reservation: EnrichedReservation) => {
    setSelectedReservation(reservation);
    setManualArrivalTime(reservation.heureArrivee || '');
    setManualDepartureTime(reservation.heureDepart || '');
    setShowTimeControls(true);
    onReservationClick?.(reservation);
  };

  const handleUpdateArrivalTime = () => {
    if (selectedReservation && manualArrivalTime) {
      // Update the reservation with manual arrival time - SANS forcer le temps
      const updatedReservation = {
        ...selectedReservation,
        heureArrivee: manualArrivalTime,
        statut: 'arrivee' as const
      };
      
      // Mise à jour ultra-rapide en une seule passe
      const updatedLocalReservations = localReservations.map(reservation => 
        reservation.id === selectedReservation.id ? updatedReservation : reservation
      );
      setLocalReservations(updatedLocalReservations);
      setSelectedReservation(updatedReservation);
      
      // Notifier le parent immédiatement
      if (onReservationUpdate) {
        onReservationUpdate(updatedLocalReservations);
      }
    }
  };

  const handleUpdateDepartureTime = () => {
    if (selectedReservation && manualDepartureTime) {
      // Update the reservation with manual departure time - SANS forcer le temps
      const updatedReservation = {
        ...selectedReservation,
        heureDepart: manualDepartureTime,
        statut: 'terminee' as const
      };
      
      // Mise à jour ultra-rapide en une seule passe
      const updatedLocalReservations = localReservations.map(reservation => 
        reservation.id === selectedReservation.id ? updatedReservation : reservation
      );
      setLocalReservations(updatedLocalReservations);
      setSelectedReservation(updatedReservation);
      
      // Notifier le parent
      if (onReservationUpdate) {
        onReservationUpdate(updatedLocalReservations);
      }
      if (onReservationClick) {
        onReservationClick(updatedReservation);
      }
    }
  };

  const handleClearArrivalTime = () => {
    if (selectedReservation) {
      const updatedReservation = {
        ...selectedReservation,
        heureArrivee: undefined,
        statut: 'confirmee' as const
      };
      
      // Mise à jour ultra-rapide en une seule passe
      const updatedLocalReservations = localReservations.map(reservation => 
        reservation.id === selectedReservation.id ? updatedReservation : reservation
      );
      setLocalReservations(updatedLocalReservations);
      setSelectedReservation(updatedReservation);
      setManualArrivalTime('');
      
      // Notifier le parent
      if (onReservationUpdate) {
        onReservationUpdate(updatedLocalReservations);
      }
      if (onReservationClick) {
        onReservationClick(updatedReservation);
      }
    }
  };

  const handleClearDepartureTime = () => {
    if (selectedReservation) {
      const updatedReservation = {
        ...selectedReservation,
        heureDepart: undefined,
        statut: 'arrivee' as const
      };
      
      // Mise à jour ultra-rapide en une seule passe
      const updatedLocalReservations = localReservations.map(reservation => 
        reservation.id === selectedReservation.id ? updatedReservation : reservation
      );
      setLocalReservations(updatedLocalReservations);
      setSelectedReservation(updatedReservation);
      setManualDepartureTime('');
      
      // Notifier le parent
      if (onReservationUpdate) {
        onReservationUpdate(updatedLocalReservations);
      }
      if (onReservationClick) {
        onReservationClick(updatedReservation);
      }
    }
  };

  const handleQuickMarkDeparted = () => {
    if (selectedReservation) {
      // Optimisation : Mise à jour directe sans recalcul inutile
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Créer la réservation mise à jour
      const updatedReservation = {
        ...selectedReservation,
        heureDepart: currentTime,
        statut: 'terminee' as const
      };
      
      // Mise à jour ultra-rapide de l'état local (optimisée)
      const updatedLocalReservations = localReservations.map(reservation => 
        reservation.id === selectedReservation.id ? updatedReservation : reservation
      );
      
      // Appliquer les mises à jour en une seule passe
      setLocalReservations(updatedLocalReservations);
      setSelectedReservation(updatedReservation);
      setManualDepartureTime(currentTime);
      
      // Notifier le parent immédiatement (sans délai)
      if (onReservationUpdate) {
        onReservationUpdate(updatedLocalReservations);
      }
    }
  };


  const handleMarkNoShow = () => {
    if (selectedReservation) {
      // Optimisation : Mise à jour directe sans recalcul inutile
      const updatedReservation = {
        ...selectedReservation,
        statut: 'no_show' as const,
        heureArrivee: undefined // S'assurer qu'il n'y a pas d'heure d'arrivée
      };
      
      // Mise à jour ultra-rapide de l'état local (optimisée)
      const updatedLocalReservations = localReservations.map(reservation => 
        reservation.id === selectedReservation.id ? updatedReservation : reservation
      );
      
      // Appliquer les mises à jour en une seule passe
      setLocalReservations(updatedLocalReservations);
      setSelectedReservation(updatedReservation);
      setManualArrivalTime('');
      
      // Notifier le parent immédiatement (sans délai)
      if (onReservationUpdate) {
        onReservationUpdate(updatedLocalReservations);
      }
    }
  };

  const hourLabels = Array.from({ length: SERVICE_END - SERVICE_START + 1 }, (_, i) => {
    const hour = SERVICE_START + i;
    return `${hour}h`;
  });

  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      height: '600px',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#fafafa'
    }}>
      {/* Header avec les numéros de table */}
      <Box sx={{ 
        display: 'flex', 
        height: '50px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fff'
      }}>
        <Box sx={{ 
          width: '80px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderRight: '1px solid #e0e0e0',
          fontWeight: 'bold',
          backgroundColor: '#f5f5f5'
        }}>
          Heures
        </Box>
        {tables.map((table) => (
          <Box key={table.id} sx={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderRight: '1px solid #e0e0e0',
            fontWeight: 'bold',
            backgroundColor: '#f5f5f5'
          }}>
            {table.numero}
          </Box>
        ))}
      </Box>

      {/* Zone principale avec les créneaux horaires */}
      <Box sx={{ 
        display: 'flex', 
        height: 'calc(100% - 50px)',
        position: 'relative'
      }}>
        {/* Colonne des heures */}
        <Box sx={{ 
          width: '80px',
          borderRight: '1px solid #e0e0e0',
          backgroundColor: '#fff'
        }}>
          {hourLabels.map((hour, index) => (
            <Box key={hour} sx={{ 
              height: `${100 / hourLabels.length}%`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: index < hourLabels.length - 1 ? '1px solid #f0f0f0' : 'none',
              fontSize: '12px',
              color: '#666'
            }}>
              {hour}
            </Box>
          ))}
        </Box>

        {/* Zone des réservations */}
        <Box ref={scrollRef} sx={{ 
          flex: 1,
          position: 'relative',
          backgroundColor: '#fff',
          overflowY: 'auto'
        }}>
          {tables.map((table, tableIndex) => (
            <Box key={table.id} sx={{ 
              position: 'absolute',
              left: `${(tableIndex / tables.length) * 100}%`,
              width: `${100 / tables.length}%`,
              height: '100%',
              borderRight: tableIndex < tables.length - 1 ? '1px solid #f0f0f0' : 'none'
            }}>
              {/* Lignes de séparation horaires */}
              {hourLabels.slice(0, -1).map((_, hourIndex) => (
                <Box key={hourIndex} sx={{
                  position: 'absolute',
                  top: `${(hourIndex / (hourLabels.length - 1)) * 100}%`,
                  left: 0,
                  right: 0,
                  height: '1px',
                  backgroundColor: '#f0f0f0'
                }} />
              ))}

              {/* Réservations pour cette table */}
              {localReservations
                .filter(reservation => reservation.tableId === table.id)
                .map((reservation, reservationIndex) => {
                  const startMinutes = timeToMinutes(
                    (reservation.heureArrivee || reservation.heureDebut || reservation.heure || '00:00')
                  );
                  const duration = reservation.duree || DEFAULT_DURATION;
                  
                  // Obtenir le statut d'affichage avec extension et dépassement (version cachée)
                  const displayStatus = getCachedReservationDisplayStatus(reservation, currentTimeMinutes, displayStatusCache);
                  
                  // Calculer la position et la hauteur avec extension si nécessaire
                  let topPosition = (startMinutes / TOTAL_MINUTES) * 100;
                  let height = (duration / TOTAL_MINUTES) * 100;
                  
                  // Si client arrivé et pas encore parti
                  if (reservation.heureArrivee && !reservation.heureDepart) {
                    // Avant l'heure de fin prévue: montrer la durée planifiée (custom si fournie, sinon 60min)
                    if (currentTimeMinutes <= (startMinutes + duration)) {
                      height = ((reservation.duree || DEFAULT_DURATION) / TOTAL_MINUTES) * 100;
                    }
                  }

                  // Si la réservation est en dépassement, on étend jusqu'à l'heure actuelle
                  if (displayStatus.isExtended && displayStatus.actualEndMinutes) {
                    const extendedDuration = displayStatus.actualEndMinutes - startMinutes;
                    height = (extendedDuration / TOTAL_MINUTES) * 100;
                  }
                  
                  // Si le client est parti, utiliser l'heure réelle de départ
                  if (reservation.heureDepart) {
                    const departMinutes = timeToMinutes(reservation.heureDepart);
                    const actualDuration = departMinutes - startMinutes;
                    height = (actualDuration / TOTAL_MINUTES) * 100;
                  }
                  
                  const clientName = getClientName(reservation, clients);
                  const shortName = clientName.split(' ')[0] || clientName;
                  
                  // Utiliser la réservation mise à jour depuis localReservations pour le tooltip
                  const updatedReservation = localReservations.find(r => r.id === reservation.id) || reservation;

                  return (
                    <Tooltip
                      key={reservation.id}
                      title={
                        <Box sx={{ p: 1, minWidth: '200px' }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                            {clientName}
                          </Typography>
                          <Typography variant="body2">
                            Horaire prévu: {updatedReservation.heureDebut || updatedReservation.heure} - {minutesToTime(displayStatus.plannedEndMinutes)}
                          </Typography>
                          {updatedReservation.heureArrivee && (
                            <Typography variant="body2" sx={{ color: '#4CAF50' }}>
                              Arrivée réelle: {updatedReservation.heureArrivee}
                            </Typography>
                          )}
                          {updatedReservation.heureDepart && (
                            <Typography variant="body2" sx={{ color: '#F44336' }}>
                              Départ réel: {updatedReservation.heureDepart}
                            </Typography>
                          )}
                          {displayStatus.isOverdue && (
                            <Typography variant="body2" sx={{ color: '#FF9800', fontWeight: 'bold', mb: 1 }}>
                              ⚠️ Dépassement détecté
                            </Typography>
                          )}
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Statut: <strong>{displayStatus.text}</strong>
                          </Typography>
                          {!updatedReservation.heureArrivee && (
                            <Button
                              variant="contained"
                              size="small"
                              color="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                const now = new Date();
                                const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                                const newUpdatedReservation = {
                                  ...updatedReservation,
                                  heureArrivee: currentTime,
                                  statut: 'arrivee' as const
                                };
                                
                                // Mise à jour ultra-rapide en une seule passe
                                const updatedLocalReservations = localReservations.map(r => 
                                  r.id === newUpdatedReservation.id ? newUpdatedReservation : r
                                );
                                setLocalReservations(updatedLocalReservations);
                                
                                // Notifier le parent immédiatement
                                if (onReservationUpdate) {
                                  onReservationUpdate(updatedLocalReservations);
                                }
                              }}
                              sx={{ 
                                fontSize: '11px', 
                                mt: 1,
                                backgroundColor: '#4caf50',
                                '&:hover': { backgroundColor: '#388e3c' }
                              }}
                            >
                              Arrivée Maintenant ✓
                            </Button>
                          )}
                          {updatedReservation.heureArrivee && !updatedReservation.heureDepart && (
                            <Button
                              variant="contained"
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Optimisation : appel direct sans setState intermédiaire
                                const now = new Date();
                                const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                                const newUpdatedReservation = {
                                  ...updatedReservation,
                                  heureDepart: currentTime,
                                  statut: 'terminee' as const
                                };
                                
                                // Mise à jour ultra-rapide en une seule passe
                                const updatedLocalReservations = localReservations.map(r => 
                                  r.id === newUpdatedReservation.id ? newUpdatedReservation : r
                                );
                                setLocalReservations(updatedLocalReservations);
                                
                                // Notifier le parent immédiatement
                                if (onReservationUpdate) {
                                  onReservationUpdate(updatedLocalReservations);
                                }
                              }}
                              sx={{ 
                                fontSize: '11px', 
                                mt: 1,
                                backgroundColor: '#d32f2f',
                                '&:hover': { backgroundColor: '#b71c1c' }
                              }}
                            >
                              Client Parti ✓
                            </Button>
                          )}
                          {!updatedReservation.heureArrivee && !updatedReservation.heureDepart && updatedReservation.statut !== 'no_show' && currentTimeMinutes > (timeToMinutes(updatedReservation.heureDebut || updatedReservation.heure || '00:00') + (updatedReservation.duree || DEFAULT_DURATION)) && (
                            <Button
                              variant="contained"
                              size="small"
                              color="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newUpdatedReservation = {
                                  ...updatedReservation,
                                  statut: 'no_show' as const,
                                  heureArrivee: undefined
                                };
                                const updatedLocalReservations = localReservations.map(r => 
                                  r.id === newUpdatedReservation.id ? newUpdatedReservation : r
                                );
                                setLocalReservations(updatedLocalReservations);
                                if (onReservationUpdate) {
                                  onReservationUpdate(updatedLocalReservations);
                                }
                                if (onMarkNoShow) {
                                  onMarkNoShow(newUpdatedReservation.id);
                                }
                              }}
                              sx={{ 
                                fontSize: '11px', 
                                mt: 1,
                                backgroundColor: '#4caf50',
                                '&:hover': { backgroundColor: '#388e3c' }
                              }}
                            >
                              Marquer non arrivé ✓
                            </Button>
                          )}
                        </Box>
                      }
                      arrow
                    >
                      <Box
                        onClick={() => handleReservationClick(reservation)}
                        sx={{
                          position: 'absolute',
                          top: `${topPosition}%`,
                          left: '5px',
                          right: '5px',
                          height: `${height}%`,
                          backgroundColor: displayStatus.color,
                          borderRadius: '4px',
                          cursor: onReservationClick ? 'pointer' : 'default',
                          transition: 'all 0.2s ease-in-out',
                          border: displayStatus.isOverdue ? '2px solid #FF5722' : 'none',
                          animation: displayStatus.isOverdue ? 'strongPulse 1.5s ease-in-out infinite' : 'none',
                          '@keyframes strongPulse': {
                            '0%, 100%': { 
                              borderColor: '#FF5722',
                              borderWidth: '3px',
                              boxShadow: '0 0 0 0 rgba(255, 87, 34, 0.7)',
                              transform: 'scale(1)'
                            },
                            '50%': { 
                              borderColor: '#FF1744',
                              borderWidth: '4px',
                              boxShadow: '0 0 0 8px rgba(255, 23, 68, 0.3)',
                              transform: 'scale(1.02)'
                            }
                          },
                          '&:hover': {
                            transform: 'scale(1.05)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                            zIndex: 10
                          },
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          overflow: 'hidden'
                        }}
                      >
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: '#fff', 
                            fontWeight: 'bold',
                            textAlign: 'center',
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden'
                          }}
                        >
                          {shortName}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })
              }
            </Box>
          ))}

          {/* Ligne rouge de l'heure actuelle */}
          {currentTimeMinutes >= 0 && currentTimeMinutes <= TOTAL_MINUTES && (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  top: `${(currentTimeMinutes / TOTAL_MINUTES) * 100}%`,
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: '#f44336',
                  zIndex: 20,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: '-4px',
                    top: '-4px',
                    width: '10px',
                    height: '10px',
                    backgroundColor: '#f44336',
                    borderRadius: '50%'
                  }
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: `${(currentTimeMinutes / TOTAL_MINUTES) * 100}%`,
                  left: '85px',
                  backgroundColor: '#f44336',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  zIndex: 21,
                  transform: 'translateY(-50%)'
                }}
              >
                {minutesToTime(currentTimeMinutes)}
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Contrôles manuels pour l'arrivée et le départ */}
      {showTimeControls && selectedReservation && (
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Gestion des horaires - {getClientName(selectedReservation, clients)}
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Heure d'arrivée
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <input
                    type="time"
                    value={manualArrivalTime}
                    onChange={(e) => setManualArrivalTime(e.target.value)}
                    style={{
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleUpdateArrivalTime}
                    disabled={!manualArrivalTime}
                    sx={{ minWidth: '80px' }}
                  >
                    Enregistrer
                  </Button>
                  {selectedReservation.heureArrivee && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleClearArrivalTime}
                      color="error"
                      sx={{ minWidth: '60px' }}
                    >
                      Effacer
                    </Button>
                  )}
                </Box>
                {selectedReservation.heureArrivee && (
                  <Typography variant="caption" sx={{ color: 'green', mt: 1, display: 'block' }}>
                    Arrivée enregistrée: {selectedReservation.heureArrivee}
                  </Typography>
                )}
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Heure de départ
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <input
                    type="time"
                    value={manualDepartureTime}
                    onChange={(e) => setManualDepartureTime(e.target.value)}
                    style={{
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleUpdateDepartureTime}
                    disabled={!manualDepartureTime}
                    sx={{ minWidth: '80px' }}
                  >
                    Enregistrer
                  </Button>
                  {selectedReservation.heureDepart && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleClearDepartureTime}
                      color="error"
                      sx={{ minWidth: '60px' }}
                    >
                      Effacer
                    </Button>
                  )}
                </Box>
                {selectedReservation.heureDepart && (
                  <Typography variant="caption" sx={{ color: 'red', mt: 1, display: 'block' }}>
                    Départ enregistré: {selectedReservation.heureDepart}
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Statut actuel: <strong>{getCachedReservationDisplayStatus(selectedReservation, currentTimeMinutes, displayStatusCache).text}</strong>
              </Typography>
              {getCachedReservationDisplayStatus(selectedReservation, currentTimeMinutes, displayStatusCache).isOverdue && (
                <Typography variant="caption" sx={{ color: '#FF5722', fontWeight: 'bold' }}>
                  ⚠️ Dépassement détecté - Action requise
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {selectedReservation.heureArrivee && !selectedReservation.heureDepart && (
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  onClick={handleQuickMarkDeparted}
                  sx={{ fontSize: '12px' }}
                >
                  Client Parti ✓
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowTimeControls(false)}
              >
                Fermer
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}