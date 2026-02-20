/**
 * @fileoverview View/Edit page logic — loads a single record and renders detail or edit mode.
 * @module view-service
 */

import { getMember, deleteMember } from './member-service.js';
import { showToast, showLoader, hideLoader, showConfirmDialog, formatLabel, formatDate, formatDOB, escapeHtml } from './ui-service.js';
import { ROUTES, ENABLE_PHOTO_UPLOAD, MESSAGES, TIMING } from './constants.js';

/**
 * Initializes the view page by loading the record specified in the URL query parameter.
 * @param {boolean} admin - Whether the current user has admin privileges.
 */
export async function initViewPage(admin) {
  const fullUrl = window.location.href;
  const params = new URLSearchParams(window.location.search);
  let recordId = params.get('id');

  // Fallback: try extracting id from full URL in case URLSearchParams missed it
  if (!recordId) {
    const match = fullUrl.match(/[?&]id=([^&#]+)/);
    if (match) recordId = decodeURIComponent(match[1]);
  }

  const editParam = params.get('edit') || (fullUrl.match(/[?&]edit=([^&#]+)/) || [])[1] || '';
  const isSharedEdit = editParam === 'share';
  const isAdminEdit = editParam === '1';

  if (!recordId) {
    console.warn('View page loaded without record ID. URL:', fullUrl);
    renderErrorState(MESSAGES.NO_RECORD_ID);
    return;
  }

  showLoader(MESSAGES.LOADING_RECORD);

  try {
    const record = await getMember(recordId);
    if (!record) {
      hideLoader();
      renderErrorState(MESSAGES.RECORD_NOT_FOUND);
      return;
    }

    if (isSharedEdit) {
      await loadEditMode(record, recordId, true);
    } else if (isAdminEdit && admin) {
      await loadEditMode(record, recordId, false);
    } else {
      renderViewMode(record);
    }

    bindViewActions(recordId, record, admin);
  } catch (err) {
    console.error('Failed to load record:', err);
    const isPermission = err?.code === 'permission-denied';
    const msg = isPermission
      ? MESSAGES.PERMISSION_DENIED
      : MESSAGES.RECORD_LOAD_FAIL;
    renderErrorState(msg);
  } finally {
    hideLoader();
  }
}

/* ================================================================== */
/*  View Mode Rendering                                                */
/* ================================================================== */

/**
 * Renders the record in read-only view mode.
 * @param {Object} record
 */
function renderViewMode(record) {
  const pd = record.personalDetails || {};
  const addr = pd.address || {};

  renderPersonalDetails(pd);
  renderAddress(addr);
  renderHealthFamily(pd);
  renderPersonList('membersView', record.members, false);
  renderPersonList('nonMembersView', record.nonMembers, true);
  renderMetadata(record.metadata);
}

/**
 * Renders personal details into the view container.
 * @param {Object} pd
 */
function renderPersonalDetails(pd) {
  const container = document.getElementById('personalDetailsView');
  if (!container) return;

  const photo = (ENABLE_PHOTO_UPLOAD && pd.photoURL)
    ? `<div class="col-md-3 text-center mb-3">
        <img src="${escapeHtml(pd.photoURL)}" alt="Photo" class="rounded" style="max-width:120px;max-height:120px;object-fit:cover;">
       </div>`
    : '';

  container.innerHTML = `
    ${photo}
    <div class="${(ENABLE_PHOTO_UPLOAD && pd.photoURL) ? 'col-md-9' : 'col-12'}">
      <div class="row">
        ${detailField('Name', pd.name)}
        ${detailField('House Name', pd.houseName)}
        ${detailField('Pradeshika Sabha', pd.pradeshikaSabha)}
        ${detailField('Membership', formatLabel(pd.membershipType), pd.membershipType === 'life_member' ? 'life' : 'ordinary')}
        ${pd.holdsSpssPosition ? detailField('SPSS Position', pd.spssPositionName) : ''}
        ${detailField('Date of Birth', formatDOB(pd.dob))}
        ${detailField('Gender', formatLabel(pd.gender))}
        ${detailField('Blood Group', pd.bloodGroup)}
        ${detailField('Occupation', formatLabel(pd.occupation))}
        ${detailField('Education', formatLabel(pd.highestEducation))}
        ${detailField('Phone', pd.phone)}
        ${detailField('Email', pd.email)}
      </div>
    </div>
  `;
}

/**
 * Renders address fields.
 * @param {Object} addr
 */
function renderAddress(addr) {
  const container = document.getElementById('addressView');
  if (!container) return;

  container.innerHTML = `
    ${detailField('Address Line 1', addr.address1)}
    ${detailField('Address Line 2', addr.address2)}
    ${detailField('Place', addr.place)}
    ${detailField('PIN', addr.pin)}
  `;
}

/**
 * Renders health & family fields.
 * @param {Object} pd
 */
function renderHealthFamily(pd) {
  const container = document.getElementById('healthFamilyView');
  if (!container) return;

  container.innerHTML = `
    ${detailField('Health Insurance Coverage', pd.healthInsurance ? 'Yes' : 'No')}
    ${detailField('Family Member Outside Kerala', pd.familyOutside ? 'Yes' : 'No')}
    ${pd.familyOutside ? detailField('Reason', formatLabel(pd.familyOutsideReason)) : ''}
    ${detailField('Ration Card Color', formatLabel(pd.rationCardType))}
  `;
}

/**
 * Renders a list of members or non-members as cards.
 * @param {string} containerId
 * @param {Array<Object>} [persons]
 * @param {boolean} [showReason=false]
 */
function renderPersonList(containerId, persons, showReason = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!persons || persons.length === 0) {
    container.innerHTML = '<p class="text-muted">None</p>';
    return;
  }

  container.innerHTML = persons.map((p, i) => `
    <div class="dynamic-block">
      <div class="block-header">
        <span class="block-number fw-bold">#${i + 1} — ${escapeHtml(p.name || '—')}</span>
        ${p.membershipType ? `<span class="member-badge ${p.membershipType === 'life_member' ? 'life' : 'ordinary'}">${escapeHtml(formatLabel(p.membershipType))}</span>` : ''}
      </div>
      <div class="row">
        ${detailField('DOB', formatDOB(p.dob), null, 'col-6 col-md-3')}
        ${detailField('Relationship', formatLabel(p.relationship), null, 'col-6 col-md-3')}
        ${detailField('Blood Group', p.bloodGroup, null, 'col-6 col-md-3')}
        ${detailField('Phone', p.phone, null, 'col-6 col-md-3')}
      </div>
      <div class="row">
        ${detailField('Email', p.email, null, 'col-12 col-md-3')}
        ${detailField('Education', formatLabel(p.highestEducation), null, 'col-6 col-md-3')}
        ${detailField('Occupation', formatLabel(p.occupation), null, 'col-6 col-md-3')}
        ${showReason ? detailField('Reason', p.reasonForNoMembership, null, 'col-12 col-md-3') : ''}
        ${p.holdsSpssPosition ? detailField('SPSS Position', p.spssPositionName, null, 'col-6 col-md-3') : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Renders metadata fields.
 * @param {Object} [metadata]
 */
function renderMetadata(metadata) {
  const container = document.getElementById('metadataView');
  if (!container || !metadata) return;

  container.innerHTML = `
    ${detailField('Created At', formatDate(metadata.createdAt))}
    ${detailField('Created By', metadata.createdBy)}
    ${detailField('Updated At', formatDate(metadata.updatedAt))}
  `;
}

/**
 * Builds a detail field HTML block.
 * @param {string} label
 * @param {string} value
 * @param {string} [badgeClass] - If set, value is rendered as a badge.
 * @param {string} [colClass]
 * @returns {string}
 */
function detailField(label, value, badgeClass, colClass = 'col-md-4') {
  const display = value || '—';
  const content = badgeClass
    ? `<span class="member-badge ${badgeClass}">${escapeHtml(display)}</span>`
    : escapeHtml(display);

  return `
    <div class="${colClass} mb-3">
      <div class="detail-label">${escapeHtml(label)}</div>
      <div class="detail-value">${content}</div>
    </div>
  `;
}

/**
 * Shows an error message inside the record content area instead of redirecting.
 * @param {string} message
 */
function renderErrorState(message) {
  const container = document.getElementById('recordContent');
  if (container) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-exclamation-triangle fs-1 text-warning"></i>
        <p class="mt-3 text-muted">${escapeHtml(message)}</p>
        <p class="small text-muted mt-1">URL: <code>${escapeHtml(window.location.href)}</code></p>
        <a href="dashboard" class="btn btn-outline-primary btn-sm mt-2">
          <i class="bi bi-arrow-left me-1"></i>Back to Dashboard
        </a>
      </div>
    `;
  }
}

/* ================================================================== */
/*  Edit Mode                                                          */
/* ================================================================== */

/**
 * Loads the edit form using the form-handler module.
 * @param {Object} record
 * @param {string} recordId
 */
async function loadEditMode(record, recordId, isShared = false) {
  document.getElementById('recordContent')?.classList.add('d-none');

  const editContainer = document.getElementById('editFormContainer');
  if (!editContainer) return;
  editContainer.classList.remove('d-none');

  editContainer.innerHTML = await buildEditFormHTML();

  const { initForm } = await import('./form-handler.js');
  initForm(record, recordId, isShared);
}

/**
 * Fetches the form HTML from create.html and extracts the form section.
 * @returns {Promise<string>}
 */
async function buildEditFormHTML() {
  try {
    const resp = await fetch('create');
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const form = doc.getElementById('memberForm');
    return form ? form.outerHTML : `<p class="text-danger">${MESSAGES.EDIT_FORM_FAIL}</p>`;
  } catch {
    return `<p class="text-danger">${MESSAGES.EDIT_FORM_FAIL}</p>`;
  }
}

/* ================================================================== */
/*  Action Bindings                                                    */
/* ================================================================== */

/**
 * Binds edit, delete, and PDF buttons on the view page.
 * @param {string} recordId
 * @param {Object} record
 * @param {boolean} admin
 */
function bindViewActions(recordId, record, admin) {
  document.getElementById('editBtn')?.addEventListener('click', () => {
    window.location.href = `view?id=${recordId}&edit=1`;
  });

  document.getElementById('deleteBtn')?.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog(MESSAGES.DELETE_CONFIRM_PERMANENT);
    if (!confirmed) return;

    showLoader(MESSAGES.DELETING);
    try {
      await deleteMember(recordId);
      hideLoader();
      showToast(MESSAGES.DELETE_SUCCESS, 'success');
      setTimeout(() => { window.location.href = ROUTES.DASHBOARD; }, TIMING.REDIRECT_DELAY);
    } catch (err) {
      hideLoader();
      console.error('Delete failed:', err);
      showToast(MESSAGES.DELETE_FAIL, 'error');
    }
  });

  document.getElementById('downloadPdfBtn')?.addEventListener('click', async () => {
    const { generateMemberPDF } = await import('./pdf-service.js');
    generateMemberPDF(record);
  });

  document.getElementById('shareBtn')?.addEventListener('click', () => {
    const shareUrl = `${window.location.origin}/view?id=${recordId}&edit=share`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast(MESSAGES.SHARE_COPIED, 'success');
    }).catch(() => {
      showToast(MESSAGES.SHARE_COPY_FAIL + shareUrl, 'error');
    });
  });
}
