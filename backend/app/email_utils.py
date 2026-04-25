"""Async email utility for invite and OTP sending via SMTP."""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
APP_NAME = "Surtn - the AI Assistant"


def _send(to_email: str, subject: str, html_body: str) -> None:
    """Synchronous SMTP send via TLS (runs in thread pool for async contexts)."""
    if not SMTP_HOST or not SMTP_USER:
        raise RuntimeError(
            "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env"
        )
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{APP_NAME} <{SMTP_FROM}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, [to_email], msg.as_string())


def _send_with_attachment(to_email: str, subject: str, html_body: str, attachment_bytes: bytes, filename: str) -> None:
    """Synchronous SMTP send with attachment via TLS."""
    from email.mime.application import MIMEApplication

    if not SMTP_HOST or not SMTP_USER:
        raise RuntimeError(
            "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env"
        )
    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = f"{APP_NAME} <{SMTP_FROM}>"
    msg["To"] = to_email
    
    msg.attach(MIMEText(html_body, "html"))

    part = MIMEApplication(attachment_bytes, Name=filename)
    part['Content-Disposition'] = f'attachment; filename="{filename}"'
    msg.attach(part)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, [to_email], msg.as_string())


def _get_base_email_html(content_html: str) -> str:
    """Provides a consistent outer shell (logo header and footer) for all emails."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    logo_url = f"{frontend_url}/Surtn_text_white_logo.svg"
    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;max-width:560px;margin:20px auto;background:#FFFFFF;border-radius:6px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      <div style="background:#0F172A;padding:28px 24px;text-align:center;">
        <img src="{logo_url}" alt="{APP_NAME}" width="160" style="display:inline-block;margin:0 auto;color:#FFC20E;font-size:24px;font-weight:700;text-decoration:none;" />
      </div>
      <div style="padding:40px 32px;">
        {content_html}
      </div>
      <div style="padding:28px 32px;text-align:center;background:#F8FAFC;border-top:1px solid #E2E8F0;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#64748B;">
          You received this email because you have an account on <span style="color:#2B93D1;font-weight:600;">{APP_NAME}</span>.
        </p>
        <p style="margin:0;font-size:11px;color:#94A3B8;">
          Surtn Ltd · 124 City Road, London, EC1V 2NX
        </p>
      </div>
    </div>
    """


def send_invite_email(to_email: str, invite_link: str) -> None:
    """Send an invite email with a magic-link button."""
    subject = f"You've been invited to join {APP_NAME}"
    content = f"""
        <h2 style="font-size:22px;font-weight:700;margin-top:0;margin-bottom:16px;color:#0F172A;">
          You've been invited to join {APP_NAME}
        </h2>
        <p style="color:#475569;margin-bottom:32px;line-height:1.6;font-size:15px;">
          An admin has invited you to access {APP_NAME}. Click the button below to accept your invitation:
        </p>
        <div style="text-align:left;">
          <a href="{invite_link}"
             style="display:inline-block;padding:14px 32px;background:#FFC20E;color:#0F172A;border-radius:6px;
                    text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            Join your team
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #E2E8F0;margin:32px 0 24px 0;" />
        <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;">
          This link expires in 7 days. If you didn't expect this email, you can ignore it.<br><br>
          Team {APP_NAME}
        </p>
    """
    _send(to_email, subject, _get_base_email_html(content))


def send_otp_email(to_email: str, otp: str) -> None:
    """Send a 6-digit OTP for password reset."""
    subject = f"{APP_NAME} — Verify your email address"
    content = f"""
        <h2 style="font-size:22px;font-weight:700;margin-top:0;margin-bottom:20px;color:#0F172A;">
          Verify your email address
        </h2>
        <p style="color:#475569;margin-bottom:16px;line-height:1.6;font-size:15px;">
          Hi there,
        </p>
        <p style="color:#475569;margin-bottom:32px;line-height:1.6;font-size:15px;">
          Please use the code below to verify your email address:
        </p>
        <div style="font-size:36px;font-weight:700;letter-spacing:14px;color:#0F172A;
                    text-align:center;padding:24px;background:#F8FAFC;border-radius:8px;border:2px dashed #0D9488;margin-bottom:28px;">
          {otp}
        </div>
        <p style="color:#64748B;font-size:14px;text-align:center;line-height:1.6;margin-bottom:36px;">
          This code will expire in <strong style="color:#0F172A;">10 minutes</strong>.
        </p>
        <hr style="border:none;border-top:1px solid #E2E8F0;margin-bottom:24px;" />
        <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;">
          If you did not request this, you can safely ignore this email.<br><br>
          Team {APP_NAME}
        </p>
    """
    _send(to_email, subject, _get_base_email_html(content))


def send_invite_email_safe(to_email: str, invite_link: str) -> Optional[str]:
    """Returns error message string or None on success."""
    try:
        send_invite_email(to_email, invite_link)
        return None
    except Exception as exc:
        return str(exc)


def send_otp_email_safe(to_email: str, otp: str) -> Optional[str]:
    """Returns error message string or None on success."""
    try:
        send_otp_email(to_email, otp)
        return None
    except Exception as exc:
        return str(exc)


def send_pdf_email(to_email: str, subject: str, body: str, pdf_bytes: bytes, filename: str) -> None:
    """Send an email with a PDF attachment."""
    _send_with_attachment(to_email, subject, _get_base_email_html(body), pdf_bytes, filename)


def send_pdf_email_safe(to_email: str, subject: str, body: str, pdf_bytes: bytes, filename: str) -> Optional[str]:
    """Returns error message string or None on success."""
    try:
        send_pdf_email(to_email, subject, body, pdf_bytes, filename)
        return None
    except Exception as exc:
        return str(exc)
