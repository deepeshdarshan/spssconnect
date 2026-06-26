/**
 * @fileoverview Internal confidence levels for family relationship inference.
 * @module services/family-tree-inference/inference-confidence
 */

/** Relationship stored explicitly in the database. */
export const CONFIDENCE_EXPLICIT = 100;

/** Relationship inferred with exactly one possible interpretation. */
export const CONFIDENCE_INFERRED = 90;

/** Relationship could not be inferred automatically. */
export const CONFIDENCE_UNRESOLVED = 0;
