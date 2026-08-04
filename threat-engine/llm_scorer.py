"""
llm_scorer.py — LLM-based semantic threat analysis using Groq via the OpenAI SDK.

This is the second-pass scorer. It only runs when the deterministic
checks (Levenshtein + regex) produce a non-zero risk signal, so we
don't burn API quota on clearly benign comments.

The LLM classifies the comment into one or more threat categories and
returns a structured JSON confidence score (0-100) plus reasoning.
"""

import os
import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client — Groq uses the OpenAI SDK with a custom base_url
# ---------------------------------------------------------------------------

_client: OpenAI | None = None


def _get_client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.groq.com/openai/v1")
    if not api_key:
        logger.warning("[LLM] OPENAI_API_KEY not set — LLM scoring disabled.")
        return None
    return OpenAI(api_key=api_key, base_url=base_url)


def _client_instance() -> OpenAI | None:
    global _client
    if _client is None:
        _client = _get_client()
    return _client


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a YouTube comment security analyst. Your job is to detect:
1. Impersonators — someone pretending to be the channel creator or a trusted figure
2. Crypto/giveaway scams — fake giveaways, "double your money", "DM me for prize"
3. Phishing/malicious links — obfuscated URLs, suspicious redirects
4. Social engineering — pressuring users to DM, share personal info, or join groups

You will be given:
- author_name: the commenter's display name
- creator_name: the real channel owner's name
- comment: the comment text (already normalized to ASCII)

Respond ONLY with valid JSON in this exact schema:
{
  "threat_score": <int 0-100>,
  "categories": [<list of matched threat categories from: "impersonation", "scam", "phishing", "social_engineering">],
  "reasoning": "<one sentence explanation>",
  "is_threat": <true|false>
}

Be strict: a threat_score >= 60 means is_threat=true.
Legitimate fan comments, criticism, or off-topic messages are NOT threats (score 0-20).
Do not flag comments just because they mention money or famous people."""

USER_TEMPLATE = """author_name: {author_name}
creator_name: {creator_name}
comment: {comment}"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class LLMResult:
    def __init__(self, threat_score: int, categories: list[str], reasoning: str, is_threat: bool):
        self.threat_score = threat_score
        self.categories = categories
        self.reasoning = reasoning
        self.is_threat = is_threat


def llm_analyze(
    comment_text: str,
    author_name: str,
    creator_name: str,
) -> LLMResult | None:
    """
    Run LLM semantic analysis on a comment.

    Returns None if the LLM client is unavailable or the call fails,
    so the caller can gracefully fall back to deterministic-only scoring.
    """
    client = _client_instance()
    if client is None:
        return None

    model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

    user_msg = USER_TEMPLATE.format(
        author_name=author_name,
        creator_name=creator_name,
        comment=comment_text[:1000],  # cap at 1000 chars to save tokens
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_msg},
            ],
            temperature=0.0,       # deterministic output
            max_tokens=256,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        data = json.loads(raw)

        return LLMResult(
            threat_score=int(data.get("threat_score", 0)),
            categories=data.get("categories", []),
            reasoning=data.get("reasoning", ""),
            is_threat=bool(data.get("is_threat", False)),
        )

    except Exception as exc:
        logger.error("[LLM] Analysis failed: %s", exc)
        return None


def format_llm_flags(result: LLMResult) -> list[str]:
    """Convert LLM category labels to human-readable flag strings."""
    label_map = {
        "impersonation":     "LLM: Impersonation Detected",
        "scam":              "LLM: Scam / Giveaway Fraud",
        "phishing":          "LLM: Phishing Link",
        "social_engineering":"LLM: Social Engineering",
    }
    flags = [label_map.get(c, f"LLM: {c.title()}") for c in result.categories]
    if result.reasoning:
        flags.append(f'LLM reasoning: "{result.reasoning}"')
    return flags
