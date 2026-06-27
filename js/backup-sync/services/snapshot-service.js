/**
 * @fileoverview Pre-restore Firestore snapshot storage and rollback.
 * @module backup-sync/services/snapshot-service
 */

import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '../../constants/constants.js';
import { db } from '../../services/firebase-config.js';
import { getDocument, getServerTimestamp, createDocumentWithId } from '../../services/firestore-service.js';
import { deleteMember } from '../../services/member-service.js';
import { upsertMemberIdForPhone } from '../../services/member-id-service.js';
import { RESTORE_CONFIG } from '../backup-sync-constants.js';
import * as Logger from '../../utils/logger.js';

/**
 * Returns the households subcollection reference for a snapshot job.
 * @param {string} restoreJobId
 * @returns {import('firebase/firestore').CollectionReference}
 */
function householdsCollection(restoreJobId) {
  return collection(db, COLLECTIONS.RESTORE_SNAPSHOTS, restoreJobId, 'households');
}

/**
 * Creates a pre-restore snapshot of affected household documents.
 * @param {string} restoreJobId
 * @param {string[]} recordIds
 * @param {string} triggeredBy
 * @param {string} mode
 * @returns {Promise<void>}
 */
export async function createPreRestoreSnapshot(restoreJobId, recordIds, triggeredBy, mode) {
  const metaRef = doc(db, COLLECTIONS.RESTORE_SNAPSHOTS, restoreJobId);
  await setDoc(metaRef, {
    restoreJobId,
    createdAt: getServerTimestamp(),
    triggeredBy,
    mode,
    recordIds,
  });

  const BATCH_LIMIT = 400;
  for (let i = 0; i < recordIds.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = recordIds.slice(i, i + BATCH_LIMIT);

    for (const recordId of chunk) {
      const existing = await getDocument(COLLECTIONS.MEMBER_DETAILS, recordId);
      const snapRef = doc(householdsCollection(restoreJobId), recordId);
      batch.set(snapRef, {
        recordId,
        existed: Boolean(existing),
        data: existing || null,
      });
    }

    await batch.commit();
  }
}

/**
 * Returns whether a snapshot is within the retention window.
 * @param {Object} snapshotMeta
 * @returns {boolean}
 */
export function isSnapshotWithinRetention(snapshotMeta) {
  const created = snapshotMeta?.createdAt?.toDate?.() ?? null;
  if (!created) return false;
  const maxAge = RESTORE_CONFIG.SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - created.getTime() <= maxAge;
}

/**
 * Loads snapshot metadata.
 * @param {string} restoreJobId
 * @returns {Promise<Object|null>}
 */
export async function getSnapshotMeta(restoreJobId) {
  const snap = await getDoc(doc(db, COLLECTIONS.RESTORE_SNAPSHOTS, restoreJobId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Rolls back Firestore to a pre-restore snapshot.
 * @param {string} restoreJobId
 * @param {function(Object): void} [onProgress]
 * @returns {Promise<{ restored: number, deleted: number, failed: number }>}
 */
export async function rollbackFromSnapshot(restoreJobId, onProgress) {
  const meta = await getSnapshotMeta(restoreJobId);
  if (!meta) {
    throw new Error('Snapshot not found for this restore job.');
  }
  if (!isSnapshotWithinRetention(meta)) {
    throw new Error(`Snapshot is older than ${RESTORE_CONFIG.SNAPSHOT_RETENTION_DAYS} days and cannot be rolled back.`);
  }

  const snap = await getDocs(householdsCollection(restoreJobId));
  let restored = 0;
  let deleted = 0;
  let failed = 0;
  let processed = 0;
  const total = snap.docs.length;

  for (const docSnap of snap.docs) {
    const { recordId, existed, data } = docSnap.data();
    processed += 1;

    try {
      if (existed && data) {
        const { id: _id, _docId, ...docData } = data;
        await createDocumentWithId(COLLECTIONS.MEMBER_DETAILS, recordId, docData);
        const phone = docData.personalDetails?.phone;
        if (phone) {
          await upsertMemberIdForPhone(phone, recordId);
        }
        restored += 1;
      } else if (!existed) {
        await deleteMember(recordId);
        deleted += 1;
      }
    } catch (err) {
      Logger.error(`Rollback failed for ${recordId}:`, err);
      failed += 1;
    }

    onProgress?.({
      processed,
      total,
      currentOperation: `Rolling back household ${recordId}`,
    });
  }

  return { restored, deleted, failed };
}
