"""TOTP utilities for 2FA using pyotp."""
import pyotp


def generate_totp_secret() -> str:
    """Generate a new random TOTP base32 secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, issuer: str = "COP Platform") -> str:
    """Return an otpauth:// URI for QR code generation."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=issuer)


def verify_totp_code(secret: str, code: str) -> bool:
    """Verify a TOTP code. Allows 1 period of clock drift."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
