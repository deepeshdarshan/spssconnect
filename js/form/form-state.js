/**
 * @fileoverview Mutable create/edit form session state (shared across form modules).
 * @module form/form-state
 */

/**
 * Counters, upload buffers, and edit context for the registration form.
 * @type {{
 *   memberCount: number,
 *   nonMemberCount: number,
 *   selectedPhoto: File|null,
 *   existingPhotoURL: string|null,
 *   editingId: string|null,
 *   isSharedEdit: boolean
 * }}
 */
export const formState = {
  memberCount: 0,
  nonMemberCount: 0,
  selectedPhoto: null,
  existingPhotoURL: null,
  editingId: null,
  isSharedEdit: false,
};
