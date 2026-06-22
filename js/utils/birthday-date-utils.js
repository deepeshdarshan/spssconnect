/**
 * @fileoverview Pure date helpers for the Birthday Dashboard — birth part parsing,
 * days-until-birthday math, categorization, and document enrichment for Firestore writes.
 * @module utils/birthday-date-utils
 */

/**
 * @typedef {Object} BirthParts
 * @property {number} birthMonth Calendar month 1–12.
 * @property {number} birthDay Day of month 1–31.
 */

/**
 * @typedef {Object} BirthdayPersonEntry
 * @property {import('../services/member-person-search.js').PersonSearchRow} row
 * @property {number} daysUntil Days until the next occurrence of this birthday (0 = today).
 */

/**
 * @typedef {Object} CategorizedBirthdays
 * @property {BirthdayPersonEntry[]} today
 * @property {BirthdayPersonEntry[]} week
 * @property {BirthdayPersonEntry[]} month
 */

/**
 * @typedef {Object} SabhaBirthdayGroup
 * @property {string} sabha Pradeshika Sabha display name.
 * @property {CategorizedBirthdays} categorized
 * @property {{ today: number, week: number, month: number }} counts
 */

/**
 * Normalizes a Date to local midnight for day-diff comparisons.
 *
 * @param {Date} date
 * @returns {Date}
 */
function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Whole-day difference from `from` to `to` (local calendar days).
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function diffLocalDays(from, to) {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.round(ms / 86400000);
}

/**
 * Parses `YYYY-MM-DD` into month/day parts.
 *
 * @param {string|undefined|null} dob
 * @returns {BirthParts|null}
 */
export function parseBirthPartsFromDob(dob) {
  const raw = String(dob ?? '').trim();
  const parts = raw.split('-');
  if (parts.length !== 3) return null;
  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { birthMonth: month, birthDay: day };
}

/**
 * Resolves birth month/day from stored fields or `dob`.
 *
 * @param {Object|undefined|null} person Person sub-object (`personalDetails`, `members[]`, etc.).
 * @returns {BirthParts|null}
 */
export function resolveBirthParts(person) {
  if (!person || typeof person !== 'object') return null;
  const storedMonth = person.birthMonth;
  const storedDay = person.birthDay;
  if (
    Number.isFinite(storedMonth) &&
    Number.isFinite(storedDay) &&
    storedMonth >= 1 &&
    storedMonth <= 12 &&
    storedDay >= 1 &&
    storedDay <= 31
  ) {
    return { birthMonth: storedMonth, birthDay: storedDay };
  }
  return parseBirthPartsFromDob(person.dob);
}

/**
 * Days until the next birthday occurrence (0 = today).
 *
 * @param {number} birthMonth 1–12.
 * @param {number} birthDay 1–31.
 * @param {Date} [refDate=new Date()] Reference calendar day.
 * @returns {number|null} `null` when the date is invalid in the reference year.
 */
export function daysUntilNextBirthday(birthMonth, birthDay, refDate = new Date()) {
  const ref = startOfLocalDay(refDate);
  const year = ref.getFullYear();
  let next = new Date(year, birthMonth - 1, birthDay);
  if (Number.isNaN(next.getTime())) return null;
  if (next < ref) {
    next = new Date(year + 1, birthMonth - 1, birthDay);
    if (Number.isNaN(next.getTime())) return null;
  }
  return diffLocalDays(ref, next);
}

/**
 * Age the person turns on their birthday in the reference year.
 *
 * @param {string|undefined|null} dob `YYYY-MM-DD`.
 * @param {Date} [refDate=new Date()]
 * @returns {number|null}
 */
export function ageTurningOnBirthday(dob, refDate = new Date()) {
  const parts = parseBirthPartsFromDob(dob);
  if (!parts) return null;
  const ref = startOfLocalDay(refDate);
  const year = ref.getFullYear();
  const birthdayThisYear = new Date(year, parts.birthMonth - 1, parts.birthDay);
  if (Number.isNaN(birthdayThisYear.getTime())) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  let age = year - birth.getFullYear();
  if (birthdayThisYear > ref) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/**
 * Human-readable label for days until a birthday.
 *
 * @param {number} days
 * @returns {string}
 */
export function formatDaysRemainingLabel(days) {
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  return '';
}

const UPCOMING_DAY_NAMES = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
const UPCOMING_MONTH_NAMES = Object.freeze([
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]);

/**
 * Calendar date of the next birthday occurrence from a whole-day offset.
 *
 * @param {number} daysUntil 0 = today.
 * @param {Date} [refDate=new Date()]
 * @returns {Date}
 */
export function nextBirthdayDateFromDaysUntil(daysUntil, refDate = new Date()) {
  const ref = startOfLocalDay(refDate);
  const next = new Date(ref);
  next.setDate(next.getDate() + daysUntil);
  return next;
}

/**
 * Short label like `25 Jun, Wed` for upcoming birthday chips.
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatUpcomingBirthdayCalendarLine(date) {
  const d = date.getDate();
  const mon = UPCOMING_MONTH_NAMES[date.getMonth()] ?? '';
  const wd = UPCOMING_DAY_NAMES[date.getDay()] ?? '';
  return `${d} ${mon}, ${wd}`;
}

/**
 * Stable dedup key for a flattened person row.
 *
 * @param {import('../services/member-person-search.js').PersonSearchRow} row
 * @returns {string}
 */
export function personRowKey(row) {
  const idx = row.memberIndex == null ? 'owner' : String(row.memberIndex);
  return `${row.recordId}:${row.role}:${idx}`;
}

/**
 * Splits person rows into today / this week (1–7 days) / rest of current month buckets.
 *
 * @param {import('../services/member-person-search.js').PersonSearchRow[]} personRows
 * @param {Date} [refDate=new Date()]
 * @returns {CategorizedBirthdays}
 */
export function categorizeBirthdayPersons(personRows, refDate = new Date()) {
  const ref = startOfLocalDay(refDate);
  const refMonth = ref.getMonth() + 1;
  /** @type {BirthdayPersonEntry[]} */
  const today = [];
  /** @type {BirthdayPersonEntry[]} */
  const week = [];
  /** @type {BirthdayPersonEntry[]} */
  const month = [];
  const seenToday = new Set();
  const seenWeek = new Set();

  for (const row of personRows) {
    const parts = resolveBirthParts(row.person);
    if (!parts) continue;

    const days = daysUntilNextBirthday(parts.birthMonth, parts.birthDay, ref);
    if (days == null) continue;

    const key = personRowKey(row);
    const entry = { row, days };

    if (days === 0) {
      if (!seenToday.has(key)) {
        seenToday.add(key);
        today.push(entry);
      }
      continue;
    }

    if (days >= 1 && days <= 7) {
      if (!seenWeek.has(key)) {
        seenWeek.add(key);
        week.push(entry);
      }
      continue;
    }

    if (parts.birthMonth === refMonth && days > 7) {
      month.push(entry);
    }
  }

  const byDays = (a, b) => a.days - b.days;
  const byName = (a, b) =>
    String(a.row.person?.name ?? '').localeCompare(String(b.row.person?.name ?? ''), undefined, {
      sensitivity: 'base',
    });

  today.sort(byName);
  week.sort((a, b) => byDays(a, b) || byName(a, b));
  month.sort((a, b) => byDays(a, b) || byName(a, b));

  return { today, week, month };
}

/**
 * Groups categorized birthdays by Pradeshika Sabha in display order.
 *
 * @param {Array<{ sabha: string, personRows: import('../services/member-person-search.js').PersonSearchRow[] }>} sabhaBatches
 * @param {string[]} [sabhaOrder] Canonical sabha key order.
 * @param {Date} [refDate=new Date()]
 * @returns {SabhaBirthdayGroup[]}
 */
export function groupCategorizedBySabha(sabhaBatches, sabhaOrder = [], refDate = new Date()) {
  const orderIndex = new Map(sabhaOrder.map((s, i) => [s, i]));
  const groups = sabhaBatches.map(({ sabha, personRows }) => {
    const categorized = categorizeBirthdayPersons(personRows, refDate);
    return {
      sabha,
      categorized,
      counts: {
        today: categorized.today.length,
        week: categorized.week.length,
        month: categorized.month.length,
      },
    };
  });

  groups.sort((a, b) => {
    const ia = orderIndex.has(a.sabha) ? orderIndex.get(a.sabha) : 999;
    const ib = orderIndex.has(b.sabha) ? orderIndex.get(b.sabha) : 999;
    if (ia !== ib) return ia - ib;
    return a.sabha.localeCompare(b.sabha);
  });

  return groups;
}

/**
 * Sums today / week / month counts across sabha groups.
 *
 * @param {SabhaBirthdayGroup[]} groups
 * @returns {{ today: number, week: number, month: number }}
 */
export function aggregateSummaryCounts(groups) {
  return groups.reduce(
    (acc, g) => ({
      today: acc.today + g.counts.today,
      week: acc.week + g.counts.week,
      month: acc.month + g.counts.month,
    }),
    { today: 0, week: 0, month: 0 },
  );
}

/**
 * Adds `birthMonth` / `birthDay` to a person object when `dob` is present.
 *
 * @param {Object} person
 * @returns {Object}
 */
function enrichPersonBirthParts(person) {
  if (!person || typeof person !== 'object') return person;
  const parts = parseBirthPartsFromDob(person.dob);
  if (!parts) return person;
  return { ...person, birthMonth: parts.birthMonth, birthDay: parts.birthDay };
}

/**
 * Ensures `birthMonth` / `birthDay` are set on owner and household persons before Firestore write.
 *
 * @param {Object} data Member document payload (`personalDetails`, `members`, `nonMembers`).
 * @returns {Object} Enriched copy.
 */
export function enrichMemberDocumentBirthParts(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    personalDetails: enrichPersonBirthParts(data.personalDetails || {}),
    members: (data.members || []).map(enrichPersonBirthParts),
    nonMembers: (data.nonMembers || []).map(enrichPersonBirthParts),
  };
}
