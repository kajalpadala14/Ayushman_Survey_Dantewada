import * as XLSX from 'xlsx';

/**
 * Exports data to a genuine Microsoft Excel (.xlsx) file with auto-calculated column widths.
 * @param {Array<Object>|Array<Array<any>>} data - Rows to export (Array of objects or array of arrays)
 * @param {string} fileName - Desired file name (ending with .xlsx)
 * @param {string} sheetName - Excel sheet tab name (defaults to 'Report')
 */
export function exportToExcel(data, fileName = 'Report.xlsx', sheetName = 'Report') {
  if (!data || data.length === 0) {
    alert('डाउनलोड करने के लिए कोई डेटा उपलब्ध नहीं है।');
    return;
  }

  const isAOA = Array.isArray(data[0]);
  const ws = isAOA ? XLSX.utils.aoa_to_sheet(data) : XLSX.utils.json_to_sheet(data);

  // Auto-calculate column widths
  const keys = isAOA ? data[0] : Object.keys(data[0]);
  const colWidths = keys.map((key, colIndex) => {
    let maxLen = String(key || '').length;
    const sampleLimit = Math.min(data.length, 100);
    for (let i = 0; i < sampleLimit; i++) {
      const val = isAOA ? data[i][colIndex] : data[i][key];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  const safeSheetName = (sheetName || 'Report').replace(/[*?:/\\\[\]]/g, '').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const finalName = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(wb, finalName);
}
