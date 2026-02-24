/**
 * @fileoverview PDF generation service using html2pdf.js.
 * Generates member-wise, sabha-wise, and full dataset PDF exports.
 * @module pdf-service
 */

import { formatLabel, formatDOB, showToast, showLoader, hideLoader } from './ui-service.js';
import { MESSAGES, ORG_NAME, ORG_SUBTITLE } from './constants.js';

/**
 * Inline style applied to blocks that must not be split across PDF pages.
 * `display:table;width:100%` forces the renderer to treat the element as an
 * atomic unit, which is the most reliable way to prevent html2pdf.js from
 * slicing it at a page boundary.
 */
const KEEP_TOGETHER = 'display:table;width:100%;page-break-inside:avoid;break-inside:avoid;overflow:hidden;';

/** Saffron/maroon theme color used throughout the PDF. */
const PDF_PRIMARY = '#7a2e04';
const PDF_ACCENT = '#c0392b';

/**
 * Builds the branded PDF letterhead with logo, organization name, and underline.
 * @returns {string}
 */
function buildPDFHeader() {
  return `
    <div style="text-align:center;margin-bottom:8px;">
      <img src="assets/logo.png" style="width:80px;height:auto;" crossorigin="anonymous">
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
 * Generates and downloads a PDF for a single member record.
 * @param {Object} record - A single member_details document.
 */
export function generateMemberPDF(record) {
  const pd = record.personalDetails || {};
  const html = buildSingleRecordHTML(record);
  downloadPDF(html, `${(pd.name || 'record').replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates and downloads a PDF of all records filtered by Pradeshika Sabha.
 * @param {Array<Object>} records - All records.
 * @param {string} sabha - The Pradeshika Sabha to filter by.
 */
export function generateSabhaWisePDF(records, sabha) {
  const sabhaLower = sabha.toLowerCase();
  const allSabhas = records.map((r) => r.personalDetails?.pradeshikaSabha || '(empty)');
  console.log('[Sabha PDF] Dropdown value:', JSON.stringify(sabha));
  console.log('[Sabha PDF] Stored values:', JSON.stringify(allSabhas));
  const filtered = records.filter(
    (r) => (r.personalDetails?.pradeshikaSabha || '').toLowerCase() === sabhaLower
  );
  console.log('[Sabha PDF] Matched:', filtered.length);

  if (filtered.length === 0) {
    showToast(`${MESSAGES.NO_RECORDS} (${sabha})`, 'warning');
    return;
  }

  const html = buildMultiRecordHTML(filtered);
  downloadPDF(html, `SPSS_${sabha.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates and downloads a PDF of the full dataset.
 * @param {Array<Object>} records
 */
export function generateFullDatasetPDF(records) {
  if (records.length === 0) {
    showToast(MESSAGES.PDF_NO_RECORDS, 'warning');
    return;
  }

  const html = buildMultiRecordHTML(records);
  downloadPDF(html, 'SPSS_Full_Dataset.pdf');
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
          ${pd.areaOfExpertise ? row('Area of Expertise', pd.areaOfExpertise) : ''}
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
 * Builds a styled HTML string for multiple records.
 * @param {Array<Object>} records
 * @returns {string}
 */
function buildMultiRecordHTML(records) {
  const thStyle = `padding:6px;border:1px solid #ddd;`;
  const tdStyle = `padding:4px;border:1px solid #ddd;`;

  const rows = records.map((rec, i) => {
    const pd = rec.personalDetails || {};
    return `<tr>
      <td style="${tdStyle}">${i + 1}</td>
      <td style="${tdStyle}">${esc(pd.name || '—')}</td>
      <td style="${tdStyle}">${esc(pd.houseName || '—')}</td>
      <td style="${tdStyle}">${esc(pd.pradeshikaSabha || '—')}</td>
      <td style="${tdStyle}">${esc(pd.phone || '—')}</td>
      <td style="${tdStyle}">${(rec.members || []).length}</td>
    </tr>`;
  }).join('');

  return `<div style="font-family:Arial,sans-serif;font-size:11px;color:#333;">
    ${buildPDFHeader()}
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead>
        <tr style="background:${PDF_PRIMARY};color:#fff;">
          <th style="${thStyle}">#</th>
          <th style="${thStyle}">Name</th>
          <th style="${thStyle}">House</th>
          <th style="${thStyle}">Pradeshika Sabha</th>
          <th style="${thStyle}">Phone</th>
          <th style="${thStyle}">Members</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
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
          ${row('Relationship', formatLabel(p.relationship))}
          ${p.membershipType ? row('Membership', formatLabel(p.membershipType)) : ''}
          ${!showReason && p.holdsSpssPosition ? row('SPSS Position', p.spssPositionName) : ''}
          ${row('Phone', p.phone)}
          ${row('Email', p.email)}
          ${row('Blood Group', p.bloodGroup)}
          ${row('Education', formatLabel(p.highestEducation))}
          ${row('Occupation', formatLabel(p.occupation))}
          ${p.areaOfExpertise ? row('Area of Expertise', p.areaOfExpertise) : ''}
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

/** Simple HTML escape. */
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/* ================================================================== */
/*  PDF Download via html2pdf.js                                       */
/* ================================================================== */

/**
 * Converts an HTML string to PDF and triggers download.
 * Expects html2pdf.js to be loaded globally.
 * @param {string} htmlContent
 * @param {string} filename
 */
function downloadPDF(htmlContent, filename) {
  if (typeof html2pdf === 'undefined') {
    showToast(MESSAGES.PDF_LIB_MISSING, 'error');
    return;
  }

  showLoader(MESSAGES.PDF_GENERATING);

  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.padding = '20px';
  document.body.appendChild(container);

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['div[style*="display:table"]'] },
  };

  html2pdf()
    .set(opt)
    .from(container)
    .save()
    .then(() => {
      container.remove();
      hideLoader();
      showToast(MESSAGES.PDF_DOWNLOADED, 'success');
    })
    .catch((err) => {
      container.remove();
      hideLoader();
      console.error('PDF generation failed:', err);
      showToast(MESSAGES.PDF_FAIL, 'error');
    });
}
