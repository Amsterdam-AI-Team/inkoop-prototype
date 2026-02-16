from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from typing import Any
from services.auth import get_current_user
from schemas.collections import (CollectionCreate,
                                 CollectionOut,
                                 CollectionUpdate)

router = APIRouter(prefix="/collections", tags=["collections"])


def _row_to_out(row: Any) -> CollectionOut:
    return CollectionOut(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        name=row["name"],
        description=row["description"],
        created_at=row["created_at"].isoformat() if row["created_at"] else None,
        updated_at=row["updated_at"].isoformat() if row["updated_at"] else None,
        status=row["status"],
    )


@router.post("", response_model=CollectionOut, status_code=201)
def create_collection(
    payload: CollectionCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = request.app.state.db_engine
    sql = text("""
        INSERT INTO collections (user_id, name, description, template_content)
        VALUES (:user_id, :name, :description, :template_content)
        RETURNING id, user_id, name, description, created_at, updated_at, status;
    """)
    with engine.begin() as conn:
        row = conn.execute(sql, {
            "user_id": current_user["sub"],
            "name": payload.name,
            "description": payload.description,
            "template_content": payload.template_content,
        }).mappings().first()
    return _row_to_out(row)


@router.delete("/{collection_id}", status_code=204)
def delete_collection(
    collection_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Verwijdert de collection van de huidige user (incl. cascades).
    """
    engine = request.app.state.db_engine

    # eigenaarscheck + delete
    sql = text("""
        DELETE FROM collections
         WHERE id = :cid AND user_id = :uid;
    """)
    with engine.begin() as conn:
        res = conn.execute(sql, {"cid": collection_id, "uid": current_user["sub"]})
    if res.rowcount == 0:
        # niet gevonden of geen eigenaar
        raise HTTPException(status_code=404, detail="Collection not found.")
    return


@router.get("", response_model=list[CollectionOut])
def get_collections(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Haal alle collections op die bij de huidige user horen.
    """
    engine = request.app.state.db_engine

    sql = text("""
        SELECT id, user_id, name, description, created_at, updated_at, status
          FROM collections
         WHERE user_id = :uid
         ORDER BY created_at ASC;
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, {"uid": current_user["sub"]}).mappings().all()

    return [_row_to_out(r) for r in rows]


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(
    collection_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Haal één collection op die bij de huidige user hoort.
    """
    engine = request.app.state.db_engine

    sql = text("""
        SELECT id, user_id, name, description, created_at, updated_at, status
          FROM collections
         WHERE id = :cid
           AND user_id = :uid;
    """)

    with engine.connect() as conn:
        row = conn.execute(sql, {"cid": collection_id, "uid": current_user["sub"]}).mappings().first()

    if not row:
        # Niet gevonden of geen eigenaar
        raise HTTPException(status_code=404, detail="Collection not found.")

    return _row_to_out(row)


@router.patch("/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: str,
    payload: CollectionUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Werk een collection gedeeltelijk bij (PATCH).
    Alleen velden die in de payload staan worden aangepast.
    """
    engine = request.app.state.db_engine

    # 1) Bepaal welke velden geüpdatet mogen worden
    data = payload.model_dump(exclude_unset=True)
    print(data)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geen velden opgegeven om te updaten.",
        )

    allowed_cols = {"name", "description", "status"}  # voeg 'status' toe als je die wilt kunnen updaten
    set_clauses = []
    params: dict[str, Any] = {
        "cid": collection_id,
        "uid": current_user["sub"],  # eigenaarscheck via WHERE
    }

    for key, value in data.items():
        if key not in allowed_cols:
            continue
        set_clauses.append(f"{key} = :{key}")
        params[key] = value

    if not set_clauses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geen geldige velden opgegeven om te updaten.",
        )

    # 2) Bouw de UPDATE-statement met eigenaarscheck in WHERE
    sql = text(f"""
        UPDATE collections
           SET {', '.join(set_clauses)}, updated_at = NOW()
         WHERE id = :cid
           AND user_id = :uid
        RETURNING id, user_id, name, description, created_at, updated_at, status;
    """)

    with engine.begin() as conn:
        row = conn.execute(sql, params).mappings().first()

    if not row:
        # Niet gevonden of geen eigenaar
        raise HTTPException(status_code=404, detail="Collection not found.")

    return _row_to_out(row)
