import os
import time
import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy import text
from sqlalchemy.engine import Engine

from schemas.auth import RegisterRequest, LoginRequest, UserOut, TokenResponse, ChangePasswordRequest
from services.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

# JWT settings from env
JWT_SECRET = os.getenv("JWT_SECRET", "change_me_in_prod")
JWT_ALG = "HS256"
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "60"))
JWT_ISS = os.getenv("JWT_ISS", "inkoopstrategie-api")


# ----------------------
# Helpers
# ----------------------
def _hash_password(plain: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _mk_token(user_id: str, email: str, is_admin: bool = False) -> TokenResponse:
    now = int(time.time())
    exp = now + JWT_EXPIRES_MIN * 3600
    payload = {
        "sub": user_id,
        "email": email,
        "is_admin": is_admin,
        "iss": JWT_ISS,
        "iat": now,
        "exp": exp,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
    return TokenResponse(access_token=token, expires_in=JWT_EXPIRES_MIN * 60)


def _row_to_user_out(row) -> UserOut:
    return UserOut(
        id=str(row["id"]),
        email=row["email"],
        display_name=row["display_name"],
        idp_provider=row["idp_provider"],
        is_admin=row.get("is_admin", False),
        created_at=row["created_at"].isoformat() if row["created_at"] else None,
        updated_at=row["updated_at"].isoformat() if row["updated_at"] else None,
    )


def _get_engine(request: Request) -> Engine:
    engine = getattr(request.app.state, "db_engine", None)
    if engine is None:
        raise HTTPException(status_code=500, detail="DB engine not initialized")
    return engine


# ----------------------
# Endpoints
# ----------------------
@router.post("/register", response_model=UserOut, status_code=200)
def register(payload: RegisterRequest, request: Request):
    """
    Prototype-registratie (geen self-signup):
    - User moet al bestaan in de database (aangemaakt door admin).
    - Als hashed_password leeg is, mag de user NU een wachtwoord instellen.
    - Als user niet bestaat -> 404 (vraag admin).
    - Als al een wachtwoord bestaat -> 409 (gebruik /auth/login).

    Opmerking m.b.t. toekomstige IntraID:
    - We veranderen niets aan idp_*; dit endpoint zet alleen een lokaal password
      voor bestaande accounts. Bij overgang naar IntraID vervalt dit.
    """
    engine = _get_engine(request)

    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required.")

    # 1) Bestaat de user?
    sql_get = text("""
        SELECT id, email, display_name, idp_provider, hashed_password, is_admin, created_at, updated_at
          FROM users
         WHERE email = :email
         LIMIT 1;
    """)
    with engine.connect() as conn:
        row = conn.execute(sql_get, {"email": payload.email}).mappings().first()

    if not row:
        # User is niet vooraf aangemaakt door admin
        raise HTTPException(
            status_code=404,
            detail="Account not found. Contact the administrator to create your user first."
        )

    # 2) Al geregistreerd?
    if row["hashed_password"]:
        raise HTTPException(
            status_code=409,
            detail="Account is already registered. Please use /auth/login."
        )

    # 3) Wachtwoord zetten
    hashed = _hash_password(payload.password)
    sql_set = text("""
        UPDATE users
           SET hashed_password = :hp, updated_at = NOW()
         WHERE id = :id
     RETURNING id, email, display_name, idp_provider, is_admin, created_at, updated_at;
    """)
    with engine.begin() as conn:
        updated = conn.execute(sql_set, {"hp": hashed, "id": row["id"]}).mappings().first()

    return _row_to_user_out(updated)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request):
    """
    Simpele login met email + password -> JWT token.
    SSO/IntraID-users hebben geen password; die route komt later via de IdP.
    """
    engine = _get_engine(request)

    # Haal user op
    sql = text("""
        SELECT id, email, display_name, idp_provider, hashed_password, is_admin, created_at, updated_at
          FROM users
         WHERE email = :email
         LIMIT 1;
    """)
    with engine.connect() as conn:
        row = conn.execute(sql, {"email": payload.email}).mappings().first()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not row["hashed_password"]:
        # User is (of wordt) SSO-gebruiker, password login niet toegestaan
        raise HTTPException(
            status_code=400,
            detail="Password login not available for this user. Use SSO (IntraID) once enabled."
        )

    # Verify password
    if not _verify_password(payload.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    # Issue JWT
    return _mk_token(str(row["id"]), row["email"], row.get("is_admin", False))


@router.post("/change-password", status_code=200)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    user_id = current_user["sub"]

    sql = text("""
        SELECT hashed_password FROM users
        WHERE id = :id LIMIT 1;
    """)
    with engine.connect() as conn:
        row = conn.execute(sql, {"id": user_id}).mappings().first()

    if not row or not row["hashed_password"]:
        raise HTTPException(status_code=400, detail="No password set.")

    if not _verify_password(payload.current_password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")

    hashed = _hash_password(payload.new_password)
    sql_update = text("""
        UPDATE users SET hashed_password = :hp, updated_at = NOW()
        WHERE id = :id;
    """)
    with engine.begin() as conn:
        conn.execute(sql_update, {"hp": hashed, "id": user_id})

    return {"status": "ok"}
