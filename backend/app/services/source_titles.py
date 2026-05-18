from __future__ import annotations

import re
from urllib.parse import unquote, urlparse

GENERIC_TITLES = frozenset(
    {
        "",
        "official source",
        "untitled",
        "untitled source",
        "policy source",
        "stored source",
        "government scheme page",
        "no title",
    }
)

_SKIP_PATH_PARTS = frozenset(
    {
        "en",
        "hi",
        "schemes",
        "scheme",
        "pages",
        "page",
        "home",
        "index",
        "search",
        "detail",
        "details",
        "view",
        "content",
        "portal",
        "public",
    }
)


def _title_case_words(text: str) -> str:
    words = re.split(r"\s+", text.strip())
    return " ".join(word[:1].upper() + word[1:] if word else "" for word in words if word)


def title_from_url(url: str) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    segments = [unquote(part) for part in parsed.path.split("/") if part]
    for segment in reversed(segments):
        cleaned = re.sub(r"\.[a-z0-9]{2,5}$", "", segment, flags=re.IGNORECASE)
        cleaned = re.sub(r"[-_]+", " ", cleaned).strip()
        if len(cleaned) < 3 or cleaned.lower() in _SKIP_PATH_PARTS:
            continue
        if cleaned.isdigit():
            continue
        return _title_case_words(cleaned)[:120]

  # Some portals encode the scheme in the query string.
    for key in ("scheme", "schemeName", "scheme_name", "id", "name"):
        value = (parsed.query or "").lower()
        match = re.search(rf"(?:^|[&?]){re.escape(key)}=([^&]+)", value)
        if match:
            candidate = unquote(match.group(1)).replace("+", " ")
            candidate = re.sub(r"[-_]+", " ", candidate).strip()
            if len(candidate) >= 3:
                return _title_case_words(candidate)[:120]
    return None


def title_from_content(item: dict) -> str | None:
    for key in ("content", "raw_content", "answer", "snippet"):
        text = (item.get(key) or "").strip()
        if not text:
            continue
        first_line = re.sub(r"\s+", " ", text.split("\n", maxsplit=1)[0]).strip()
        if 10 <= len(first_line) <= 120 and not first_line.lower().startswith("http"):
            return first_line
    return None


def resolve_source_title(item: dict, context: dict[str, str] | None = None) -> str:
    context = context or {}
    raw_title = (item.get("title") or "").strip()
    if raw_title and raw_title.lower() not in GENERIC_TITLES:
        return raw_title[:120]

    url_title = title_from_url(item.get("url", ""))
    if url_title:
        return url_title

    content_title = title_from_content(item)
    if content_title:
        return content_title

    scheme_name = (context.get("scheme_name") or context.get("scheme_name_or_service") or "").strip()
    if scheme_name:
        return scheme_name[:120]

    state = (context.get("state") or "").strip()
    profile = (context.get("profile") or "").strip()
    if state and profile:
        return f"{state} schemes for {profile}"[:120]
    if state:
        return f"{state} government schemes"[:120]

    hostname = urlparse(item.get("url", "")).netloc.replace("www.", "")
    if hostname:
        return hostname[:120]
    return "Government scheme"
