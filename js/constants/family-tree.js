/**
 * @fileoverview UI copy and layout tokens for the Family Relationship Tree page.
 * @module constants/family-tree
 */

/** Layout dimensions for D3 tree nodes (px). */
export const FAMILY_TREE_LAYOUT = Object.freeze({
  NODE_WIDTH: 176,
  NODE_HEIGHT: 192,
  HORIZONTAL_GAP: 48,
  INTER_ROW_GAP: 56,
  MARRIAGE_GAP: 36,
  ZOOM_MIN: 0.25,
  ZOOM_MAX: 3,
  ZOOM_STEP: 0.12,
  TRANSITION_MS: 450,
});

/** Vertical distance between generation row centers. */
export const FAMILY_TREE_ROW_STEP =
  FAMILY_TREE_LAYOUT.NODE_HEIGHT + FAMILY_TREE_LAYOUT.INTER_ROW_GAP;

/** Relationship keys included in the household tree (extensible set). */
export const FAMILY_TREE_SUPPORTED_RELATIONSHIPS = Object.freeze([
  'father',
  'mother',
  'spouse',
  'son',
  'daughter',
  'grandchild',
  'son_in_law',
  'daughter_in_law',
]);

/** Link stroke styles keyed by relationship line type. */
export const FAMILY_TREE_LINK_STYLES = Object.freeze({
  'parent-child': Object.freeze({ stroke: '#c95b14', dash: null, width: 2.5 }),
  marriage: Object.freeze({ stroke: '#e07b2e', dash: '7 5', width: 2 }),
});

/** Node card visual roles (maps to CSS modifiers). */
export const FAMILY_TREE_NODE_ROLES = Object.freeze({
  HOUSE_OWNER: 'house_owner',
  SPOUSE: 'spouse',
  PARENT: 'parent',
  CHILD: 'child',
  MEMBER: 'member',
});

/**
 * User-facing copy for the family tree feature.
 */
export const FAMILY_TREE = Object.freeze({
  PAGE_TITLE: 'Family Relationship Tree',
  BACK_LABEL: 'Household directory',
  BACK_ARIA: 'Return to household directory',
  MEMBERS_SUFFIX: 'Members',
  NON_MEMBERS_SUFFIX: 'Non-members',
  OWNER_PREFIX: 'Owner:',
  LOADING_MESSAGE: 'Loading family tree…',
  EMPTY_TITLE: 'No relationship data available.',
  EMPTY_BODY: 'This household currently contains only one member.',
  ACTION_FAMILY_TREE: 'Family relationship tree',
  ZOOM_IN: 'Zoom in',
  ZOOM_OUT: 'Zoom out',
  ZOOM_RESET: 'Reset view',
  CENTER_OWNER: 'Center on house owner',
  FIT_TREE: 'Fit tree',
  PANEL_CLOSE: 'Close member details',
  PANEL_VIEW_PROFILE: 'View profile',
  PANEL_EDIT_FAMILY: 'Edit family',
  PANEL_CENTER_HERE: 'Center tree here',
  PANEL_CALL: 'Call',
  PANEL_WHATSAPP: 'WhatsApp',
  LABEL_RELATIONSHIP: 'Relationship',
  LABEL_PHONE: 'Phone',
  LABEL_BIRTHDAY: 'Birthday',
  LABEL_AGE: 'Age',
  LABEL_OCCUPATION: 'Occupation',
  LABEL_BLOOD_GROUP: 'Blood group',
  LABEL_SPSS_POSITION: 'SPSS position',
  LABEL_HOUSE_OWNER: 'House Owner',
  YEARS_SUFFIX: 'Years',
  BACK_TO_DIRECTORY: 'Back to House Directory',
  BACK_TO_VIEW: 'Back to Record',
  BACK_ARIA_VIEW: 'Return to household record',
  LEGEND_TITLE: 'Legend',
  LEGEND_MARRIAGE: 'Marriage',
  LEGEND_PARENT_CHILD: 'Parent–Child',
  LEGEND_OWNER: 'House Owner',
  LEGEND_SPOUSE: 'Spouse',
  LEGEND_PARENT: 'Parent',
  LEGEND_CHILD: 'Child',
  PANEL_TITLE: 'Member Details',
  PANEL_PLACEHOLDER: 'Click a member in the tree to view their details.',
  PANEL_VIEW_FULL: 'View Full Profile',
  PANEL_GENDER: 'Gender',
});
