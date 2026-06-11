/**
 * @fileoverview Dynamic member / non-member blocks.
 * @module form/form-handler-sections
 */

import { applyTranslations } from '../services/i18n-service.js';
import { formState } from './form-state.js';
import { buildMemberBlockHTML, buildNonMemberBlockHTML } from './form-handler-html.js';

/** Binds the "Add Member" and "Add Non-Member" buttons (at bottom of each section). */
export function bindDynamicSections() {
  document.getElementById('addMemberBtn')?.addEventListener('click', () => addMemberBlock());
  document.getElementById('addNonMemberBtn')?.addEventListener('click', () => addNonMemberBlock());
}

/**
 * Creates a dynamic member block and appends it to the container.
 * @param {Object} [data] - Pre-filled data for edit mode.
 */
export function addMemberBlock(data) {
  formState.memberCount++;
  const container = document.getElementById('membersContainer');
  if (!container) return;

  document.getElementById('noMembersMsg')?.classList.add('d-none');

  const index = formState.memberCount;
  const block = document.createElement('div');
  block.className = 'dynamic-block';
  block.dataset.memberIndex = index;
  block.innerHTML = buildMemberBlockHTML(index, data);

  block.querySelector('.btn-remove-block')?.addEventListener('click', () => {
    block.remove();
    toggleEmptyMessage('membersContainer', 'noMembersMsg');
  });

  container.appendChild(block);
  applyTranslations();
  renumberBlocks('membersContainer');
}

/**
 * Creates a dynamic non-member block and appends it to the container.
 * @param {Object} [data] - Pre-filled data for edit mode.
 */
export function addNonMemberBlock(data) {
  formState.nonMemberCount++;
  const container = document.getElementById('nonMembersContainer');
  if (!container) return;

  document.getElementById('noNonMembersMsg')?.classList.add('d-none');

  const index = formState.nonMemberCount;
  const block = document.createElement('div');
  block.className = 'dynamic-block';
  block.dataset.nonMemberIndex = index;
  block.innerHTML = buildNonMemberBlockHTML(index, data);

  block.querySelector('.btn-remove-block')?.addEventListener('click', () => {
    block.remove();
    toggleEmptyMessage('nonMembersContainer', 'noNonMembersMsg');
  });

  container.appendChild(block);
  applyTranslations();
  renumberBlocks('nonMembersContainer');
}

/** Toggles the "no items" message visibility and resets counters when empty. */
function toggleEmptyMessage(containerId, messageId) {
  const container = document.getElementById(containerId);
  const msg = document.getElementById(messageId);
  if (!container || !msg) return;

  const hasChildren = container.children.length > 0;
  msg.classList.toggle('d-none', hasChildren);

  if (!hasChildren) {
    if (containerId === 'membersContainer') {
      formState.memberCount = 0;
    } else if (containerId === 'nonMembersContainer') {
      formState.nonMemberCount = 0;
    }
  }

  renumberBlocks(containerId);
}

/**
 * Renumbers visible member/non-member block labels (#1, #2, ...) based on DOM order.
 * Does not change underlying indices or input names used for data collection.
 * @param {string} containerId
 */
function renumberBlocks(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const blocks = container.querySelectorAll('.dynamic-block');
  blocks.forEach((block, idx) => {
    const indexLabel = block.querySelector('.block-index');
    if (indexLabel) {
      indexLabel.textContent = `#${idx + 1}`;
    }
  });
}
