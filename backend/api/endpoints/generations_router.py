from fastapi import APIRouter, HTTPException, Depends, Request, status

from sqlalchemy import text as sql_text
from uuid import UUID
from services.auth import get_current_user
from schemas.generations import GenerationEditIn


router = APIRouter(prefix="/generations", tags=["generations"])


@router.patch("/{generation_id}/edit", status_code=200)
def edit_generation_text(
    generation_id: UUID,
    payload: GenerationEditIn,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Laat de gebruiker de concepttekst (LLM-output) bewerken en als nieuwe versie opslaan.
    Slaat NIET het originele response veld over — dat blijft behouden.
    """
    engine = request.app.state.db_engine

    # 1. Check of generation bestaat en dat de user eigenaar is van de flow_run->flow->collection chain
    sql_fetch = sql_text("""
        SELECT g.id, fr.flow_id, c.user_id
          FROM generations g
          JOIN flow_runs fr ON fr.id = g.flow_run_id
          JOIN flows f ON f.id = fr.flow_id
          JOIN collections c ON c.id = f.collection_id
         WHERE g.id = :gid
         LIMIT 1;
    """)

    with engine.connect() as conn:
        row = conn.execute(sql_fetch, {"gid": str(generation_id)}).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Generation not found.")

    if str(row["user_id"]) != str(current_user["sub"]):
        raise HTTPException(status_code=403, detail="Not allowed.")

    # 2. Update edited response
    sql_update = sql_text("""
        UPDATE generations
           SET edited_response = :txt,
               edited_at = NOW(),
               is_user_edited = TRUE
         WHERE id = :gid
        RETURNING id, edited_response, edited_at, is_user_edited;
    """)

    with engine.begin() as conn:
        res = conn.execute(sql_update, {"gid": str(generation_id), "txt": payload.edited_text}).mappings().first()

    return {
        "status": "updated",
        "generation_id": str(res["id"]),
        "edited_text": res["edited_response"],
        "edited_at": res["edited_at"],
        "is_user_edited": res["is_user_edited"],
    }
