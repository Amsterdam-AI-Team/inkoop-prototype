from fastapi import HTTPException
from sqlalchemy import text as sql_text
from uuid import UUID


def _assert_flow_owned(engine, flow_id: UUID, user_id: str) -> None:
    sql_check = sql_text("""
        SELECT 1
          FROM flows f
          JOIN collections c ON c.id = f.collection_id
         WHERE f.id = :fid AND c.user_id = :uid
         LIMIT 1;
    """)
    with engine.connect() as conn:
        ok = conn.execute(sql_check, {"fid": str(flow_id), "uid": user_id}).scalar()
    if not ok:
        raise HTTPException(status_code=404, detail="Flow not found.")


def _assert_collection_owned(engine, collection_id: UUID, user_id: str):
    # 1) Check eigenaarschap van collection
    sql_check = sql_text("""
        SELECT 1 FROM collections
         WHERE id = :cid AND user_id = :uid
         LIMIT 1;
    """)
    with engine.connect() as conn:
        ok = conn.execute(sql_check, {"cid": collection_id, "uid": user_id}).scalar()
    if not ok:
        raise HTTPException(status_code=404, detail="Collection not found.")