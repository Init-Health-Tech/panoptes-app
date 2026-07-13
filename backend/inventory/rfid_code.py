"""RFID EPC helpers: 24-char hex or ASCII equivalent (≤12 chars, space-padded)."""

from __future__ import annotations

EPC_HEX_LENGTH = 24
EPC_ASCII_BYTE_LENGTH = 12  # 24 hex nibbles → 12 bytes


class RfidCodeError(ValueError):
    pass


def _hex_digits(value: str) -> str:
    return (value or "").strip().replace(" ", "").replace("-", "").upper()


def is_hex_epc(value: str) -> bool:
    s = _hex_digits(value)
    return len(s) == EPC_HEX_LENGTH and all(c in "0123456789ABCDEF" for c in s)


def _is_printable_ascii(value: str) -> bool:
    return value.isascii() and all(32 <= ord(c) <= 126 for c in value)


def hex_to_ascii_epc(hex_code: str, *, strip_padding: bool = False) -> str | None:
    """Decode 24-char hex EPC to its ASCII equivalent (12 chars), if printable."""
    hex_code = _hex_digits(hex_code)
    if not is_hex_epc(hex_code):
        return None
    try:
        raw = bytes.fromhex(hex_code)
    except ValueError:
        return None
    if len(raw) != EPC_ASCII_BYTE_LENGTH:
        return None
    try:
        ascii_str = raw.decode("ascii")
    except UnicodeDecodeError:
        return None
    if not _is_printable_ascii(ascii_str):
        return None
    return ascii_str.rstrip(" ") if strip_padding else ascii_str


def ascii_to_hex_epc(ascii_code: str) -> str | None:
    """
    Encode ASCII (1–12 chars) to 24-char hex EPC.

    Shorter strings are right-padded with spaces (0x20) so the EPC is always 24 hex chars.
    Strings with hyphens are rejected (legacy demo codes like EPC-1001).
    """
    s = (ascii_code or "").replace("\n", "").replace("\r", "")
    if not s or len(s) > EPC_ASCII_BYTE_LENGTH or "-" in s:
        return None
    if not _is_printable_ascii(s):
        return None
    padded = s.ljust(EPC_ASCII_BYTE_LENGTH, " ")
    return padded.encode("ascii").hex().upper()


def normalize_rfid_code(raw: str, *, strict: bool = True) -> str:
    """
    Return canonical uppercase 24-char hex EPC.

    Accepts either 24 hex characters or ASCII ≤12 chars (space-padded to 12 bytes).
    When strict=False, returns trimmed input unchanged if not EPC-shaped (legacy demo codes).
    """
    raw = raw or ""
    if not raw.strip():
        raise RfidCodeError("El código RFID es obligatorio.")

    if is_hex_epc(raw):
        return _hex_digits(raw)

    hex_from_ascii = ascii_to_hex_epc(raw)
    if hex_from_ascii:
        return hex_from_ascii

    legacy = raw.strip()
    if not strict:
        return legacy

    raise RfidCodeError(
        "El código RFID debe ser 24 caracteres hexadecimales (EPC) "
        "o su equivalente ASCII (hasta 12 caracteres; se rellena con espacios)."
    )


def rfid_code_variants(raw_or_canonical: str) -> list[str]:
    """All equivalent lookup keys for an EPC (hex + ASCII when applicable)."""
    try:
        canonical = normalize_rfid_code(raw_or_canonical, strict=False)
    except RfidCodeError:
        return [(raw_or_canonical or "").strip()]

    variants: list[str] = []

    def _add(value: str | None) -> None:
        if value and value not in variants:
            variants.append(value)

    if is_hex_epc(canonical):
        hex_code = _hex_digits(canonical)
        _add(hex_code)
        ascii_full = hex_to_ascii_epc(hex_code, strip_padding=False)
        ascii_strip = hex_to_ascii_epc(hex_code, strip_padding=True)
        _add(ascii_full)
        _add(ascii_strip)
    else:
        _add(canonical)
        hex_form = ascii_to_hex_epc(canonical)
        _add(hex_form)
        if hex_form:
            _add(hex_to_ascii_epc(hex_form, strip_padding=False))
            _add(hex_to_ascii_epc(hex_form, strip_padding=True))

    return variants


def validate_rfid_code(raw: str, *, strict: bool = True) -> str:
    """Validate and return canonical hex EPC (or legacy code if strict=False)."""
    return normalize_rfid_code(raw, strict=strict)


def find_rfid_tag_by_code(queryset, raw: str):
    """Resolve a tag by hex, ASCII equivalent, or exact legacy code."""
    stripped = (raw or "").strip()
    if not stripped:
        return None

    for variant in rfid_code_variants(raw):
        tag = queryset.filter(code=variant).first()
        if tag:
            return tag

    return queryset.filter(code=stripped).first()


def rfid_code_exists(queryset, raw: str) -> bool:
    """True if any variant of this EPC already exists in queryset."""
    if not (raw or "").strip():
        return False
    variants = rfid_code_variants(raw)
    return queryset.filter(code__in=variants).exists()
