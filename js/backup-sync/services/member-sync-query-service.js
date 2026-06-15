/**
 * @fileoverview Firestore queries for incremental member_details sync.
 * @module backup-sync/services/member-sync-query-service
 */

import { COLLECTIONS } from '../../constants/constants.js';
import {
  getCollectionCount,
  getQueryCount,
  queryCollectionOrderedPaginated,
} from '../../services/firestore-service.js';
import { BACKUP_SYNC } from '../backup-sync-constants.js';
import { Timestamp } from 'firebase/firestore';

const UPDATED_AT_FIELD = BACKUP_SYNC.METADATA_DOC_FIELD;

/**
 * Returns total count of member_details documents (homes).
 * @returns {Promise<number>}
 */
export async function countAllMembers() {
  return getCollectionCount(COLLECTIONS.MEMBER_DETAILS);
}

/**
 * Returns count of members updated after the given timestamp.
 * @param {import('firebase/firestore').Timestamp} sinceTimestamp
 * @returns {Promise<number>}
 */
export async function countMembersUpdatedSince(sinceTimestamp) {
  return getQueryCount(COLLECTIONS.MEMBER_DETAILS, UPDATED_AT_FIELD, '>', sinceTimestamp);
}

/**
 * Resolves the incremental sync watermark from metadata.
 * @param {import('firebase/firestore').Timestamp|null|undefined} lastSyncTimestamp
 * @returns {import('firebase/firestore').Timestamp}
 */
export function resolveSyncWatermark(lastSyncTimestamp) {
  if (lastSyncTimestamp?.toDate) return lastSyncTimestamp;
  return Timestamp.fromDate(new Date(0));
}

/**
 * Fetches a page of member documents for incremental sync.
 * @param {Object} options
 * @param {import('firebase/firestore').Timestamp} options.sinceTimestamp
 * @param {import('firebase/firestore').QueryDocumentSnapshot|null} [options.startAfterDoc]
 * @param {number} [options.pageSize]
 * @returns {Promise<{ docs: Array<Object>, lastDoc: import('firebase/firestore').QueryDocumentSnapshot|null }>}
 */
export async function fetchMembersPageForSync(options) {
  const { sinceTimestamp, startAfterDoc = null, pageSize = BACKUP_SYNC.BATCH_SIZE } = options;
  const epoch = Timestamp.fromDate(new Date(0));

  if (sinceTimestamp && sinceTimestamp.toMillis() > epoch.toMillis()) {
    return queryCollectionOrderedPaginated(COLLECTIONS.MEMBER_DETAILS, {
      field: UPDATED_AT_FIELD,
      operator: '>',
      value: sinceTimestamp,
      orderDirection: 'asc',
      startAfterDoc,
      pageSize,
    });
  }

  return queryCollectionOrderedPaginated(COLLECTIONS.MEMBER_DETAILS, {
    field: UPDATED_AT_FIELD,
    orderDirection: 'asc',
    startAfterDoc,
    pageSize,
  });
}

/**
 * Fetches member documents by ID list.
 * @param {string[]} memberIds
 * @returns {Promise<Array<Object>>}
 */
export async function fetchMembersByIds(memberIds) {
  const { getDocument } = await import('../../services/firestore-service.js');
  const results = await Promise.all(
    memberIds.map(async (id) => {
      const doc = await getDocument(COLLECTIONS.MEMBER_DETAILS, id);
      return doc ? { id, ...doc } : null;
    }),
  );
  return results.filter(Boolean);
}

/**
 * Finds the latest updatedAt among synced documents in a batch.
 * @param {Array<Object>} memberDocs
 * @returns {import('firebase/firestore').Timestamp|null}
 */
export function findLatestUpdatedAt(memberDocs) {
  let latest = null;
  for (const doc of memberDocs) {
    const ts = doc.metadata?.updatedAt;
    if (!ts?.toMillis) continue;
    if (!latest || ts.toMillis() > latest.toMillis()) {
      latest = ts;
    }
  }
  return latest;
}
