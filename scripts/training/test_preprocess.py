"""
Unit tests for Python preprocessing logic to verify exact 1:1 parity with TS preprocess.ts.
"""

import unittest
from preprocess import preprocess

class TestPreprocess(unittest.TestCase):
    def test_noise_removal(self):
        text = "Check this http://example.com @user #feedback 😀 good!"
        expected = "Check this good!"
        self.assertEqual(preprocess(text), expected)

    def test_repetition_normalization(self):
        # 'soooo' becomes 'so' (soo not in vocab), 'coolll' becomes 'cool' (cool in vocab)
        self.assertEqual(preprocess("soooo coolll"), "so cool")
        self.assertEqual(preprocess("yessss!"), "yes!")
        # 'feel' and 'free' are in vocab
        self.assertEqual(preprocess("feeeeel freeeee"), "feel free")

    def test_double_letter_vocab(self):
        # 'good' is in double-letter vocab
        self.assertEqual(preprocess("goooood job"), "good job")
        # 'taas' is in vocab (tested on 'taaas')
        self.assertEqual(preprocess("taaas"), "taas")

    def test_abbreviation_expansion(self):
        self.assertEqual(
            preprocess("pls complete the proj asap"),
            "please complete the project as soon as possible",
        )
        self.assertEqual(
            preprocess("the ass was hard bc of math"),
            "the assignment was hard because of math",
        )

    def test_combined(self):
        text = "pls check https://link.com @prof #hw - sooooo hard bc the ass is confusing!!!"
        expected = "please check - so hard because the assignment is confusing!!!"
        self.assertEqual(preprocess(text), expected)

if __name__ == "__main__":
    unittest.main()
