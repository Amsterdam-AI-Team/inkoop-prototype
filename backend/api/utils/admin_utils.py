from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import text as sql_text


def assert_is_admin(engine, user_id: str) -> None:
    """Check if user is an admin, raise 403 if not."""
    sql = sql_text("SELECT is_admin FROM users WHERE id = :uid LIMIT 1;")
    with engine.connect() as conn:
        result = conn.execute(sql, {"uid": user_id}).scalar()

    if not result:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


def get_setting(engine, key: str) -> Optional[str]:
    """Get a single setting value by key."""
    sql = sql_text("SELECT value FROM app_settings WHERE key = :key LIMIT 1;")
    with engine.connect() as conn:
        return conn.execute(sql, {"key": key}).scalar()


def get_all_settings(engine) -> dict:
    """Get all settings as {key: {value, updated_at}}."""
    sql = sql_text(
        "SELECT key, value, updated_at FROM app_settings ORDER BY key;"
    )
    with engine.connect() as conn:
        rows = conn.execute(sql).mappings().all()

    return {
        row["key"]: {
            "value": row["value"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
        for row in rows
    }


def set_setting(engine, key: str, value: str, user_id: str) -> None:
    """Upsert a setting."""
    sql = sql_text("""
        INSERT INTO app_settings (key, value, updated_by)
        VALUES (:key, :value, :user_id)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW();
    """)
    with engine.begin() as conn:
        conn.execute(sql, {"key": key, "value": value, "user_id": user_id})
