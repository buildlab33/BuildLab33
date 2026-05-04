"""Utilities for generating and hashing one-time tokens."""
import hashlib
import secrets


def generate_token(nbytes: int = 32) -> str:
    """Generate a cryptographically secure URL-safe token string."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Return the SHA-256 hex digest of a token (for safe DB storage)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
