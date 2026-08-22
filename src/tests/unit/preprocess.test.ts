/*
 * Unit tests for Module 2: Preprocessing.
 * Validates that vowel normalization, noise removal, abbreviation expansion,
 * and whitespace normalization work correctly in isolation and in combination
 * (CleanFeedback), plus tokenization/numerical encoding (EncodeFeedback).
 */

import { describe, it, expect } from "vitest";
import {
  CleanFeedback,
  EncodeFeedback,
  MAX_SEQ_LEN,
  Preprocess,
  type MachineTokenizer,
} from "../../lib/algorithm/preprocess";

/**
 * Deterministic char-level stub: ids start at 101, the attention mask marks
 * content positions, and the tail is zero-padding.
 */
function createStubTokenizer(): MachineTokenizer {
  return (text: string, opts: Record<string, unknown> = {}) => {
    const maxLength = typeof opts.max_length === "number" ? opts.max_length : MAX_SEQ_LEN;
    const contentLen = Math.min(text.length, maxLength);
    const ids: number[] = new Array(maxLength).fill(0);
    const mask: number[] = new Array(maxLength).fill(0);
    for (let i = 0; i < contentLen; i++) {
      ids[i] = i + 101;
      mask[i] = 1;
    }
    return { input_ids: { data: ids }, attention_mask: { data: mask } };
  };
}

describe("CleanFeedback (Module 2: Preprocessing — Text Cleaning)", () => {
  describe("Vowel Normalization", () => {
    it("should reduce repeated vowels to single occurrence", () => {
      const input = { id: "test-1", rawText: "yessss" };
      const result = CleanFeedback(input);
      expect(result).toBe("yes");
    });

    it("should handle multiple repeated vowels in one word", () => {
      const input = { id: "test-2", rawText: "cooooool" };
      const result = CleanFeedback(input);
      expect(result).toBe("cool");
    });

    it("should handle mixed repeated vowels", () => {
      const input = { id: "test-3", rawText: "heeeey" };
      const result = CleanFeedback(input);
      // "heey" is not a dictionary word, so the fixed normalizeVowels collapses
      // the repetition to a single "e" ("hey") instead of keeping two.
      expect(result).toBe("hey");
    });

    it("should preserve normal vowel usage", () => {
      const input = { id: "test-4", rawText: "beautiful education" };
      const result = CleanFeedback(input);
      expect(result).toBe("beautiful education");
    });

    it("should handle vocabulary words with natural double-vowels", () => {
      const input = { id: "test-4b", rawText: "seeeee" };
      const result = CleanFeedback(input);
      expect(result).toBe("see");
    });

    it("should handle Tagalog words in vocabulary", () => {
      const input = { id: "test-4c", rawText: "nooooon" };
      const result = CleanFeedback(input);
      expect(result).toBe("noon");
    });
  });

  describe("Noise Removal", () => {
    it("should remove URLs (http/https)", () => {
      const input = {
        id: "test-5",
        rawText: "Check this https://example.com for more info",
      };
      const result = CleanFeedback(input);
      expect(result).not.toContain("https://example.com");
      expect(result).toContain("Check this for more info");
    });

    it("should remove www links", () => {
      const input = {
        id: "test-6",
        rawText: "Visit www.awesome.org now",
      };
      const result = CleanFeedback(input);
      expect(result).not.toContain("www.awesome.org");
      expect(result).toContain("Visit now");
    });

    it("should remove @mentions", () => {
      const input = {
        id: "test-7",
        rawText: "@professor @student Great work!",
      };
      const result = CleanFeedback(input);
      expect(result).not.toContain("@professor");
      expect(result).not.toContain("@student");
      expect(result).toContain("Great work!");
    });

    it("should remove hashtags", () => {
      const input = {
        id: "test-8",
        rawText: "I love #learning #python #coding",
      };
      const result = CleanFeedback(input);
      expect(result).not.toContain("#learning");
      expect(result).not.toContain("#python");
      expect(result).toContain("I love");
    });

    it("should remove emojis", () => {
      const input = {
        id: "test-9",
        rawText: "Great lecture! 😄 Amazing! 👏",
      };
      const result = CleanFeedback(input);
      expect(result).not.toContain("😄");
      expect(result).not.toContain("👏");
      expect(result).toContain("Great lecture! Amazing!");
    });
  });

  describe("Abbreviation Expansion", () => {
    it("should expand 'bc' to 'because'", () => {
      const input = {
        id: "test-10",
        rawText: "Too fast bc students are confused",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("because");
      expect(result).not.toContain(" bc ");
    });

    it("should expand 'pls' to 'please'", () => {
      const input = {
        id: "test-11",
        rawText: "pls slow down",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("please");
    });

    it("should expand 'proj' to 'project'", () => {
      const input = {
        id: "test-12",
        rawText: "your proj is cooool",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("project");
    });

    it("should be case-insensitive", () => {
      const input = {
        id: "test-13",
        rawText: "BC the pacing is too fast",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("because");
    });

    it("should not expand abbreviations within words", () => {
      // "projection" contains "proj" but should not be expanded (word boundary).
      const input = {
        id: "test-14",
        rawText: "the projection is clear",
      };
      const result = CleanFeedback(input);
      // Should still be "projection", not "projecttion".
      expect(result).toContain("projection");
    });

    it("should expand educational abbreviations", () => {
      const input = {
        id: "test-15",
        rawText: "The ilo for rbt is important",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("intended learning outcome");
      expect(result).toContain("revised bloom taxonomy");
    });
  });

  describe("Whitespace Normalization", () => {
    it("should collapse multiple spaces", () => {
      const input = {
        id: "test-16",
        rawText: "too    many     spaces",
      };
      const result = CleanFeedback(input);
      expect(result).not.toContain("    ");
      expect(result).toContain("too many spaces");
    });

    it("should trim leading/trailing whitespace", () => {
      const input = {
        id: "test-17",
        rawText: "   leading and trailing spaces   ",
      };
      const result = CleanFeedback(input);
      expect(result).toBe(result.trim());
      expect(result).toBe("leading and trailing spaces");
    });

    it("should handle tabs and newlines", () => {
      const input = {
        id: "test-18",
        rawText: "line one\n\tline two",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("line one line two");
    });

    it("should preserve punctuation exactly as-is", () => {
      const input = {
        id: "test-19",
        rawText: "Hello   ,   world   !   How   ?",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("Hello , world ! How ?");
    });

    it("should preserve multiple punctuation marks", () => {
      const input = {
        id: "test-19b",
        rawText: "thanks!!  yessss!!!  what???",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("thanks!! yes!!! what???");
    });
  });

  describe("Case Preservation", () => {
    it("should preserve case as-is", () => {
      const input = {
        id: "test-20",
        rawText: "UPPERCASE and MixedCase text",
      };
      const result = CleanFeedback(input);
      expect(result).toBe("UPPERCASE and MixedCase text");
    });
  });

  describe("Complex End-to-End Examples", () => {
    it("should handle Example 1: vowel normalization + abbreviation", () => {
      const input = {
        id: "test-21",
        rawText: "yessssss bc the pacing is too fast!!!",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("yes");
      expect(result).toContain("because");
      expect(result).toContain("pacing");
    });

    it("should handle Example 2: emoji + tag + URL", () => {
      const input = {
        id: "test-22",
        rawText: "@prof Great lecture! 😄 Check https://example.com #learning",
      };
      const result = CleanFeedback(input);
      expect(result).not.toContain("@prof");
      expect(result).not.toContain("😄");
      expect(result).not.toContain("https://example.com");
      expect(result).not.toContain("#learning");
      expect(result).toContain("Great lecture");
    });

    it("should handle Example 3: mixed complexity", () => {
      const input = {
        id: "test-23",
        rawText: "yessss @student ur proj is cooool! ilu 😍 See www.awesome.org #best thx!",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("yes");
      expect(result).not.toContain("@student");
      expect(result).toContain("your");
      expect(result).toContain("project");
      expect(result).toContain("cool");
      expect(result).not.toContain("😍");
      expect(result).not.toContain("www.awesome.org");
      expect(result).not.toContain("#best");
      expect(result).toContain("thanks");
    });

    it("should handle empty or minimal input", () => {
      const input = {
        id: "test-24",
        rawText: "   ",
      };
      const result = CleanFeedback(input);
      expect(result).toBe("");
    });

    it("should preserve semantic meaning", () => {
      const input = {
        id: "test-25",
        rawText: "The content is too fast bc students can't keep up!!!",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("content");
      expect(result).toContain("too");
      expect(result).toContain("fast");
      expect(result).toContain("because");
      expect(result).toContain("students");
      expect(result).toContain("keep");
    });
  });

  describe("Unicode and Special Cases", () => {
    it("should handle unicode characters", () => {
      const input = {
        id: "test-26",
        rawText: "Très bien! 很好! Excellente! 🎉",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("Très");
      expect(result).toContain("bien!");
      expect(result).not.toContain("🎉");
    });

    it("should handle numbers", () => {
      const input = {
        id: "test-27",
        rawText: "There are 123 students in class 2024",
      };
      const result = CleanFeedback(input);
      expect(result).toContain("123");
      expect(result).toContain("2024");
    });

    it("should handle already clean input", () => {
      const input = {
        id: "test-28",
        rawText: "this feedback is already clean and well formatted",
      };
      const result = CleanFeedback(input);
      expect(result).toBe("this feedback is already clean and well formatted");
    });
  });

  it("accepts a plain string as input", () => {
    expect(CleanFeedback("yessss bc")).toBe("yes because");
  });
});

describe("EncodeFeedback (Module 2: Preprocessing — Tokenization & Encoding)", () => {
  it("produces fixed-length numerical sequences padded to MAX_SEQ_LEN", () => {
    const encoding = EncodeFeedback("hello world", createStubTokenizer());
    expect(encoding.inputIds).toBeInstanceOf(BigInt64Array);
    expect(encoding.attentionMask).toBeInstanceOf(BigInt64Array);
    expect(encoding.inputIds.length).toBe(MAX_SEQ_LEN);
    expect(encoding.attentionMask.length).toBe(MAX_SEQ_LEN);
    expect(encoding.inputIds[0]).toBe(101n);
    expect(encoding.attentionMask[0]).toBe(1n);
    expect(encoding.attentionMask[MAX_SEQ_LEN - 1]).toBe(0n); // padded tail
  });

  it("honors a custom max_length (truncation window)", () => {
    const encoding = EncodeFeedback("abcdef", createStubTokenizer(), 8);
    expect(encoding.inputIds.length).toBe(8);
    expect(encoding.inputIds[7]).toBe(0n); // content truncated before position 8
  });

  it("encodes empty text into an all-padding sequence", () => {
    const encoding = EncodeFeedback("", createStubTokenizer());
    expect([...encoding.attentionMask].every((m) => m === 0n)).toBe(true);
  });

  it("normalizes plain-number tokenizer output into BigInt64Array", () => {
    // The stub emits number[] — conversion must not throw
    // ("Cannot convert a number to a BigInt").
    const encoding = EncodeFeedback("safe", createStubTokenizer(), 4);
    expect(typeof encoding.inputIds[0]).toBe("bigint");
    expect(encoding.attentionMask[0]).toBe(1n);
  });
});

describe("Preprocess (Module 2 pipeline)", () => {
  it("cleans, tokenizes, and encodes in one pass", () => {
    const result = Preprocess({ id: "p1", rawText: "yessss bc" }, createStubTokenizer());
    expect(result.cleanedText).toBe("yes because");
    expect(result.encoding?.inputIds.length).toBe(MAX_SEQ_LEN);
    expect(result.encoding?.attentionMask.length).toBe(MAX_SEQ_LEN);
    // Deterministic stub: "yes because" is 11 chars of content.
    expect([...result.encoding!.attentionMask].filter((m) => m === 1n)).toHaveLength(11);
  });

  it("produces encodings matching the Module 3 contract shape", () => {
    const result = Preprocess({ id: "p2", rawText: "hello" }, createStubTokenizer());
    expect(result.encoding).toBeInstanceOf(Object);
    expect(result.encoding!.inputIds).toBeInstanceOf(BigInt64Array);
  });
});
