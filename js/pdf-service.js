/**
 * @fileoverview PDF generation service using html2pdf.js.
 * Generates member-wise, sabha-wise, and full dataset PDF exports.
 * @module pdf-service
 */

import { formatLabel, showToast, showLoader, hideLoader } from './ui-service.js';

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
  const filtered = records.filter(
    (r) => (r.personalDetails?.pradeshikaSabha || '') === sabha
  );

  if (filtered.length === 0) {
    showToast(`No records found for ${sabha}.`, 'warning');
    return;
  }

  const html = buildMultiRecordHTML(filtered, `SPSS Connect — ${sabha}`);
  downloadPDF(html, `SPSS_${sabha.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates and downloads a PDF of the full dataset.
 * @param {Array<Object>} records
 */
export function generateFullDatasetPDF(records) {
  if (records.length === 0) {
    showToast('No records to export.', 'warning');
    return;
  }

  const html = buildMultiRecordHTML(records, 'SPSS Connect — Full Dataset');
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
      <h2 style="color:#1a5276;border-bottom:2px solid #1a5276;padding-bottom:8px;">
        SPSS Connect — Member Record
      </h2>
      <h3 style="margin-top:16px;">${esc(pd.name || '—')}</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${row('House Name', pd.houseName)}
        ${row('Date of Birth', pd.dob)}
        ${row('Gender', formatLabel(pd.gender))}
        ${row('Pradeshika Sabha', pd.pradeshikaSabha)}
        ${row('Blood Group', pd.bloodGroup)}
        ${row('Occupation', formatLabel(pd.occupation))}
        ${row('Membership', formatLabel(pd.membershipType))}
        ${row('Education', formatLabel(pd.highestEducation))}
        ${row('Phone', pd.phone)}
        ${row('Email', pd.email)}
        ${pd.holdsSpssPosition ? row('SPSS Position', pd.spssPositionName) : ''}
        ${row('Health Insurance', pd.healthInsurance ? 'Yes' : 'No')}
        ${row('Family Outside', pd.familyOutside ? `Yes (${formatLabel(pd.familyOutsideReason)})` : 'No')}
      </table>

      <h4 style="color:#1a5276;">Address</h4>
      <p style="margin:4px 0;">
        ${esc(addr.address1 || '')} ${esc(addr.address2 || '')}<br>
        ${esc(addr.place || '')} — ${esc(addr.pin || '')}
      </p>
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
 * @param {string} title
 * @returns {string}
 */
function buildMultiRecordHTML(records, title) {
  let html = `
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#333;">
      <h2 style="color:#1a5276;border-bottom:2px solid #1a5276;padding-bottom:8px;">${esc(title)}</h2>
      <p>Total Records: ${records.length}</p>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr style="background:#1a5276;color:#fff;">
            <th style="padding:6px;border:1px solid #ddd;">#</th>
            <th style="padding:6px;border:1px solid #ddd;">Name</th>
            <th style="padding:6px;border:1px solid #ddd;">House</th>
            <th style="padding:6px;border:1px solid #ddd;">Sabha</th>
            <th style="padding:6px;border:1px solid #ddd;">Phone</th>
            <th style="padding:6px;border:1px solid #ddd;">Members</th>
          </tr>
        </thead>
        <tbody>
  `;

  records.forEach((rec, i) => {
    const pd = rec.personalDetails || {};
    html += `
      <tr>
        <td style="padding:4px;border:1px solid #ddd;">${i + 1}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(pd.name || '—')}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(pd.houseName || '—')}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(pd.pradeshikaSabha || '—')}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(pd.phone || '—')}</td>
        <td style="padding:4px;border:1px solid #ddd;">${(rec.members || []).length}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

/**
 * Builds an HTML table for a list of member/non-member persons.
 * @param {string} heading
 * @param {Array<Object>} persons
 * @param {boolean} [showReason=false]
 * @returns {string}
 */
function buildPersonListHTML(heading, persons, showReason = false) {
  let html = `<h4 style="color:#1a5276;margin-top:16px;">${esc(heading)}</h4>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;">
      <thead>
        <tr style="background:#eee;">
          <th style="padding:4px;border:1px solid #ddd;">Name</th>
          <th style="padding:4px;border:1px solid #ddd;">Relationship</th>
          <th style="padding:4px;border:1px solid #ddd;">DOB</th>
          <th style="padding:4px;border:1px solid #ddd;">Blood</th>
          <th style="padding:4px;border:1px solid #ddd;">Phone</th>
          <th style="padding:4px;border:1px solid #ddd;">Education</th>
          <th style="padding:4px;border:1px solid #ddd;">Occupation</th>
          ${showReason ? '<th style="padding:4px;border:1px solid #ddd;">Reason</th>' : ''}
        </tr>
      </thead>
      <tbody>`;

  persons.forEach((p) => {
    html += `
      <tr>
        <td style="padding:4px;border:1px solid #ddd;">${esc(p.name || '—')}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(formatLabel(p.relationship))}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(p.dob || '—')}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(p.bloodGroup || '—')}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(p.phone || '—')}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(formatLabel(p.highestEducation))}</td>
        <td style="padding:4px;border:1px solid #ddd;">${esc(formatLabel(p.occupation))}</td>
        ${showReason ? `<td style="padding:4px;border:1px solid #ddd;">${esc(p.reasonForNoMembership || '—')}</td>` : ''}
      </tr>`;
  });

  html += '</tbody></table>';
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
    showToast('PDF library not loaded. Please try again.', 'error');
    return;
  }

  showLoader('Generating PDF...');

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
  };

  html2pdf()
    .set(opt)
    .from(container)
    .save()
    .then(() => {
      container.remove();
      hideLoader();
      showToast('PDF downloaded!', 'success');
    })
    .catch((err) => {
      container.remove();
      hideLoader();
      console.error('PDF generation failed:', err);
      showToast('PDF generation failed.', 'error');
    });
}
