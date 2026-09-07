"""Email delivery service for SatQuery AI.

Provides standard SMTP email delivery for production and an injectable
InMemoryEmailSender for test suites.

Security guarantees:
- Plaintext verification codes are NEVER logged in application logs.
- SMTP passwords and credentials are NEVER logged or printed.
- In unconfigured development or test environments, email dispatch is simulated
  safely without leaking codes to logs.
"""

from __future__ import annotations

import logging
import smtplib
from abc import ABC, abstractmethod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, List, Optional

from backend.config import settings

logger = logging.getLogger("satquery.services.email")


class EmailSender(ABC):
    """Abstract interface for email delivery."""

    @abstractmethod
    def send_verification_email(
        self, to_email: str, code: str, display_name: Optional[str] = None
    ) -> bool:
        """Deliver a 6-digit verification code to the recipient."""
        raise NotImplementedError


class SMTPEmailSender(EmailSender):
    """Production SMTP email delivery implementation."""

    def send_verification_email(
        self, to_email: str, code: str, display_name: Optional[str] = None
    ) -> bool:
        """Send verification email via configured SMTP server or simulate if unconfigured."""
        if not settings.SMTP_HOST:
            logger.info("SMTP_HOST not configured; simulated email delivery to %s", to_email)
            return True

        greeting = f"Hello {display_name}," if display_name else "Hello,"
        subject = f"Verify your {settings.SMTP_FROM_NAME} account"

        text_body = (
            f"{greeting}\n\n"
            f"Your verification code is: {code}\n\n"
            f"This code will expire in {settings.EMAIL_VERIFY_EXPIRE_MINUTES} minutes.\n"
            f"If you did not request this code, please ignore this email.\n\n"
            f"— The {settings.SMTP_FROM_NAME} Team"
        )

        html_body = (
            f"<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>"
            f"  <h2 style='color: #1e3a8a;'>{settings.SMTP_FROM_NAME} Verification</h2>"
            f"  <p>{greeting}</p>"
            f"  <p>Please enter the following 6-digit verification code to activate your account:</p>"
            f"  <div style='background: #f1f5f9; padding: 16px; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; border-radius: 8px; color: #0f172a; margin: 24px 0;'>"
            f"    {code}"
            f"  </div>"
            f"  <p style='color: #64748b; font-size: 13px;'>This code expires in {settings.EMAIL_VERIFY_EXPIRE_MINUTES} minutes. If you did not create an account, you can safely ignore this email.</p>"
            f"</div>"
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        try:
            if settings.SMTP_USE_SSL:
                with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                    if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                    if settings.SMTP_USE_TLS:
                        server.starttls()
                    if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())

            logger.info("Successfully sent verification email to %s", to_email)
            return True
        except Exception as exc:
            logger.error(
                "Failed to deliver verification email to %s: %s",
                to_email,
                type(exc).__name__,
            )
            return False


class InMemoryEmailSender(EmailSender):
    """In-memory mock email sender for automated testing."""

    def __init__(self) -> None:
        self.sent_emails: List[Dict[str, str]] = []

    def send_verification_email(
        self, to_email: str, code: str, display_name: Optional[str] = None
    ) -> bool:
        """Capture sent email safely in memory for test verification."""
        self.sent_emails.append(
            {
                "to_email": to_email,
                "code": code,
                "display_name": display_name or "",
            }
        )
        return True

    def get_last_email(self) -> Optional[Dict[str, str]]:
        """Return the most recently sent email dict."""
        return self.sent_emails[-1] if self.sent_emails else None

    def get_last_code_for(self, email: str) -> Optional[str]:
        """Return the most recent verification code sent to the specified email."""
        for item in reversed(self.sent_emails):
            if item["to_email"].lower() == email.strip().lower():
                return item["code"]
        return None

    def clear(self) -> None:
        """Reset captured emails."""
        self.sent_emails.clear()


# Default singleton instance
_current_sender: EmailSender = SMTPEmailSender()


def get_email_sender() -> EmailSender:
    """Return the active email sender instance."""
    return _current_sender


def set_email_sender(sender: EmailSender) -> None:
    """Inject an alternative email sender (e.g. InMemoryEmailSender for tests)."""
    global _current_sender
    _current_sender = sender


def send_verification_email(to_email: str, code: str, display_name: Optional[str] = None) -> bool:
    """Helper function delegating to active email sender."""
    return get_email_sender().send_verification_email(to_email, code, display_name)
