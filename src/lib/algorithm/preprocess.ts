/*
 * Module 2: Preprocessing (algorithm.pseudo line: "clean_text = Preprocess(feedback)")
 * This module normalizes vowels, maps common abbreviations, removes noise (URLs, tags,
 * emojis, hashtags), and prepares text for DistilXLM-R tokenization.
 *
 * Console logging is emitted at input/output boundaries for dev debugging and
 * data flow visibility during thesis presentation.
 */

import type { FeedbackInput } from "./types";

/**
 * URL pattern: matches http://, https://, www., and domain-like patterns.
 */
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi;

/**
 * Mention/tag pattern: matches @username or similar tags.
 */
const TAG_PATTERN = /@\w+/g;

/**
 * Hashtag pattern: matches #hashtag.
 */
const HASHTAG_PATTERN = /#\w+/g;

/**
 * Emoji pattern: matches unicode emoji sequences.
 * This pattern covers most common emoji ranges.
 */
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{2300}-\u{23FF}]|[\u{2000}-\u{206F}]/gu;

/**
 * Smart bilingual (English + Tagalog) vocabulary for double-letter preservation.
 * These words naturally contain double-vowels or double-consonants and should be
 * preserved when reducing repetitions.
 *
 * Example: "cooool" in feedback should become "cool" (2 o's), not "col" (1 o).
 * Example: "yessss" in feedback should become "yes" (1 s), not "yees".
 */
const DOUBLE_LETTER_VOCABULARY = new Set([
  // English: common words with double-vowels
  "good",
  "cool",
  "tool",
  "soon",
  "feel",
  "see",
  "look",
  "keep",
  "feed",
  "week",
  "meet",
  "free",
  "need",
  "bee",
  "tree",
  "door",
  "poor",
  "book",
  "moon",
  "noon",
  "room",
  "food",
  // Tagalog / Taglish: common words with double-vowels or consonants
  "taas",
  "noon",
  "noo",
  "oops",
  "loob",
]);

/**
 * Pattern to detect letters repeated 3 or more times.
 */
const REPETITION_PATTERN = /([a-zA-Z])\1{2,}/g;

/**
 * Common abbreviations to full-word mappings.
 * Extracted from common feedback patterns in educational contexts.
 */
const ABBREVIATION_MAP: Record<string, string> = {
  proj: "project",
  bc: "because",
  pls: "please",
  thx: "thanks",
  ur: "your",
  u: "you",
  r: "are",
  wrt: "with respect to",
  ilo: "intended learning outcome",
  rbt: "revised bloom taxonomy",
  clt: "cognitive load theory",
  tti: "teaching through interactions",
  ttm: "teaching through modeling",
  idk: "i do not know",
  imo: "in my opinion",
  iirc: "if i recall correctly",
  fyi: "for your information",
  asap: "as soon as possible",
  hw: "homework",
  lol: "laughing out loud",
  tbh: "to be honest",
  smh: "shaking my head",
  ass: "assignment",
};

/**
 * Remove URLs, tags, hashtags, and emojis.
 * Cleans extraneous noise without removing semantic content.
 * Line mapping: algorithm.pseudo (implicit in Preprocess module).
 */
function removeNoise(text: string): string {
  let cleaned = text;

  // Remove URLs
  cleaned = cleaned.replace(URL_PATTERN, "");

  // Remove @mentions and tags
  cleaned = cleaned.replace(TAG_PATTERN, "");

  // Remove #hashtags
  cleaned = cleaned.replace(HASHTAG_PATTERN, "");

  // Remove emojis
  cleaned = cleaned.replace(EMOJI_PATTERN, "");

  return cleaned;
}

/**
 * Normalize letter repetitions using smart vocabulary lookup.
 *
 * Algorithm:
 * 1. Find any letter repeated 3+ times in a word.
 * 2. Generate the 1-letter and 2-letter versions of the word using surrounding context.
 * 3. If the 2-letter version is in DOUBLE_LETTER_VOCABULARY, preserve 2 characters.
 * 4. Else if the letter is 'o', 'O', 'e', or 'E' (common double-vowels), default to 2 characters.
 * 5. Else (consonants or other vowels), default to 1 character.
 *
 * Preserves original case throughout.
 * Line mapping: algorithm.pseudo (implicit in Preprocess module).
 */
function normalizeVowels(text: string): string {
  return text.replace(REPETITION_PATTERN, (match, letter, offset, fullString) => {
    const lowerLetter = letter.toLowerCase();
    const singleCharVersion = letter;
    const doubleCharVersion = letter + letter;

    // 1. If it's a common English double-vowel (o/e), default to double characters immediately.
    if (lowerLetter === "o" || lowerLetter === "e") {
      return doubleCharVersion;
    }

    // 2. Otherwise, extract the full word containing the repetition to check the vocabulary
    let wordStart = offset;
    while (wordStart > 0 && /\w/.test(fullString[wordStart - 1])) {
      wordStart--;
    }
    let wordEnd = offset + match.length;
    while (wordEnd < fullString.length && /\w/.test(fullString[wordEnd])) {
      wordEnd++;
    }

    // Reconstruct the word as if it only had 2 of the repeated letters
    const originalWord = fullString.slice(wordStart, wordEnd);
    const doubleLetterWord = (
      originalWord.slice(0, offset - wordStart) +
      doubleCharVersion +
      originalWord.slice(offset + match.length - wordStart)
    ).toLowerCase();

    // Check if the 2-letter word exists in our vocabulary
    if (DOUBLE_LETTER_VOCABULARY.has(doubleLetterWord)) {
      return doubleCharVersion;
    }

    // 3. Default fallback to 1 letter (consonants / other vowels not in vocab)
    return singleCharVersion;
  });
}

/**
 * Expand abbreviations to full words.
 * Uses word-boundary regex to avoid partial matches (e.g., "proj" in "projection").
 * Line mapping: algorithm.pseudo (implicit in Preprocess module).
 */
function expandAbbreviations(text: string): string {
  let expanded = text;

  // Iterate over each abbreviation and replace it if found as a whole word.
  for (const [abbrev, fullWord] of Object.entries(ABBREVIATION_MAP)) {
    // Word boundary: ensure the abbreviation is surrounded by non-word chars or text boundaries.
    const wordBoundaryPattern = new RegExp(`\\b${abbrev}\\b`, "gi");
    expanded = expanded.replace(wordBoundaryPattern, fullWord);
  }

  return expanded;
}

/**
 * Normalize whitespace for DistilXLM-R tokenization.
 * - Collapses multiple spaces into single space.
 * - Removes leading/trailing whitespace.
 * Line mapping: algorithm.pseudo (implicit in Preprocess module).
 */
function normalizeWhitespace(text: string): string {
  // Collapse multiple spaces, tabs, newlines into single space.
  let normalized = text.replace(/\s+/g, " ");

  // Trim leading/trailing whitespace.
  normalized = normalized.trim();

  return normalized;
}

/**
 * Preprocess feedback text for DistilXLM-R extraction.
 *
 * Pipeline (in order):
 * 1. Remove noise: URLs, tags, hashtags, emojis (runs first to prevent url alterations).
 * 2. Normalize vowel/consonant repetitions (e.g., "yessss" → "yes", "cooool" → "cool").
 * 3. Expand abbreviations (e.g., "bc" → "because").
 * 4. Normalize whitespace (collapse spaces, trim).
 *
 * Note: Punctuation marks are preserved exactly as-is. Case is preserved as-is.
 *
 * Input: FeedbackInput with rawText.
 * Output: String cleaned and ready for model tokenization.
 *
 * Thesis Mapping:
 * - Module 2 (Preprocessing) from algorithm.pseudo.
 * - Supports downstream Module 3 (ExtractPID) by normalizing language variation.
 *
 * Line mapping: algorithm.pseudo line 9: "clean_text = Preprocess(feedback)"
 */
export function Preprocess(feedback: FeedbackInput): string {
  console.debug("[preprocess] INPUT BOUNDARY: Received feedback", {
    feedbackId: feedback.id,
    rawLength: feedback.rawText.length,
    sample: feedback.rawText.substring(0, 50),
  });

  // Step 1: Remove URLs, tags, hashtags, emojis.
  const afterNoiseRemoval = removeNoise(feedback.rawText);
  console.debug("[preprocess] After noise removal", {
    newLength: afterNoiseRemoval.length,
  });

  // Step 2: Normalize vowel/consonant repetitions.
  const afterVowelNormalization = normalizeVowels(afterNoiseRemoval);
  console.debug("[preprocess] After vowel/consonant normalization", {
    newLength: afterVowelNormalization.length,
  });

  // Step 3: Expand abbreviations.
  const afterAbbreviationExpansion = expandAbbreviations(afterVowelNormalization);
  console.debug("[preprocess] After abbreviation expansion", {
    newLength: afterAbbreviationExpansion.length,
  });

  // Step 4: Normalize whitespace.
  const cleanedText = normalizeWhitespace(afterAbbreviationExpansion);
  console.debug("[preprocess] OUTPUT BOUNDARY: Preprocessing complete", {
    cleanedLength: cleanedText.length,
    sample: cleanedText.substring(0, 50),
  });

  return cleanedText;
}
