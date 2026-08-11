// Module 2: Preprocessing
// Normalizes feedback text for model tokenization.

import feedbackLexicon from "./data/feedback-lexicon.json";
import type { FeedbackInput } from "./types";

const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi; // URL pattern: matches http://, https://, www., and domain-like patterns.
const TAG_PATTERN = /@\w+/g;                     // Mention/tag pattern: matches @username or similar tags.
const HASHTAG_PATTERN = /#\w+/g;                 // Hashtag pattern: matches #hashtag.

// Emoji pattern: matches unicode emoji sequences.
const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{2300}-\u{23FF}]|[\u{2000}-\u{206F}]/gu;

// Pattern to detect letters repeated 3 or more times.
const REPETITION_PATTERN = /([a-zA-Z])\1{2,}/g;

const ABBREVIATION_MAP = feedbackLexicon.abbreviations as Record<string, string>;

// Precomputed lowercase key → expansion, so each token is a single O(1) map hit.
const ABBREVIATION_LOOKUP = new Map(
  Object.entries(ABBREVIATION_MAP).map(([abbrev, fullWord]) => [abbrev.toLowerCase(), fullWord]),
);

// Strips URLs, tags, hashtags, and emojis.
function removeNoise(text: string): string {
  let cleaned = text;

  cleaned = cleaned.replace(URL_PATTERN, "");
  cleaned = cleaned.replace(TAG_PATTERN, "");
  cleaned = cleaned.replace(HASHTAG_PATTERN, "");
  cleaned = cleaned.replace(EMOJI_PATTERN, "");

  return cleaned;
}

const seedVocabulary = new Set<string>(feedbackLexicon.seed_vocabulary as string[]);

function isValidWord(word: string): boolean {
  return seedVocabulary.has(word.toLowerCase());
}

// Reduces repeated letters (e.g., "yessss" → "yes") using vocabulary lookup.
function normalizeVowels(text: string): string {
  return text.replace(REPETITION_PATTERN, (match, letter, offset, fullString) => {
    const singleCharVersion = letter;
    const doubleCharVersion = letter + letter;

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

    // All letters share one lookup path — "o"/"e" are not special-cased, so a
    // double-letter candidate must be a real word to be kept (e.g. "heey" → "hey").
    if (isValidWord(doubleLetterWord)) {
      return doubleCharVersion;
    }

    return singleCharVersion;
  });
}

// Splits a token into leading punctuation, the core word, and trailing
// punctuation. Matching stays word-bounded (no partial-word hits) while
// punctuation attached to a token (e.g. "pls,") does not block expansion.
function splitAttachedPunctuation(token: string): {
  core: string;
  leading: string;
  trailing: string;
} {
  let start = 0;
  while (start < token.length && !/\w/.test(token[start])) {
    start++;
  }
  let end = token.length;
  while (end > start && !/\w/.test(token[end - 1])) {
    end--;
  }
  return {
    core: token.slice(start, end),
    leading: token.slice(0, start),
    trailing: token.slice(end),
  };
}

// Single-pass expansion: the text is tokenized once on whitespace (O(n)) and
// each token is looked up case-insensitively in ABBREVIATION_LOOKUP, instead of
// running one regex pass per dictionary entry. Whitespace is preserved verbatim.
function expandAbbreviations(text: string): string {
  return text
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s+$/.test(chunk)) {
        return chunk;
      }

      const { core, leading, trailing } = splitAttachedPunctuation(chunk);
      const fullWord = ABBREVIATION_LOOKUP.get(core.toLowerCase());
      if (fullWord === undefined) {
        return chunk;
      }

      return leading + fullWord + trailing;
    })
    .join("");
}

function normalizeWhitespace(text: string): string {
  let normalized = text.replace(/\s+/g, " ");
  normalized = normalized.trim();

  return normalized;
}

export function Preprocess(feedback: FeedbackInput): string {
  console.debug("[preprocess] INPUT BOUNDARY: Received feedback", {
    feedbackId: feedback.id,
    rawLength: feedback.rawText.length,
    sample: feedback.rawText.substring(0, 50),
  });

  const afterNoiseRemoval = removeNoise(feedback.rawText);
  console.debug("[preprocess] After noise removal", {
    newLength: afterNoiseRemoval.length,
  });

  const afterVowelNormalization = normalizeVowels(afterNoiseRemoval);
  console.debug("[preprocess] After vowel/consonant normalization", {
    newLength: afterVowelNormalization.length,
  });

  const afterAbbreviationExpansion = expandAbbreviations(afterVowelNormalization);
  console.debug("[preprocess] After abbreviation expansion", {
    newLength: afterAbbreviationExpansion.length,
  });

  const cleanedText = normalizeWhitespace(afterAbbreviationExpansion);
  console.debug("[preprocess] OUTPUT BOUNDARY: Preprocessing complete", {
    cleanedLength: cleanedText.length,
    sample: cleanedText.substring(0, 50),
  });

  return cleanedText;
}
