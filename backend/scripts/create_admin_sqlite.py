"""Create an admin user in the SQLite database."""
import asyncio
import os
import sys
from pathlib import Path

# Load .env first
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent.parent))

import aiosqlite
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DB_PATH = os.environ.get("APP_DATABASE_URL", "sqlite:///data/app.db").replace("sqlite:///", "")


async def create_admin(username: str, password: str):
    db_file = Path(__file__).parent.parent / DB_PATH
    db_file.parent.mkdir(parents=True, exist_ok=True)

    password_hash = pwd_context.hash(password)
    sub = f"local|{username}"

    async with aiosqlite.connect(str(db_file)) as conn:
        # Ensure table exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS "user" (
                user_id     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                sub         TEXT UNIQUE NOT NULL,
                username    TEXT,
                name        TEXT,
                phone       TEXT,
                password_hash TEXT,
                is_admin    INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                last_seen   TEXT,
                stripe_customer_id TEXT,
                plan_type   TEXT NOT NULL DEFAULT 'freemium'
            )
        """)
        await conn.commit()

        # Check if user already exists
        async with conn.execute('SELECT user_id FROM "user" WHERE username = ?', (username,)) as cur:
            existing = await cur.fetchone()

        if existing:
            await conn.execute(
                'UPDATE "user" SET password_hash = ?, is_admin = 1 WHERE username = ?',
                (password_hash, username)
            )
            await conn.commit()
            print(f"User '{username}' already exists — password updated and admin flag set.")
        else:
            await conn.execute(
                'INSERT INTO "user" (sub, username, password_hash, is_admin) VALUES (?, ?, ?, 1)',
                (sub, username, password_hash)
            )
            await conn.commit()
            print(f"Admin user '{username}' created successfully!")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python create_admin_sqlite.py <username> <password>")
        sys.exit(1)

    asyncio.run(create_admin(sys.argv[1], sys.argv[2]))
