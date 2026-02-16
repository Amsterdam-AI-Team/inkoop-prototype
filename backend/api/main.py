import os
from fastapi import FastAPI
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from endpoints.register import register_routes

app = FastAPI(title="Inkoopstrategie Backend API")


# --------------------------------------
# Load .env & maak DB-engine
# --------------------------------------
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/inkoopsstrategie",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)

# --------------------------------------
# FastAPI app
# --------------------------------------
app = FastAPI(title="Inkoopstrategie Backend API")


@app.on_event("startup")
def on_startup():
    """Zet DB-engine op app.state zodat endpoints hem kunnen gebruiken."""
    app.state.db_engine = engine
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[startup] Database connection successful.")
    except Exception as e:
        print(f"[startup] Database ping failed: {e}")


@app.on_event("shutdown")
def on_shutdown():
    """Sluit de DB-pool netjes af bij shutdown."""
    try:
        engine.dispose()
        print("[shutdown] Database connection closed.")
    except Exception:
        pass


# --------------------------------------
# Root endpoint (ping)
# --------------------------------------
@app.get("/")
def root():
    return {"status": "ok"}


# --------------------------------------
# Registreer alle routes
# --------------------------------------
register_routes(app)
