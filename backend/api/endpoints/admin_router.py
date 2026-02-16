from typing import Optional, List, Dict
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from sqlalchemy import text as sql_text

from services.auth import get_current_user
from utils.admin_utils import assert_is_admin, get_all_settings, set_setting

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SettingUpdate(BaseModel):
    value: str


class CollectionTemplateCreate(BaseModel):
    type: Optional[str] = None
    display_name: str
    description: Optional[str] = None
    template_content: Optional[str] = None
    enabled: bool = True


class CollectionTemplateUpdate(BaseModel):
    type: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    template_content: Optional[str] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


def _slugify(text: str) -> str:
    """Convert a display name to a snake_case slug for template_name."""
    import re, unicodedata
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


class FlowTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_name: Optional[str] = None
    template_content: Optional[str] = None
    sort_order: Optional[int] = 0


class FlowTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    template_name: Optional[str] = None
    template_content: Optional[str] = None
    sort_order: Optional[int] = None


class SeedFlowTemplate(BaseModel):
    name: str
    description: Optional[str] = None
    template_name: str
    template_content: Optional[str] = None
    sort_order: Optional[int] = 0


class SeedCollectionTemplate(BaseModel):
    type: str
    display_name: str
    description: Optional[str] = None
    template_content: Optional[str] = None
    enabled: bool = True
    sort_order: Optional[int] = 0
    flows: Optional[List[SeedFlowTemplate]] = []


class SeedPayload(BaseModel):
    settings: Optional[Dict[str, str]] = None
    collection_templates: Optional[List[SeedCollectionTemplate]] = None


class UserCreate(BaseModel):
    email: str
    display_name: Optional[str] = None
    password: str
    is_admin: bool = False


class UserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    password: Optional[str] = None
    display_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_engine(request: Request):
    engine = getattr(request.app.state, "db_engine", None)
    if engine is None:
        raise HTTPException(status_code=500, detail="DB engine not initialized")
    return engine


# ---------------------------------------------------------------------------
# Settings endpoints (admin-only)
# ---------------------------------------------------------------------------

@router.get("/settings")
def get_settings(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])
    return {"settings": get_all_settings(engine)}


@router.patch("/settings/{key}")
def update_setting(
    key: str,
    payload: SettingUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])
    set_setting(engine, key, payload.value, current_user["sub"])

    # Return the updated setting
    sql = sql_text("SELECT value, updated_at FROM app_settings WHERE key = :key LIMIT 1;")
    with engine.connect() as conn:
        row = conn.execute(sql, {"key": key}).mappings().first()
    return {
        "key": key,
        "value": row["value"],
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


# ---------------------------------------------------------------------------
# Collection Templates
# ---------------------------------------------------------------------------

def _ct_row_to_dict(row) -> dict:
    return {
        "id": str(row["id"]),
        "type": row["type"],
        "display_name": row["display_name"],
        "description": row["description"],
        "template_content": row["template_content"],
        "enabled": row["enabled"],
        "sort_order": row["sort_order"],
    }


def _ft_row_to_dict(row) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "description": row["description"],
        "template_name": row["template_name"],
        "template_content": row["template_content"],
        "sort_order": row["sort_order"],
    }


@router.get("/collection-templates")
def list_collection_templates(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """List all collection templates with their flow templates.
    Accessible to ALL authenticated users."""
    engine = _get_engine(request)

    ct_sql = sql_text("""
        SELECT id, type, display_name, description, template_content, enabled, sort_order
          FROM collection_templates
         ORDER BY sort_order, display_name;
    """)
    ft_sql = sql_text("""
        SELECT id, collection_template_id, name, description,
               template_name, template_content, sort_order
          FROM flow_templates
         ORDER BY sort_order, name;
    """)

    with engine.connect() as conn:
        ct_rows = conn.execute(ct_sql).mappings().all()
        ft_rows = conn.execute(ft_sql).mappings().all()

    # Group flow templates by collection_template_id
    ft_by_ct: Dict[str, list] = {}
    for ft in ft_rows:
        ct_id = str(ft["collection_template_id"])
        ft_by_ct.setdefault(ct_id, []).append(_ft_row_to_dict(ft))

    result = []
    for ct in ct_rows:
        ct_dict = _ct_row_to_dict(ct)
        ct_dict["flows"] = ft_by_ct.get(str(ct["id"]), [])
        result.append(ct_dict)

    return result


@router.post("/collection-templates", status_code=201)
def create_collection_template(
    payload: CollectionTemplateCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    sql = sql_text("""
        INSERT INTO collection_templates (type, display_name, description, template_content, enabled)
        VALUES (:type, :display_name, :description, :template_content, :enabled)
        RETURNING id, type, display_name, description, template_content, enabled, sort_order;
    """)
    ct_type = payload.type or _slugify(payload.display_name)
    with engine.begin() as conn:
        row = conn.execute(sql, {
            "type": ct_type,
            "display_name": payload.display_name,
            "description": payload.description,
            "template_content": payload.template_content,
            "enabled": payload.enabled,
        }).mappings().first()

    return _ct_row_to_dict(row)


@router.patch("/collection-templates/{ct_id}")
def update_collection_template(
    ct_id: UUID,
    payload: CollectionTemplateUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["ct_id"] = str(ct_id)

    sql = sql_text(f"""
        UPDATE collection_templates
           SET {set_clauses}
         WHERE id = :ct_id
        RETURNING id, type, display_name, description, template_content, enabled, sort_order;
    """)
    with engine.begin() as conn:
        row = conn.execute(sql, updates).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Collection template not found")
    return _ct_row_to_dict(row)


@router.delete("/collection-templates/{ct_id}", status_code=204)
def delete_collection_template(
    ct_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    # Delete flow templates first (cascade), then collection template
    with engine.begin() as conn:
        conn.execute(
            sql_text("DELETE FROM flow_templates WHERE collection_template_id = :ct_id;"),
            {"ct_id": str(ct_id)},
        )
        result = conn.execute(
            sql_text("DELETE FROM collection_templates WHERE id = :ct_id;"),
            {"ct_id": str(ct_id)},
        )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Collection template not found")


# ---------------------------------------------------------------------------
# Flow Templates (admin-only)
# ---------------------------------------------------------------------------

@router.post("/collection-templates/{ct_id}/flow-templates", status_code=201)
def create_flow_template(
    ct_id: UUID,
    payload: FlowTemplateCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    sql = sql_text("""
        INSERT INTO flow_templates
            (collection_template_id, name, description, template_name, template_content, sort_order)
        VALUES (:ct_id, :name, :description, :template_name, :template_content, :sort_order)
        RETURNING id, name, description, template_name, template_content, sort_order;
    """)
    template_name = payload.template_name or _slugify(payload.name)
    with engine.begin() as conn:
        row = conn.execute(sql, {
            "ct_id": str(ct_id),
            "name": payload.name,
            "description": payload.description,
            "template_name": template_name,
            "template_content": payload.template_content,
            "sort_order": payload.sort_order,
        }).mappings().first()

    return _ft_row_to_dict(row)


@router.patch("/flow-templates/{ft_id}")
def update_flow_template(
    ft_id: UUID,
    payload: FlowTemplateUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["ft_id"] = str(ft_id)

    sql = sql_text(f"""
        UPDATE flow_templates
           SET {set_clauses}
         WHERE id = :ft_id
        RETURNING id, name, description, template_name, template_content, sort_order;
    """)
    with engine.begin() as conn:
        row = conn.execute(sql, updates).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Flow template not found")
    return _ft_row_to_dict(row)


@router.delete("/flow-templates/{ft_id}", status_code=204)
def delete_flow_template(
    ft_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    with engine.begin() as conn:
        result = conn.execute(
            sql_text("DELETE FROM flow_templates WHERE id = :ft_id;"),
            {"ft_id": str(ft_id)},
        )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Flow template not found")


# ---------------------------------------------------------------------------
# Seed endpoint (admin-only)
# ---------------------------------------------------------------------------

@router.post("/seed")
def seed_data(
    payload: SeedPayload,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])
    user_id = current_user["sub"]

    # Upsert settings
    if payload.settings:
        for key, value in payload.settings.items():
            set_setting(engine, key, value, user_id)

    # Upsert collection templates
    if payload.collection_templates:
        for ct in payload.collection_templates:
            with engine.begin() as conn:
                # Check if collection template with this type exists
                existing = conn.execute(
                    sql_text("SELECT id FROM collection_templates WHERE type = :type LIMIT 1;"),
                    {"type": ct.type},
                ).mappings().first()

                if existing:
                    ct_id = str(existing["id"])
                    # Update the collection template
                    conn.execute(
                        sql_text("""
                            UPDATE collection_templates
                               SET display_name = :display_name,
                                   description = :description,
                                   template_content = :template_content,
                                   enabled = :enabled,
                                   sort_order = :sort_order
                             WHERE id = :ct_id;
                        """),
                        {
                            "display_name": ct.display_name,
                            "description": ct.description,
                            "template_content": ct.template_content,
                            "enabled": ct.enabled,
                            "sort_order": ct.sort_order,
                            "ct_id": ct_id,
                        },
                    )
                    # Replace flow templates: delete existing, insert new
                    conn.execute(
                        sql_text("DELETE FROM flow_templates WHERE collection_template_id = :ct_id;"),
                        {"ct_id": ct_id},
                    )
                else:
                    # Insert new collection template
                    row = conn.execute(
                        sql_text("""
                            INSERT INTO collection_templates (type, display_name, description, template_content, enabled, sort_order)
                            VALUES (:type, :display_name, :description, :template_content, :enabled, :sort_order)
                            RETURNING id;
                        """),
                        {
                            "type": ct.type,
                            "display_name": ct.display_name,
                            "description": ct.description,
                            "template_content": ct.template_content,
                            "enabled": ct.enabled,
                            "sort_order": ct.sort_order,
                        },
                    ).mappings().first()
                    ct_id = str(row["id"])

                # Insert flow templates
                if ct.flows:
                    for ft in ct.flows:
                        conn.execute(
                            sql_text("""
                                INSERT INTO flow_templates
                                    (collection_template_id, name, description,
                                     template_name, template_content, sort_order)
                                VALUES (:ct_id, :name, :description,
                                        :template_name, :template_content, :sort_order);
                            """),
                            {
                                "ct_id": ct_id,
                                "name": ft.name,
                                "description": ft.description,
                                "template_name": ft.template_name,
                                "template_content": ft.template_content,
                                "sort_order": ft.sort_order,
                            },
                        )

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# User management (admin-only)
# ---------------------------------------------------------------------------

def _hash_password(plain: str) -> str:
    import bcrypt
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


@router.get("/users")
def list_users(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    sql = sql_text("""
        SELECT id, email, display_name, is_admin,
               hashed_password IS NOT NULL AS has_password,
               created_at
          FROM users
         ORDER BY created_at;
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql).mappings().all()

    return [
        {
            "id": str(r["id"]),
            "email": r["email"],
            "display_name": r["display_name"],
            "is_admin": r["is_admin"] or False,
            "has_password": r["has_password"],
            "created_at": (
                r["created_at"].isoformat() if r["created_at"] else None
            ),
        }
        for r in rows
    ]


@router.post("/users", status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    hashed = _hash_password(payload.password)

    sql = sql_text("""
        INSERT INTO users (email, display_name, hashed_password, is_admin)
        VALUES (:email, :display_name, :hp, :is_admin)
        RETURNING id, email, display_name, is_admin, created_at;
    """)
    try:
        with engine.begin() as conn:
            row = conn.execute(sql, {
                "email": payload.email,
                "display_name": payload.display_name,
                "hp": hashed,
                "is_admin": payload.is_admin,
            }).mappings().first()
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise HTTPException(
                status_code=409,
                detail="A user with this email already exists.",
            )
        raise

    return {
        "id": str(row["id"]),
        "email": row["email"],
        "display_name": row["display_name"],
        "is_admin": row["is_admin"] or False,
        "created_at": (
            row["created_at"].isoformat() if row["created_at"] else None
        ),
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Hash password if provided
    if "password" in updates:
        updates["hashed_password"] = _hash_password(updates.pop("password"))

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["user_id"] = str(user_id)

    sql = sql_text(f"""
        UPDATE users
           SET {set_clauses}, updated_at = NOW()
         WHERE id = :user_id
        RETURNING id, email, display_name, is_admin, created_at;
    """)
    with engine.begin() as conn:
        row = conn.execute(sql, updates).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(row["id"]),
        "email": row["email"],
        "display_name": row["display_name"],
        "is_admin": row["is_admin"] or False,
        "created_at": (
            row["created_at"].isoformat() if row["created_at"] else None
        ),
    }


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = _get_engine(request)
    assert_is_admin(engine, current_user["sub"])

    # Prevent self-deletion
    if str(user_id) == current_user["sub"]:
        raise HTTPException(
            status_code=400, detail="Cannot delete your own account."
        )

    with engine.begin() as conn:
        result = conn.execute(
            sql_text("DELETE FROM users WHERE id = :id;"),
            {"id": str(user_id)},
        )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")
