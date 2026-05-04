"""Unit tests for password policy validator."""
import pytest
from app.utils.password import validate_password, PasswordError


def test_too_short():
    with pytest.raises(PasswordError, match="8"):
        validate_password("Ab1!")


def test_no_uppercase():
    with pytest.raises(PasswordError, match="uppercase"):
        validate_password("abcde1!!")


def test_no_digit():
    with pytest.raises(PasswordError, match="number"):
        validate_password("Abcde!!!")


def test_no_special():
    with pytest.raises(PasswordError, match="special"):
        validate_password("Abcde123")


def test_valid_password():
    # Should not raise
    validate_password("Secure1!")
    validate_password("MyP@ssw0rd")
    validate_password("Hello#999")


def test_returns_password_on_success():
    result = validate_password("Secure1!")
    assert result == "Secure1!"
