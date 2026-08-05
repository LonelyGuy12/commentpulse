# main.py — CommentPulse Threat Engine (FastAPI)
#
# POST /analyze
#   Body:    { "comment_text": "...", "author_name": "...", "creator_name": "..." }
#   Returns: { "risk_score": int, "is_impersonator": bool,
#              "normalized_text": str, "flags": [...], "llm_reasoning": str | null }
#
# Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000

import os
import re
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from normalizer import normalize_text
from scorer import score_impersonation
from llm_scorer import llm_analyze, format_llm_flags

load_dotenv()

LLM_TRIGGER_SCORE: int = int(os.getenv("LLM_TRIGGER_SCORE", "15"))

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CommentPulse Threat Engine",
    description="YouTube comment threat analysis — deterministic + LLM (Groq).",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    comment_text: str = Field(..., description="Raw comment text from YouTube")
    author_name: str = Field(..., description="Display name of the commenter")
    creator_name: str = Field(..., description="Display name of the channel owner")


class AnalyzeResponse(BaseModel):
    risk_score: int = Field(..., ge=0, le=100, description="Composite risk score 0-100")
    is_impersonator: bool = Field(..., description="True if author is likely impersonating the creator")
    normalized_text: str = Field(..., description="Comment text after unicode normalization")
    flags: list[str] = Field(default_factory=list, description="Human-readable flag reasons")
    llm_reasoning: str | None = Field(None, description="One-sentence LLM explanation (null if skipped)")


# ---------------------------------------------------------------------------
# Deterministic body scanner
# ---------------------------------------------------------------------------

_BODY_PATTERNS = [
    # (dot) / [dot] obfuscated URLs
    re.compile(r"\b\w+\s*[\(\[]\s*dot\s*[\)\]]\s*\w+", re.IGNORECASE),
    # Suspicious TLDs
    re.compile(r"https?://\S+\.(xyz|tk|ml|ga|cf|gq|bit\.ly)\b", re.IGNORECASE),
    # Telegram / WhatsApp lures
    re.compile(r"(t\.me|telegram\.me|wa\.me)/\S+", re.IGNORECASE),
    # Giveaway / crypto scam keywords
    re.compile(
        r"\b(free\s+crypto|double\s+your\s+bitcoin|send\s+\d+\s*(btc|eth|usdt)|"
        r"click\s+below|link\s+in\s+bio|dm\s+me|whatsapp\s+me|i\s+was\s+scammed)\b",
        re.IGNORECASE,
    ),
]


_BANNED_WORDS_SEVERE = [
    # Targeted / directed severe abuse — score 100
    r"\b(kill yourself|kys|go die|end your life|kill urself)\b",
    r"\b(cunt|n[i1]gg[ae]r)\b",
    r"\b(fuck\s+you|fuk\s+u|f\*ck\s+you)\b",
    r"\b(you('re|\s+are)\s+(an?\s+)?(idiot|moron|retard|dumbass|imbecile))\b",
    r"\b(asshole|a[\*@]shole|a55hole)\b",
    r"\b(bitch\s+ass|dumb\s*ass|dumb\s*fuck)\b",
]

_BANNED_WORDS_MODERATE = [
    # Common strong profanity — score 60 (still flagged, but less severe)
    r"\bfuck\b",
    r"\bshit\b",
    r"\bbitch\b",
    r"\bdamn\b",
    r"\bcrappy\b",
    r"\bpiss\s+off\b",
    r"\bscrew\s+you\b",
    r"\bmoron\b",
    r"\bidiot\b",
    r"\bdumbass\b",
    r"\bstupid\s+ass\b",
]

_BANNED_SEVERE_PATTERNS  = [re.compile(p, re.IGNORECASE) for p in _BANNED_WORDS_SEVERE]
_BANNED_MODERATE_PATTERNS = [re.compile(p, re.IGNORECASE) for p in _BANNED_WORDS_MODERATE]

def _scan_body(text: str) -> list[str]:
    flags = []
    for pattern in _BODY_PATTERNS:
        if pattern.search(text):
            flags.append("Obfuscated Link Detected")
            break

    for pattern in _BANNED_SEVERE_PATTERNS:
        if pattern.search(text):
            flags.append("Severe Abuse")
            break

    if "Severe Abuse" not in flags:
        for pattern in _BANNED_MODERATE_PATTERNS:
            if pattern.search(text):
                flags.append("Abusive Language")
                break

    return flags


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health_check():
    """Health probe — also reports whether LLM is configured."""
    return {
        "status": "ok",
        "service": "threat-engine",
        "llm_enabled": bool(os.getenv("OPENAI_API_KEY")),
        "llm_model": os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"),
        "llm_trigger_score": LLM_TRIGGER_SCORE,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """
    Two-stage threat analysis pipeline.

    Stage 1 — Deterministic (always runs, zero latency)
      a. Unicode / homoglyph normalization (unicodedata NFKD)
      b. Levenshtein impersonation scoring on normalized names
      c. Regex body scan — obfuscated links, crypto scam keywords

    Stage 2 — LLM semantic pass via Groq (llama-3.3-70b-versatile)
      Only triggered when Stage 1 risk_score >= LLM_TRIGGER_SCORE (default 15).
      This catches contextually subtle threats the regex can't see:
        "My friend got $500 from this guy's giveaway, DM him quick!"
      Blended score = 60% deterministic + 40% LLM (capped at 100).
    """
    # ── Stage 1: Deterministic ─────────────────────────────────────────
    normalized_text = normalize_text(req.comment_text)
    imp_score, is_impersonator, imp_flags = score_impersonation(req.author_name, req.creator_name)
    body_flags = _scan_body(normalized_text)

    all_flags = imp_flags + body_flags
    
    body_bonus = 0
    if "Severe Abuse" in body_flags:
        body_bonus = 100
    elif "Abusive Language" in body_flags:
        body_bonus = 60
    elif "Obfuscated Link Detected" in body_flags:
        body_bonus = 40

    det_score = min(100, imp_score + body_bonus)

    if det_score >= 85 and not is_impersonator and body_flags:
        is_impersonator = True

    llm_reasoning: str | None = None

    # ── Stage 2: LLM pass ──────────────────────────────────────────────
    if det_score >= LLM_TRIGGER_SCORE:
        llm = llm_analyze(normalized_text, req.author_name, req.creator_name)

        if llm is not None:
            # Blend: 60% deterministic, 40% LLM
            blended = min(100, round(det_score * 0.6 + llm.threat_score * 0.4))
            
            # Never let the LLM lower the score for confirmed abusive language
            if "Abusive Language" in body_flags:
                det_score = max(blended, 70)
            else:
                det_score = blended

            # Merge category flags (deduplicated, order preserved)
            llm_flags = format_llm_flags(llm)
            reasoning_flags = [f for f in llm_flags if f.startswith("LLM reasoning:")]
            category_flags  = [f for f in llm_flags if not f.startswith("LLM reasoning:")]
            all_flags = list(dict.fromkeys(all_flags + category_flags))

            llm_reasoning = (
                reasoning_flags[0].replace('LLM reasoning: "', "").rstrip('"')
                if reasoning_flags else llm.reasoning
            )

            # LLM can promote impersonator flag even if Levenshtein missed it
            if llm.is_threat and not is_impersonator and "impersonation" in llm.categories:
                is_impersonator = True

    return AnalyzeResponse(
        risk_score=det_score,
        is_impersonator=is_impersonator,
        normalized_text=normalized_text,
        flags=all_flags,
        llm_reasoning=llm_reasoning,
    )
