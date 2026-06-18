/**
 * @fileoverview PDF generation service using html2pdf.js.
 * Generates member-wise, household directory list, advanced search, and jilla membership PDF exports.
 * @module pdf-service
 */

import { formatLabel, formatDOB, calcAgeYears, showToast, showLoader, hideLoader } from '../ui/ui-service.js';
import * as Logger from '../utils/logger.js';
import {
  formatHouseholdAddress,
  personRoleBadgeLabel,
} from './member-person-search.js';
import {
  MESSAGES,
  ORG_NAME,
  ORG_SUBTITLE,
  JILLA_MEMBERSHIP_COLUMN_LABELS,
  PDF_MEMBER_LIST,
  PDF_ADVANCED_SEARCH,
  ADVANCED_MEMBER_SEARCH,
} from '../constants/constants.js';

/**
 * Inline style applied to blocks that must not be split across PDF pages.
 * `display:table;width:100%` forces the renderer to treat the element as an
 * atomic unit, which is the most reliable way to prevent html2pdf.js from
 * slicing it at a page boundary.
 */
const KEEP_TOGETHER = 'display:table;width:100%;page-break-inside:avoid;break-inside:avoid;overflow:hidden;';

/**
 * Column widths for multi-record household directory PDFs (one table per page chunk).
 * Phone stays readable at table body size; PS text is usually short. Member/Non-member needs enough width for
 * the header label and `members/nonMembers` values (html2pdf truncates when this column is too tight).
 */
const MULTI_RECORD_COLGROUP = `
    <colgroup>
      <col style="width:5%;">
      <col style="width:26%;">
      <col style="width:23%;">
      <col style="width:17%;">
      <col style="width:12%;">
      <col style="width:17%;">
    </colgroup>`;

/** Saffron/maroon theme color used throughout the PDF. */
const PDF_PRIMARY = '#7a2e04';

/** Secondary accent (links, emphasis) paired with {@link PDF_PRIMARY}. */
const PDF_ACCENT = '#c0392b';

/** Portrait PDF body text (px). */
const PDF_FONT_BODY_PX = 14;

/** Portrait PDF table text — household directory, jilla membership (px). */
const PDF_FONT_TABLE_PX = 12;

/** Landscape PDF table text — advanced search (px). */
const PDF_FONT_TABLE_LANDSCAPE_PX = 10;

/** Letterhead organization title (px). */
const PDF_FONT_HEADER_TITLE_PX = 20;

/** Letterhead subtitle (px). */
const PDF_FONT_HEADER_SUBTITLE_PX = 15;

/** Document / section title under the letterhead (px). */
const PDF_FONT_DOC_TITLE_PX = 15;

/** Member / non-member person card tables (px). */
const PDF_FONT_PERSON_CARD_PX = 13;

/** Small audit / meta lines (px). */
const PDF_FONT_META_PX = 11;

/** jsPDF page-number label (pt). */
const PDF_FONT_PAGE_NUM_PT = 10;

/** Printable content width for portrait A4 PDFs (~210mm at 96dpi). */
const PDF_PORTRAIT_CONTENT_WIDTH_PX = 794;

/** Space between the repeated letterhead and page body (mm). */
const PDF_HEADER_CONTENT_GAP_MM = 2;

/** Reserved footer band for page numbers (mm). */
const PDF_FOOTER_HEIGHT_MM = 6;

/** @type {Map<number, HTMLCanvasElement>} */
const pdfHeaderCanvasCache = new Map();

/** @type {Map<string, HTMLCanvasElement>} Cached tabular PDF column header rows (key = export kind + content width). */
const pdfTheadCanvasCache = new Map();

/**
 * Captures the branded letterhead once per content width (cached).
 *
 * @param {number} contentWidthPx
 * @param {Object} renderOpt
 * @returns {Promise<HTMLCanvasElement>}
 */
async function getPdfHeaderCanvas(contentWidthPx, renderOpt) {
  const cached = pdfHeaderCanvasCache.get(contentWidthPx);
  if (cached) return cached;

  const container = createPdfCaptureContainer(buildPDFHeader(), contentWidthPx, 0);
  document.body.appendChild(container);
  await waitForImagesIn(container);
  await waitForLayoutPaint();
  const canvas = await captureElementToCanvas(container, renderOpt);
  container.remove();
  pdfHeaderCanvasCache.set(contentWidthPx, canvas);
  return canvas;
}

/**
 * @param {Object} doc
 * @param {number} margin
 * @param {HTMLCanvasElement} headerCanvas
 * @returns {{ contentTopMm: number, maxContentHeightMm: number }}
 */
function computePdfLayoutMetrics(doc, margin, headerCanvas) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const headerWidthMm = pageW - 2 * margin;
  const headerHeightMm = (headerCanvas.height * headerWidthMm) / headerCanvas.width;
  const contentTopMm = margin + headerHeightMm + PDF_HEADER_CONTENT_GAP_MM;
  const contentBottomMm = pageH - margin - PDF_FOOTER_HEIGHT_MM;
  return {
    contentTopMm,
    maxContentHeightMm: contentBottomMm - contentTopMm,
  };
}

/**
 * Draws the letterhead and page number on one PDF page.
 *
 * @param {Object} doc
 * @param {HTMLCanvasElement} headerCanvas
 * @param {number} pageNum
 * @param {number} totalPages
 * @param {number} margin
 */
function drawPdfPageChrome(doc, headerCanvas, pageNum, totalPages, margin) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const headerWidthMm = pageW - 2 * margin;
  const headerHeightMm = (headerCanvas.height * headerWidthMm) / headerCanvas.width;
  const headerData = headerCanvas.toDataURL('image/jpeg', 0.95);

  doc.addImage(headerData, 'JPEG', margin, margin, headerWidthMm, headerHeightMm);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_FONT_PAGE_NUM_PT);
  doc.setTextColor(85, 85, 85);
  const pageLabel = totalPages > 1 ? `Page ${pageNum} of ${totalPages}` : 'Page 1';
  doc.text(pageLabel, pageW - margin, pageH - (margin / 2), { align: 'right' });
}

/**
 * Overlays the letterhead and page numbers on every page after content is placed.
 *
 * @param {Object} doc
 * @param {HTMLCanvasElement} headerCanvas
 * @param {number} margin
 */
function applyPdfPageChromeToAllPages(doc, headerCanvas, margin) {
  const totalPages = doc.internal.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    doc.setPage(pageNum);
    drawPdfPageChrome(doc, headerCanvas, pageNum, totalPages, margin);
  }
}

/**
 * Builds the branded PDF letterhead with logo, organization name, and underline.
 * @returns {string}
 */
function buildPDFHeader() {
  return `
    <div style="text-align:center;margin-bottom:8px;">
      <img src="assets/app-logo.png" style="width:80px;height:auto;" crossorigin="anonymous">
      <h1 style="margin:6px 0 2px;font-size:${PDF_FONT_HEADER_TITLE_PX}px;color:${PDF_PRIMARY};letter-spacing:1px;font-weight:800;">
        ${ORG_NAME}
      </h1>
      <p style="margin:0 0 8px;font-size:${PDF_FONT_HEADER_SUBTITLE_PX}px;color:#555;letter-spacing:0.5px;font-weight:600;">
        ${ORG_SUBTITLE}
      </p>
      <hr style="border:none;border-top:2.5px solid ${PDF_PRIMARY};margin:0 auto 16px;width:100%;">
    </div>`;
}

/**
 * Generates and downloads a PDF for a single member record (detail layout).
 *
 * @param {Object} record - A single `member_details` document.
 * @returns {void} Shows toast on failure if html2pdf is missing.
 */
export function generateMemberPDF(record) {
  const pd = record.personalDetails || {};
  const html = buildSingleRecordHTML(record);
  downloadPDF(html, `${(pd.name || 'record').replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates and downloads a PDF of the household directory list (tabular layout, paginated).
 *
 * @param {Array<Object>} records - Filtered households to include (typically current UI filters).
 * @returns {void} No-op with warning toast if `records` is empty.
 */
export function generateHouseholdDirectoryPDF(records) {
  if (records.length === 0) {
    showToast(MESSAGES.PDF_NO_RECORDS, 'warning');
    return;
  }

  const html = buildMultiRecordHTML(records);
  downloadPDF(html, 'SPSS_Household_Directory.pdf');
}

/**
 * Generates and downloads a PDF of advanced search filtered person rows (tabular layout, paginated).
 *
 * @param {import('./member-person-search.js').PersonSearchRow[]} rows - All filtered person rows (not paginated UI slice).
 * @returns {void} No-op with warning toast if `rows` is empty.
 */
export function generateAdvancedSearchPDF(rows) {
  if (rows.length === 0) {
    showToast(MESSAGES.PDF_NO_RECORDS, 'warning');
    return;
  }

  const pageSections = buildAdvancedSearchPageSections(rows);
  downloadAdvancedSearchPDF(pageSections, 'SPSS_Advanced_Search.pdf');
}

/* ================================================================== */
/*  HTML Builders                                                      */
/* ================================================================== */

/**
 * Builds a styled HTML string for a single record.
 * @param {Object} record
 * @returns {string}
 */
function buildSingleRecordHTML(record) {
  const pd = record.personalDetails || {};
  const addr = pd.address || {};

  let html = `
    <div style="font-family:Arial,sans-serif;font-size:${PDF_FONT_BODY_PX}px;color:#333;">
      <div class="pdf-atomic-section">
      <div style="${KEEP_TOGETHER}">
        <h4 style="margin-top:4px;color:${PDF_PRIMARY};">Personal Details</h4>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          ${row('Name', pd.name)}
          ${row('House Name', pd.houseName)}
          ${row('Date of Birth', formatDOB(pd.dob))}
          ${row('Gender', formatLabel(pd.gender))}
          ${row('Phone', pd.phone)}
          ${row('Email', pd.email)}
          ${row('Blood Group', pd.bloodGroup)}
          ${row('Education', formatLabel(pd.highestEducation))}
          ${row('Occupation', formatLabel(pd.occupation))}
          ${pd.areaOfExpertise ? row('Area of expertise (if any)', pd.areaOfExpertise) : ''}
        </table>
      </div>
      </div>

      <div class="pdf-atomic-section" style="${KEEP_TOGETHER}">
        <h4 style="color:${PDF_PRIMARY};">Membership Details</h4>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          ${row('Pradeshika Sabha', pd.pradeshikaSabha)}
          ${row('Membership', formatLabel(pd.membershipType))}
          ${pd.holdsSpssPosition ? row('SPSS Position', pd.spssPositionName) : ''}
        </table>
      </div>

      <div class="pdf-atomic-section" style="${KEEP_TOGETHER}">
        <h4 style="color:${PDF_PRIMARY};">Family & Welfare</h4>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          ${row('Family Health Insurance', pd.healthInsurance ? 'Yes' : 'No')}
          ${row('Term/Life Insurance', pd.termLifeInsurance ? 'Yes' : 'No')}
          ${pd.rationCardType ? row('Ration Card Color', formatLabel(pd.rationCardType)) : ''}
        </table>
      </div>

      <div class="pdf-atomic-section" style="${KEEP_TOGETHER}">
        <h4 style="color:${PDF_PRIMARY};">Address</h4>
        <p style="margin:4px 0;">
          ${esc(addr.address1 || '')} ${esc(addr.address2 || '')}<br>
          ${esc(addr.place || '')} — ${esc(addr.pin || '')}
        </p>
      </div>
  `;

  if (record.members?.length) {
    html += buildPersonListHTML('Members', record.members);
  }

  if (record.nonMembers?.length) {
    html += buildPersonListHTML('Non-Members', record.nonMembers, true);
  }

  html += '</div>';
  return html;
}

/**
 * House column: house name on the first line, formatted address on the second when present.
 *
 * @param {Object} pd - `personalDetails`.
 * @returns {string} HTML snippet (escaped).
 */
function buildHouseholdDirectoryPdfHouseCell(pd) {
  const houseName = String(pd.houseName ?? '').trim() || '—';
  const address = formatHouseholdAddress(pd);
  if (!address) return esc(houseName);
  if (houseName === '—') return esc(address);
  return `${esc(houseName)}<br>${esc(address)}`;
}

/**
 * One `<tr>` for the multi-record household directory table body.
 *
 * @param {Object} rec
 * @param {number} i - Zero-based index (shown as i + 1 in the # column).
 * @param {string} tdStyle - Base cell style (non-house columns).
 * @param {string} tdHouseStyle - House column (long text wrapping).
 * @returns {string}
 */
function buildMultiRecordDataTr(rec, i, tdStyle, tdHouseStyle) {
  const pd = rec.personalDetails || {};
  const memberCount = (rec.members || []).length;
  const nonMemberCount = (rec.nonMembers || []).length;
  const trBreakStyle = 'page-break-inside:avoid;break-inside:avoid;';
  return `<tr style="${trBreakStyle}">
      <td style="${tdStyle}">${i + 1}</td>
      <td style="${tdHouseStyle}">${buildHouseholdDirectoryPdfHouseCell(pd)}</td>
      <td style="${tdStyle}">${esc(pd.name || '—')}</td>
      <td style="${tdStyle}">${esc(pd.pradeshikaSabha || '—')}</td>
      <td style="${tdStyle}">${esc(pd.phone || '—')}</td>
      <td style="${tdStyle}">${memberCount}/${nonMemberCount}</td>
    </tr>`;
}

/**
 * Splits an array into consecutive segments of at most `size` elements.
 *
 * @template T
 * @param {T[]} list
 * @param {number} size
 * @returns {T[][]}
 */
function chunkList(list, size) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

/**
 * Document title shown under the letterhead on the first household-directory PDF page.
 * @returns {string}
 */
function buildHouseholdDirectoryDocTitle() {
  return `<h2 style="text-align:center;font-size:${PDF_FONT_DOC_TITLE_PX}px;color:${PDF_PRIMARY};font-weight:800;margin:0 0 10px;">${PDF_MEMBER_LIST.DOC_TITLE}</h2>`;
}

/**
 * Style strings and thead markup shared by each paginated member-list PDF table.
 *
 * @returns {{ tdStyle: string, tdHouseStyle: string, tableStyle: string, theadHtml: string }}
 */
function getMultiRecordPdfListStyles() {
  const thStyle = 'padding:6px;border:1px solid #ddd;vertical-align:top;';
  const tdStyle =
    'padding:4px;border:1px solid #ddd;vertical-align:top;line-height:1.25;';
  const tdHouseStyle = `${tdStyle}word-break:break-word;overflow-wrap:anywhere;`;
  const tableStyle =
    'width:100%;border-collapse:collapse;font-size:' + PDF_FONT_TABLE_PX + 'px;table-layout:fixed;';
  const cols = PDF_MEMBER_LIST.COLUMNS;
  const theadHtml = `<thead>
        <tr style="background:${PDF_PRIMARY};color:#fff;">
          <th style="${thStyle}">${cols.INDEX}</th>
          <th style="${thStyle}">${cols.HOUSE}</th>
          <th style="${thStyle}">${cols.HOUSE_OWNER_NAME}</th>
          <th style="${thStyle}">${cols.PRADESHIKA_SABHA}</th>
          <th style="${thStyle}">${cols.PHONE}</th>
          <th style="${thStyle}">${cols.MEMBERS_NON_MEMBERS}</th>
        </tr>
      </thead>`;
  return { tdStyle, tdHouseStyle, tableStyle, theadHtml };
}

/**
 * Captures a tabular PDF column header row for repeating on continuation pages.
 *
 * @param {number} contentWidthPx
 * @param {Object} renderOpt
 * @param {string} cacheKey - Stable id per export layout (e.g. `household:794`).
 * @param {string} tableHtml - Minimal table markup containing only `<thead>`.
 * @returns {Promise<HTMLCanvasElement>}
 */
async function capturePdfTheadCanvas(contentWidthPx, renderOpt, cacheKey, tableHtml) {
  const cached = pdfTheadCanvasCache.get(cacheKey);
  if (cached) return cached;

  const container = createPdfCaptureContainer(tableHtml, contentWidthPx, 0);
  document.body.appendChild(container);
  await waitForImagesIn(container);
  await waitForLayoutPaint();
  const canvas = await captureElementToCanvas(container, renderOpt);
  container.remove();
  pdfTheadCanvasCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * @returns {string} Household-directory thead-only table HTML.
 */
function buildHouseholdDirectoryTheadTableHtml() {
  const styles = getMultiRecordPdfListStyles();
  return `<div style="font-family:Arial,sans-serif;background:#fff;color:#333;">
    <table style="${styles.tableStyle}">
      ${MULTI_RECORD_COLGROUP}
      ${styles.theadHtml}
    </table>
  </div>`;
}

/**
 * @returns {string} Advanced-search thead-only table HTML.
 */
function buildAdvancedSearchTheadTableHtml() {
  const styles = getAdvancedSearchPdfListStyles();
  return `<div class="pdf-advanced-search-page" style="font-family:Arial,sans-serif;font-size:${PDF_FONT_TABLE_LANDSCAPE_PX}px;color:#333;background:#fff;">
    <table style="${styles.tableStyle}">
      ${ADVANCED_SEARCH_COLGROUP}
      ${styles.theadHtml}
    </table>
  </div>`;
}

/**
 * @returns {string} Jilla membership thead-only table HTML.
 */
function buildJillaMembershipTheadTableHtml() {
  const L = JILLA_MEMBERSHIP_COLUMN_LABELS;
  const thStyle = `padding:6px 4px;border:1px solid #333;text-align:center;font-size:${PDF_FONT_TABLE_PX}px;line-height:1.2;`;
  return `<div class="pdf-jilla-membership-page" style="font-family:Arial,sans-serif;background:#fff;color:#333;">
    <table style="width:100%;border-collapse:collapse;font-size:${PDF_FONT_TABLE_PX}px;">
      <thead>
        <tr style="background:${PDF_PRIMARY};color:#fff;">
          <th style="${thStyle}width:6%;">Sl.No</th>
          <th style="${thStyle}width:24%;">Pradeshika Sabha</th>
          <th style="${thStyle}width:12%;">${esc(L.LIFE_MEMBERS)}</th>
          <th style="${thStyle}width:12%;">${esc(L.ORDINARY_MEMBERS)}</th>
          <th style="${thStyle}width:10%;">Total</th>
          <th style="${thStyle}width:10%;">Home</th>
          <th style="${thStyle}width:12%;">${esc(L.PUSHPAKADHWANI)}</th>
        </tr>
      </thead>
    </table>
  </div>`;
}

/**
 * Resolves a cached thead canvas for tabular PDF sections that may span multiple sheets.
 *
 * @param {string} sectionHtml
 * @param {number} contentWidthPx
 * @param {Object} renderOpt
 * @returns {Promise<HTMLCanvasElement|null>}
 */
async function resolvePdfRepeatTheadCanvas(sectionHtml, contentWidthPx, renderOpt) {
  if (sectionHtml.includes('pdf-member-list-page')) {
    return capturePdfTheadCanvas(
      contentWidthPx,
      renderOpt,
      `household:${contentWidthPx}`,
      buildHouseholdDirectoryTheadTableHtml(),
    );
  }
  if (sectionHtml.includes('pdf-advanced-search-page')) {
    return capturePdfTheadCanvas(
      contentWidthPx,
      renderOpt,
      `advanced:${contentWidthPx}`,
      buildAdvancedSearchTheadTableHtml(),
    );
  }
  if (sectionHtml.includes('pdf-jilla-membership-page')) {
    return capturePdfTheadCanvas(
      contentWidthPx,
      renderOpt,
      `jilla:${contentWidthPx}`,
      buildJillaMembershipTheadTableHtml(),
    );
  }
  return null;
}

/**
 * One PDF page section: optional break, header or continuation banner, one table.
 *
 * @param {Array<Object>} chunk - Records for this page.
 * @param {number} chunkIdx - Zero-based page index.
 * @param {number} pageSize - Rows per page (same value as `PDF_MEMBER_LIST.ROWS_PER_PAGE`).
 * @param {number} totalPages
 * @param {{ tdStyle: string, tdHouseStyle: string, tableStyle: string, theadHtml: string }} styles
 * @returns {string}
 */
function buildMultiRecordPdfPageSection(chunk, chunkIdx, pageSize, totalPages, styles) {
  const pageStyle =
    chunkIdx > 0 ? 'page-break-before:always;break-before:page;' : '';
  const docTitleHtml = chunkIdx === 0 ? buildHouseholdDirectoryDocTitle() : '';
  const startIndex = chunkIdx * pageSize;
  const bodyRows = chunk
    .map((rec, j) =>
      buildMultiRecordDataTr(rec, startIndex + j, styles.tdStyle, styles.tdHouseStyle)
    )
    .join('');

  return `<div class="pdf-member-list-page" style="${pageStyle}">
    ${docTitleHtml}
    <table style="${styles.tableStyle}">
      ${MULTI_RECORD_COLGROUP}
      ${styles.theadHtml}
      <tbody>${bodyRows}</tbody>
    </table>
  </div>`;
}

/**
 * Builds a styled HTML string for multiple records (full or sabha-wise export).
 * Paginates using `PDF_MEMBER_LIST.ROWS_PER_PAGE` with explicit page breaks between chunks.
 *
 * @param {Array<Object>} records
 * @returns {string}
 */
function buildMultiRecordHTML(records) {
  const pageSize = PDF_MEMBER_LIST.ROWS_PER_PAGE;
  const chunks = chunkList(records, pageSize);
  const styles = getMultiRecordPdfListStyles();
  const pagesHtml = chunks
    .map((chunk, chunkIdx) =>
      buildMultiRecordPdfPageSection(
        chunk,
        chunkIdx,
        pageSize,
        chunks.length,
        styles
      )
    )
    .join('');

  return `<div style="font-family:Arial,sans-serif;font-size:${PDF_FONT_BODY_PX}px;color:#333;">
    ${pagesHtml}
  </div>`;
}

/** Column widths for advanced search person-list PDF tables (landscape A4). */
const ADVANCED_SEARCH_COLGROUP = `
    <colgroup>
      <col style="width:3%;">
      <col style="width:13%;">
      <col style="width:24%;">
      <col style="width:11%;">
      <col style="width:20%;">
      <col style="width:11%;">
      <col style="width:18%;">
    </colgroup>`;

/**
 * Formats DOB and age for a single PDF table cell (matches advanced search card copy).
 *
 * @param {string|undefined} dob
 * @returns {string}
 */
function formatDobAgePdfCell(dob) {
  const dobDisp = formatDOB(dob);
  const age = calcAgeYears(dob);
  if (dobDisp === '—' && age === '—') return '—';
  const lines = [];
  if (dobDisp !== '—') lines.push(dobDisp);
  if (age !== '—') lines.push(`${age} yrs`);
  return lines.join('<br>');
}

/**
 * Formats phone and email on separate lines for a single PDF table cell.
 *
 * @param {string|undefined} phone
 * @param {string|undefined} email
 * @returns {string}
 */
function formatContactPdfCell(phone, email) {
  const phoneStr = String(phone ?? '').trim() || '—';
  const emailStr = String(email ?? '').trim() || '—';
  return `${esc(phoneStr)}<br>${esc(emailStr)}`;
}

/**
 * One `<tr>` for the advanced search person table body.
 *
 * @param {import('./member-person-search.js').PersonSearchRow} row
 * @param {number} i - Zero-based index (shown as i + 1 in the # column).
 * @param {string} tdStyle - Base cell style.
 * @param {string} tdWrapStyle - Cell style with word wrapping for long text.
 * @returns {string}
 */
function buildAdvancedSearchDataTr(row, i, tdStyle, tdWrapStyle) {
  const p = row.person || {};
  const pd = row.householdPd || {};
  const name = p.name || '—';
  const addr = formatHouseholdAddress(pd) || '—';
  const sabha = pd.pradeshikaSabha || '—';
  const roleLabel = personRoleBadgeLabel(row, ADVANCED_MEMBER_SEARCH);
  const trBreakStyle = 'page-break-inside:avoid;break-inside:avoid;';

  return `<tr style="${trBreakStyle}">
      <td style="${tdStyle}">${i + 1}</td>
      <td style="${tdWrapStyle}">${esc(name)}</td>
      <td style="${tdWrapStyle}">${esc(addr)}</td>
      <td style="${tdWrapStyle}">${formatDobAgePdfCell(p.dob)}</td>
      <td style="${tdWrapStyle}">${formatContactPdfCell(p.phone, p.email)}</td>
      <td style="${tdStyle}">${esc(roleLabel)}</td>
      <td style="${tdWrapStyle}">${esc(sabha)}</td>
    </tr>`;
}

/**
 * Style strings and thead markup shared by each paginated advanced search PDF table.
 *
 * @returns {{ tdStyle: string, tdWrapStyle: string, tableStyle: string, theadHtml: string }}
 */
function getAdvancedSearchPdfListStyles() {
  const thStyle =
    `padding:5px 3px;border:1px solid #ccc;vertical-align:middle;font-size:${PDF_FONT_TABLE_LANDSCAPE_PX}px;line-height:1.25;`
    + `background-color:${PDF_PRIMARY};color:#fff;text-align:left;`;
  const tdStyle =
    `padding:4px 3px;border:1px solid #ccc;vertical-align:top;line-height:1.3;font-size:${PDF_FONT_TABLE_LANDSCAPE_PX}px;color:#333;`;
  const tdWrapStyle = `${tdStyle}word-break:break-word;overflow-wrap:break-word;white-space:normal;`;
  const tableStyle =
    `width:100%;border-collapse:collapse;font-size:${PDF_FONT_TABLE_LANDSCAPE_PX}px;table-layout:fixed;color:#333;`;
  const theadHtml = `<thead>
        <tr>
          <th style="${thStyle}">#</th>
          <th style="${thStyle}">Name</th>
          <th style="${thStyle}">Address</th>
          <th style="${thStyle}">DOB<br>&amp; Age</th>
          <th style="${thStyle}">Phone<br>&amp; Email</th>
          <th style="${thStyle}">Member /<br>Non-member</th>
          <th style="${thStyle}">Pradeshika<br>Sabha</th>
        </tr>
      </thead>`;
  return { tdStyle, tdWrapStyle, tableStyle, theadHtml };
}

/**
 * Document title under the letterhead on the first advanced search PDF page.
 *
 * @returns {string}
 */
function buildAdvancedSearchDocTitle() {
  return `<div style="text-align:center;margin-bottom:10px;">
      <h2 style="margin:0;font-size:${PDF_FONT_DOC_TITLE_PX + 1}px;color:${PDF_PRIMARY};font-weight:800;">${esc(ADVANCED_MEMBER_SEARCH.PDF_TITLE)}</h2>
    </div>`;
}

/**
 * One PDF page section: optional break, header or continuation banner, one table.
 *
 * @param {import('./member-person-search.js').PersonSearchRow[]} chunk
 * @param {number} chunkIdx - Zero-based page index.
 * @param {number} pageSize
 * @param {number} totalPages
 * @param {{ tdStyle: string, tdWrapStyle: string, tableStyle: string, theadHtml: string }} styles
 * @returns {string}
 */
function buildAdvancedSearchPdfPageSection(chunk, chunkIdx, pageSize, totalPages, styles) {
  const docTitleHtml = chunkIdx === 0 ? buildAdvancedSearchDocTitle() : '';
  const startIndex = chunkIdx * pageSize;
  const bodyRows = chunk
    .map((row, j) => buildAdvancedSearchDataTr(row, startIndex + j, styles.tdStyle, styles.tdWrapStyle))
    .join('');

  return `<div class="pdf-advanced-search-page" style="font-family:Arial,sans-serif;font-size:${PDF_FONT_TABLE_LANDSCAPE_PX}px;color:#333;background:#fff;">
    ${docTitleHtml}
    <table style="${styles.tableStyle}">
      ${ADVANCED_SEARCH_COLGROUP}
      ${styles.theadHtml}
      <tbody>${bodyRows}</tbody>
    </table>
  </div>`;
}

/**
 * Builds one HTML fragment per PDF page (avoids html2canvas max-height on large exports).
 *
 * @param {import('./member-person-search.js').PersonSearchRow[]} rows
 * @returns {string[]}
 */
function buildAdvancedSearchPageSections(rows) {
  const pageSize = PDF_ADVANCED_SEARCH.ROWS_PER_PAGE;
  const chunks = chunkList(rows, pageSize);
  const styles = getAdvancedSearchPdfListStyles();
  return chunks.map((chunk, chunkIdx) =>
    buildAdvancedSearchPdfPageSection(
      chunk,
      chunkIdx,
      pageSize,
      chunks.length,
      styles,
    ),
  );
}

/**
 * Builds PDF HTML for Jilla membership statistics (one year, table + footer totals).
 * @param {{ year: number, rows: Array<{ psName: string, lifeMembers: number, ordinaryMembers: number, home: number, pushpakadhwani: number }>, lastUpdatedText: string, updatedByText: string, footer: { lm: number, om: number, grand: number, home: number, pd: number } }} opts
 * @returns {string}
 */
function buildJillaMembershipHTML(opts) {
  const { year, rows, lastUpdatedText, updatedByText, footer } = opts;
  const L = JILLA_MEMBERSHIP_COLUMN_LABELS;
  const thStyle = `padding:6px 4px;border:1px solid #333;text-align:center;font-size:${PDF_FONT_TABLE_PX}px;line-height:1.2;`;
  const tdStyle = 'padding:5px 4px;border:1px solid #333;';
  const tdNum = `${tdStyle}text-align:right;`;
  const tdName = `${tdStyle}text-align:left;`;
  const footBg = 'background:#e8e8e8;font-weight:700;';

  const bodyRows = rows
    .map((r, i) => {
      const total = r.lifeMembers + r.ordinaryMembers;
      return `<tr>
      <td style="${tdNum}">${i + 1}</td>
      <td style="${tdName}">${esc(r.psName)}</td>
      <td style="${tdNum}">${r.lifeMembers}</td>
      <td style="${tdNum}">${r.ordinaryMembers}</td>
      <td style="${tdNum}">${total}</td>
      <td style="${tdNum}">${r.home}</td>
      <td style="${tdNum}">${r.pushpakadhwani}</td>
    </tr>`;
    })
    .join('');

  const auditLines = [
    lastUpdatedText ? `Last updated: ${esc(lastUpdatedText)}` : '',
    updatedByText ? `Updated by: ${esc(updatedByText)}` : '',
  ]
    .filter(Boolean)
    .join(' &nbsp;|&nbsp; ');

  return `<div class="pdf-jilla-membership-page" style="font-family:Arial,sans-serif;font-size:${PDF_FONT_BODY_PX}px;color:#333;">
    <div style="text-align:center;margin-bottom:12px;">
      <h2 style="margin:0 0 4px;font-size:${PDF_FONT_DOC_TITLE_PX + 3}px;color:${PDF_PRIMARY};font-weight:800;">Jilla Membership Details</h2>
      <p style="margin:0;font-size:${PDF_FONT_BODY_PX}px;font-weight:700;color:#333;">${year} Membership</p>
      ${auditLines ? `<p style="margin:8px 0 0;font-size:${PDF_FONT_META_PX}px;color:#555;">${auditLines}</p>` : ''}
    </div>
    <div style="${KEEP_TOGETHER}">
      <table style="width:100%;border-collapse:collapse;font-size:${PDF_FONT_TABLE_PX}px;">
        <thead>
          <tr style="background:${PDF_PRIMARY};color:#fff;">
            <th style="${thStyle}width:6%;">Sl.No</th>
            <th style="${thStyle}width:24%;">Pradeshika Sabha</th>
            <th style="${thStyle}width:12%;">${esc(L.LIFE_MEMBERS)}</th>
            <th style="${thStyle}width:12%;">${esc(L.ORDINARY_MEMBERS)}</th>
            <th style="${thStyle}width:10%;">Total</th>
            <th style="${thStyle}width:10%;">Home</th>
            <th style="${thStyle}width:12%;">${esc(L.PUSHPAKADHWANI)}</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>
          <tr style="${footBg}">
            <td style="${tdNum}" colspan="2">Total</td>
            <td style="${tdNum}">${footer.lm}</td>
            <td style="${tdNum}">${footer.om}</td>
            <td style="${tdNum}">${footer.grand}</td>
            <td style="${tdNum}">${footer.home}</td>
            <td style="${tdNum}">${footer.pd}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>`;
}

/**
 * Generates and downloads a PDF of Jilla membership statistics for one year (tabular layout).
 *
 * @param {{
 *   year: number,
 *   rows: Array<{ psName: string, lifeMembers: number, ordinaryMembers: number, home: number, pushpakadhwani: number }>,
 *   lastUpdatedText: string,
 *   updatedByText: string,
 *   footer: { lm: number, om: number, grand: number, home: number, pd: number }
 * }} opts - Pre-built rows and footer from the Jilla membership page (same numbers as on screen).
 * @returns {void} Triggers download; shows toast if html2pdf is missing or generation fails.
 */
export function generateJillaMembershipPDF(opts) {
  const html = buildJillaMembershipHTML(opts);
  downloadPDF(html, `SPSS_Jilla_Membership_${opts.year}.pdf`);
}

/**
 * Builds an HTML table for a list of member/non-member persons.
 * @param {string} heading
 * @param {Array<Object>} persons
 * @param {boolean} [showReason=false]
 * @returns {string}
 */
function buildPersonListHTML(heading, persons, showReason = false) {
  let html = '';

  persons.forEach((p, i) => {
    const headingHtml = i === 0
      ? `<h4 style="color:${PDF_PRIMARY};margin-top:16px;page-break-after:avoid;break-after:avoid;">${esc(heading)}</h4>`
      : '';
    html += `
      <div class="pdf-atomic-section" style="${KEEP_TOGETHER}margin-bottom:12px;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fafafa;">
        ${headingHtml}
        <h5 style="margin:0 0 6px;color:${PDF_PRIMARY};">#${i + 1} — ${esc(p.name || '—')}</h5>
        <table style="width:100%;border-collapse:collapse;font-size:${PDF_FONT_PERSON_CARD_PX}px;">
          ${row('Date of Birth', formatDOB(p.dob))}
          ${row('Gender', formatLabel(p.gender))}
          ${row('Relationship', formatLabel(p.relationship))}
          ${p.membershipType ? row('Membership', formatLabel(p.membershipType)) : ''}
          ${!showReason && p.holdsSpssPosition ? row('SPSS Position', p.spssPositionName) : ''}
          ${row('Phone', p.phone)}
          ${row('Email', p.email)}
          ${row('Blood Group', p.bloodGroup)}
          ${row('Education', formatLabel(p.highestEducation))}
          ${row('Occupation', formatLabel(p.occupation))}
          ${p.areaOfExpertise ? row('Area of expertise (if any)', p.areaOfExpertise) : ''}
          ${showReason ? row('Reason for No Membership', p.reasonForNoMembership) : ''}
          ${row('Living Outside Kerala', p.livingOutsideKerala ? 'Yes' : 'No')}
          ${p.livingOutsideKerala ? row('Reason', formatLabel(p.outsideReason)) : ''}
        </table>
      </div>`;
  });

  return html;
}

/**
 * Builds a two-column table row.
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
function row(label, value) {
  return `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:600;width:180px;">${esc(label)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;">${esc(value || '—')}</td>
    </tr>`;
}

/** Simple HTML escape (string-based; safe before DOM attachment). */
function esc(str) {
  if (str == null || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Waits for layout paint before html2canvas capture.
 * @returns {Promise<void>}
 */
function waitForLayoutPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * Waits for all images under `root` to load (or fail).
 * @param {ParentNode} root
 * @returns {Promise<void>}
 */
function waitForImagesIn(root) {
  const images = root.querySelectorAll('img');
  return Promise.all(
    Array.from(images).map(
      (img) => (img.complete
        ? Promise.resolve()
        : new Promise((res) => {
          img.onload = res;
          img.onerror = res;
        })),
    ),
  );
}

/**
 * html2pdf.js render options for one advanced-search PDF page section (landscape).
 *
 * @param {number} contentWidthPx
 * @returns {Object}
 */
function getAdvancedSearchPdfRenderOptions(contentWidthPx) {
  return {
    margin: [8, 8, 8, 8],
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      width: contentWidthPx,
      windowWidth: contentWidthPx,
      backgroundColor: '#ffffff',
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] },
  };
}

/**
 * Builds a DOM node for html2pdf/html2canvas capture on long admin pages.
 * Fixed at top-left above the loading overlay so html2canvas sees non-zero layout.
 *
 * @param {string} html
 * @param {number} contentWidthPx
 * @param {number} [paddingPx=20]
 * @returns {HTMLDivElement}
 */
function createPdfCaptureContainer(html, contentWidthPx, paddingPx = 20) {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.zIndex = '10001';
  container.style.width = `${contentWidthPx}px`;
  container.style.minWidth = `${contentWidthPx}px`;
  container.style.maxWidth = `${contentWidthPx}px`;
  container.style.padding = `${paddingPx}px`;
  container.style.boxSizing = 'border-box';
  container.style.background = '#fff';
  container.style.overflow = 'visible';
  container.style.pointerEvents = 'none';
  return container;
}

/**
 * @param {string} html
 * @param {number} contentWidthPx
 * @returns {HTMLDivElement}
 */
function createAdvancedSearchPdfCaptureContainer(html, contentWidthPx) {
  return createPdfCaptureContainer(html, contentWidthPx, 12);
}

/**
 * Captures a DOM node to canvas (prefers global html2canvas; falls back to html2pdf worker).
 *
 * @param {HTMLElement} container
 * @param {Object} renderOpt
 * @returns {Promise<HTMLCanvasElement>}
 */
async function captureElementToCanvas(container, renderOpt) {
  const html2canvasOpts = {
    scale: renderOpt.html2canvas?.scale ?? 2,
    useCORS: true,
    logging: false,
    letterRendering: true,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
  };
  if (renderOpt.html2canvas?.width != null) {
    html2canvasOpts.width = renderOpt.html2canvas.width;
  }
  if (renderOpt.html2canvas?.windowWidth != null) {
    html2canvasOpts.windowWidth = renderOpt.html2canvas.windowWidth;
  }

  if (typeof html2canvas !== 'undefined') {
    return html2canvas(container, html2canvasOpts);
  }

  return html2pdf()
    .set({ ...renderOpt, filename: '_section.pdf' })
    .from(container)
    .toCanvas()
    .get('canvas');
}

/**
 * Draws a canvas onto a jsPDF doc (adds pages when the image is taller than one sheet).
 *
 * @param {Object} doc
 * @param {HTMLCanvasElement} canvas
 * @param {number} margin
 * @param {boolean} isFirstPage
 * @param {{ format?: string, orientation?: string }} jsPdfOpts
 * @param {{ contentTopMm: number, maxContentHeightMm: number }} [layout]
 * @param {HTMLCanvasElement} [repeatHeaderCanvas] - Table header row redrawn on each continuation slice.
 */
function drawCanvasOnPdfDoc(doc, canvas, margin, isFirstPage, jsPdfOpts, layout, repeatHeaderCanvas) {
  const format = jsPdfOpts.format || 'a4';
  const orientation = jsPdfOpts.orientation || 'landscape';
  const pageW = doc.internal.pageSize.getWidth();
  const imgWidthMm = pageW - 2 * margin;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const contentTopMm = layout?.contentTopMm ?? margin;
  const maxSliceMm = layout?.maxContentHeightMm
    ?? (doc.internal.pageSize.getHeight() - 2 * margin);

  let headerHeightMm = 0;
  let headerImgData = null;
  if (repeatHeaderCanvas) {
    headerHeightMm = (repeatHeaderCanvas.height * imgWidthMm) / repeatHeaderCanvas.width;
    headerImgData = repeatHeaderCanvas.toDataURL('image/jpeg', 0.95);
  }
  const continuationSliceMm = Math.max(maxSliceMm - headerHeightMm, 1);

  if (!isFirstPage) doc.addPage(format, orientation);

  if (imgHeightMm <= maxSliceMm) {
    doc.addImage(imgData, 'JPEG', margin, contentTopMm, imgWidthMm, imgHeightMm);
    return;
  }

  let offsetMm = 0;
  let sliceIndex = 0;
  while (offsetMm < imgHeightMm) {
    if (sliceIndex > 0) doc.addPage(format, orientation);

    if (sliceIndex > 0 && headerImgData) {
      doc.addImage(headerImgData, 'JPEG', margin, contentTopMm, imgWidthMm, headerHeightMm);
    }

    const imageTopMm = sliceIndex > 0 && headerImgData
      ? contentTopMm + headerHeightMm
      : contentTopMm;
    doc.addImage(imgData, 'JPEG', margin, imageTopMm - offsetMm, imgWidthMm, imgHeightMm);

    offsetMm += sliceIndex === 0 ? maxSliceMm : continuationSliceMm;
    sliceIndex += 1;
  }
}

/** Gap between stacked atomic PDF sections on the same page (mm). */
const PDF_ATOMIC_SECTION_GAP_MM = 2;

/**
 * Places a section canvas on the PDF without splitting it across pages when it fits on one sheet.
 * Starts a new page when the section would not fit in the remaining space.
 *
 * @param {Object} doc
 * @param {HTMLCanvasElement} canvas
 * @param {number} margin
 * @param {number} cursorY - Current Y position on the active page (mm).
 * @param {boolean} isFirstPage
 * @param {{ format?: string, orientation?: string }} jsPdfOpts
 * @param {{ contentTopMm: number, maxContentHeightMm: number }} layout
 * @returns {{ cursorY: number, isFirstPage: boolean }}
 */
function appendAtomicSectionCanvasToPdfDoc(doc, canvas, margin, cursorY, isFirstPage, jsPdfOpts, layout) {
  const format = jsPdfOpts.format || 'a4';
  const orientation = jsPdfOpts.orientation || 'portrait';
  const pageW = doc.internal.pageSize.getWidth();
  const imgWidthMm = pageW - 2 * margin;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const { contentTopMm, maxContentHeightMm } = layout;
  const contentBottomMm = contentTopMm + maxContentHeightMm;

  if (imgHeightMm > maxContentHeightMm) {
    drawCanvasOnPdfDoc(doc, canvas, margin, isFirstPage, jsPdfOpts, layout);
    return { cursorY: contentBottomMm, isFirstPage: false };
  }

  let y = isFirstPage ? contentTopMm : cursorY;
  if (!isFirstPage && y + imgHeightMm > contentBottomMm) {
    doc.addPage(format, orientation);
    y = contentTopMm;
  }

  doc.addImage(imgData, 'JPEG', margin, y, imgWidthMm, imgHeightMm);
  return {
    cursorY: y + imgHeightMm + PDF_ATOMIC_SECTION_GAP_MM,
    isFirstPage: false,
  };
}

/**
 * @param {string} html
 * @returns {boolean}
 */
function isFullPagePdfSection(html) {
  return html.includes('pdf-member-list-page')
    || html.includes('pdf-advanced-search-page')
    || html.includes('pdf-jilla-membership-page');
}

/**
 * Renders advanced-search PDF page sections one at a time and merges into a single file.
 * Avoids html2canvas max-canvas-height failures on large unfiltered exports.
 *
 * @param {string[]} pageSections - HTML fragment per page from {@link buildAdvancedSearchPageSections}.
 * @param {string} filename
 * @returns {void}
 */
function downloadAdvancedSearchPDF(pageSections, filename) {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) {
    showToast(MESSAGES.PDF_LIB_MISSING, 'error');
    return;
  }

  showLoader(MESSAGES.PDF_GENERATING);

  const contentWidthPx = Math.round(PDF_ADVANCED_SEARCH.CONTENT_WIDTH_MM * 3.78);
  const renderOpt = getAdvancedSearchPdfRenderOptions(contentWidthPx);
  const jsPdfOpts = renderOpt.jsPDF;
  const margin = 8;

  (async () => {
    /** @type {HTMLElement[]} */
    const containers = [];

    try {
      await waitForLayoutPaint();

      const doc = new JsPDF({
        orientation: jsPdfOpts.orientation || 'landscape',
        unit: 'mm',
        format: jsPdfOpts.format || 'a4',
      });
      const headerCanvas = await getPdfHeaderCanvas(contentWidthPx, renderOpt);
      const layout = computePdfLayoutMetrics(doc, margin, headerCanvas);
      let isFirstPage = true;

      for (let i = 0; i < pageSections.length; i++) {
        const repeatTheadCanvas = await resolvePdfRepeatTheadCanvas(
          pageSections[i],
          contentWidthPx,
          renderOpt,
        );

        const container = createAdvancedSearchPdfCaptureContainer(pageSections[i], contentWidthPx);
        containers.push(container);
        document.body.appendChild(container);

        await waitForImagesIn(container);
        await waitForLayoutPaint();

        const canvas = await captureElementToCanvas(container, renderOpt);
        drawCanvasOnPdfDoc(
          doc,
          canvas,
          margin,
          isFirstPage,
          jsPdfOpts,
          layout,
          repeatTheadCanvas,
        );
        isFirstPage = false;

        container.remove();
      }

      applyPdfPageChromeToAllPages(doc, headerCanvas, margin);
      doc.save(filename);
      hideLoader();
      showToast(MESSAGES.PDF_DOWNLOADED, 'success');
    } catch (err) {
      containers.forEach((el) => el.remove());
      hideLoader();
      Logger.error('Advanced search PDF generation failed:', err);
      showToast(MESSAGES.PDF_FAIL, 'error');
    }
  })();
}

/**
 * html2pdf.js render options for portrait PDF capture (member detail, directory list, jilla).
 *
 * @param {number} contentWidthPx
 * @returns {Object}
 */
function getPortraitPdfRenderOptions(contentWidthPx) {
  return {
    margin: 10,
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      width: contentWidthPx,
      windowWidth: contentWidthPx,
      backgroundColor: '#ffffff',
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };
}

/**
 * Splits paginated PDF HTML into one fragment per page section (if present).
 * Member-detail exports use `.pdf-atomic-section` so each card/block is captured separately.
 *
 * @param {string} htmlContent
 * @returns {string[]}
 */
function extractPdfCaptureSections(htmlContent) {
  const probe = document.createElement('div');
  probe.innerHTML = htmlContent;
  const sections = probe.querySelectorAll('.pdf-member-list-page');
  if (sections.length > 0) {
    return Array.from(sections).map((el) => el.outerHTML);
  }

  const root = probe.firstElementChild;
  if (root) {
    const atomicSections = root.querySelectorAll(':scope > .pdf-atomic-section');
    if (atomicSections.length > 0) {
      const rootStyle = root.getAttribute('style') || '';
      return Array.from(atomicSections).map(
        (el) => `<div style="${rootStyle}">${el.outerHTML}</div>`,
      );
    }
  }

  return [htmlContent];
}

/**
 * Portrait PDF via html2canvas + jsPDF (reliable on long admin pages; html2pdf().save() often blanks).
 *
 * @param {string[]} pageSections
 * @param {string} filename
 * @param {Object} renderOpt
 * @returns {Promise<void>}
 */
async function downloadPortraitPdfViaCanvas(pageSections, filename, renderOpt) {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) {
    showToast(MESSAGES.PDF_LIB_MISSING, 'error');
    return;
  }

  const jsPdfOpts = renderOpt.jsPDF;
  const margin = Array.isArray(renderOpt.margin) ? renderOpt.margin[0] : (renderOpt.margin ?? 10);
  const contentWidthPx = renderOpt.html2canvas?.width ?? PDF_PORTRAIT_CONTENT_WIDTH_PX;
  /** @type {HTMLElement[]} */
  const containers = [];

  try {
    const doc = new JsPDF({
      orientation: jsPdfOpts.orientation || 'portrait',
      unit: 'mm',
      format: jsPdfOpts.format || 'a4',
    });
    const headerCanvas = await getPdfHeaderCanvas(contentWidthPx, renderOpt);
    const layout = computePdfLayoutMetrics(doc, margin, headerCanvas);
    let isFirstPage = true;
    let cursorY = layout.contentTopMm;
    const useAtomicPlacement = pageSections.some(
      (section) => !isFullPagePdfSection(section),
    ) && pageSections.length > 1;

    for (let i = 0; i < pageSections.length; i++) {
      const repeatTheadCanvas = await resolvePdfRepeatTheadCanvas(
        pageSections[i],
        contentWidthPx,
        renderOpt,
      );

      const container = createPdfCaptureContainer(pageSections[i], contentWidthPx, 20);
      containers.push(container);
      document.body.appendChild(container);

      await waitForImagesIn(container);
      await waitForLayoutPaint();

      const canvas = await captureElementToCanvas(container, renderOpt);
      if (useAtomicPlacement && !isFullPagePdfSection(pageSections[i])) {
        ({ cursorY, isFirstPage } = appendAtomicSectionCanvasToPdfDoc(
          doc,
          canvas,
          margin,
          cursorY,
          isFirstPage,
          jsPdfOpts,
          layout,
        ));
      } else {
        drawCanvasOnPdfDoc(
          doc,
          canvas,
          margin,
          isFirstPage,
          jsPdfOpts,
          layout,
          repeatTheadCanvas,
        );
        isFirstPage = false;
        cursorY = layout.contentTopMm;
      }

      container.remove();
    }

    applyPdfPageChromeToAllPages(doc, headerCanvas, margin);
    doc.save(filename);
  } finally {
    containers.forEach((el) => el.remove());
  }
}

/* ================================================================== */
/*  PDF Download via html2pdf.js                                       */
/* ================================================================== */

/**
 * Converts an HTML string to PDF and triggers a browser download.
 * Uses html2canvas + jsPDF when available (same pipeline as advanced search).
 *
 * @param {string} htmlContent - Full HTML fragment (styles are mostly inline).
 * @param {string} filename - Downloaded file name including `.pdf`.
 * @param {Object} [pdfOptOverrides] - Optional render option overrides.
 * @returns {void}
 */
function downloadPDF(htmlContent, filename, pdfOptOverrides = {}) {
  const hasCanvasPipeline = Boolean(window.jspdf?.jsPDF)
    && (typeof html2canvas !== 'undefined' || typeof html2pdf !== 'undefined');
  if (!hasCanvasPipeline && typeof html2pdf === 'undefined') {
    showToast(MESSAGES.PDF_LIB_MISSING, 'error');
    return;
  }

  showLoader(MESSAGES.PDF_GENERATING);

  const contentWidthPx = pdfOptOverrides.containerWidthPx ?? PDF_PORTRAIT_CONTENT_WIDTH_PX;
  const { containerWidthPx, ...renderOverrides } = pdfOptOverrides;
  const baseRenderOpt = getPortraitPdfRenderOptions(contentWidthPx);
  const renderOpt = {
    ...baseRenderOpt,
    ...renderOverrides,
    html2canvas: { ...baseRenderOpt.html2canvas, ...(renderOverrides.html2canvas || {}) },
    jsPDF: { ...baseRenderOpt.jsPDF, ...(renderOverrides.jsPDF || {}) },
  };
  const pageSections = extractPdfCaptureSections(htmlContent);

  (async () => {
    try {
      await waitForLayoutPaint();

      if (window.jspdf?.jsPDF) {
        await downloadPortraitPdfViaCanvas(pageSections, filename, renderOpt);
      } else {
        const container = createPdfCaptureContainer(htmlContent, contentWidthPx, 20);
        document.body.appendChild(container);
        await waitForImagesIn(container);
        await waitForLayoutPaint();
        await html2pdf().set({
          margin: [10, 10, 10, 10],
          filename,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: renderOpt.html2canvas,
          jsPDF: renderOpt.jsPDF,
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['div[style*="display:table"]'],
            ...(renderOverrides.pagebreak || {}),
          },
        }).from(container).save();
        container.remove();
      }

      hideLoader();
      showToast(MESSAGES.PDF_DOWNLOADED, 'success');
    } catch (err) {
      hideLoader();
      Logger.error('PDF generation failed:', err);
      showToast(MESSAGES.PDF_FAIL, 'error');
    }
  })();
}
