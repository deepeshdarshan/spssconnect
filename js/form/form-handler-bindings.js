/**
 * @fileoverview Event listeners for the registration form (excluding submit).
 * @module form/form-handler-bindings
 */

import { isAdmin, isSuperAdmin, getUserPradeshikaSabha } from '../services/auth-service.js';

/**
 * Uses event delegation to strip non-digit characters from any input with the
 * "digits-only" class, including dynamically added member/non-member fields.
 */
export function bindDigitsOnlyInputs() {
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('digits-only')) {
      e.target.value = e.target.value.replace(/\D/g, '');
    }
  });
}

/** Event-delegated toggle for "Living outside Kerala" reason dropdown in member/non-member blocks. */
export function bindLivingOutsideToggle() {
  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('living-outside-toggle')) return;
    const block = e.target.closest('.dynamic-block');
    if (!block) return;
    const reasonGroup = block.querySelector('.living-outside-reason-group');
    if (reasonGroup) reasonGroup.classList.toggle('d-none', e.target.value !== 'yes');
  });
}

/** Shows/hides the SPSS position name field based on the Yes/No select. */
export function bindSpssPositionToggle() {
  const select = document.getElementById('holdsSpssPosition');
  const nameGroup = document.getElementById('spssPositionNameGroup');
  if (!select || !nameGroup) return;

  select.addEventListener('change', () => {
    nameGroup.classList.toggle('d-none', select.value !== 'yes');
  });
}

/**
 * If the current user is an admin (not super_admin), pre-selects their assigned
 * Pradeshika Sabha and disables the dropdown so they cannot change it.
 */
export function lockSabhaForAdmin() {
  if (!isAdmin() || isSuperAdmin()) return;
  const sabha = getUserPradeshikaSabha();
  if (!sabha) return;

  const select = document.getElementById('pradeshikaSabha');
  if (!select) return;

  select.value = sabha;
  select.setAttribute('disabled', 'true');

  const form = document.getElementById('memberForm');
  if (!form) return;
  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.name = 'pradeshikaSabhaHidden';
  hidden.id = 'pradeshikaSabhaHidden';
  hidden.value = sabha;
  form.appendChild(hidden);
}

/** Event-delegated toggle for SPSS position fields inside dynamic member blocks. */
export function bindMemberSpssPositionToggle() {
  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('member-spss-toggle')) return;
    const block = e.target.closest('.dynamic-block');
    if (!block) return;
    const nameGroup = block.querySelector('.member-spss-name-group');
    if (nameGroup) nameGroup.classList.toggle('d-none', e.target.value !== 'yes');
  });
}

/**
 * Shows "Area of expertise" only when Occupation is selected; clears expertise when occupation is cleared.
 * Applies to the house owner and to member / non-member dynamic blocks.
 */
export function bindOccupationExpertiseVisibility() {
  const select = document.getElementById('ownerOccupation');
  const group = document.getElementById('ownerExpertiseGroup');
  const input = document.getElementById('ownerExpertise');

  function syncOwner() {
    if (!group || !select) return;
    const has = Boolean((select.value || '').trim());
    group.classList.toggle('d-none', !has);
    if (!has && input) input.value = '';
  }

  if (select) {
    select.addEventListener('change', syncOwner);
    syncOwner();
  }

  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('member-occupation-select')) return;
    const block = e.target.closest('.dynamic-block');
    if (!block) return;
    const expGroup = block.querySelector('.member-expertise-group');
    if (!expGroup) return;
    const has = Boolean((e.target.value || '').trim());
    expGroup.classList.toggle('d-none', !has);
    if (!has) {
      const inp = expGroup.querySelector('input[name^="member_expertise_"], input[name^="nonMember_expertise_"]');
      if (inp) inp.value = '';
    }
  });
}
