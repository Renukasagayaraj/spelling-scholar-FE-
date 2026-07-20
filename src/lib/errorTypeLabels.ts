export const ERROR_TYPE_LABELS: Record<string, string> = {
  missing_letter: "Missing letter",
  extra_letter: "Extra letter",
  letter_substitution: "Letter substitution",
  letter_transposition: "Letter order swap",
  double_letter_error: "Double-letter error",
  phonetic_spelling: "Phonetic spelling",
  vowel_confusion: "Vowel confusion",
  ending_confusion: "Ending confusion",
  chunk_omission: "Chunk omission",
  consonant_cluster_error: "Consonant cluster error",
  silent_letter_error: "Silent-letter error",
  pattern_rule_mismatch: "Pattern/rule mismatch",
  morphology_error: "Morphology error",
  likely_rushed: "Likely rushed",
};

export function friendlyErrorType(key: string): string {
  return (
    ERROR_TYPE_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
