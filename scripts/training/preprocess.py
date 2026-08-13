"""
Preprocessing module (Python implementation of src/lib/algorithm/preprocess.ts)
Maintains 1:1 preprocessing parity between Python training loader and TS runtime adapter.
"""

import json
import re
from pathlib import Path

LEXICON_PATH = Path(__file__).resolve().parents[2] / "src" / "lib" / "algorithm" / "data" / "feedback-lexicon.json"

with LEXICON_PATH.open(encoding="utf-8") as handle:
    _LEXICON_DATA = json.load(handle)

# URL pattern: matches http://, https://, www., and domain-like patterns.
URL_PATTERN = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
# Mention/tag pattern: matches @username or similar tags.
TAG_PATTERN = re.compile(r"@\w+")
# Hashtag pattern: matches #hashtag.
HASHTAG_PATTERN = re.compile(r"#\w+")
# Emoji pattern: matches unicode emoji sequences.
EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001F9FF]|[\u2600-\u27BF]|[\U0001F000-\U0001F02F]|[\U0001F0A0-\U0001F0FF]|[\u2300-\u23FF]|[\u2000-\u206F]"
)

# Pattern to detect letters repeated 3 or more times.
REPETITION_PATTERN = re.compile(r"([a-zA-Z])\1{2,}")

# Extracted from common feedback patterns in educational contexts (English + Tagalog/Taglish).
ABBREVIATION_MAP = _LEXICON_DATA["abbreviations"]
ABBREVIATION_LOOKUP = {k.lower(): v for k, v in ABBREVIATION_MAP.items()}

# Double-letter vocabulary consulted by normalize_vowels to decide whether a
# repeated run collapses to one copy or keeps two.
SEED_VOCABULARY = set(_LEXICON_DATA["seed_vocabulary"])


def is_valid_word(word: str) -> bool:
    return word.lower() in SEED_VOCABULARY


def remove_noise(text: str) -> str:
    """Strips URLs, tags, hashtags, and emojis."""
    cleaned = URL_PATTERN.sub("", text)
    cleaned = TAG_PATTERN.sub("", cleaned)
    cleaned = HASHTAG_PATTERN.sub("", cleaned)
    cleaned = EMOJI_PATTERN.sub("", cleaned)
    return cleaned


def normalize_vowels(text: str) -> str:
    """Reduces repeated letters (e.g., 'yessss' -> 'yes') using vocabulary lookup."""

    def replace_match(match: re.Match) -> str:
        letter = match.group(1)
        offset = match.start()
        match_len = len(match.group(0))
        single_char_version = letter
        double_char_version = letter + letter

        # Find word boundaries around the match
        word_start = offset
        while word_start > 0 and (text[word_start - 1].isalnum() or text[word_start - 1] == "_"):
            word_start -= 1
        word_end = offset + match_len
        while word_end < len(text) and (text[word_end].isalnum() or text[word_end] == "_"):
            word_end += 1

        original_word = text[word_start:word_end]
        double_letter_word = (
            original_word[: offset - word_start]
            + double_char_version
            + original_word[offset + match_len - word_start :]
        ).lower()

        if is_valid_word(double_letter_word):
            return double_char_version

        return single_char_version

    return REPETITION_PATTERN.sub(replace_match, text)


def split_attached_punctuation(token: str):
    """Splits token into leading punctuation, core word, and trailing punctuation."""
    start = 0
    while start < len(token) and not (token[start].isalnum() or token[start] == "_"):
        start += 1
    end = len(token)
    while end > start and not (token[end - 1].isalnum() or token[end - 1] == "_"):
        end -= 1
    return token[:start], token[start:end], token[end:]


def expand_abbreviations(text: str) -> str:
    """Expands common abbreviations to full words using word-boundary single-pass tokenization."""
    chunks = re.split(r"(\s+)", text)
    result = []
    for chunk in chunks:
        if not chunk:
            continue
        if re.match(r"^\s+$", chunk):
            result.append(chunk)
            continue

        leading, core, trailing = split_attached_punctuation(chunk)
        full_word = ABBREVIATION_LOOKUP.get(core.lower())
        if full_word is None:
            result.append(chunk)
        else:
            result.append(leading + full_word + trailing)
    return "".join(result)


def normalize_whitespace(text: str) -> str:
    """Collapses whitespace and trims."""
    return re.sub(r"\s+", " ", text).strip()


def preprocess(text: str) -> str:
    """
    Cleans feedback text: removes noise, normalizes repetitions,
    expands abbreviations, trims whitespace.
    """
    if not isinstance(text, str):
        return ""
    after_noise = remove_noise(text)
    after_vowels = normalize_vowels(after_noise)
    after_abbrev = expand_abbreviations(after_vowels)
    cleaned = normalize_whitespace(after_abbrev)
    return cleaned
