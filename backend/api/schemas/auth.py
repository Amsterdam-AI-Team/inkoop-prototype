from typing import Optional
from pydantic import BaseModel, EmailStr


# Requests
class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: Optional[str] = None
    password: Optional[str] = None
    # Vooruitlopend op IntraID (SSO) – voor nu meestal leeg:
    idp_provider: Optional[str] = None
    idp_subject: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Responses
class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: Optional[str] = None
    idp_provider: Optional[str] = None
    is_admin: bool = False
    created_at: str
    updated_at: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
