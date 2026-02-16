from fastapi import APIRouter, Request
from sqlalchemy import text

router = APIRouter(tags=["health"])


@router.get("/health")
def health(request: Request):
    """
    Healthcheck met DB-verbindingstest.
    Retourneert status 'ok' als verbinding succesvol.
    """
    engine = getattr(request.app.state, "db_engine", None)
    if engine is None:
        return {"status": "degraded", "db": {"connected": False, "error": "DB engine not initialized"}}

    try:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT current_database(), version()")).first()
        return {
            "status": "ok",
            "db": {
                "connected": True,
                "database": row[0],
                "version": row[1],
            },
        }
    except Exception as e:
        return {
            "status": "degraded",
            "db": {"connected": False, "error": str(e)},
        }
