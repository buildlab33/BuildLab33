"""Password policy validator."""
import re


class PasswordError(ValueError):
    pass


def validate_password(password: str) -> str:
    """Validate password meets policy. Returns password if valid, raises PasswordError if not."""
    if len(password) < 8:
        raise PasswordError("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise PasswordError("Password must contain at least one uppercase letter")
    if not re.search(r"\d", password):
        raise PasswordError("Password must contain at least one number")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        raise PasswordError("Password must contain at least one special character")
    return password
