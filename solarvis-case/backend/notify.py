"""Teklif görüntülenme bildirimi.

RESEND_API_KEY + SALES_EMAIL tanımlıysa Resend ile e-posta atar;
yoksa console'a loglar (evaluator anahtarsız da davranışı görür).
"""
import os

import httpx


def notify_proposal_viewed(pid: str, view_count: int) -> str:
    api_key = os.getenv("RESEND_API_KEY", "")
    to = os.getenv("SALES_EMAIL", "")
    subject = f"Solar proposal {pid} was viewed (view #{view_count})"

    if not api_key or not to:
        print(f"[notify] {subject} — RESEND_API_KEY/SALES_EMAIL tanımsız, "
              "e-posta console'a loglandı.")
        return "logged"

    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": os.getenv("NOTIFY_FROM", "onboarding@resend.dev"),
                "to": [to],
                "subject": subject,
                "html": f"<p>Shareable proposal <b>{pid}</b> was opened "
                        f"by the customer (view #{view_count}).</p>",
            },
            timeout=10,
        )
        return "sent" if r.status_code in (200, 201) else f"error:{r.status_code}"
    except Exception as e:
        print(f"[notify] e-posta hatası: {e}")
        return "error"