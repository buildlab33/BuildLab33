"""Email sending via Resend REST API."""
import httpx
from app.config import get_settings


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend. Returns True on success, False if email_send_enabled=False."""
    settings = get_settings()
    if not settings.email_send_enabled:
        return False
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.resend_from_email,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        return resp.status_code == 200
