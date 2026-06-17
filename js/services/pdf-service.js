/**
 * @fileoverview PDF generation service using html2pdf.js.
 * Generates member-wise, sabha-wise, full dataset, and advanced search PDF exports.
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
 * Phone stays readable at 10px; PS text is usually short. Members needs enough width for
 * the header label and multi-digit counts (html2pdf truncates when this column is too tight).
 */
const MULTI_RECORD_COLGROUP = `
    <colgroup>
      <col style="width:5%;">
      <col style="width:23%;">
      <col style="width:26%;">
      <col style="width:17%;">
      <col style="width:12%;">
      <col style="width:17%;">
    </colgroup>`;

/** Saffron/maroon theme color used throughout the PDF. */
const PDF_PRIMARY = '#7a2e04';

/** Secondary accent (links, emphasis) paired with {@link PDF_PRIMARY}. */
const PDF_ACCENT = '#c0392b';

/**
 * Builds the branded PDF letterhead with logo, organization name, and underline.
 * @returns {string}
 */
function buildPDFHeader() {
  return `
    <div style="text-align:center;margin-bottom:8px;">
      <img src="assets/app-logo.png" style="width:80px;height:auto;" crossorigin="anonymous">
      <h1 style="margin:6px 0 2px;font-size:18px;color:${PDF_PRIMARY};letter-spacing:1px;font-weight:800;">
        ${ORG_NAME}
      </h1>
      <p style="margin:0 0 8px;font-size:13px;color:#555;letter-spacing:0.5px;font-weight:600;">
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
 * Generates and downloads a PDF of records for one Pradeshika Sabha (tabular layout).
 *
 * @param {Array<Object>} records - Full or scoped list; filtered in-memory by `sabha`.
 * @param {string} sabha - Pradeshika Sabha name to match (case-insensitive).
 * @returns {void} No-op with warning toast if the filtered list is empty.
 */
export function generateSabhaWisePDF(records, sabha) {
  const sabhaLower = sabha.toLowerCase();
  const filtered = records.filter(
    (r) => (r.personalDetails?.pradeshikaSabha || '').toLowerCase() === sabhaLower
  );

  if (filtered.length === 0) {
    showToast(`${MESSAGES.NO_RECORDS} (${sabha})`, 'warning');
    return;
  }

  const html = buildMultiRecordHTML(filtered);
  downloadPDF(html, `SPSS_${sabha.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates and downloads a PDF of the full household directory (tabular layout, paginated).
 *
 * @param {Array<Object>} records - All households to include (already scope-filtered for the user).
 * @returns {void} No-op with warning toast if `records` is empty.
 */
export function generateFullDatasetPDF(records) {
  if (records.length === 0) {
    showToast(MESSAGES.PDF_NO_RECORDS, 'warning');
    return;
  }

  const html = buildMultiRecordHTML(records);
  downloadPDF(html, 'SPSS_Full_Dataset.pdf');
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
    <div style="font-family:Arial,sans-serif;font-size:12px;color:#333;">
      ${buildPDFHeader()}

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

      <div style="${KEEP_TOGETHER}">
        <h4 style="color:${PDF_PRIMARY};">Membership Details</h4>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          ${row('Pradeshika Sabha', pd.pradeshikaSabha)}
          ${row('Membership', formatLabel(pd.membershipType))}
          ${pd.holdsSpssPosition ? row('SPSS Position', pd.spssPositionName) : ''}
        </table>
      </div>

      <div style="${KEEP_TOGETHER}">
        <h4 style="color:${PDF_PRIMARY};">Family & Welfare</h4>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          ${row('Family Health Insurance', pd.healthInsurance ? 'Yes' : 'No')}
          ${row('Term/Life Insurance', pd.termLifeInsurance ? 'Yes' : 'No')}
          ${pd.rationCardType ? row('Ration Card Color', formatLabel(pd.rationCardType)) : ''}
        </table>
      </div>

      <div style="${KEEP_TOGETHER}">
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
  return `<tr>
      <td style="${tdStyle}">${i + 1}</td>
      <td style="${tdStyle}">${esc(pd.name || '—')}</td>
      <td style="${tdHouseStyle}">${esc(pd.houseName || '—')}</td>
      <td style="${tdStyle}">${esc(pd.pradeshikaSabha || '—')}</td>
      <td style="${tdStyle}">${esc(pd.phone || '—')}</td>
      <td style="${tdStyle}">${(rec.members || []).length}</td>
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
 * Compact title strip for member-list PDF pages after the first.
 *
 * @param {number} pageIndex - Zero-based page index.
 * @param {number} totalPages
 * @returns {string}
 */
function buildMemberListContinuationBanner(pageIndex, totalPages) {
  const pageNum = pageIndex + 1;
  return `<div style="margin:0 0 8px;padding:0 0 6px;border-bottom:2px solid ${PDF_PRIMARY};font-size:11px;font-weight:700;color:${PDF_PRIMARY};">
      ${esc(ORG_NAME)} — Household directory <span style="color:#555;font-weight:600;">(Page ${pageNum} of ${totalPages})</span>
    </div>`;
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
    'width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed;';
  const theadHtml = `<thead>
        <tr style="background:${PDF_PRIMARY};color:#fff;">
          <th style="${thStyle}">#</th>
          <th style="${thStyle}">Name</th>
          <th style="${thStyle}">House</th>
          <th style="${thStyle}">Pradeshika Sabha</th>
          <th style="${thStyle}">Phone</th>
          <th style="${thStyle}">Members</th>
        </tr>
      </thead>`;
  return { tdStyle, tdHouseStyle, tableStyle, theadHtml };
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
  const headerHtml =
    chunkIdx === 0
      ? buildPDFHeader()
      : buildMemberListContinuationBanner(chunkIdx, totalPages);
  const startIndex = chunkIdx * pageSize;
  const bodyRows = chunk
    .map((rec, j) =>
      buildMultiRecordDataTr(rec, startIndex + j, styles.tdStyle, styles.tdHouseStyle)
    )
    .join('');

  return `<div class="pdf-member-list-page" style="${pageStyle}">
    ${headerHtml}
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

  return `<div style="font-family:Arial,sans-serif;font-size:11px;color:#333;">
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
 * Compact title strip for advanced search PDF pages after the first.
 *
 * @param {number} pageIndex - Zero-based page index.
 * @param {number} totalPages
 * @returns {string}
 */
function buildAdvancedSearchContinuationBanner(pageIndex, totalPages) {
  const pageNum = pageIndex + 1;
  return `<div style="margin:0 0 8px;padding:0 0 6px;border-bottom:2px solid ${PDF_PRIMARY};font-size:11px;font-weight:700;color:${PDF_PRIMARY};">
      ${esc(ORG_NAME)} — ${esc(ADVANCED_MEMBER_SEARCH.PDF_TITLE)} <span style="color:#555;font-weight:600;">(Page ${pageNum} of ${totalPages})</span>
    </div>`;
}

/**
 * Style strings and thead markup shared by each paginated advanced search PDF table.
 *
 * @returns {{ tdStyle: string, tdWrapStyle: string, tableStyle: string, theadHtml: string }}
 */
function getAdvancedSearchPdfListStyles() {
  const thStyle =
    `padding:5px 3px;border:1px solid #ccc;vertical-align:middle;font-size:8px;line-height:1.25;`
    + `background-color:${PDF_PRIMARY};color:#fff;text-align:left;`;
  const tdStyle =
    'padding:4px 3px;border:1px solid #ccc;vertical-align:top;line-height:1.3;font-size:8px;color:#333;';
  const tdWrapStyle = `${tdStyle}word-break:break-word;overflow-wrap:break-word;white-space:normal;`;
  const tableStyle =
    'width:100%;border-collapse:collapse;font-size:8px;table-layout:fixed;color:#333;';
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
 * Subtitle under the letterhead on the first advanced search PDF page.
 *
 * @param {number} totalRows
 * @returns {string}
 */
function buildAdvancedSearchSubtitle(totalRows) {
  const unit = totalRows === 1
    ? ADVANCED_MEMBER_SEARCH.RESULTS_UNIT_PERSON
    : ADVANCED_MEMBER_SEARCH.RESULTS_UNIT_PEOPLE;
  return `<div style="text-align:center;margin-bottom:10px;">
      <h2 style="margin:0 0 4px;font-size:14px;color:${PDF_PRIMARY};font-weight:800;">${esc(ADVANCED_MEMBER_SEARCH.PDF_TITLE)}</h2>
      <p style="margin:0;font-size:11px;font-weight:600;color:#333;">${totalRows} ${unit}</p>
    </div>`;
}

/**
 * One PDF page section: optional break, header or continuation banner, one table.
 *
 * @param {import('./member-person-search.js').PersonSearchRow[]} chunk
 * @param {number} chunkIdx - Zero-based page index.
 * @param {number} pageSize
 * @param {number} totalPages
 * @param {number} totalRows - Full filtered row count (subtitle on page 1).
 * @param {{ tdStyle: string, tdWrapStyle: string, tableStyle: string, theadHtml: string }} styles
 * @returns {string}
 */
function buildAdvancedSearchPdfPageSection(chunk, chunkIdx, pageSize, totalPages, totalRows, styles) {
  const headerHtml = chunkIdx === 0
    ? `${buildPDFHeader()}${buildAdvancedSearchSubtitle(totalRows)}`
    : buildAdvancedSearchContinuationBanner(chunkIdx, totalPages);
  const startIndex = chunkIdx * pageSize;
  const bodyRows = chunk
    .map((row, j) => buildAdvancedSearchDataTr(row, startIndex + j, styles.tdStyle, styles.tdWrapStyle))
    .join('');

  return `<div class="pdf-advanced-search-page" style="font-family:Arial,sans-serif;font-size:8px;color:#333;background:#fff;">
    ${headerHtml}
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
      rows.length,
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
  const thStyle = 'padding:6px 4px;border:1px solid #333;text-align:center;font-size:9px;line-height:1.2;';
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

  return `<div style="font-family:Arial,sans-serif;font-size:11px;color:#333;">
    ${buildPDFHeader()}
    <div style="text-align:center;margin-bottom:12px;">
      <h2 style="margin:0 0 4px;font-size:16px;color:${PDF_PRIMARY};font-weight:800;">Jilla Membership Details</h2>
      <p style="margin:0;font-size:14px;font-weight:700;color:#333;">${year} Membership</p>
      ${auditLines ? `<p style="margin:8px 0 0;font-size:10px;color:#555;">${auditLines}</p>` : ''}
    </div>
    <div style="${KEEP_TOGETHER}">
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
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
  let html = `<h4 style="color:${PDF_PRIMARY};margin-top:16px;page-break-after:avoid;break-after:avoid;">${esc(heading)}</h4>`;

  persons.forEach((p, i) => {
    html += `
      <div style="${KEEP_TOGETHER}margin-bottom:12px;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fafafa;">
        <h5 style="margin:0 0 6px;color:${PDF_PRIMARY};">#${i + 1} — ${esc(p.name || '—')}</h5>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
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
 * Builds a DOM node for html2pdf capture (visible; loading overlay covers the flash).
 *
 * @param {string} html
 * @param {number} contentWidthPx
 * @returns {HTMLDivElement}
 */
function createAdvancedSearchPdfCaptureContainer(html, contentWidthPx) {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.width = `${contentWidthPx}px`;
  container.style.minWidth = `${contentWidthPx}px`;
  container.style.maxWidth = `${contentWidthPx}px`;
  container.style.padding = '12px';
  container.style.boxSizing = 'border-box';
  container.style.background = '#fff';
  container.style.overflow = 'visible';
  return container;
}

/**
 * Captures a DOM node to canvas (prefers global html2canvas; falls back to html2pdf worker).
 *
 * @param {HTMLElement} container
 * @param {Object} renderOpt
 * @returns {Promise<HTMLCanvasElement>}
 */
async function captureElementToCanvas(container, renderOpt) {
  if (typeof html2canvas !== 'undefined') {
    return html2canvas(container, {
      scale: renderOpt.html2canvas?.scale ?? 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
    });
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
 */
function drawCanvasOnPdfDoc(doc, canvas, margin, isFirstPage, jsPdfOpts) {
  const format = jsPdfOpts.format || 'a4';
  const orientation = jsPdfOpts.orientation || 'landscape';
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const imgWidthMm = pageW - 2 * margin;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const maxSliceMm = pageH - 2 * margin;

  if (!isFirstPage) doc.addPage(format, orientation);

  if (imgHeightMm <= maxSliceMm) {
    doc.addImage(imgData, 'JPEG', margin, margin, imgWidthMm, imgHeightMm);
    return;
  }

  let offsetMm = 0;
  let sliceIndex = 0;
  while (offsetMm < imgHeightMm) {
    if (sliceIndex > 0) doc.addPage(format, orientation);
    doc.addImage(imgData, 'JPEG', margin, margin - offsetMm, imgWidthMm, imgHeightMm);
    offsetMm += maxSliceMm;
    sliceIndex += 1;
  }
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
      const doc = new JsPDF({
        orientation: jsPdfOpts.orientation || 'landscape',
        unit: 'mm',
        format: jsPdfOpts.format || 'a4',
      });
      let isFirstPage = true;

      for (let i = 0; i < pageSections.length; i++) {
        const container = createAdvancedSearchPdfCaptureContainer(pageSections[i], contentWidthPx);
        containers.push(container);
        document.body.appendChild(container);

        await waitForImagesIn(container);
        await waitForLayoutPaint();

        const canvas = await captureElementToCanvas(container, renderOpt);
        drawCanvasOnPdfDoc(doc, canvas, margin, isFirstPage, jsPdfOpts);
        isFirstPage = false;

        container.remove();
      }

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

/* ================================================================== */
/*  PDF Download via html2pdf.js                                       */
/* ================================================================== */

/**
 * Converts an HTML string to PDF and triggers a browser download.
 * Expects `html2pdf` on `window`. Removes the temporary DOM node after completion.
 *
 * @param {string} htmlContent - Full HTML fragment (styles are mostly inline).
 * @param {string} filename - Downloaded file name including `.pdf`.
 * @param {Object} [pdfOptOverrides] - Optional html2pdf option overrides (e.g. landscape jsPDF).
 * @returns {void}
 */
function downloadPDF(htmlContent, filename, pdfOptOverrides = {}) {
  if (typeof html2pdf === 'undefined') {
    showToast(MESSAGES.PDF_LIB_MISSING, 'error');
    return;
  }

  showLoader(MESSAGES.PDF_GENERATING);

  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.padding = '20px';
  if (pdfOptOverrides.containerWidthPx) {
    container.style.width = `${pdfOptOverrides.containerWidthPx}px`;
    container.style.maxWidth = `${pdfOptOverrides.containerWidthPx}px`;
    container.style.boxSizing = 'border-box';
  }
  document.body.appendChild(container);

  const { containerWidthPx, ...renderOverrides } = pdfOptOverrides;
  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      ...(renderOverrides.html2canvas || {}),
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', ...(renderOverrides.jsPDF || {}) },
    pagebreak: {
      mode: ['css', 'legacy'],
      avoid: ['div[style*="display:table"]'],
      ...(renderOverrides.pagebreak || {}),
    },
  };

  const images = container.querySelectorAll('img');
  const loadPromises = Array.from(images).map(
    (img) => img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; })
  );

  Promise.all(loadPromises)
    .then(() => waitForLayoutPaint())
    .then(() => html2pdf().set(opt).from(container).save())
    .then(() => {
      container.remove();
      hideLoader();
      showToast(MESSAGES.PDF_DOWNLOADED, 'success');
    })
    .catch((err) => {
      container.remove();
      hideLoader();
      Logger.error('PDF generation failed:', err);
      showToast(MESSAGES.PDF_FAIL, 'error');
    });
}
