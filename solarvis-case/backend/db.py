"""Teklif kalıcılığı — sqlite3 (stdlib, ek bağımlılık yok).

Neden SQLite: tek dosya, kurulum sıfır, evaluator makinesinde garantili çalışır;
teklif linkleri backend restart'tan sonra da yaşar.
"""
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "proposals.db"


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS proposals (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            kwp REAL NOT NULL,
            payload TEXT NOT NULL,
            view_count INTEGER NOT NULL DEFAULT 0,
            last_viewed_at TEXT
        )""")


def create_proposal(kwp: float, payload: dict) -> str:
    pid = uuid.uuid4().hex[:10]
    with _conn() as c:
        c.execute(
            "INSERT INTO proposals (id, created_at, kwp, payload) VALUES (?,?,?,?)",
            (pid, datetime.now(timezone.utc).isoformat(), kwp,
             json.dumps(payload)),
        )
    return pid


def get_proposal(pid: str):
    with _conn() as c:
        row = c.execute("SELECT * FROM proposals WHERE id=?",
                        (pid,)).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "createdAt": row["created_at"],
        "kwp": row["kwp"],
        "analysis": json.loads(row["payload"]),
        "viewCount": row["view_count"],
        "lastViewedAt": row["last_viewed_at"],
    }


def record_view(pid: str) -> bool:
    with _conn() as c:
        cur = c.execute(
            "UPDATE proposals SET view_count=view_count+1, last_viewed_at=? "
            "WHERE id=?",
            (datetime.now(timezone.utc).isoformat(), pid),
        )
    return cur.rowcount > 0