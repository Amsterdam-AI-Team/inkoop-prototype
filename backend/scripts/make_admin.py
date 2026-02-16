#!/usr/bin/env python3
"""Make an existing user an admin by email address."""
import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/inkoopsstrategie",
)

def make_admin(email: str):
    engine = create_engine(DATABASE_URL)
    sql = text("""
        UPDATE users
        SET is_admin = TRUE, updated_at = NOW()
        WHERE email = :email
        RETURNING id, email, display_name, is_admin;
    """)
    with engine.begin() as conn:
        result = conn.execute(sql, {"email": email}).mappings().first()

    if result:
        print(f"User {result['email']} is now an admin (id: {result['id']})")
    else:
        print(f"User with email '{email}' not found")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python make_admin.py <email>")
        sys.exit(1)
    make_admin(sys.argv[1])
