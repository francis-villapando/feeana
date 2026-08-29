// Module 2: Preprocessing
// Normalizes feedback text and converts it to tokenized machine encodings.

import feedbackLexicon from "./data/feedback-lexicon.json";
import type { FeedbackEncoding, FeedbackInput, PreprocessResult } from "./types";

const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi;
const TAG_PATTERN = /@\w+/g;
const HASHTAG_PATTERN = /#\w+/g;

// Emoji pattern: matches unicode emoji sequences.
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{2300}-\u{23FF}]|[\u{2000}-\u{206F}]/gu;

// Pattern to detect letters repeated 3 or more times.
const REPETITION_PATTERN = /([a-zA-Z])\1{2,}/g;

const ABBREVIATION_MAP: Record<string, string> = {
  ...(feedbackLexicon.abbreviated_slang as Record<string, string>),
  ...(feedbackLexicon.abbreviated_cs_terms as Record<string, string>),
};

// Precomputed lowercase key → expansion, so each token is a single O(1) map hit.
const ABBREVIATION_LOOKUP = new Map(
  Object.entries(ABBREVIATION_MAP).map(([abbrev, fullWord]) => [abbrev.toLowerCase(), fullWord]),
);

// Strips URLs, @mentions, #hashtags, and emojis.
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
// punctuation, so abbreviation matching stays word-bounded.
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

// Expands abbreviations to full words in a single whitespace pass (O(n)).
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

// Fixed sequence length the fine-tuned ONNX models were trained with.
export const MAX_SEQ_LEN = 256;

// Structural tokenizer interface decoupling preprocessing from HF runtime imports.
export interface MachineTokenizer {
  (
    text: string,
    options?: Record<string, unknown>,
  ): {
    input_ids?: { data?: ArrayLike<number | bigint> };
    attention_mask?: { data?: ArrayLike<number | bigint> };
  };
}

// Normalizes feedback text (noise removal, vowel reduction, abbreviation mapping, whitespace).
export function CleanFeedback(feedback: FeedbackInput | string): string {
  const rawText = typeof feedback === "string" ? feedback : feedback.rawText;

  const afterNoise = removeNoise(rawText);
  const afterVowels = normalizeVowels(afterNoise);
  const afterAbbrevs = expandAbbreviations(afterVowels);
  return normalizeWhitespace(afterAbbrevs);
}

// Converts cleaned text into fixed-length BigInt64Array tensor encodings.
export function EncodeFeedback(
  cleanedText: string,
  tokenizer: MachineTokenizer,
  maxLength: number = MAX_SEQ_LEN,
): FeedbackEncoding {
  const output = tokenizer(cleanedText, {
    padding: "max_length",
    truncation: true,
    max_length: maxLength,
    return_tensor: true,
  });

  const inputIdsData = output?.input_ids?.data;
  const attentionMaskData = output?.attention_mask?.data;

  if (!inputIdsData || !attentionMaskData) {
    throw new Error("[preprocess] Tokenizer returned invalid encoding output.");
  }

  const toBigInt64 = (data: ArrayLike<number | bigint>): BigInt64Array =>
    data instanceof BigInt64Array ? data : BigInt64Array.from(data, (v) => BigInt(v));

  return {
    inputIds: toBigInt64(inputIdsData),
    attentionMask: toBigInt64(attentionMaskData),
  };
}

// Module 2: Preprocessing --- algorithm.pseudo line 9
export function Preprocess(feedback: FeedbackInput, tokenizer: MachineTokenizer): PreprocessResult {
  console.debug("[preprocess] INPUT BOUNDARY: Received feedback", {
    feedbackId: feedback.id,
    rawLength: feedback.rawText.length,
    sample: feedback.rawText.substring(0, 50),
  });

  const cleanedText = CleanFeedback(feedback);
  const encoding = EncodeFeedback(cleanedText, tokenizer);

  console.debug("[preprocess] OUTPUT BOUNDARY: Preprocessing complete", {
    cleanedLength: cleanedText.length,
    hasEncoding: !!encoding,
    sample: cleanedText.substring(0, 50),
  });

  return { cleanedText, encoding };
}
