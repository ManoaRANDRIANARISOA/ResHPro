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

export function exportToPDF(title: string, data: any[], filename: string) {
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
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        h1 {
          color: #333;
          border-bottom: 2px solid #6E8EF5;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background-color: #6E8EF5;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: bold;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        tr:hover {
          background-color: #f5f5f5;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>Date d'export: ${new Date().toLocaleDateString('fr-FR', { 
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
              ${headers.map(h => `<td>${item[h] || ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        <p>OKA LODGE - Système de gestion</p>
      </div>
    </body>
    </html>
  `;

  // Ouvrir dans une nouvelle fenêtre et imprimer
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Attendre que le contenu soit chargé avant d'imprimer
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}