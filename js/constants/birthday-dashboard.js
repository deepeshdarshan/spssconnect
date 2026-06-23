/**
 * @fileoverview UI copy and labels for the Birthday Dashboard page.
 * @module constants/birthday-dashboard
 */

/** Birthday Dashboard page strings (English; i18n may wrap later). */
export const BIRTHDAY_DASHBOARD = Object.freeze({
  PAGE_TITLE: 'Birthday Dashboard',
  PAGE_SUBTITLE: 'Upcoming birthdays grouped by Pradeshika Sabha.',
  SUMMARY_TODAY_LABEL: "Today's Birthdays",
  SUMMARY_WEEK_LABEL: 'This Week',
  SUMMARY_MONTH_LABEL: 'This Month',
  SUMMARY_TODAY_HINT: 'Wish them today!',
  SUMMARY_WEEK_HINT: 'Next 7 days',
  SUMMARY_MONTH_HINT: 'Remaining this month',
  SECTION_TODAY: "Today's Birthdays",
  SECTION_WEEK: 'Upcoming This Week',
  SECTION_MONTH: 'Upcoming This Month',
  WEEK_WIDGET_SUBTITLE: 'Birthdays coming up in the next 7 days',
  MONTH_WIDGET_SUBTITLE: 'Birthdays later this month (after this week)',
  VIEW_ALL_WEEK_CTA: 'View All This Week',
  VIEW_ALL_MONTH_CTA: 'View All This Month',
  FOOTER_NOTE: "All dates are based on member's birth date.",
  EMPTY_TODAY: 'No birthdays today. Enjoy the day!',
  EMPTY_WEEK: 'No birthdays this week',
  EMPTY_MONTH: 'No more birthdays this month',
  HOUSE_LABEL: 'House',
  TURNING_LABEL: 'Turning',
  YEARS_SUFFIX: 'years',
  /** Ribbon on “today” member cards */
  HAPPY_BIRTHDAY_RIBBON: 'Happy Birthday!',
  /** Shown under the WhatsApp number pill */
  WHATSAPP_TAP_HINT: 'Tap to send a birthday wish on WhatsApp',
  /** Secondary CTA — WhatsApp deep link with pre-filled birthday wish (see `buildBirthdayWishWhatsAppMessage`). */
  SEND_BIRTHDAY_WISHES: 'Send Birthday Wishes',
  /** Sign-off line for the pre-filled WhatsApp birthday wish */
  BIRTHDAY_WISH_SIGNOFF: '- SPSS, Ernakulam Jilla',
  /** Greeting line; `{name}` is replaced in `buildBirthdayWishWhatsAppMessage`. */
  BIRTHDAY_WISH_GREETING: 'Happy Birthday {name}.',
  /** Body line between greeting and sign-off in the WhatsApp wish */
  BIRTHDAY_WISH_BODY: 'Wishing you good health and happiness.',
  /** Fallback name when the member record has no display name */
  BIRTHDAY_WISH_DEFAULT_NAME: 'there',
  AGE_LABEL: 'Age',
  /** “Turning {n} Years Today!” — {n} is inserted in the UI */
  TURNING_TODAY_SUFFIX: 'Years Today!',
  LOAD_ERROR: 'Could not load birthday data. Please try again.',
  SABHA_COUNT_TODAY: 'Today',
  SABHA_COUNT_WEEK: 'Week',
  SABHA_COUNT_MONTH: 'Month',
  ACCORDION_ARIA_PREFIX: 'Birthdays for',
});
