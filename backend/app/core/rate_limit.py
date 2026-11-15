import time
from collections import defaultdict, deque

from app.core.errors import ApiError


class SlidingWindowLimiter:
    """Small in-process limiter for login attempts (single-instance MVP)."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            raise ApiError(
                429,
                "rate_limited",
                "Әрекет тым жиі. Бір минуттан кейін қайталап көріңіз.",
            )
        hits.append(now)

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)
