import os
from fastapi import Request, HTTPException, status
import jwt
from jwt import PyJWTError
from schemas.auth import TokenResponse  # als je payload-structuur hebt


# Config
JWT_SECRET = os.getenv("JWT_SECRET", "change_me_in_prod")
JWT_ALG = "HS256"
JWT_ISS = os.getenv("JWT_ISS", "inkoopstrategie-api")


def verify_jwt_token(token: str) -> dict:
    """
    Decode en valideer het JWT-token. 
    Return de token payload (claims) als dict of raise HTTPException.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], 
                             issuer=JWT_ISS)
        return payload
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(request: Request) -> dict:
    """
    Dependency: haal token uit Authorization header, verifieer, en geef de claims terug.
    """
    auth: str | None = request.headers.get("Authorization")
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme",
            headers={"WWW-Authenticate": "Bearer"},
        )
    claims = verify_jwt_token(token)
    return claims
