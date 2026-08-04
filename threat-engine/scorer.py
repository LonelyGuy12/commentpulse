"""
scorer.py — Impersonation risk scoring using Levenshtein similarity.

Scoring rules
-------------
- Exact raw AND normalized match  →  score 0   (the actual creator commenting)
- Normalized similarity >= THRESHOLD  →  score = round(similarity * 100), is_impersonator=True
- Otherwise  →  score = round(similarity * 50)  (low-medium risk, not flagged)

The normalized comparison catches cases where the impersonator uses homoglyphs
in their username (e.g. "MrBe@st" → "mrbeast") to look like the creator.
"""

import os
import Levenshtein

from normalizer import normalize_name

# Default threshold; can be overridden via env
IMPERSONATION_THRESHOLD: float = float(
    os.getenv("IMPERSONATION_THRESHOLD", "0.85")
)

# Flags returned alongside a high risk score
FLAG_IMPERSONATION = "Impersonation Risk"
FLAG_OBFUSCATED_NAME = "Obfuscated Author Name"


def score_impersonation(
    author_name: str,
    creator_name: str,
) -> tuple[int, bool, list[str]]:
    """
    Compare *author_name* against *creator_name* and return a risk assessment.

    Returns
    -------
    (risk_score, is_impersonator, flags)
        risk_score     : int  — 0-100
        is_impersonator: bool
        flags          : list[str] — human-readable reasons
    """
    flags: list[str] = []

    norm_author = normalize_name(author_name)
    norm_creator = normalize_name(creator_name)

    # 1. Exact raw match → legitimate creator, no risk
    if author_name.strip() == creator_name.strip():
        return 0, False, []

    # 2. Compute similarity on the normalized forms
    similarity: float = Levenshtein.ratio(norm_author, norm_creator)

    # 3. Detect if obfuscation was involved (raw differs from normalized significantly)
    raw_similarity: float = Levenshtein.ratio(
        author_name.lower().strip(), creator_name.lower().strip()
    )
    if similarity > raw_similarity + 0.10:
        # Normalization improved the similarity → obfuscated characters were used
        flags.append(FLAG_OBFUSCATED_NAME)

    # 4. Apply threshold
    if similarity >= IMPERSONATION_THRESHOLD:
        flags.append(FLAG_IMPERSONATION)
        risk_score = min(100, round(similarity * 100))
        return risk_score, True, flags

    # 5. Below threshold — low-to-medium risk proportional score
    risk_score = round(similarity * 50)
    return risk_score, False, flags
