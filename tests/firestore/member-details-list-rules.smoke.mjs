/**
 * Smoke test: Firestore get vs list rules for member and admin collections.
 * Run via: firebase emulators:exec --only firestore "node tests/firestore/member-details-list-rules.smoke.mjs"
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rules = readFileSync(join(__dirname, '../../firestore.rules'), 'utf8');
const PROJECT_ID = 'spssconnect-rules-smoke';
const PHONE = '9876543210';

const MEMBER_DOC = {
  personalDetails: { phone: PHONE, name: 'Test Household' },
  metadata: { createdAt: new Date(), updatedAt: new Date() },
};

async function seed(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'member_details', 'rec1'), MEMBER_DOC);
    await setDoc(doc(db, 'member_ids', PHONE), { memberId: 'rec1' });
    await setDoc(doc(db, 'admin_contacts', 'primary'), {
      phoneNumbers: ['9000000001'],
    });
    await setDoc(doc(db, 'users', 'admin-uid'), {
      role: 'admin',
      email: 'admin@test.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await setDoc(doc(db, 'users', 'user-uid'), {
      role: 'user',
      email: 'user@test.com',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await setDoc(doc(db, 'users', 'super-admin-uid'), {
      role: 'super_admin',
      email: 'super@test.com',
      createdAt: '2026-01-03T00:00:00.000Z',
    });
  });
}

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules },
});

try {
  await seed(testEnv);

  const unauthed = testEnv.unauthenticatedContext();
  const unauthedDb = unauthed.firestore();

  // member_details: public get, no anonymous list
  await assertFails(getDocs(collection(unauthedDb, 'member_details')));
  await assertSucceeds(getDoc(doc(unauthedDb, 'member_details', 'rec1')));

  // member_ids: public get by phone (guest phone-check), no anonymous list
  await assertFails(getDocs(collection(unauthedDb, 'member_ids')));
  await assertSucceeds(getDoc(doc(unauthedDb, 'member_ids', PHONE)));

  // admin_contacts: public get (guest phone-check), no anonymous list
  await assertFails(getDocs(collection(unauthedDb, 'admin_contacts')));
  await assertSucceeds(getDoc(doc(unauthedDb, 'admin_contacts', 'primary')));

  // users: no anonymous access
  await assertFails(getDoc(doc(unauthedDb, 'users', 'user-uid')));
  await assertFails(getDocs(collection(unauthedDb, 'users')));

  const adminCtx = testEnv.authenticatedContext('admin-uid');
  const adminDb = adminCtx.firestore();
  await assertSucceeds(getDocs(collection(adminDb, 'member_details')));
  await assertSucceeds(
    getDocs(query(collection(adminDb, 'member_ids'), where('memberId', '==', 'rec1'))),
  );
  await assertSucceeds(getDoc(doc(adminDb, 'users', 'admin-uid')));
  await assertFails(getDocs(collection(adminDb, 'users')));
  await assertSucceeds(getDocs(collection(adminDb, 'admin_contacts')));

  const userCtx = testEnv.authenticatedContext('user-uid');
  const userDb = userCtx.firestore();
  await assertSucceeds(getDocs(collection(userDb, 'member_details')));
  await assertFails(getDocs(collection(userDb, 'member_ids')));
  await assertSucceeds(getDoc(doc(userDb, 'member_ids', PHONE)));
  await assertSucceeds(getDoc(doc(userDb, 'users', 'user-uid')));
  await assertFails(getDocs(collection(userDb, 'users')));
  await assertFails(getDocs(collection(userDb, 'admin_contacts')));

  const superAdminCtx = testEnv.authenticatedContext('super-admin-uid');
  const superAdminDb = superAdminCtx.firestore();
  await assertSucceeds(getDocs(collection(superAdminDb, 'users')));

  const noProfileCtx = testEnv.authenticatedContext('unknown-uid');
  await assertFails(getDocs(collection(noProfileCtx.firestore(), 'member_details')));
  await assertFails(getDocs(collection(noProfileCtx.firestore(), 'member_ids')));

  console.log('PASS: Firestore get/list rules smoke test');
} finally {
  await testEnv.cleanup();
}
