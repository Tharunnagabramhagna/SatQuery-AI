"""Services module for SatQuery AI."""

from backend.services.email import (
    EmailSender,
    InMemoryEmailSender,
    SMTPEmailSender,
    get_email_sender,
    send_verification_email,
    set_email_sender,
)

__all__ = [
    "EmailSender",
    "SMTPEmailSender",
    "InMemoryEmailSender",
    "get_email_sender",
    "set_email_sender",
    "send_verification_email",
]
