"""Unit tests for reset/invite token utilities."""
from app.utils.tokens import generate_token, hash_token


def test_generate_token_length():
    token = generate_token()
    assert len(token) >= 40  # URL-safe base64 of 32 bytes is ~43 chars


def test_generate_tokens_are_unique():
    t1 = generate_token()
    t2 = generate_token()
    assert t1 != t2


def test_hash_is_deterministic():
    token = generate_token()
    assert hash_token(token) == hash_token(token)


def test_different_tokens_different_hashes():
    t1 = generate_token()
    t2 = generate_token()
    assert hash_token(t1) != hash_token(t2)


def test_hash_is_hex_string():
    token = generate_token()
    h = hash_token(token)
    int(h, 16)  # raises ValueError if not valid hex
    assert len(h) == 64  # SHA-256 = 64 hex chars
