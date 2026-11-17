/**
 * @fileoverview Excel (.xlsx) export for "Export Excel" actions. ExcelJS is loaded from the CDN on first use
 * so pages don't pay for it until someone exports.
 * @module utils/excel-export
 */

const EXCELJS_CDN_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';

/** Brand maroon used for the header row (matches PDF exports). */
const HEADER_FILL_ARGB = 'FF7A2E04';

const MIN_COLUMN_WIDTH = 6;
const MAX_COLUMN_WIDTH = 60;

/** @type {Promise<any>|null} */
let excelJsPromise = null;

/**
 * @returns {Promise<any>} The global `ExcelJS` namespace.
 */
function loadExcelJs() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!excelJsPromise) {
    excelJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = EXCELJS_CDN_URL;
      script.async = true;
      script.onload = () => {
        if (window.ExcelJS) resolve(window.ExcelJS);
        else reject(new Error('ExcelJS loaded but is not available'));
      };
      script.onerror = () => {
        excelJsPromise = null;
        script.remove();
        reject(new Error('Failed to load ExcelJS'));
      };
      document.head.appendChild(script);
    });
  }
  return excelJsPromise;
}

/**
 * Column widths (in Excel character units) sized to the longest value per column, clamped to a sane range.
 *
 * @param {Array<unknown>} header
 * @param {Array<Array<unknown>>} rows
 * @returns {number[]}
 */
export function computeColumnWidths(header, rows) {
  return header.map((h, col) => {
    let longest = String(h ?? '').length;
    rows.forEach((r) => {
      longest = Math.max(longest, String(r[col] ?? '').length);
    });
    return Math.min(Math.max(longest + 2, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH);
  });
}

/**
 * Builds and downloads a single-sheet .xlsx: optional title lines, a styled header row (frozen, with filters),
 * data rows, and an optional bold totals row. Pass phone numbers as strings so Excel keeps them as text.
 *
 * @param {Object} opts
 * @param {string} opts.filename - Including `.xlsx`.
 * @param {string} opts.sheetName - Max 31 characters.
 * @param {Array<string|number>} opts.header
 * @param {Array<Array<string|number>>} opts.rows
 * @param {string[]} [opts.titleLines] - Rows above the table (first line is bold).
 * @param {Array<string|number>} [opts.footerRow] - Bold row after the data (e.g. totals).
 * @returns {Promise<void>}
 */
export async function downloadXlsx({ filename, sheetName, header, rows, titleLines = [], footerRow }) {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  titleLines.forEach((line, i) => {
    const r = sheet.addRow([line]);
    r.font = { bold: i === 0, size: i === 0 ? 14 : 11 };
  });
  if (titleLines.length > 0) sheet.addRow([]);

  const headerRow = sheet.addRow(header);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL_ARGB } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  rows.forEach((values) => {
    const r = sheet.addRow(values);
    r.alignment = { vertical: 'top', wrapText: true };
  });

  if (footerRow) {
    sheet.addRow(footerRow).font = { bold: true };
  }

  const widths = computeColumnWidths(header, footerRow ? [...rows, footerRow] : rows);
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const headerRowNumber = headerRow.number;
  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: header.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
