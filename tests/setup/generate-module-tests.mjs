/**
 * @fileoverview Generates one unit test file per source module under js/.
 * Run: node tests/setup/generate-module-tests.mjs
 */

import { readdirSync, statSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const JS_ROOT = join(ROOT, 'js');

/** @type {Set<string>} */
const FIREBASE_DEPENDENT = new Set([
  'services/auth-service.js',
  'services/firebase-config.js',
  'services/firestore-service.js',
  'services/storage-service.js',
  'services/users-service.js',
  'services/admin-contacts-service.js',
  'services/birthday-service.js',
  'services/jilla-membership-service.js',
  'services/member-id-service.js',
  'services/member-service.js',
  'services/permissions.js',
  'services/session-navigation-guard.js',
  'app-init.js',
  'login-init.js',
  'form/form-handler-bindings.js',
  'form/form-handler-photo.js',
  'form/form-handler-submit.js',
  'pages/admin-contacts-page.js',
  'pages/admin-dashboard-page.js',
  'pages/backup-restore-center-page.js',
  'pages/backup-sync-center-page.js',
  'pages/backup-sync-page.js',
  'pages/birthday-dashboard-page.js',
  'pages/dashboard-service.js',
  'pages/family-tree-page.js',
  'pages/form-handler.js',
  'pages/jilla-membership.js',
  'pages/member-advanced-search-page.js',
  'pages/phone-check-page.js',
  'pages/restore-center-page.js',
  'pages/user-management.js',
  'pages/view-service.js',
  'backup-sync/services/backup-service.js',
  'backup-sync/services/member-backup-sync-service.js',
  'backup-sync/services/member-sync-query-service.js',
  'backup-sync/services/restore-analysis-service.js',
  'backup-sync/services/restore-failures-service.js',
  'backup-sync/services/restore-history-service.js',
  'backup-sync/services/restore-metadata-service.js',
  'backup-sync/services/restore-service.js',
  'backup-sync/services/restore-write-service.js',
  'backup-sync/services/snapshot-service.js',
  'backup-sync/services/sync-failures-service.js',
  'backup-sync/services/sync-history-service.js',
  'backup-sync/services/sync-metadata-service.js',
]);

/** Modules that run initialization on import and export no bindings. */
const SIDE_EFFECT_ONLY = new Set([
  'app-init.js',
  'login-init.js',
  'pages/landing-page.js',
  'ui/role-ui-sync.js',
]);

const SPOUSE_RULE = 'services/family-tree-inference/rules/spouse-rule.js';

/** @type {Record<string, string>} */
const BEHAVIORAL = {
  'utils/birthday-date-utils.js': `
  describe('positive cases', () => {
    it('parseBirthPartsFromDob parses valid YYYY-MM-DD', async () => {
      const { parseBirthPartsFromDob } = await import(MODULE);
      assert.deepEqual(parseBirthPartsFromDob('1990-06-15'), { birthMonth: 6, birthDay: 15 });
    });

    it('resolveBirthParts prefers stored birthMonth and birthDay', async () => {
      const { resolveBirthParts } = await import(MODULE);
      assert.deepEqual(resolveBirthParts({ birthMonth: 3, birthDay: 10, dob: '1990-01-01' }), { birthMonth: 3, birthDay: 10 });
    });

    it('daysUntilNextBirthday returns 0 for today', async () => {
      const { daysUntilNextBirthday } = await import(MODULE);
      const ref = new Date(2026, 5, 15);
      assert.equal(daysUntilNextBirthday(6, 15, ref), 0);
    });

    it('enrichMemberDocumentBirthParts adds birth parts from dob', async () => {
      const { enrichMemberDocumentBirthParts } = await import(MODULE);
      const out = enrichMemberDocumentBirthParts({
        personalDetails: { dob: '1985-12-25' },
        members: [{ dob: '2010-01-05' }],
      });
      assert.equal(out.personalDetails.birthMonth, 12);
      assert.equal(out.members[0].birthDay, 5);
    });
  });

  describe('negative cases', () => {
    it('parseBirthPartsFromDob rejects invalid strings', async () => {
      const { parseBirthPartsFromDob } = await import(MODULE);
      assert.equal(parseBirthPartsFromDob('invalid'), null);
      assert.equal(parseBirthPartsFromDob('1990-13-01'), null);
      assert.equal(parseBirthPartsFromDob(''), null);
    });

    it('resolveBirthParts returns null for missing person', async () => {
      const { resolveBirthParts } = await import(MODULE);
      assert.equal(resolveBirthParts(null), null);
      assert.equal(resolveBirthParts({}), null);
    });
  });

  describe('edge cases', () => {
    it('formatDaysRemainingLabel handles boundary labels', async () => {
      const { formatDaysRemainingLabel } = await import(MODULE);
      assert.equal(formatDaysRemainingLabel(0), '');
      assert.equal(formatDaysRemainingLabel(1), 'Tomorrow');
      assert.equal(formatDaysRemainingLabel(5), 'In 5 days');
    });

    it('personRowKey distinguishes owner from indexed members', async () => {
      const { personRowKey } = await import(MODULE);
      assert.equal(personRowKey({ recordId: 'r1', role: 'owner', memberIndex: null }), 'r1:owner:owner');
      assert.equal(personRowKey({ recordId: 'r1', role: 'member', memberIndex: 2 }), 'r1:member:2');
    });

    it('aggregateSummaryCounts sums empty groups to zero', async () => {
      const { aggregateSummaryCounts } = await import(MODULE);
      assert.deepEqual(aggregateSummaryCounts([]), { today: 0, week: 0, month: 0 });
    });
  });`,

  'utils/member-avatar-initials.js': `
  describe('positive cases', () => {
    it('getMemberAvatarInitials follows multi-word and single-word rules', async () => {
      const { getMemberAvatarInitials } = await import(MODULE);
      assert.equal(getMemberAvatarInitials('John'), 'JO');
      assert.equal(getMemberAvatarInitials('Abhirami B M'), 'AB');
    });

    it('getMemberAvatarSwatchIndex is stable for the same seed', async () => {
      const { getMemberAvatarSwatchIndex } = await import(MODULE);
      assert.equal(getMemberAvatarSwatchIndex('Same Name'), getMemberAvatarSwatchIndex('Same Name'));
    });
  });

  describe('negative cases', () => {
    it('getMemberAvatarInitials returns placeholder for empty names', async () => {
      const { getMemberAvatarInitials } = await import(MODULE);
      assert.equal(getMemberAvatarInitials(''), '?');
      assert.equal(getMemberAvatarInitials('   '), '?');
      assert.equal(getMemberAvatarInitials(null), '?');
    });
  });

  describe('edge cases', () => {
    it('getMemberAvatarInitials handles two-character names', async () => {
      const { getMemberAvatarInitials } = await import(MODULE);
      assert.equal(getMemberAvatarInitials('Jo'), 'JO');
      assert.equal(getMemberAvatarInitials('J'), 'J');
    });

    it('getMemberAvatarSwatchIndex stays within swatch range', async () => {
      const { getMemberAvatarSwatchIndex, MEMBER_AVATAR_SWATCH_COUNT } = await import(MODULE);
      const idx = getMemberAvatarSwatchIndex('Any Seed');
      assert.ok(idx >= 0 && idx < MEMBER_AVATAR_SWATCH_COUNT);
    });
  });`,

  'utils/target-achievement-utils.js': `
  describe('positive cases', () => {
    it('achievementRatio computes percent and capped bar width', async () => {
      const { achievementRatio } = await import(MODULE);
      assert.deepEqual(achievementRatio(50, 100), { pct: 50, barPct: 50 });
      assert.deepEqual(achievementRatio(150, 100), { pct: 150, barPct: 100 });
    });

    it('countActiveMembersInRecord counts owner and members with active types', async () => {
      const { countActiveMembersInRecord } = await import(MODULE);
      const n = countActiveMembersInRecord({
        personalDetails: { membershipType: 'life_member' },
        members: [{ membershipType: 'ordinary_member' }],
        nonMembers: [{ name: 'Guest' }],
      });
      assert.equal(n, 2);
    });
  });

  describe('negative cases', () => {
    it('toNonNegInt coerces invalid values to zero', async () => {
      const { toNonNegInt } = await import(MODULE);
      assert.equal(toNonNegInt(-3), 0);
      assert.equal(toNonNegInt('x'), 0);
      assert.equal(toNonNegInt(NaN), 0);
    });

    it('achievementRatio returns null when target is zero', async () => {
      const { achievementRatio } = await import(MODULE);
      assert.equal(achievementRatio(10, 0), null);
    });

    it('resolveSabhaKey returns null for unknown sabha', async () => {
      const { resolveSabhaKey, defaultSabhaOrder } = await import(MODULE);
      assert.equal(resolveSabhaKey({ personalDetails: { pradeshikaSabha: 'Not A Sabha' } }, defaultSabhaOrder()), null);
    });
  });

  describe('edge cases', () => {
    it('mergeJillaMembershipRows preserves sabha order with missing saved rows', async () => {
      const { mergeJillaMembershipRows } = await import(MODULE);
      const rows = mergeJillaMembershipRows(null, ['A', 'B']);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].psName, 'A');
      assert.equal(rows[1].lifeMembers, 0);
    });

    it('hasAnyJillaTargets is false when all targets are zero', async () => {
      const { hasAnyJillaTargets } = await import(MODULE);
      assert.equal(hasAnyJillaTargets([{ psName: 'A', lifeMembers: 0, ordinaryMembers: 0, home: 0 }]), false);
    });
  });`,

  'utils/logger.js': `
  describe('positive cases', () => {
    it('log helpers are callable without throwing', async () => {
      const { debug, info, warn, error } = await import(MODULE);
      assert.doesNotThrow(() => debug('test'));
      assert.doesNotThrow(() => info('test'));
      assert.doesNotThrow(() => warn('test'));
      assert.doesNotThrow(() => error('test'));
    });
  });`,

  'services/pagination-service.js': `
  describe('positive cases', () => {
    it('paginate returns correct slices', async () => {
      const { paginate } = await import(MODULE);
      const records = [1, 2, 3, 4, 5];
      assert.deepEqual(paginate(records, 1, 2), [1, 2]);
      assert.deepEqual(paginate(records, 3, 2), [5]);
    });

    it('getTotalPages computes page count', async () => {
      const { getTotalPages } = await import(MODULE);
      assert.equal(getTotalPages(25, 10), 3);
    });
  });

  describe('negative cases', () => {
    it('paginate does not mutate the source array', async () => {
      const { paginate } = await import(MODULE);
      const records = [1, 2, 3];
      const copy = [...records];
      paginate(records, 1, 2);
      assert.deepEqual(records, copy);
    });
  });

  describe('edge cases', () => {
    it('getTotalPages returns at least one page for zero records', async () => {
      const { getTotalPages } = await import(MODULE);
      assert.equal(getTotalPages(0, 10), 1);
    });

    it('resetPage and setPaginationState update state', async () => {
      const { setPaginationState, resetPage, getPaginationState, paginate } = await import(MODULE);
      setPaginationState({ currentPage: 3, pageSize: 5 });
      assert.equal(getPaginationState().currentPage, 3);
      resetPage();
      assert.equal(getPaginationState().currentPage, 1);
      assert.deepEqual(paginate([1, 2, 3, 4, 5, 6], undefined, 5), [1, 2, 3, 4, 5]);
    });
  });`,

  'services/sort-service.js': `
  describe('positive cases', () => {
    it('sortMembers sorts by name ascending and descending', async () => {
      const { sortMembers } = await import(MODULE);
      const records = [
        { personalDetails: { name: 'Zara' } },
        { personalDetails: { name: 'Amy' } },
      ];
      const asc = sortMembers(records, 'name', 'asc');
      assert.equal(asc[0].personalDetails.name, 'Amy');
      const desc = sortMembers(records, 'name', 'desc');
      assert.equal(desc[0].personalDetails.name, 'Zara');
    });
  });

  describe('negative cases', () => {
    it('sortMembers does not mutate the input array', async () => {
      const { sortMembers } = await import(MODULE);
      const records = [{ personalDetails: { name: 'B' } }, { personalDetails: { name: 'A' } }];
      const before = records.map((r) => r.personalDetails.name);
      sortMembers(records, 'name', 'asc');
      assert.deepEqual(records.map((r) => r.personalDetails.name), before);
    });
  });

  describe('edge cases', () => {
    it('sortMembers treats missing names as empty strings', async () => {
      const { sortMembers } = await import(MODULE);
      const records = [{ personalDetails: {} }, { personalDetails: { name: 'Amy' } }];
      const sorted = sortMembers(records, 'name', 'asc');
      assert.equal(sorted[0].personalDetails.name, undefined);
      assert.equal(sorted[1].personalDetails.name, 'Amy');
    });
  });`,

  'services/member-person-search.js': `
  describe('positive cases', () => {
    it('formatHouseholdAddress joins populated address lines', async () => {
      const { formatHouseholdAddress } = await import(MODULE);
      const addr = formatHouseholdAddress({
        address: { address1: 'Line 1', address2: 'Line 2', place: 'Kochi', pin: '682001' },
      });
      assert.equal(addr, 'Line 1, Line 2, Kochi, 682001');
    });
  });

  describe('negative cases', () => {
    it('formatHouseholdAddress returns empty string when address missing', async () => {
      const { formatHouseholdAddress } = await import(MODULE);
      assert.equal(formatHouseholdAddress({}), '');
      assert.equal(formatHouseholdAddress(null), '');
    });
  });`,

  'services/search-service.js': `
  describe('positive cases', () => {
    it('searchMembers matches house name case-insensitively', async () => {
      const { searchMembers } = await import(MODULE);
      const records = [{ personalDetails: { houseName: 'Green Villa', name: 'Owner', phone: '9876543210', address: { pin: '682001' } } }];
      const hits = searchMembers(records, 'green');
      assert.equal(hits.length, 1);
    });

    it('filterMembersBySabha matches exact sabha', async () => {
      const { filterMembersBySabha } = await import(MODULE);
      const records = [
        { personalDetails: { pradeshikaSabha: 'Aluva' } },
        { personalDetails: { pradeshikaSabha: 'Tripunithura' } },
      ];
      assert.equal(filterMembersBySabha(records, 'aluva').length, 1);
    });
  });

  describe('negative cases', () => {
    it('searchMembers returns all records for blank query', async () => {
      const { searchMembers } = await import(MODULE);
      const records = [{ id: 1 }, { id: 2 }];
      assert.equal(searchMembers(records, '   ').length, 2);
    });

    it('filterMembersBySabha returns all records when sabha is empty', async () => {
      const { filterMembersBySabha } = await import(MODULE);
      const records = [{ personalDetails: { pradeshikaSabha: 'Aluva' } }];
      assert.equal(filterMembersBySabha(records, '').length, 1);
    });
  });

  describe('edge cases', () => {
    it('filterMembersBySabhaSet returns all when selection is empty', async () => {
      const { filterMembersBySabhaSet } = await import(MODULE);
      const records = [{ personalDetails: { pradeshikaSabha: 'Aluva' } }];
      assert.equal(filterMembersBySabhaSet(records, new Set()).length, 1);
    });

    it('filterMembersByHouseholdComposition matches non-member households', async () => {
      const { filterMembersByHouseholdComposition } = await import(MODULE);
      const records = [{ personalDetails: {}, members: [], nonMembers: [{ name: 'Guest' }] }];
      const hits = filterMembersByHouseholdComposition(records, new Set(['non_member']));
      assert.equal(hits.length, 1);
    });
  });`,

  'constants/family-tree.js': `
  describe('positive cases', () => {
    it('exports frozen layout and copy constants', async () => {
      const { FAMILY_TREE_LAYOUT, FAMILY_TREE, FAMILY_TREE_SUPPORTED_RELATIONSHIPS } = await import(MODULE);
      assert.ok(FAMILY_TREE_LAYOUT.NODE_WIDTH > 0);
      assert.equal(typeof FAMILY_TREE.PAGE_TITLE, 'string');
      assert.ok(Object.isFrozen(FAMILY_TREE_SUPPORTED_RELATIONSHIPS));
    });
  });

  describe('edge cases', () => {
    it('supported relationships include in-law and grandchild keys', async () => {
      const { FAMILY_TREE_SUPPORTED_RELATIONSHIPS } = await import(MODULE);
      assert.ok(FAMILY_TREE_SUPPORTED_RELATIONSHIPS.includes('grandchild'));
      assert.ok(FAMILY_TREE_SUPPORTED_RELATIONSHIPS.includes('daughter_in_law'));
    });
  });`,

  'constants/routing.js': `
  describe('positive cases', () => {
    it('resolveRecordsListHrefFromViewReferrer maps advanced search referrer', async () => {
      const { resolveRecordsListHrefFromViewReferrer, VIEW_REFERRER } = await import(MODULE);
      assert.equal(resolveRecordsListHrefFromViewReferrer(VIEW_REFERRER.ADVANCED_SEARCH), 'advanced-member-search');
      assert.equal(resolveRecordsListHrefFromViewReferrer(VIEW_REFERRER.MEMBER_LIST), 'household-directory');
    });

    it('buildFamilyTreeHref encodes id and from referrer', async () => {
      const { buildFamilyTreeHref, FAMILY_TREE_REFERRER } = await import(MODULE);
      const href = buildFamilyTreeHref('house 1', FAMILY_TREE_REFERRER.VIEW);
      assert.ok(href.includes('family-tree?id='));
      assert.ok(href.includes('from=view'));
    });
  });

  describe('negative cases', () => {
    it('resolveRecordsListHrefFromViewReferrer defaults unknown values to household directory', async () => {
      const { resolveRecordsListHrefFromViewReferrer } = await import(MODULE);
      assert.equal(resolveRecordsListHrefFromViewReferrer('unknown'), 'household-directory');
      assert.equal(resolveRecordsListHrefFromViewReferrer(null), 'household-directory');
    });
  });

  describe('edge cases', () => {
    it('resolveFamilyTreeBackNav falls back without record id', async () => {
      const { resolveFamilyTreeBackNav, FAMILY_TREE_REFERRER } = await import(MODULE);
      const nav = resolveFamilyTreeBackNav(FAMILY_TREE_REFERRER.VIEW, '');
      assert.equal(nav.href, 'household-directory');
    });
  });`,

  'locales/en.js': `
  describe('positive cases', () => {
    it('default export is a non-empty string map with page title', async () => {
      const mod = await import(MODULE);
      assert.ok(Object.keys(mod.default).length > 10);
      assert.equal(typeof mod.default['page.title'], 'string');
    });
  });

  describe('negative cases', () => {
    it('does not expose undefined values for core keys', async () => {
      const mod = await import(MODULE);
      assert.notEqual(mod.default['page.title'], undefined);
      assert.notEqual(mod.default['landing.title'], undefined);
    });
  });`,

  'locales/ml.js': `
  describe('positive cases', () => {
    it('default export is a non-empty Malayalam string map', async () => {
      const mod = await import(MODULE);
      assert.ok(Object.keys(mod.default).length > 10);
      assert.equal(typeof mod.default['page.title'], 'string');
    });
  });`,

  'admin-stats/admin-stats-calculators.js': `
  describe('positive cases', () => {
    it('resolveOccupationKey matches known and legacy keys', async () => {
      const { resolveOccupationKey } = await import(MODULE);
      const known = ['engineer'];
      assert.equal(resolveOccupationKey('engineer', known), 'engineer');
      assert.equal(resolveOccupationKey('Engineer', known), 'engineer');
    });

    it('ageFromDob and ageBucket compute expected values', async () => {
      const { ageFromDob, ageBucket } = await import(MODULE);
      const age = ageFromDob('2000-01-01');
      assert.ok(typeof age === 'number' && age > 0);
      assert.equal(ageBucket(10), '0–18');
      assert.equal(ageBucket(70), '60+');
    });
  });

  describe('negative cases', () => {
    it('resolveOccupationKey maps empty and unknown to sentinels', async () => {
      const { resolveOccupationKey } = await import(MODULE);
      assert.equal(resolveOccupationKey('', []), '__empty__');
      assert.equal(resolveOccupationKey(null, []), '__empty__');
      assert.equal(resolveOccupationKey('mystery job', ['engineer']), '__unknown__');
    });

    it('ageFromDob rejects invalid dates', async () => {
      const { ageFromDob } = await import(MODULE);
      assert.equal(ageFromDob(''), null);
      assert.equal(ageFromDob('not-a-date'), null);
    });
  });

  describe('edge cases', () => {
    it('normalizeGender handles short aliases', async () => {
      const { normalizeGender } = await import(MODULE);
      assert.equal(normalizeGender('m'), 'Male');
      assert.equal(normalizeGender('F'), 'Female');
      assert.equal(normalizeGender(''), 'Unknown');
    });
  });`,

  'validation/jilla-membership-validation.js': `
  describe('positive cases', () => {
    it('parseMembershipInt accepts zero and positive integers', async () => {
      const { parseMembershipInt } = await import(MODULE);
      assert.deepEqual(parseMembershipInt(''), { valid: true, value: 0 });
      assert.deepEqual(parseMembershipInt('42'), { valid: true, value: 42 });
    });
  });

  describe('negative cases', () => {
    it('parseMembershipInt rejects decimals and letters', async () => {
      const { parseMembershipInt } = await import(MODULE);
      assert.equal(parseMembershipInt('3.5').valid, false);
      assert.equal(parseMembershipInt('abc').valid, false);
      assert.equal(parseMembershipInt('-1').valid, false);
    });
  });

  describe('edge cases', () => {
    it('parseMembershipInt rejects overly long numbers', async () => {
      const { parseMembershipInt } = await import(MODULE);
      const tooLong = '1'.repeat(13);
      assert.equal(parseMembershipInt(tooLong).valid, false);
    });
  });`,

  'validation/validation-service.js': `
  describe('positive cases', () => {
    it('validateRequired accepts non-empty trimmed strings', async () => {
      const { validateRequired } = await import(MODULE);
      assert.equal(validateRequired('  value  ').valid, true);
    });

    it('validatePhone accepts ten-digit numbers and optional zero placeholder', async () => {
      const { validatePhone } = await import(MODULE);
      assert.equal(validatePhone('9876543210').valid, true);
      assert.equal(validatePhone('0').valid, true);
    });

    it('validatePIN accepts six-digit PINs', async () => {
      const { validatePIN } = await import(MODULE);
      assert.equal(validatePIN('682001').valid, true);
    });
  });

  describe('negative cases', () => {
    it('validateRequired rejects empty values', async () => {
      const { validateRequired } = await import(MODULE);
      assert.equal(validateRequired('').valid, false);
      assert.equal(validateRequired('   ').valid, false);
    });

    it('validateEmail rejects malformed addresses', async () => {
      const { validateEmail } = await import(MODULE);
      assert.equal(validateEmail('bad@').valid, false);
      assert.equal(validateEmail('a@b').valid, false);
    });

    it('validatePhone rejects invalid lengths when provided', async () => {
      const { validatePhone } = await import(MODULE);
      assert.equal(validatePhone('12345').valid, false);
      assert.equal(validatePhone('', true).valid, false);
    });

    it('validateDOB rejects future dates', async () => {
      const { validateDOB } = await import(MODULE);
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      assert.equal(validateDOB(future.toISOString().slice(0, 10)).valid, false);
    });
  });

  describe('edge cases', () => {
    it('validateEmail allows empty optional email', async () => {
      const { validateEmail } = await import(MODULE);
      assert.equal(validateEmail('').valid, true);
    });

    it('validatePhone allows empty optional phone', async () => {
      const { validatePhone } = await import(MODULE);
      assert.equal(validatePhone('', false).valid, true);
    });
  });`,

  'services/family-tree-inference/graph-mutations.js': `
  describe('positive cases', () => {
    it('linkSpouse links nodes mutually', async () => {
      const { linkSpouse } = await import(MODULE);
      const nodes = new Map([
        ['a', { spouseId: null, childrenIds: [] }],
        ['b', { spouseId: null, childrenIds: [] }],
      ]);
      linkSpouse('a', 'b', nodes);
      assert.equal(nodes.get('a').spouseId, 'b');
      assert.equal(nodes.get('b').spouseId, 'a');
    });
  });

  describe('negative cases', () => {
    it('linkSpouse no-ops for missing nodes', async () => {
      const { linkSpouse } = await import(MODULE);
      const nodes = new Map([['a', { spouseId: null, childrenIds: [] }]]);
      linkSpouse('a', 'missing', nodes);
      assert.equal(nodes.get('a').spouseId, null);
    });
  });

  describe('edge cases', () => {
    it('addChild avoids duplicate child ids', async () => {
      const { addChild } = await import(MODULE);
      const nodes = new Map([['p', { childrenIds: ['c1'] }], ['c1', {}]]);
      addChild('p', 'c1', nodes);
      assert.deepEqual(nodes.get('p').childrenIds, ['c1']);
    });
  });`,

  'services/family-tree-graph-builder.js': `
  describe('positive cases', () => {
    it('normalizeRelationshipKey lowercases relationship values', async () => {
      const { normalizeRelationshipKey } = await import(MODULE);
      assert.equal(normalizeRelationshipKey('SON'), 'son');
      assert.equal(normalizeRelationshipKey('Daughter_In_Law'), 'daughter_in_law');
    });
  });

  describe('negative cases', () => {
    it('normalizeRelationshipKey returns empty string for nullish input', async () => {
      const { normalizeRelationshipKey } = await import(MODULE);
      assert.equal(normalizeRelationshipKey(null), '');
      assert.equal(normalizeRelationshipKey(undefined), '');
    });
  });

  describe('edge cases', () => {
    it('normalizeRelationshipKey trims whitespace', async () => {
      const { normalizeRelationshipKey } = await import(MODULE);
      assert.equal(normalizeRelationshipKey('  spouse  '), 'spouse');
    });
  });`,
};

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkJs(dir, base = '') {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(abs).isDirectory()) {
      files.push(...walkJs(abs, rel));
    } else if (entry.endsWith('.js')) {
      files.push(rel);
    }
  }
  return files.sort();
}

/**
 * @param {string} jsRel
 * @returns {string}
 */
function testPathFor(jsRel) {
  const dir = dirname(jsRel);
  const name = basename(jsRel, '.js');
  return join('tests/unit', dir === '.' ? '' : dir, `${name}.test.js`);
}

/**
 * @param {string} testAbs
 * @param {string} jsRel
 * @returns {string}
 */
function importPath(testAbs, jsRel) {
  const testDir = dirname(testAbs);
  const sourceAbs = join(JS_ROOT, jsRel);
  let rel = relative(testDir, sourceAbs);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

/**
 * @param {string} jsRel
 * @returns {string[]}
 */
function detectExports(jsRel) {
  const source = readFileSync(join(JS_ROOT, jsRel), 'utf8');
  const names = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      names.add(match[1]);
    }
  }
  const block = /export\s*\{([^}]+)\}/g;
  let match;
  while ((match = block.exec(source)) !== null) {
    match[1].split(',').forEach((part) => {
      const trimmed = part.trim().split(/\s+as\s+/)[0].trim();
      if (trimmed && /^\w+$/.test(trimmed)) names.add(trimmed);
    });
  }
  if (/export\s+default/.test(source)) names.add('default');
  return [...names].sort();
}

/**
 * @param {string} jsRel
 * @param {string} testAbs
 * @returns {string}
 */
function renderTest(jsRel, testAbs) {
  const moduleImport = importPath(testAbs, jsRel);
  const label = `js/${jsRel}`;
  const exports = detectExports(jsRel);
  const exportAssert = exports.length > 0
    ? `assertHasExports(mod, ${JSON.stringify(exports)});`
    : 'assertModuleLoads(mod);';
  const needsBrowser = /pages\/|form\/|ui\/|validation\/|app-init|login-init|backup-sync\/components/.test(jsRel);
  const needsFirebase = FIREBASE_DEPENDENT.has(jsRel);
  const behavioral = BEHAVIORAL[jsRel] ?? '';

  const setupDir = relative(dirname(testAbs), join(ROOT, 'tests', 'setup')).replace(/\\/g, '/');
  const browserImport = needsBrowser || needsFirebase
    ? `import '${setupDir}/browser-globals.js';\n`
    : '';

  let utilsImportPath = `${setupDir}/module-test-utils.js`;
  if (!utilsImportPath.startsWith('.')) utilsImportPath = `./${utilsImportPath}`;

  if (jsRel === SPOUSE_RULE) {
    const indexImport = importPath(testAbs, 'services/family-tree-inference/index.js');
    return `/**
 * @fileoverview Unit tests for ${label}
 * @generated by tests/setup/generate-module-tests.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const INDEX_MODULE = '${indexImport}';

describe('${label}', () => {
  it('is registered in the inference engine', async () => {
    const { INFERENCE_RULES } = await import(INDEX_MODULE);
    assert.ok(INFERENCE_RULES.some((rule) => rule.name === 'SpouseRule'));
  });
});
`;
  }

  if (needsFirebase) {
    const exportList = JSON.stringify(exports);
    return `/**
 * @fileoverview Unit tests for ${label}
 * @generated by tests/setup/generate-module-tests.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), '${moduleImport}');
const EXPECTED_EXPORTS = ${exportList};

describe('${label}', () => {
  it('defines expected exports in source', () => {
    const source = readFileSync(SOURCE, 'utf8');
    assert.ok(source.length > 0);
    if (EXPECTED_EXPORTS.length === 0) {
      assert.doesNotMatch(source, /^export /m);
      return;
    }
    assert.match(source, /export /);
    for (const name of EXPECTED_EXPORTS) {
      if (name === 'default') {
        assert.match(source, /export\\s+default/);
      } else {
        assert.match(source, new RegExp(\`\\\\b\${name}\\\\b\`));
      }
    }
  });
${behavioral ? behavioral.replace(/await import\\(MODULE\\)/g, `await import('${moduleImport}')`) : ''}
});
`;
  }

  const loadTestBody = SIDE_EFFECT_ONLY.has(jsRel) || exports.length === 0
    ? `  it('loads without throwing', async () => {
    await import(MODULE);
  });`
    : `  it('loads and exposes exports', async () => {
    const mod = await import(MODULE);
    ${exportAssert}
  });`;

  return `/**
 * @fileoverview Unit tests for ${label}
 * @generated by tests/setup/generate-module-tests.mjs
 */

${browserImport}import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertHasExports,
  assertModuleLoads,
} from '${utilsImportPath}';

const MODULE = '${moduleImport}';

describe('${label}', () => {
${loadTestBody}
${behavioral ? `\n  describe('behavioral cases', () => {${behavioral}\n  });` : ''}
});
`;
}

const jsFiles = walkJs(JS_ROOT);
let created = 0;

for (const jsRel of jsFiles) {
  if (jsRel === 'services/family-tree-inference/__tests__/inference-engine.test.js') continue;
  const testRel = testPathFor(jsRel);
  const testAbs = join(ROOT, testRel);
  mkdirSync(dirname(testAbs), { recursive: true });
  if (existsSync(testAbs)) {
    const existing = readFileSync(testAbs, 'utf8');
    if (!existing.includes('@generated by tests/setup/generate-module-tests.mjs')) {
      continue;
    }
  }
  writeFileSync(testAbs, renderTest(jsRel, testAbs));
  created += 1;
}

console.log(`Generated ${created} test files under tests/unit/`);
