/**
 * @fileoverview Jilla membership statistics by year — super_admin only.
 * @module jilla-membership
 */

import {
  ROUTES,
  ORG_NAME,
  ORG_SUBTITLE,
  JILLA_MEMBERSHIP_COLUMN_LABELS,
  JILLA_MEMBERSHIP_MIN_YEAR,
  MESSAGES,
} from '../constants/constants.js';
import { auth } from '../services/firebase-config.js';
import { isSuperAdmin } from '../services/auth-service.js';
import {
  buildDefaultJillaRows,
  mergeJillaMembershipDetails,
  fetchJillaMembershipByYear,
  saveJillaMembershipByYear,
} from '../services/jilla-membership-service.js';
import { parseMembershipInt } from '../validation/jilla-membership-validation.js';
import { showToast, setButtonLoading, showLoader, hideLoader, setLoaderMessage, escapeHtml } from '../ui/ui-service.js';
import * as Logger from '../utils/logger.js';

/** @type {Array<{ psName: string, psCode: string, lifeMembers: number, ordinaryMembers: number, home: number, pushpakadhwani: number }>} */
let rows = [];

/** Last loaded / saved snapshot for dirty checks and cancel */
let serverRows = [];

let editing = false;
let lastUpdated = null;
let updatedByDisplay = '—';

/**
 * @returns {number}
 */
function currentCalendarYear() {
  return new Date().getFullYear();
}

function cloneRows(r) {
  return JSON.parse(JSON.stringify(r));
}

function rowsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatAuditTimestamp(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  const d = ts.toDate();
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getFooterTotals() {
  let lm = 0;
  let om = 0;
  let grand = 0;
  let home = 0;
  let pd = 0;
  rows.forEach((r) => {
    lm += r.lifeMembers;
    om += r.ordinaryMembers;
    grand += r.lifeMembers + r.ordinaryMembers;
    home += r.home;
    pd += r.pushpakadhwani;
  });
  return { lm, om, grand, home, pd };
}

function updateFooterDom() {
  const { lm, om, grand, home, pd } = getFooterTotals();
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
  };
  set('footLM', lm);
  set('footOM', om);
  set('footGrand', grand);
  set('footHome', home);
  set('footPD', pd);
}

/**
 * @param {number} rowIndex
 * @param {string} field
 * @param {string} raw
 * @returns {boolean} valid
 */
function applyCellInput(rowIndex, field, raw) {
  const parsed = parseMembershipInt(raw);
  const wrap = document.querySelector(`[data-wrap="${rowIndex}-${field}"]`);
  const input = document.querySelector(`input[data-row="${rowIndex}"][data-field="${field}"]`);

  if (!parsed.valid) {
    if (wrap) wrap.classList.add('is-invalid');
    if (input) {
      input.classList.add('is-invalid');
      let fb = wrap?.querySelector('.invalid-feedback');
      if (wrap && !fb) {
        fb = document.createElement('div');
        fb.className = 'invalid-feedback d-block';
        wrap.appendChild(fb);
      }
      if (fb) fb.textContent = parsed.message || 'Invalid';
    }
    return false;
  }

  if (wrap) wrap.classList.remove('is-invalid');
  if (input) {
    input.classList.remove('is-invalid');
    const fb = wrap?.querySelector('.invalid-feedback');
    if (fb) fb.textContent = '';
  }

  rows[rowIndex][field] = parsed.value;
  if (input && document.activeElement !== input) {
    input.value = String(parsed.value);
  }
  return true;
}

function validateAllEditableInputs() {
  let allOk = true;
  if (!editing) return true;
  document.querySelectorAll('#membershipTableBody input[data-field]').forEach((el) => {
    const row = Number(el.getAttribute('data-row'));
    const field = el.getAttribute('data-field');
    if (Number.isNaN(row) || !field) return;
    const ok = applyCellInput(row, field, el.value);
    if (!ok) allOk = false;
  });
  return allOk;
}

function updateRowTotalCell(rowIndex) {
  const r = rows[rowIndex];
  if (!r) return;
  const td = document.querySelector(`td[data-col="total"][data-row="${rowIndex}"]`);
  if (td) td.textContent = String(r.lifeMembers + r.ordinaryMembers);
}

function renderTableBody() {
  const tbody = document.getElementById('membershipTableBody');
  if (!tbody) return;

  tbody.innerHTML = rows
    .map((r, i) => {
      const total = r.lifeMembers + r.ordinaryMembers;
      if (editing) {
        const cell = (field, label) => {
          const v = String(r[field]);
          return `
            <td class="align-middle text-end p-1">
              <div class="membership-cell-wrap" data-wrap="${i}-${field}">
                <input type="text" class="form-control form-control-sm text-end membership-num-input"
                  inputmode="numeric" autocomplete="off"
                  data-row="${i}" data-field="${field}" value="${v}" aria-label="${escapeAttr(label)} — ${escapeAttr(r.psName)}">
                <div class="invalid-feedback"></div>
              </div>
            </td>`;
        };
        return `<tr>
          <td class="align-middle">${i + 1}</td>
          <td class="align-middle text-start fw-medium">${escapeHtml(r.psName)}</td>
          ${cell('lifeMembers', JILLA_MEMBERSHIP_COLUMN_LABELS.LIFE_MEMBERS)}
          ${cell('ordinaryMembers', JILLA_MEMBERSHIP_COLUMN_LABELS.ORDINARY_MEMBERS)}
          <td class="align-middle text-end" data-col="total" data-row="${i}">${total}</td>
          ${cell('home', 'Home')}
          ${cell('pushpakadhwani', JILLA_MEMBERSHIP_COLUMN_LABELS.PUSHPAKADHWANI)}
        </tr>`;
      }
      return `<tr>
        <td class="align-middle">${i + 1}</td>
        <td class="align-middle text-start fw-medium">${escapeHtml(r.psName)}</td>
        <td class="align-middle text-end">${r.lifeMembers}</td>
        <td class="align-middle text-end">${r.ordinaryMembers}</td>
        <td class="align-middle text-end">${total}</td>
        <td class="align-middle text-end">${r.home}</td>
        <td class="align-middle text-end">${r.pushpakadhwani}</td>
      </tr>`;
    })
    .join('');

  if (editing) {
    tbody.querySelectorAll('.membership-num-input').forEach((input) => {
      input.addEventListener('input', () => {
        const row = Number(input.getAttribute('data-row'));
        const field = input.getAttribute('data-field');
        if (Number.isNaN(row) || !field) return;
        applyCellInput(row, field, input.value);
        updateRowTotalCell(row);
        updateFooterDom();
        updateToolbarState();
      });
      input.addEventListener('blur', () => {
        const row = Number(input.getAttribute('data-row'));
        const field = input.getAttribute('data-field');
        if (Number.isNaN(row) || !field) return;
        const t = String(input.value ?? '').trim();
        if (t === '') {
          input.value = '0';
          applyCellInput(row, field, '0');
        } else {
          applyCellInput(row, field, input.value);
        }
        updateRowTotalCell(row);
        updateFooterDom();
        updateToolbarState();
      });
    });
  }
  updateFooterDom();
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function updateAuditDom() {
  const lu = document.getElementById('auditLastUpdated');
  const ub = document.getElementById('auditUpdatedBy');
  if (lu) lu.textContent = `Last updated: ${formatAuditTimestamp(lastUpdated)}`;
  if (ub) {
    const email = updatedByDisplay;
    if (email && email !== '—' && email.includes('@')) {
      ub.innerHTML = `Updated by: <a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a>`;
    } else {
      ub.textContent = `Updated by: ${updatedByDisplay}`;
    }
  }
}

function updateTableTitle(year) {
  const el = document.getElementById('membershipTableTitle');
  if (el) el.textContent = `${year} Membership`;
}

function updateToolbarState() {
  const btnEdit = document.getElementById('btnEditMembership');
  const btnSave = document.getElementById('btnSaveMembership');
  const btnCancel = document.getElementById('btnCancelMembership');
  const yearSel = document.getElementById('membershipYear');

  const dirty = !rowsEqual(rows, serverRows);
  const hasInvalid = Boolean(document.querySelector('#membershipTableBody .is-invalid'));

  if (btnEdit) btnEdit.disabled = editing;
  if (btnSave) btnSave.disabled = !editing || !dirty || hasInvalid;
  if (btnCancel) btnCancel.disabled = !editing;
  if (yearSel) yearSel.disabled = editing;
}

function applyMembershipColumnHeaderLabels() {
  const L = JILLA_MEMBERSHIP_COLUMN_LABELS;
  const elLm = document.getElementById('colHeadLifeMembers');
  const elOm = document.getElementById('colHeadOrdinaryMembers');
  const elPd = document.getElementById('colHeadPushpakadhwani');
  if (elLm) elLm.textContent = L.LIFE_MEMBERS;
  if (elOm) elOm.textContent = L.ORDINARY_MEMBERS;
  if (elPd) elPd.textContent = L.PUSHPAKADHWANI;
}

function populateYearSelect() {
  const sel = document.getElementById('membershipYear');
  if (!sel) return;
  const maxY = currentCalendarYear();
  sel.innerHTML = '';
  for (let y = JILLA_MEMBERSHIP_MIN_YEAR; y <= maxY; y += 1) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    sel.appendChild(opt);
  }
  sel.value = String(maxY);
}

/**
 * Loads membership rows for the selected year from Firestore and refreshes the table.
 *
 * @param {object} [options]
 * @param {boolean} [options.bootstrap=false] When true, only updates loader message (bootstrap
 *   owns overlay dismiss via {@link ../app-init.js app-init}); otherwise shows/hides the overlay
 *   for user-driven year changes and cancel actions.
 * @returns {Promise<void>}
 */
async function loadYearFromFirestore({ bootstrap = false } = {}) {
  const sel = document.getElementById('membershipYear');
  const yearStr = sel?.value || String(currentCalendarYear());
  const yearNum = parseInt(yearStr, 10);
  if (yearNum < JILLA_MEMBERSHIP_MIN_YEAR || yearNum > currentCalendarYear()) {
    showToast('Invalid year.', 'error');
    return;
  }

  if (bootstrap) {
    setLoaderMessage(MESSAGES.LOADING_JILLA_MEMBERSHIP);
  } else {
    showLoader(MESSAGES.LOADING_JILLA_MEMBERSHIP);
  }
  try {
    const doc = await fetchJillaMembershipByYear(yearStr);
    if (doc && Array.isArray(doc.membershipDetails)) {
      rows = mergeJillaMembershipDetails(doc.membershipDetails);
      lastUpdated = doc.lastUpdated ?? null;
      updatedByDisplay = doc.updatedBy ? String(doc.updatedBy) : '—';
    } else {
      rows = buildDefaultJillaRows();
      lastUpdated = null;
      updatedByDisplay = '—';
    }
    serverRows = cloneRows(rows);
    editing = false;
    updateTableTitle(yearNum);
    updateAuditDom();
    renderTableBody();
    updateToolbarState();
  } catch (err) {
    Logger.error('Jilla membership load', err);
    showToast('Failed to load membership data.', 'error');
  } finally {
    if (!bootstrap) {
      hideLoader();
    }
  }
}

async function saveMembership() {
  if (!validateAllEditableInputs()) {
    showToast('Fix validation errors before saving.', 'error');
    updateToolbarState();
    return;
  }

  const sel = document.getElementById('membershipYear');
  const yearStr = sel?.value || String(currentCalendarYear());
  const yearNum = parseInt(yearStr, 10);
  const user = auth.currentUser;
  const email = user?.email || 'unknown';

  const btn = document.getElementById('btnSaveMembership');
  setButtonLoading(btn, true);
  try {
    const membershipDetails = rows.map((r) => ({
      psCode: r.psCode,
      psName: r.psName,
      lifeMembers: r.lifeMembers,
      ordinaryMembers: r.ordinaryMembers,
      home: r.home,
      pushpakadhwani: r.pushpakadhwani,
    }));

    await saveJillaMembershipByYear(yearStr, yearNum, email, membershipDetails);

    showToast('Membership data saved.', 'success');
    await loadYearFromFirestore();
  } catch (err) {
    Logger.error('Jilla membership save', err);
    showToast('Failed to save. Try again.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

function getExportAuditLines() {
  const last = formatAuditTimestamp(lastUpdated);
  const by = updatedByDisplay && updatedByDisplay !== '—' ? updatedByDisplay : '—';
  return { lastUpdatedLine: last !== '—' ? `Last updated: ${last}` : '', updatedByLine: `Updated by: ${by}` };
}

function exportCsvForExcel() {
  const sel = document.getElementById('membershipYear');
  const yearStr = sel?.value || String(currentCalendarYear());
  const yearNum = parseInt(yearStr, 10);
  const { lm, om, grand, home, pd } = getFooterTotals();
  const { lastUpdatedLine, updatedByLine } = getExportAuditLines();

  const lines = [];
  lines.push(csvEscape(ORG_NAME));
  lines.push(csvEscape(ORG_SUBTITLE));
  lines.push('Jilla Membership Details');
  lines.push(`${yearNum} Membership`);
  if (lastUpdatedLine) lines.push(lastUpdatedLine);
  lines.push(updatedByLine);
  lines.push('');
  const L = JILLA_MEMBERSHIP_COLUMN_LABELS;
  lines.push(
    ['Sl.No', 'Pradeshika Sabha', L.LIFE_MEMBERS, L.ORDINARY_MEMBERS, 'Total', 'Home', L.PUSHPAKADHWANI].join(',')
  );
  rows.forEach((r, i) => {
    const t = r.lifeMembers + r.ordinaryMembers;
    lines.push(
      [i + 1, csvEscape(r.psName), r.lifeMembers, r.ordinaryMembers, t, r.home, r.pushpakadhwani].join(',')
    );
  });
  lines.push(['', 'Total', lm, om, grand, home, pd].join(','));

  const csv = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SPSS_Jilla_Membership_${yearStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportMembershipPdf() {
  const sel = document.getElementById('membershipYear');
  const yearStr = sel?.value || String(currentCalendarYear());
  const yearNum = parseInt(yearStr, 10);
  const lu = formatAuditTimestamp(lastUpdated);
  const lastUpdatedText = lu === '—' ? '' : lu;
  const updatedByText =
    updatedByDisplay && updatedByDisplay !== '—' ? String(updatedByDisplay) : '';

  const { generateJillaMembershipPDF } = await import('../services/pdf-service.js');
  generateJillaMembershipPDF({
    year: yearNum,
    rows: cloneRows(rows),
    lastUpdatedText,
    updatedByText,
    footer: getFooterTotals(),
  });
}

function csvEscape(s) {
  const x = String(s);
  if (/[",\r\n]/.test(x)) return `"${x.replace(/"/g, '""')}"`;
  return x;
}

function bindToolbar() {
  document.getElementById('btnEditMembership')?.addEventListener('click', () => {
    editing = true;
    renderTableBody();
    updateToolbarState();
  });

  document.getElementById('btnCancelMembership')?.addEventListener('click', async () => {
    editing = false;
    await loadYearFromFirestore();
  });

  document.getElementById('btnSaveMembership')?.addEventListener('click', () => {
    saveMembership();
  });

  document.getElementById('btnExportMembership')?.addEventListener('click', () => {
    exportCsvForExcel();
  });

  document.getElementById('btnExportMembershipPdf')?.addEventListener('click', () => {
    exportMembershipPdf();
  });

  document.getElementById('membershipYear')?.addEventListener('change', () => {
    if (editing) return;
    loadYearFromFirestore();
  });
}

/**
 * Entry point — called from app-init after RBAC.
 */
export async function initJillaMembershipPage() {
  if (!isSuperAdmin()) {
    window.location.href = ROUTES.ADMIN_DASHBOARD;
    return;
  }

  populateYearSelect();
  applyMembershipColumnHeaderLabels();
  bindToolbar();
  await loadYearFromFirestore({ bootstrap: true });
}
