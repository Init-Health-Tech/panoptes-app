"""Tests for RFID EPC hex / ASCII normalization."""

from django.test import TestCase

from inventory.rfid_code import (
    RfidCodeError,
    ascii_to_hex_epc,
    hex_to_ascii_epc,
    is_hex_epc,
    normalize_rfid_code,
    rfid_code_variants,
    validate_rfid_code,
)


class RfidCodeTests(TestCase):
    HEX_SAMPLE = "4142434445464748494A4B4C"  # ABCDEFGHIJKL
    SHORT_ASCII = "ABC"
    SHORT_HEX = "414243202020202020202020"  # ABC + 9 spaces

    def test_is_hex_epc(self):
        self.assertTrue(is_hex_epc(self.HEX_SAMPLE))
        self.assertTrue(is_hex_epc(self.HEX_SAMPLE.lower()))
        self.assertFalse(is_hex_epc("EPC-001"))
        self.assertFalse(is_hex_epc("abc"))

    def test_hex_ascii_roundtrip(self):
        ascii_form = hex_to_ascii_epc(self.HEX_SAMPLE)
        self.assertIsNotNone(ascii_form)
        self.assertEqual(len(ascii_form), 12)
        self.assertEqual(ascii_to_hex_epc(ascii_form), self.HEX_SAMPLE)

    def test_ascii_shorter_pads_with_spaces(self):
        self.assertEqual(ascii_to_hex_epc(self.SHORT_ASCII), self.SHORT_HEX)
        self.assertEqual(normalize_rfid_code(self.SHORT_ASCII), self.SHORT_HEX)
        self.assertEqual(
            hex_to_ascii_epc(self.SHORT_HEX, strip_padding=True),
            self.SHORT_ASCII,
        )
        self.assertEqual(hex_to_ascii_epc(self.SHORT_HEX), self.SHORT_ASCII.ljust(12, " "))

    def test_normalize_from_hex(self):
        self.assertEqual(normalize_rfid_code(self.HEX_SAMPLE), self.HEX_SAMPLE)

    def test_normalize_from_ascii(self):
        ascii_form = hex_to_ascii_epc(self.HEX_SAMPLE, strip_padding=True)
        self.assertEqual(normalize_rfid_code(ascii_form), self.HEX_SAMPLE)

    def test_variants_include_both(self):
        ascii_form = hex_to_ascii_epc(self.HEX_SAMPLE, strip_padding=True)
        variants = rfid_code_variants(self.HEX_SAMPLE)
        self.assertIn(self.HEX_SAMPLE, variants)
        self.assertIn(ascii_form, variants)

    def test_legacy_non_strict(self):
        legacy = "INST-DEMO-SCOPE-01"
        self.assertEqual(normalize_rfid_code(legacy, strict=False), legacy)

    def test_strict_rejects_legacy(self):
        with self.assertRaises(RfidCodeError):
            validate_rfid_code("INST-DEMO-SCOPE-01", strict=True)
