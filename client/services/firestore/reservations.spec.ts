import { describe, it, expect } from "vitest";
import {
  getReservationRoomInterval,
  isRoomReservedDuring,
  reservationHasRoom,
} from "./reservations";
import type { Reservation } from "@shared/api";
import { getReservationStays, isOfficialInvoice, isProformaDocument } from "@shared/api";
import { addDays } from "date-fns";

describe("Reservation Interval & Overlap Logic", () => {
  it("correctly identifies 1 night reservation from 2026-09-02 to 2026-09-03", () => {
    const reservation: Reservation = {
      id: "res-1",
      type: "hebergement",
      chambreId: "ch-01",
      dateDebut: "2026-09-02T00:00:00.000Z",
      dateFin: "2026-09-03T00:00:00.000Z",
      statut: "confirmee",
      gracePeriodMinutes: 0,
    };

    expect(reservationHasRoom(reservation, "ch-01")).toBe(true);
    expect(reservationHasRoom(reservation, "ch-02")).toBe(false);

    const { resDebut, resFin } = getReservationRoomInterval(reservation, "ch-01");
    expect(resDebut.toISOString()).toBe("2026-09-02T00:00:00.000Z");
    expect(resFin.toISOString()).toBe("2026-09-03T00:00:00.000Z");

    const day1 = new Date("2026-09-01T00:00:00.000Z");
    const day2 = new Date("2026-09-02T00:00:00.000Z");
    const day3 = new Date("2026-09-03T00:00:00.000Z");
    const day4 = new Date("2026-09-04T00:00:00.000Z");

    // Day 1: cell [Sep 1, Sep 2) -> Not reserved
    expect(isRoomReservedDuring(reservation, "ch-01", day1, day2)).toBe(false);

    // Day 2 (Night of stay): cell [Sep 2, Sep 3) -> RESERVED (Green)
    expect(isRoomReservedDuring(reservation, "ch-01", day2, day3)).toBe(true);

    // Day 3 (Check-out day): cell [Sep 3, Sep 4) -> LIBRE / AVAILABLE (White)
    expect(isRoomReservedDuring(reservation, "ch-01", day3, day4)).toBe(false);
  });

  it("handles reservations with chambresDetails correctly", () => {
    const reservation: Reservation = {
      id: "res-2",
      type: "hebergement",
      chambreIds: ["ch-01", "ch-02"],
      dateDebut: "2026-09-02T00:00:00.000Z",
      dateFin: "2026-09-05T00:00:00.000Z",
      statut: "confirmee",
      gracePeriodMinutes: 0,
      chambresDetails: [
        {
          chambreId: "ch-01",
          dateDebut: "2026-09-02T00:00:00.000Z",
          dateFin: "2026-09-03T00:00:00.000Z", // 1 night
          nuits: 1,
        },
        {
          chambreId: "ch-02",
          dateDebut: "2026-09-02T00:00:00.000Z",
          dateFin: "2026-09-04T00:00:00.000Z", // 2 nights
          nuits: 2,
        },
      ],
    };

    const day2 = new Date("2026-09-02T00:00:00.000Z");
    const day3 = new Date("2026-09-03T00:00:00.000Z");
    const day4 = new Date("2026-09-04T00:00:00.000Z");

    // ch-01: only day 2 reserved
    expect(isRoomReservedDuring(reservation, "ch-01", day2, day3)).toBe(true);
    expect(isRoomReservedDuring(reservation, "ch-01", day3, day4)).toBe(false);

    // ch-02: day 2 and day 3 reserved, day 4 free
    expect(isRoomReservedDuring(reservation, "ch-02", day2, day3)).toBe(true);
    expect(isRoomReservedDuring(reservation, "ch-02", day3, day4)).toBe(true);
    expect(isRoomReservedDuring(reservation, "ch-02", day4, addDays(day4, 1))).toBe(false);
  });

  it("handles fallback to 1 night when dateFin is missing or equal to dateDebut", () => {
    const reservation: Reservation = {
      id: "res-3",
      type: "hebergement",
      chambreId: "ch-01",
      dateDebut: "2026-09-02T00:00:00.000Z",
      dateFin: "2026-09-02T00:00:00.000Z",
      statut: "confirmee",
      gracePeriodMinutes: 0,
    };

    const { resDebut, resFin } = getReservationRoomInterval(reservation, "ch-01");
    expect(resDebut.getTime()).toBe(new Date("2026-09-02T00:00:00.000Z").getTime());
    expect(resFin.getTime()).toBe(addDays(resDebut, 1).getTime());
  });

  it("ignores cancelled reservations", () => {
    const reservation: Reservation = {
      id: "res-4",
      type: "hebergement",
      chambreId: "ch-01",
      dateDebut: "2026-09-02T00:00:00.000Z",
      dateFin: "2026-09-03T00:00:00.000Z",
      statut: "annulee",
      gracePeriodMinutes: 0,
    };

    const day2 = new Date("2026-09-02T00:00:00.000Z");
    const day3 = new Date("2026-09-03T00:00:00.000Z");

    expect(isRoomReservedDuring(reservation, "ch-01", day2, day3)).toBe(false);
  });
});

import { DEFAULT_HEBERGEMENT_TAXES, HebergementTaxe } from "@shared/tenant";

describe("Hebergement Taxes & Vignettes Defaults and Calculation", () => {
  it("provides valid default taxes (Taxe Communale & Vignette Touristique)", () => {
    expect(DEFAULT_HEBERGEMENT_TAXES).toHaveLength(2);

    const tc = DEFAULT_HEBERGEMENT_TAXES.find((t) => t.id === "taxe_communale");
    expect(tc).toBeDefined();
    expect(tc?.montant).toBe(4000);
    expect(tc?.typeCalcul).toBe("fixe");
    expect(tc?.actif).toBe(true);

    const vt = DEFAULT_HEBERGEMENT_TAXES.find((t) => t.id === "vignette_touristique");
    expect(vt).toBeDefined();
    expect(vt?.montant).toBe(5000);
    expect(vt?.typeCalcul).toBe("par_nuitee");
    expect(vt?.actif).toBe(true);
  });

  it("calculates expected tax amounts for 1 night and multi-night stays", () => {
    const calculateTaxes = (taxes: HebergementTaxe[], nights: number, rooms: number, persons: number) => {
      return taxes
        .filter((t) => t.actif)
        .map((t) => {
          let qte = 1;
          if (t.typeCalcul === "fixe") qte = 1;
          else if (t.typeCalcul === "par_nuitee") qte = nights;
          else if (t.typeCalcul === "par_chambre_nuitee") qte = nights * rooms;
          else if (t.typeCalcul === "par_personne_nuitee") qte = nights * persons;
          return { nom: t.nom, qte, montant: t.montant * qte };
        });
    };

    // 1 night stay: 1 room, 2 persons
    const result1Night = calculateTaxes(DEFAULT_HEBERGEMENT_TAXES, 1, 1, 2);
    expect(result1Night).toEqual([
      { nom: "Taxe Communale", qte: 1, montant: 4000 },
      { nom: "Vignette Touristique", qte: 1, montant: 5000 },
    ]);
    const total1Night = result1Night.reduce((s, t) => s + t.montant, 0);
    expect(total1Night).toBe(9000);

    // 3 nights stay: 2 rooms, 4 persons
    const result3Nights = calculateTaxes(DEFAULT_HEBERGEMENT_TAXES, 3, 2, 4);
    expect(result3Nights).toEqual([
      { nom: "Taxe Communale", qte: 1, montant: 4000 },
      { nom: "Vignette Touristique", qte: 3, montant: 15000 },
    ]);
    const total3Nights = result3Nights.reduce((s, t) => s + t.montant, 0);
    expect(total3Nights).toBe(19000);
  });
});

describe("Multi-Stays Non-Contiguous Intervals & Proforma Logic", () => {
  it("frees intermediate non-contiguous days for other clients", () => {
    // Client reserves room ch-01 from Oct 10 to Oct 12, then from Oct 20 to Oct 23
    const reservation: Reservation = {
      id: "res-multi-stay",
      type: "hebergement",
      chambreId: "ch-01",
      dateDebut: "2026-10-10T00:00:00.000Z",
      dateFin: "2026-10-23T00:00:00.000Z",
      statut: "confirmee",
      gracePeriodMinutes: 0,
      stays: [
        {
          id: "stay-1",
          chambreId: "ch-01",
          dateDebut: "2026-10-10T00:00:00.000Z",
          dateFin: "2026-10-12T00:00:00.000Z", // 2 nights
          nuits: 2,
        },
        {
          id: "stay-2",
          chambreId: "ch-01",
          dateDebut: "2026-10-20T00:00:00.000Z",
          dateFin: "2026-10-23T00:00:00.000Z", // 3 nights
          nuits: 3,
        },
      ],
    };

    // Stays extracted
    const stays = getReservationStays(reservation);
    expect(stays).toHaveLength(2);
    expect(stays[0].id).toBe("stay-1");
    expect(stays[1].id).toBe("stay-2");

    // Oct 10 to Oct 12: Occupied
    expect(
      isRoomReservedDuring(
        reservation,
        "ch-01",
        new Date("2026-10-10T00:00:00.000Z"),
        new Date("2026-10-11T00:00:00.000Z")
      )
    ).toBe(true);
    expect(
      isRoomReservedDuring(
        reservation,
        "ch-01",
        new Date("2026-10-11T00:00:00.000Z"),
        new Date("2026-10-12T00:00:00.000Z")
      )
    ).toBe(true);

    // Oct 12 check-out to Oct 20 check-in: completely FREE for other clients!
    expect(
      isRoomReservedDuring(
        reservation,
        "ch-01",
        new Date("2026-10-12T00:00:00.000Z"),
        new Date("2026-10-13T00:00:00.000Z")
      )
    ).toBe(false);
    expect(
      isRoomReservedDuring(
        reservation,
        "ch-01",
        new Date("2026-10-15T00:00:00.000Z"),
        new Date("2026-10-18T00:00:00.000Z")
      )
    ).toBe(false);
    expect(
      isRoomReservedDuring(
        reservation,
        "ch-01",
        new Date("2026-10-19T00:00:00.000Z"),
        new Date("2026-10-20T00:00:00.000Z")
      )
    ).toBe(false);

    // Oct 20 to Oct 23: Occupied
    expect(
      isRoomReservedDuring(
        reservation,
        "ch-01",
        new Date("2026-10-20T00:00:00.000Z"),
        new Date("2026-10-21T00:00:00.000Z")
      )
    ).toBe(true);
    expect(
      isRoomReservedDuring(
        reservation,
        "ch-01",
        new Date("2026-10-22T00:00:00.000Z"),
        new Date("2026-10-23T00:00:00.000Z")
      )
    ).toBe(true);

    // Oct 23 check-out onwards: FREE
    expect(
      isRoomReservedDuring(
        reservation,
        "ch-01",
        new Date("2026-10-23T00:00:00.000Z"),
        new Date("2026-10-24T00:00:00.000Z")
      )
    ).toBe(false);
  });

  it("transparently synthesizes stays for legacy reservations without stays array", () => {
    const legacyReservation: Reservation = {
      id: "res-legacy",
      type: "hebergement",
      chambreId: "ch-05",
      dateDebut: "2026-11-01T00:00:00.000Z",
      dateFin: "2026-11-04T00:00:00.000Z",
      statut: "confirmee",
      gracePeriodMinutes: 0,
    };

    const stays = getReservationStays(legacyReservation);
    expect(stays).toHaveLength(1);
    expect(stays[0].chambreId).toBe("ch-05");
    expect(stays[0].dateDebut).toBe("2026-11-01T00:00:00.000Z");
    expect(stays[0].dateFin).toBe("2026-11-04T00:00:00.000Z");
    expect(stays[0].nuits).toBe(3);
  });

  it("correctly identifies proforma / devis vs official invoices", () => {
    expect(isProformaDocument({ typeDocument: "proforma" } as any)).toBe(true);
    expect(isProformaDocument({ typeDocument: "devis" } as any)).toBe(true);
    expect(isProformaDocument({ typeDocument: "facture" } as any)).toBe(false);
    expect(isProformaDocument({} as any)).toBe(false);
  });

  it("strictly discriminates official accounting invoices from proformas or cancelled documents", () => {
    expect(isOfficialInvoice({ typeDocument: "facture", statut: "emise" } as any)).toBe(true);
    expect(isOfficialInvoice({ typeDocument: "facture", statut: "payee" } as any)).toBe(true);
    expect(isOfficialInvoice({ typeDocument: "proforma", statut: "emise" } as any)).toBe(false);
    expect(isOfficialInvoice({ typeDocument: "devis", statut: "emise" } as any)).toBe(false);
    expect(isOfficialInvoice({ typeDocument: "facture", statut: "annulee" } as any)).toBe(false);
    expect(isOfficialInvoice({ numero: "PRO-2026-0001", statut: "emise" } as any)).toBe(false);
  });
});

