import { Facture, Client, BulletinPaie, Employe, PlanningShift } from "@shared/api";
import { TenantConfig, TenantPublicConfig } from "@shared/tenant";

// Utilitaires pour exporter des données en CSV et PDF

export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  // Extraire les en-têtes si non fournis
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Créer les lignes CSV
  const rows = data.map(item => 
    csvHeaders.map(header => {
      const value = item[header];
      // Échapper les guillemets et entourer de guillemets si nécessaire
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  // Ajouter les en-têtes
  const csv = [csvHeaders.join(','), ...rows].join('\n');

  // Créer le blob et télécharger
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(title: string, data: any[], filename: string, tenantName: string = "ResiPro") {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  // Créer un contenu HTML pour l'impression
  const headers = Object.keys(data[0]);
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body {
          font-family: 'Inter', Arial, sans-serif;
          padding: 20px;
          color: #1e293b;
        }
        h1 {
          color: #0f172a;
          border-bottom: 2px solid #6E8EF5;
          padding-bottom: 10px;
          font-size: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        th {
          background-color: #6E8EF5;
          color: white;
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
        }
        td {
          padding: 9px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 12px;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          color: #64748b;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p style="font-size: 12px; color: #64748b;">Date d'export: ${new Date().toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(item => `
            <tr>
              ${headers.map(h => `<td>${item[h] !== undefined && item[h] !== null ? item[h] : ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        <p>${tenantName} — Système de Gestion Intégré</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Moteur d'impression haute fidélité pour facture individuelle (Format A4 - 1 page)
 */
export function printFacturePro(
  facture: Facture,
  tenantConfig?: Partial<TenantConfig & TenantPublicConfig> | null,
  clientData?: Partial<Client> | null
) {
  // Récupération des informations dynamiques de l'établissement
  const etablissementNom = tenantConfig?.nom || "Établissement";
  const logoUrl = tenantConfig?.logoUrl || "";
  const nif = tenantConfig?.nif?.trim() ? tenantConfig.nif : "À fournir par le client";
  const stat = tenantConfig?.stat?.trim() ? tenantConfig.stat : "À fournir par le client";
  const rcs = tenantConfig?.rcs || "";
  const etablissementAdresse = tenantConfig?.adresse || "";
  const etablissementTel = tenantConfig?.telephone || "";
  const etablissementEmail = tenantConfig?.email || "";
  const rib = tenantConfig?.rib || "";
  const mvola = tenantConfig?.mvola || "";
  const cachetSignatureUrl = tenantConfig?.cachetSignatureUrl || "";

  // Informations Client & Agence
  const clientNom = facture.clientNom || clientData?.nom || "Client";
  const clientTel = facture.clientTelephone || clientData?.telephone || "";
  const clientEmail = facture.clientEmail || clientData?.email || "";
  const clientAdresse = facture.clientAdresse || clientData?.adresse || "";
  const agenceVoyage = facture.agenceVoyage || clientData?.agenceVoyage || "";

  // Dates & Numéro
  const dateEmission = new Date(facture.date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const dateEcheance = facture.dueDate
    ? new Date(facture.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : "À réception";
  const datePaiement = facture.datePaiement
    ? new Date(facture.datePaiement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  // Mode de paiement
  const paymentLabels: Record<string, string> = {
    especes: "Espèces",
    mobile_money: "Mobile Money (MVola / Airtel / Orange)",
    carte: "Carte Bancaire (TPE)",
    virement: "Virement Bancaire",
    cheque: "Chèque Bancaire",
  };
  const modePaiementLabel = facture.modePaiement
    ? (paymentLabels[facture.modePaiement] || facture.modePaiement)
    : "Non spécifié";

  // Calculs : Sous-total brut, remise, net à payer
  const lignes = facture.lignes || [];
  const rawSubTotal = lignes.reduce((s, l) => s + (l.qte * l.pu), 0);
  const sousTotal = facture.sousTotal !== undefined ? facture.sousTotal : rawSubTotal;
  const remisePct = facture.remisePourcentage || 0;
  const remiseMontant = facture.remiseMontant !== undefined
    ? facture.remiseMontant
    : (remisePct > 0 ? Math.round((sousTotal * remisePct) / 100) : 0);
  const totalNet = facture.totalTTC || (sousTotal - remiseMontant);
  const accompte = (facture as any).accompte || 0;
  const methodePaiementAccompte = (facture as any).methodePaiementAccompte || "";
  const resteAPayer = totalNet - accompte;

  // Statut
  const isPayee = facture.statut === "payee";
  const isAnnulee = facture.statut === "annulee";

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Facture ${facture.numero} - ${etablissementNom}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }

        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #ffffff;
          color: #0f172a;
          margin: 0;
          padding: 10px;
          display: flex;
          justify-content: center;
          font-size: 13px;
        }

        .invoice-container {
          max-width: 800px;
          width: 100%;
          background: #ffffff;
          padding: 24px 28px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        @media print {
          body {
            padding: 0;
            background: #ffffff;
          }
          .invoice-container {
            border: none;
            padding: 0;
            max-width: 100%;
          }
        }

        /* HEADER */
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 16px;
          border-bottom: 2px solid #f1f5f9;
          margin-bottom: 16px;
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-logo {
          width: 58px;
          height: 58px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .brand-fallback-logo {
          width: 54px;
          height: 54px;
          background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
          color: #ffffff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 20px;
        }

        .brand-details h1 {
          margin: 0 0 3px 0;
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.3px;
        }

        .brand-details p {
          margin: 1.5px 0;
          font-size: 12px;
          color: #475569;
        }

        .fiscal-tags {
          margin-top: 5px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .fiscal-badge {
          display: inline-block;
          font-size: 10.5px;
          font-weight: 600;
          color: #334155;
          background-color: #f1f5f9;
          padding: 2px 7px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .invoice-meta {
          text-align: right;
        }

        .invoice-title {
          font-size: 20px;
          font-weight: 800;
          color: #1e293b;
          letter-spacing: 0.5px;
          margin: 0 0 4px 0;
        }

        .invoice-number {
          font-size: 13px;
          font-weight: 700;
          color: #4f46e5;
          margin-bottom: 6px;
        }

        .status-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-paid {
          background-color: #dcfce7;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .status-pending {
          background-color: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }

        .status-cancelled {
          background-color: #f1f5f9;
          color: #64748b;
          border: 1px solid #cbd5e1;
        }

        /* CLIENT & AGENCY SECTION */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 18px;
        }

        .info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
        }

        .info-card-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .info-card-content h3 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .info-card-content p {
          margin: 2px 0;
          font-size: 12px;
          color: #334155;
        }

        .agency-highlight {
          background-color: #eef2ff;
          border: 1px solid #c7d2fe;
          border-radius: 6px;
          padding: 4px 8px;
          margin-top: 6px;
          font-size: 11.5px;
          font-weight: 600;
          color: #3730a3;
          display: inline-block;
        }

        /* ITEMS TABLE */
        .table-container {
          margin-bottom: 16px;
        }

        table.items-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        table.items-table th {
          background-color: #f1f5f9;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 8px 10px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }

        table.items-table td {
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 12.5px;
          color: #1e293b;
        }

        table.items-table tr:last-child td {
          border-bottom: 1px solid #e2e8f0;
        }

        .item-desc {
          font-weight: 600;
          color: #0f172a;
        }

        .item-note {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
          font-style: italic;
        }

        /* TOTALS BREAKDOWN */
        .summary-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-top: 14px;
        }

        .payment-details {
          flex: 1;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
        }

        .payment-details p {
          margin: 3px 0;
          color: #475569;
        }

        .payment-details strong {
          color: #0f172a;
        }

        .totals-box {
          width: 280px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 12.5px;
          color: #475569;
          margin-bottom: 6px;
        }

        .total-row.discount {
          color: #059669;
          font-weight: 600;
        }

        .total-row.final {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 2px solid #e2e8f0;
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }

        .final-price {
          color: #4f46e5;
          font-weight: 800;
        }

        /* FOOTER & SIGNATURE */
        .footer-section {
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .legal-notice {
          max-width: 460px;
          font-size: 11px;
          color: #64748b;
          line-height: 1.4;
        }

        .legal-notice p {
          margin: 2px 0;
        }

        .stamp-box {
          width: 170px;
          height: 64px;
          border: 1px dashed #94a3b8;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 10px;
          text-align: center;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- HEADER -->
        <div class="invoice-header">
          <div class="brand-section">
            ${logoUrl 
              ? `<img src="${logoUrl}" alt="${etablissementNom}" class="brand-logo" onerror="this.style.display='none'" />` 
              : `<div class="brand-fallback-logo">${etablissementNom.charAt(0)}</div>`
            }
            <div class="brand-details">
              <h1>${etablissementNom}</h1>
              ${etablissementAdresse ? `<p>📍 ${etablissementAdresse}</p>` : ''}
              ${etablissementTel || etablissementEmail ? `<p>📞 ${etablissementTel} ${etablissementEmail ? `· ✉️ ${etablissementEmail}` : ''}</p>` : ''}
              <div class="fiscal-tags">
                <span class="fiscal-badge">NIF : <strong>${nif}</strong></span>
                <span class="fiscal-badge">STAT : <strong>${stat}</strong></span>
                ${rcs ? `<span class="fiscal-badge">RCS : ${rcs}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="invoice-meta">
            <div class="invoice-title">FACTURE</div>
            <div class="invoice-number">${facture.numero}</div>
            <div>
              <span class="status-badge ${isPayee ? 'status-paid' : isAnnulee ? 'status-cancelled' : 'status-pending'}">
                ${isPayee ? '✓ ACQUITTÉE' : isAnnulee ? 'ANNULÉE' : 'EN ATTENTE'}
              </span>
            </div>
            <p style="font-size: 11.5px; color: #64748b; margin: 6px 0 0 0;">
              Émise le : <strong>${dateEmission}</strong>
            </p>
          </div>
        </div>

        <!-- INFO GRID -->
        <div class="info-grid">
          <!-- CLIENT INFO -->
          <div class="info-card">
            <div class="info-card-title">
              <span>Facturé à (Client)</span>
              <span>👤</span>
            </div>
            <div class="info-card-content">
              <h3>${clientNom}</h3>
              ${clientTel ? `<p>📞 ${clientTel}</p>` : ''}
              ${clientEmail ? `<p>✉️ ${clientEmail}</p>` : ''}
              ${clientAdresse ? `<p>🏠 ${clientAdresse}</p>` : ''}
              ${agenceVoyage ? `
                <div class="agency-highlight">
                  ✈️ Agence : <strong>${agenceVoyage}</strong>
                </div>
              ` : `
                <p style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Client direct / individuel</p>
              `}
            </div>
          </div>

          <!-- DETAILS / DATES -->
          <div class="info-card">
            <div class="info-card-title">
              <span>Détails & Règlement</span>
              <span>📅</span>
            </div>
            <div class="info-card-content">
              <p>Échéance : <strong>${dateEcheance}</strong></p>
              <p>Prestation : <strong>${facture.source}</strong></p>
              <p>Mode de règlement : <strong>${modePaiementLabel}</strong></p>
              ${isPayee && datePaiement ? `<p style="color: #166534; font-weight: 600;">✓ Réglé le : ${datePaiement}</p>` : ''}
              ${facture.notes ? `<p style="font-size: 11px; color: #64748b; margin-top: 4px;">Note : ${facture.notes}</p>` : ''}
            </div>
          </div>
        </div>

        <!-- TABLE OF ITEMS -->
        <div class="table-container">
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 50%;">Description / Prestation</th>
                <th style="width: 15%; text-align: center;">Quantité</th>
                <th style="width: 18%; text-align: right;">Prix unitaire</th>
                <th style="width: 17%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lignes.map(l => `
                <tr>
                  <td>
                    <div class="item-desc">${l.description}</div>
                    ${l.noteSpeciale ? `<div class="item-note">Note : ${l.noteSpeciale}</div>` : ''}
                  </td>
                  <td style="text-align: center; font-weight: 600;">${l.qte}</td>
                  <td style="text-align: right;">${l.pu.toLocaleString('fr-FR')} Ar</td>
                  <td style="text-align: right; font-weight: 700;">${(l.qte * l.pu).toLocaleString('fr-FR')} Ar</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- TOTALS & PAYMENT SUMMARY -->
        <div class="summary-section">
          <div class="payment-details">
            <p><strong>Conditions de règlement :</strong></p>
            <p>• Règlement attendu avant le : <strong>${dateEcheance}</strong></p>
            <p>• Modalité : <strong>${modePaiementLabel}</strong></p>
            ${rib ? `<p>• RIB : <strong>${rib}</strong></p>` : ''}
            ${mvola ? `<p>• MVola : <strong>${mvola}</strong></p>` : ''}
            <p style="font-size: 11px; color: #64748b; margin-top: 4px;">
              ${isPayee 
                ? 'Cette facture est acquittée et fait office de reçu officiel.' 
                : 'Merci d\'indiquer la référence de facture lors de votre virement ou transfert.'}
            </p>
          </div>

          <div class="totals-box">
            <div class="total-row">
              <span>Sous-total brut :</span>
              <span>${sousTotal.toLocaleString('fr-FR')} Ar</span>
            </div>
            ${remiseMontant > 0 ? `
              <div class="total-row discount">
                <span>Remise / Rabais (${remisePct}%) :</span>
                <span>- ${remiseMontant.toLocaleString('fr-FR')} Ar</span>
              </div>
            ` : ''}
            ${accompte > 0 ? `
              <div class="total-row">
                <span>Acompte (${paymentLabels[methodePaiementAccompte] || methodePaiementAccompte}) :</span>
                <span>- ${accompte.toLocaleString('fr-FR')} Ar</span>
              </div>
            ` : ''}
            <div class="total-row final">
              <span>${accompte > 0 ? 'Reste à payer TTC :' : 'Net à payer TTC :'}</span>
              <span class="final-price">${(accompte > 0 ? resteAPayer : totalNet).toLocaleString('fr-FR')} Ar</span>
            </div>
          </div>
        </div>

        <!-- FOOTER & LEGAL -->
        <div class="footer-section">
          <div class="legal-notice">
            <p><strong>${etablissementNom}</strong> — Système de gestion hôtelière & restauration ResHPro</p>
            <p>Identifiants fiscaux : NIF : ${nif} | STAT : ${stat} ${rcs ? `| RCS : ${rcs}` : ''}</p>
            <p style="font-size: 10px; color: #94a3b8;">TVA non applicable — Régime de l'Impôt Synthétique selon le code général des impôts en vigueur.</p>
          </div>
          <div class="stamp-box">
            <span>Cachet & Signature</span>
            ${cachetSignatureUrl ? `
              <div style="margin-top: 5px;">
                <img src="${cachetSignatureUrl}" alt="Signature" style="max-height: 50px; max-width: 100%; object-fit: contain;" />
              </div>
            ` : `
              <span style="font-size: 8px; margin-top: 2px;">${etablissementNom}</span>
            `}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Moteur d'impression haute fidélité pour Bulletin de Paie officiel (Format A4)
 */
export function printBulletinPaiePro(
  bulletin: BulletinPaie,
  tenantConfig?: Partial<TenantConfig & TenantPublicConfig> | null,
  employe?: Partial<Employe> | null
) {
  const etablissementNom = tenantConfig?.nom || "Établissement";
  const logoUrl = tenantConfig?.logoUrl || "";
  const nif = tenantConfig?.nif?.trim() ? tenantConfig.nif : "À fournir par le client";
  const stat = tenantConfig?.stat?.trim() ? tenantConfig.stat : "À fournir par le client";
  const rcs = tenantConfig?.rcs || "";
  const etablissementAdresse = tenantConfig?.adresse || "";
  const etablissementTel = tenantConfig?.telephone || "";
  const etablissementEmail = tenantConfig?.email || "";
  const cachetSignatureUrl = tenantConfig?.cachetSignatureUrl || "";

  // Informations Employé
  const employeNom = bulletin.employeNom || (employe ? `${employe.nom} ${employe.prenom}` : "Salarié");
  const matricule = bulletin.employeMatricule || employe?.matricule || "—";
  const poste = bulletin.poste || employe?.poste || "Employé";
  const departement = bulletin.departement || employe?.departement || "Général";
  const typeContrat = employe?.typeContrat || "CDI";
  const dateEmbauche = employe?.dateEmbauche || "—";
  const cin = employe?.cin || "—";
  const cnapsNumber = employe?.cnapsNumber || (employe?.assujettiCnaps ? "En cours" : "Non assujetti");
  const ostieNumber = employe?.ostieNumber || (employe?.assujettiOstie ? "En cours" : "Non assujetti");
  const telephone = employe?.telephone || "";

  // Période & Dates
  const [year, month] = (bulletin.periode || "2026-08").split("-");
  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  const monthLabel = monthNames[parseInt(month, 10) - 1] || month;
  const periodeLabel = `${monthLabel} ${year}`;
  const dateEmission = new Date(bulletin.dateEmission).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Mode de paiement
  const paymentLabels: Record<string, string> = {
    especes: "Espèces (Paiement en caisse)",
    mobile_money: "Mobile Money",
    virement: "Virement Bancaire",
    cheque: "Chèque Bancaire",
  };
  const modePaiementLabel = paymentLabels[bulletin.modePaiement] || bulletin.modePaiement;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bulletin de Paie - ${bulletin.numero} - ${employeNom}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }

        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #ffffff;
          color: #0f172a;
          margin: 0;
          padding: 10px;
          display: flex;
          justify-content: center;
          font-size: 12px;
        }

        .payslip-container {
          max-width: 800px;
          width: 100%;
          background: #ffffff;
          padding: 24px 28px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        @media print {
          body {
            padding: 0;
            background: #ffffff;
          }
          .payslip-container {
            border: none;
            padding: 0;
            max-width: 100%;
          }
        }

        /* HEADER */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 14px;
          border-bottom: 2px solid #0f172a;
          margin-bottom: 14px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 52px;
          height: 52px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .brand-fallback-logo {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
          color: #ffffff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
        }

        .brand-info h1 {
          margin: 0 0 2px 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .brand-info p {
          margin: 1px 0;
          font-size: 11px;
          color: #475569;
        }

        .fiscal-tags {
          margin-top: 4px;
          display: flex;
          gap: 6px;
        }

        .fiscal-tag {
          font-size: 10px;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          border: 1px solid #e2e8f0;
        }

        .title-meta {
          text-align: right;
        }

        .payslip-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.5px;
          margin: 0 0 2px 0;
        }

        .period-badge {
          display: inline-block;
          background-color: #e0e7ff;
          color: #3730a3;
          font-size: 12px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 6px;
          margin-top: 3px;
        }

        /* EMPLOYEE & CONTRACT INFO */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 14px;
        }

        .info-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 12px;
        }

        .info-box h3 {
          margin: 0 0 6px 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          font-weight: 700;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
          font-size: 11.5px;
        }

        .info-row span.label {
          color: #64748b;
        }

        .info-row span.val {
          font-weight: 600;
          color: #0f172a;
        }

        /* PAYROLL TABLE */
        table.pay-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
        }

        table.pay-table th {
          background: #0f172a;
          color: #ffffff;
          padding: 7px 9px;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        table.pay-table td {
          padding: 6px 9px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 11.5px;
        }

        table.pay-table tr.category-header td {
          background: #f1f5f9;
          font-weight: 700;
          color: #334155;
          font-size: 11px;
          padding: 4px 9px;
        }

        table.pay-table tr.total-row td {
          background: #f8fafc;
          font-weight: 700;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
        }

        .text-right { text-align: right; }
        .text-center { text-align: center; }

        /* NET SALARY & TOTALS */
        .net-section {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 14px;
          margin-bottom: 16px;
        }

        .recap-box {
          flex: 1;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 11.5px;
        }

        .recap-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          color: #475569;
        }

        .net-pay-box {
          width: 300px;
          background: #0f172a;
          color: #ffffff;
          border-radius: 6px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: right;
        }

        .net-pay-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #94a3b8;
          font-weight: 600;
        }

        .net-pay-amount {
          font-size: 20px;
          font-weight: 800;
          color: #38bdf8;
          margin-top: 3px;
        }

        /* SIGNATURES & LEGAL */
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px dashed #cbd5e1;
        }

        .sig-box {
          height: 70px;
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          padding: 6px 10px;
          position: relative;
        }

        .sig-title {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .legal-notice {
          margin-top: 12px;
          font-size: 9.5px;
          color: #94a3b8;
          text-align: center;
          line-height: 1.3;
        }
      </style>
    </head>
    <body>
      <div class="payslip-container">
        <!-- HEADER -->
        <div class="header">
          <div class="brand">
            ${logoUrl 
              ? `<img src="${logoUrl}" alt="${etablissementNom}" class="brand-logo" onerror="this.style.display='none'" />` 
              : `<div class="brand-fallback-logo">${etablissementNom.charAt(0)}</div>`
            }
            <div class="brand-info">
              <h1>${etablissementNom}</h1>
              ${etablissementAdresse ? `<p>📍 ${etablissementAdresse}</p>` : ''}
              ${etablissementTel || etablissementEmail ? `<p>📞 ${etablissementTel} ${etablissementEmail ? `· ✉️ ${etablissementEmail}` : ''}</p>` : ''}
              <div class="fiscal-tags">
                <span class="fiscal-tag">NIF: ${nif}</span>
                <span class="fiscal-tag">STAT: ${stat}</span>
                ${rcs ? `<span class="fiscal-tag">RCS: ${rcs}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="title-meta">
            <div class="payslip-title">BULLETIN DE PAIE</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Réf: ${bulletin.numero}</div>
            <div class="period-badge">Période : ${periodeLabel}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Émis le : ${dateEmission}</div>
          </div>
        </div>

        <!-- INFO GRID -->
        <div class="info-grid">
          <div class="info-box">
            <h3>Salarié / Bénéficiaire</h3>
            <div class="info-row"><span class="label">Nom complet :</span> <span class="val">${employeNom}</span></div>
            <div class="info-row"><span class="label">Matricule :</span> <span class="val">${matricule}</span></div>
            <div class="info-row"><span class="label">Poste :</span> <span class="val">${poste}</span></div>
            <div class="info-row"><span class="label">Département :</span> <span class="val" style="text-transform: capitalize;">${departement}</span></div>
            ${cin !== '—' ? `<div class="info-row"><span class="label">CIN :</span> <span class="val">${cin}</span></div>` : ''}
          </div>

          <div class="info-box">
            <h3>Affiliation & Modalités</h3>
            <div class="info-row"><span class="label">Contrat :</span> <span class="val">${typeContrat}</span></div>
            <div class="info-row"><span class="label">Date d'embauche :</span> <span class="val">${dateEmbauche}</span></div>
            <div class="info-row"><span class="label">N° CNaPS :</span> <span class="val">${cnapsNumber}</span></div>
            <div class="info-row"><span class="label">N° OSTIE / Médical :</span> <span class="val">${ostieNumber}</span></div>
            <div class="info-row"><span class="label">Règlement :</span> <span class="val">${modePaiementLabel}</span></div>
          </div>
        </div>

        <!-- TABLE OF ITEMS -->
        <table class="pay-table">
          <thead>
            <tr>
              <th style="width: 45%;">Éléments de paie</th>
              <th style="width: 15%;" class="text-center">Base / Heures</th>
              <th style="width: 10%;" class="text-center">Taux</th>
              <th style="width: 15%;" class="text-right">Gains (Ar)</th>
              <th style="width: 15%;" class="text-right">Retenues (Ar)</th>
            </tr>
          </thead>
          <tbody>
            <!-- 1. SALAIRE DE BASE & HEURES -->
            <tr class="category-header">
              <td colspan="5">1. SALAIRE DE BASE & HEURES SUPPLÉMENTAIRES</td>
            </tr>
            <tr>
              <td>Salaire de base contractuel</td>
              <td class="text-center">${bulletin.heuresNormales || 173.33} h</td>
              <td class="text-center">—</td>
              <td class="text-right">${bulletin.salaireBase.toLocaleString('fr-FR')}</td>
              <td class="text-right">—</td>
            </tr>
            ${(bulletin.heuresSup25 || 0) > 0 ? `
              <tr>
                <td>Heures supplémentaires (+25%)</td>
                <td class="text-center">${bulletin.heuresSup25} h</td>
                <td class="text-center">+25%</td>
                <td class="text-right">${Math.round(bulletin.heuresSup25 * (bulletin.salaireBase / 173.33) * 1.25).toLocaleString('fr-FR')}</td>
                <td class="text-right">—</td>
              </tr>
            ` : ''}
            ${(bulletin.heuresSup50 || 0) > 0 ? `
              <tr>
                <td>Heures supplémentaires (+50%)</td>
                <td class="text-center">${bulletin.heuresSup50} h</td>
                <td class="text-center">+50%</td>
                <td class="text-right">${Math.round(bulletin.heuresSup50 * (bulletin.salaireBase / 173.33) * 1.5).toLocaleString('fr-FR')}</td>
                <td class="text-right">—</td>
              </tr>
            ` : ''}

            <!-- 2. PRIMES & AVANTAGES -->
            ${(bulletin.primes || []).length > 0 ? `
              <tr class="category-header">
                <td colspan="5">2. PRIMES & INDEMNITÉS</td>
              </tr>
              ${bulletin.primes.map(p => `
                <tr>
                  <td>${p.nom}</td>
                  <td class="text-center">Forfait</td>
                  <td class="text-center">—</td>
                  <td class="text-right">${p.montant.toLocaleString('fr-FR')}</td>
                  <td class="text-right">—</td>
                </tr>
              `).join('')}
            ` : ''}

            <!-- SOUS TOTAL BRUT -->
            <tr class="total-row">
              <td colspan="3"><strong>TOTAL SALAIRE BRUT</strong></td>
              <td class="text-right"><strong>${bulletin.salaireBrut.toLocaleString('fr-FR')}</strong></td>
              <td class="text-right">—</td>
            </tr>

            <!-- 3. COTISATIONS SALARIALES & IMPÔTS -->
            <tr class="category-header">
              <td colspan="5">3. COTISATIONS SOCIALES & DÉDUCTIONS FISCALES</td>
            </tr>
            ${(bulletin.cotisationsSalariales || []).map(c => `
              <tr>
                <td>${c.nom}</td>
                <td class="text-center">${c.base.toLocaleString('fr-FR')}</td>
                <td class="text-center">${c.taux}%</td>
                <td class="text-right">—</td>
                <td class="text-right">${c.montant.toLocaleString('fr-FR')}</td>
              </tr>
            `).join('')}
            ${bulletin.irsa > 0 ? `
              <tr>
                <td>IRSA (Impôt sur le Revenu des Salariés)</td>
                <td class="text-center">Barème</td>
                <td class="text-center">—</td>
                <td class="text-right">—</td>
                <td class="text-right">${bulletin.irsa.toLocaleString('fr-FR')}</td>
              </tr>
            ` : ''}

            <!-- 4. AVANCES & ACOMPTES -->
            ${bulletin.avancesDeduites > 0 ? `
              <tr class="category-header">
                <td colspan="5">4. ACOMPTES & AVANCES SUR SALAIRE</td>
              </tr>
              <tr>
                <td>Déduction Avances perçues sur le mois</td>
                <td class="text-center">—</td>
                <td class="text-center">—</td>
                <td class="text-right">—</td>
                <td class="text-right">${bulletin.avancesDeduites.toLocaleString('fr-FR')}</td>
              </tr>
            ` : ''}

            <!-- TOTAL RETENUES -->
            <tr class="total-row">
              <td colspan="3"><strong>TOTAL DES RETENUES</strong></td>
              <td class="text-right">—</td>
              <td class="text-right"><strong style="color: #dc2626;">- ${bulletin.totalRetenues.toLocaleString('fr-FR')}</strong></td>
            </tr>
          </tbody>
        </table>

        <!-- RECAP & NET A PAYER -->
        <div class="net-section">
          <div class="recap-box">
            <div class="recap-row"><span>Salaire Brut :</span> <strong>${bulletin.salaireBrut.toLocaleString('fr-FR')} Ar</strong></div>
            <div class="recap-row"><span>Cotisations Sociales (CNaPS/OSTIE) :</span> <strong>- ${bulletin.totalCotisationsSalariales.toLocaleString('fr-FR')} Ar</strong></div>
            <div class="recap-row"><span>Impôt IRSA :</span> <strong>- ${bulletin.irsa.toLocaleString('fr-FR')} Ar</strong></div>
            ${bulletin.avancesDeduites > 0 ? `<div class="recap-row"><span>Acomptes déduits :</span> <strong>- ${bulletin.avancesDeduites.toLocaleString('fr-FR')} Ar</strong></div>` : ''}
            <div class="recap-row" style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 11px;">
              <span>Règlement : <strong>${modePaiementLabel}</strong></span>
              ${bulletin.detailsPaiement ? `<span>${bulletin.detailsPaiement}</span>` : ''}
            </div>
          </div>

          <div class="net-pay-box">
            <div class="net-pay-label">NET À PAYER (ARIARY)</div>
            <div class="net-pay-amount">${bulletin.salaireNet.toLocaleString('fr-FR')} Ar</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Statut : ${bulletin.statut === 'paye' ? '✓ RÉGLÉ' : 'EN COURS'}</div>
          </div>
        </div>

        <!-- SIGNATURES -->
        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">Le Salarié (Pour acquit)</div>
            <div style="font-size: 9px; color: #94a3b8; margin-top: 30px;">Date & Signature :</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">L'Employeur / Direction (Cachet & Signature)</div>
            ${cachetSignatureUrl ? `
              <img src="${cachetSignatureUrl}" alt="Cachet" style="max-height: 45px; margin-top: 5px; object-fit: contain;" />
            ` : `
              <div style="font-size: 9px; color: #94a3b8; margin-top: 30px;">Cachet officiel ${etablissementNom}</div>
            `}
          </div>
        </div>

        <div class="legal-notice">
          Dans votre intérêt et pour faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.<br />
          Document généré par le système intégré de gestion ResHPro.
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.error("Print error:", e);
      }
    }, 250);
  }
}

/**
 * Moteur d'exportation / impression du Livre de Paie mensuel récapitulatif
 */
export function printLivreDePaie(
  mois: string,
  bulletins: BulletinPaie[],
  tenantConfig?: Partial<TenantConfig & TenantPublicConfig> | null
) {
  const etablissementNom = tenantConfig?.nom || "Établissement";
  const [year, month] = mois.split("-");
  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  const periodeLabel = `${monthNames[parseInt(month, 10) - 1] || month} ${year}`;

  const totalBrut = bulletins.reduce((acc, b) => acc + (b.salaireBrut || 0), 0);
  const totalCotisations = bulletins.reduce((acc, b) => acc + (b.totalCotisationsSalariales || 0), 0);
  const totalIrsa = bulletins.reduce((acc, b) => acc + (b.irsa || 0), 0);
  const totalAvances = bulletins.reduce((acc, b) => acc + (b.avancesDeduites || 0), 0);
  const totalNet = bulletins.reduce((acc, b) => acc + (b.salaireNet || 0), 0);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Livre de Paie - ${periodeLabel} - ${etablissementNom}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @page { size: A4 landscape; margin: 8mm; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 15px; }
        h1 { margin: 0 0 4px 0; font-size: 18px; color: #0f172a; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #0f172a; color: white; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .text-right { text-align: right; }
        .total-row { background: #e2e8f0; font-weight: 800; }
        .badge { padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${etablissementNom} — Livre de Paie Mensuel</h1>
          <p style="margin: 0; color: #64748b;">Période : <strong>${periodeLabel}</strong> · Nombre de salariés : <strong>${bulletins.length}</strong></p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; color: #64748b;">Date d'édition : ${new Date().toLocaleDateString('fr-FR')}</p>
          <p style="margin: 3px 0 0 0; font-size: 13px; font-weight: 800; color: #0f172a;">Masse Salariale Nette : ${totalNet.toLocaleString('fr-FR')} Ar</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Réf</th>
            <th>Salarié</th>
            <th>Poste / Dépt</th>
            <th class="text-right">Salaire Base</th>
            <th class="text-right">Heures Sup</th>
            <th class="text-right">Primes</th>
            <th class="text-right">Salaire Brut</th>
            <th class="text-right">Cotisations</th>
            <th class="text-right">IRSA</th>
            <th class="text-right">Avances</th>
            <th class="text-right">Net à Payer</th>
            <th style="text-align: center;">Mode</th>
            <th style="text-align: center;">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${bulletins.map(b => `
            <tr>
              <td><strong>${b.numero}</strong></td>
              <td>${b.employeNom}</td>
              <td>${b.poste}</td>
              <td class="text-right">${b.salaireBase.toLocaleString('fr-FR')}</td>
              <td class="text-right">${(b.montantHeuresSup || 0).toLocaleString('fr-FR')}</td>
              <td class="text-right">${(b.totalPrimes || 0).toLocaleString('fr-FR')}</td>
              <td class="text-right"><strong>${b.salaireBrut.toLocaleString('fr-FR')}</strong></td>
              <td class="text-right">${b.totalCotisationsSalariales.toLocaleString('fr-FR')}</td>
              <td class="text-right">${b.irsa.toLocaleString('fr-FR')}</td>
              <td class="text-right">${b.avancesDeduites.toLocaleString('fr-FR')}</td>
              <td class="text-right"><strong style="color: #0369a1;">${b.salaireNet.toLocaleString('fr-FR')} Ar</strong></td>
              <td style="text-align: center; text-transform: uppercase; font-size: 9px;">${b.modePaiement}</td>
              <td style="text-align: center;">
                <span class="badge" style="background: ${b.statut === 'paye' ? '#dcfce7; color: #166534;' : '#fef3c7; color: #92400e;'}">
                  ${b.statut === 'paye' ? 'Payé' : 'Brouillon'}
                </span>
              </td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3">TOTAUX GÉNÉRAUX (${bulletins.length} salariés)</td>
            <td class="text-right">—</td>
            <td class="text-right">—</td>
            <td class="text-right">—</td>
            <td class="text-right">${totalBrut.toLocaleString('fr-FR')} Ar</td>
            <td class="text-right">${totalCotisations.toLocaleString('fr-FR')} Ar</td>
            <td class="text-right">${totalIrsa.toLocaleString('fr-FR')} Ar</td>
            <td class="text-right">${totalAvances.toLocaleString('fr-FR')} Ar</td>
            <td class="text-right">${totalNet.toLocaleString('fr-FR')} Ar</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.error("Print error:", e);
      }
    }, 250);
  }
}

/**
 * Moteur d'impression du Planning Hebdomadaire d'affichage
 */
export function printPlanningHebdo(
  dateDebut: string, // Lundi YYYY-MM-DD
  shifts: PlanningShift[],
  employes: Employe[],
  tenantConfig?: Partial<TenantConfig & TenantPublicConfig> | null
) {
  const etablissementNom = tenantConfig?.nom || "Établissement";
  const startDate = new Date(dateDebut);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return {
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase(),
      dayNum: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    };
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Planning Équipe - Semaine du ${dateDebut} - ${etablissementNom}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @page { size: A4 landscape; margin: 8mm; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 15px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #0f172a; color: white; padding: 8px; font-size: 11px; text-align: center; }
        th.emp-col { text-align: left; width: 180px; }
        td { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: top; }
        .shift-chip { background: #e0e7ff; color: #3730a3; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-bottom: 2px; }
        .repos-chip { background: #f1f5f9; color: #64748b; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-align: center; }
        .task-text { font-size: 9.5px; color: #475569; margin-top: 2px; font-style: italic; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 style="margin: 0; font-size: 18px;">${etablissementNom} — Planning Hebdomadaire</h1>
          <p style="margin: 2px 0 0 0; color: #64748b;">Semaine du <strong>${days[0].dayNum} au ${days[6].dayNum}</strong></p>
        </div>
        <div style="text-align: right; color: #64748b; font-size: 11px;">
          Affichage officiel salle du personnel<br />
          Imprimé le : ${new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="emp-col">Salarié / Poste</th>
            ${days.map(d => `<th>${d.dayName}<br/><span style="font-size: 9.5px; font-weight: 500;">${d.dayNum}</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${employes.filter(e => e.statut === 'actif').map(emp => `
            <tr>
              <td>
                <strong style="color: #0f172a;">${emp.nom} ${emp.prenom}</strong><br/>
                <span style="font-size: 10px; color: #64748b;">${emp.poste}</span>
              </td>
              ${days.map(d => {
                const s = shifts.find(sh => sh.employeId === emp.id && sh.date === d.dateStr);
                if (!s) return '<td><div class="repos-chip">—</div></td>';
                if (s.type === 'repos') return '<td><div class="repos-chip">REPOS</div></td>';
                if (s.type === 'conge_paye') return '<td><div class="repos-chip" style="background: #fef3c7; color: #92400e;">CONGÉ</div></td>';
                return `
                  <td>
                    <div class="shift-chip">${s.heureDebut} - ${s.heureFin}</div>
                    ${s.posteAffecte ? `<div style="font-weight: 600; font-size: 10px; color: #1e293b;">${s.posteAffecte}</div>` : ''}
                    ${s.tache ? `<div class="task-text">${s.tache}</div>` : ''}
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.error("Print error:", e);
      }
    }, 250);
  }
}
