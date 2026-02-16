from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text as sql_text

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_engine(request: Request):
    """Get database engine from app state."""
    engine = getattr(request.app.state, "db_engine", None)
    if engine is None:
        raise HTTPException(status_code=500, detail="DB engine not initialized")
    return engine


@router.get("")
def get_public_settings(request: Request):
    """
    Public endpoint to get app settings that are safe to expose to all users.
    Does not require authentication.

    Returns:
        dict: Settings object with brand_name and other public settings
    """
    engine = _get_engine(request)

    try:
        sql = sql_text(
            "SELECT key, value FROM app_settings WHERE key = :key LIMIT 1;"
        )
        with engine.connect() as conn:
            row = conn.execute(sql, {"key": "brand_name"}).mappings().first()

        brand_name = row["value"] if row else "Schrijfhulp"

        return {
            "brand_name": brand_name
        }
    except Exception as e:
        # On error, return safe defaults
        print(f"Error fetching settings: {e}")
        return {
            "brand_name": "Schrijfhulp"
        }
