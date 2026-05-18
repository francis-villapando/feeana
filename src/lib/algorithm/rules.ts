/*
 * Static pedagogical taxonomy rules stored as TypeScript constants.
 * This file is intentionally kept as TS constants for MVP simplicity.
 */

export const TTI_RULES: Record<string, string> = {
  "too fast": "Pacing",
  "slide overload": "Presentation",
  "typecasting unclear": "Conceptual clarity",
};

export const RBT_RULES: Record<string, number> = {
  "too fast": 2,
  "slide overload": 2,
  "typecasting unclear": 3,
};

export const CLT_RULES: Record<string, "Intrinsic" | "Extraneous"> = {
  "too fast": "Extraneous",
  "slide overload": "Extraneous",
  "typecasting unclear": "Intrinsic",
};
