/**
 * @fileoverview Firestore collection ids — must stay in sync with firestore.rules.
 * @module constants/firestore-collections
 */

/** Firestore collection names — must stay in sync with firestore.rules */
export const COLLECTIONS = Object.freeze({
  MEMBER_DETAILS: 'member_details',
  USERS: 'users',
  MEMBER_IDS: 'member_ids',
  ADMIN_CONTACTS: 'admin_contacts',
  JILLA_MEMBERSHIP_DETAILS: 'jilla_membership_details',
  SYNC_METADATA: 'sync_metadata',
  SYNC_FAILURES: 'sync_failures',
  SYNC_HISTORY: 'sync_history',
  /** Restore Center — super_admin only */
  RESTORE_METADATA: 'restore_metadata',
  RESTORE_HISTORY: 'restore_history',
  RESTORE_FAILURES: 'restore_failures',
  RESTORE_SNAPSHOTS: 'restore_snapshots',
});
