"""
normalizer.py — Unicode / homoglyph normalization utilities.

Strategy:
  1. NFKD decomposition: breaks composed characters into base + combining marks
     (e.g. 'é' → 'e' + combining acute accent, fullwidth 'Ａ' → 'A').
  2. Strip combining diacritics (Unicode category "Mn").
  3. Encode to ASCII with errors="ignore" to drop anything that doesn't map —
     this catches Cyrillic look-alikes, Greek homoglyphs, etc.
"""

import unicodedata


def normalize_text(text: str) -> str:
    """
    Normalize *text* to plain ASCII, stripping unicode obfuscation.

    Examples
    --------
    >>> normalize_text("Ｈеllo Wörld!")   # fullwidth H + Cyrillic е
    'Hllo Wrld!'
    >>> normalize_text("𝕳𝖊𝖑𝖑𝖔")         # mathematical bold-fraktur
    'Hello'
    """
    # Step 1: NFKD — compatibility decomposition
    decomposed = unicodedata.normalize("NFKD", text)

    # Step 2: Drop combining characters (diacritics, accent marks, etc.)
    stripped = "".join(
        ch for ch in decomposed if unicodedata.category(ch) != "Mn"
    )

    # Step 3: Encode to ASCII, silently drop everything that doesn't map
    ascii_bytes = stripped.encode("ascii", errors="ignore")
    return ascii_bytes.decode("ascii")


def normalize_name(name: str) -> str:
    """
    Normalize a *name* for impersonation comparison.

    Same pipeline as `normalize_text` but also lowercases and strips
    leading/trailing whitespace so comparison is case-insensitive.
    """
    return normalize_text(name).lower().strip()
