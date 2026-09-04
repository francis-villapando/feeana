export const MODEL_SIZES_BYTES = {
  distilxlmr: 118_283_312,
  mbert: 178_038_034,
  svm: 5_365_457,
} as const;

export type ComparedModelKind = keyof typeof MODEL_SIZES_BYTES;
