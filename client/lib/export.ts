import { Facture, Client } from "@shared/api";
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
            <div class="total-row final">
              <span>Net à payer TTC :</span>
              <span class="final-price">${totalNet.toLocaleString('fr-FR')} Ar</span>
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
            <span style="font-size: 8px; margin-top: 2px;">${etablissementNom}</span>
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