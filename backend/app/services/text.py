import re
import unicodedata

import bleach
from sqlalchemy import select
from sqlalchemy.orm import Session

TRANSLIT = {
    "а": "a", "ә": "a", "б": "b", "в": "v", "г": "g", "ғ": "g", "д": "d", "е": "e",
    "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "қ": "k", "л": "l",
    "м": "m", "н": "n", "ң": "n", "о": "o", "ө": "o", "п": "p", "р": "r", "с": "s",
    "т": "t", "у": "u", "ұ": "u", "ү": "u", "ф": "f", "х": "h", "һ": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "і": "i", "ь": "", "э": "e",
    "ю": "yu", "я": "ya",
}

ALLOWED_TAGS = [
    "p", "br", "h1", "h2", "h3", "h4", "ul", "ol", "li", "strong", "b", "em", "i",
    "blockquote", "a", "img", "code", "pre", "hr", "table", "thead", "tbody", "tr",
    "th", "td", "span", "div",
]
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height"],
    "span": ["class"],
    "div": ["class"],
    "th": ["colspan"],
    "td": ["colspan"],
}


def slugify(value: str, max_length: int = 100) -> str:
    value = value.lower().strip()
    transliterated = "".join(TRANSLIT.get(char, char) for char in value)
    normalized = unicodedata.normalize("NFKD", transliterated)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return (slug or "material")[:max_length].strip("-")


def unique_slug(
    db: Session, model, title: str, requested: str | None = None, exclude_id=None
) -> str:
    base = slugify(requested or title)
    candidate = base
    counter = 2
    while True:
        stmt = select(model.id).where(model.slug == candidate)
        if exclude_id is not None:
            stmt = stmt.where(model.id != exclude_id)
        if db.execute(stmt).first() is None:
            return candidate
        candidate = f"{base[:96]}-{counter}"
        counter += 1


def sanitize_html(value: str | None) -> str:
    if not value:
        return ""
    cleaned = bleach.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=["http", "https", "mailto"],
        strip=True,
    )
    # Ensure links opened in a new tab do not leak the opener.
    cleaned = cleaned.replace('<a href="http', '<a rel="noopener noreferrer" href="http')
    return cleaned


def truncate(value: str, length: int = 180) -> str:
    if len(value) <= length:
        return value
    return value[: length - 1].rstrip() + "…"
