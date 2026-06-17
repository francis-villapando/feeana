// Module 2: Preprocessing
// Normalizes feedback text for model tokenization.

import type { FeedbackInput } from "./types";

const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi; // URL pattern: matches http://, https://, www., and domain-like patterns.
const TAG_PATTERN = /@\w+/g;                     // Mention/tag pattern: matches @username or similar tags.
const HASHTAG_PATTERN = /#\w+/g;                 // Hashtag pattern: matches #hashtag.

// Emoji pattern: matches unicode emoji sequences.
const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{2300}-\u{23FF}]|[\u{2000}-\u{206F}]/gu;

// Words with natural double-letters preserved during repetition reduction.
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

// Pattern to detect letters repeated 3 or more times.
const REPETITION_PATTERN = /([a-zA-Z])\1{2,}/g;

// Common abbreviations to full-word mappings.
// Extracted from common feedback patterns in educational contexts.
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

// Strips URLs, tags, hashtags, and emojis.
function removeNoise(text: string): string {
  let cleaned = text;

  cleaned = cleaned.replace(URL_PATTERN, "");
  cleaned = cleaned.replace(TAG_PATTERN, "");
  cleaned = cleaned.replace(HASHTAG_PATTERN, "");
  cleaned = cleaned.replace(EMOJI_PATTERN, "");

  return cleaned;
}

// Reduces repeated letters (e.g., "yessss" → "yes") using vocabulary lookup.
function normalizeVowels(text: string): string {
  return text.replace(REPETITION_PATTERN, (match, letter, offset, fullString) => {
    const lowerLetter = letter.toLowerCase();
    const singleCharVersion = letter;
    const doubleCharVersion = letter + letter;

    if (lowerLetter === "o" || lowerLetter === "e") {
      return doubleCharVersion;
    }

    let wordStart = offset;
    while (wordStart > 0 && /\w/.test(fullString[wordStart - 1])) {
      wordStart--;
    }
    let wordEnd = offset + match.length;
    while (wordEnd < fullString.length && /\w/.test(fullString[wordEnd])) {
      wordEnd++;
    }

    const originalWord = fullString.slice(wordStart, wordEnd);
    const doubleLetterWord = (
      originalWord.slice(0, offset - wordStart) +
      doubleCharVersion +
      originalWord.slice(offset + match.length - wordStart)
    ).toLowerCase();

    if (DOUBLE_LETTER_VOCABULARY.has(doubleLetterWord)) {
      return doubleCharVersion;
    }

    return singleCharVersion;
  });
}

// Expands common abbreviations to full words using word-boundary matching.
function expandAbbreviations(text: string): string {
  let expanded = text;

  for (const [abbrev, fullWord] of Object.entries(ABBREVIATION_MAP)) {
    const wordBoundaryPattern = new RegExp(`\\b${abbrev}\\b`, "gi");
    expanded = expanded.replace(wordBoundaryPattern, fullWord);
  }

  return expanded;
}

// Collapses whitespace and trims.
function normalizeWhitespace(text: string): string {
  let normalized = text.replace(/\s+/g, " ");
  normalized = normalized.trim();

  return normalized;
}

// Cleans feedback text: removes noise, normalizes repetitions, expands abbreviations, trims whitespace.
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
