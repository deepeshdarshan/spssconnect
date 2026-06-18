/**
 * @fileoverview PDF export layout and column labels for tabular member exports.
 * @module constants/pdf-export
 */

/**
 * Singular/plural labels for registered individuals in UI counts (use "member(s)", not "people").
 */
export const MEMBER_COUNT_UNIT = Object.freeze({
  SINGULAR: 'member',
  PLURAL: 'members',
});

/** Household directory filtered-list PDF export (tabular layout). */
export const PDF_MEMBER_LIST = Object.freeze({
  /** Data rows per PDF page (explicit pagination for html2pdf.js). Kept low because the House column includes name + address and each chunk must fit below the letterhead without canvas slicing. */
  ROWS_PER_PAGE: 10,
  /** Document title under the letterhead on the first page. */
  DOC_TITLE: 'Household Directory',
  /**
   * Table column headers (order matches household directory PDF thead in {@link ../services/pdf-service.js}).
   */
  COLUMNS: Object.freeze({
    INDEX: '#',
    /** House name and formatted address (stacked in the House column). */
    HOUSE: 'House',
    HOUSE_OWNER_NAME: 'House Owner Name',
    PRADESHIKA_SABHA: 'Pradeshika Sabha',
    PHONE: 'Phone',
    /** Members and non-members as `members/nonMembers` (e.g. `3/0`). */
    MEMBERS_NON_MEMBERS: 'Member/Non-member',
  }),
});

/** Advanced member search filtered-results PDF export. */
export const PDF_ADVANCED_SEARCH = Object.freeze({
  /** Data rows per PDF page (kept small so each section fits one landscape page in html2canvas). */
  ROWS_PER_PAGE: 10,
  /** Printable content width for landscape A4 (mm). */
  CONTENT_WIDTH_MM: 277,
});
