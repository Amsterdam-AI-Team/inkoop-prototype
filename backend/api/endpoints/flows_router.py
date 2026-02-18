import logging

from fastapi import (APIRouter, Depends,
                     HTTPException, Request,
                     UploadFile, File,
                     Form, status, BackgroundTasks)

from sqlalchemy import text as sql_text

logger = logging.getLogger(__name__)
from typing import Any, Optional, List
from services.auth import get_current_user
from schemas.flows import (FlowCreate, FlowOut,
                           FlowCheckbox, CheckboxCreate,
                           FlowUpdate)

from schemas.websearch import (Source, WebSearchOut,
                               WebSearchIn, WebSearchResultLLM,
                               DbSource, DBWebSearchOut,
                               DownloadLinksIn)
from schemas.documents import DocumentResponse
from pathlib import Path
from uuid import UUID, uuid4
from hashlib import sha256
from utils.documents_utils import (sanitize_filename, detect_by_extension,
                                   extract_text, parse_tags)

from prompts.websearch import PROMPT_TEMPLATE
from browser_use import Agent, Browser, ChatAzureOpenAI
import os
from utils.ownership_utils import _assert_flow_owned, _assert_collection_owned
import httpx
from utils.websearch_utils import _extract_main_text, _sanitize_blob
from openai import AzureOpenAI
import time
import json
from bs4 import BeautifulSoup


router = APIRouter(tags=["flows"])

UPLOAD_ROOT = Path("uploads")  # vervang later door object storage adapter
MAX_BYTES = 25 * 1024 * 1024   # 25MB cap als voorbeeld


def _row_to_out(row: Any) -> FlowOut:
    return FlowOut(
        id=str(row["id"]),
        collection_id=str(row["collection_id"]),
        name=row["name"],
        description=row["description"],
        status=row["status"],
        template_name=row["template_name"],
        template_content=row["template_content"] if row["template_content"] else None,
        created_at=row["created_at"].isoformat() if row["created_at"] else None,
        updated_at=row["updated_at"].isoformat() if row["updated_at"] else None,
        context_content=row["context_content"] if row["context_content"] else None
    )


def checkbox_format_out(row: Any) -> FlowOut:
    return FlowCheckbox(
            id=str(row["id"]),
            flow_id=str(row["flow_id"]),
            name=row["name"],
            checked=row["checked"],
            created_at=row["created_at"].isoformat() if row["created_at"] else None
    )


@router.post("/collections/{collection_id}/flows", response_model=FlowOut, status_code=201)
def create_flow(
    collection_id: str,
    payload: FlowCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Maak een flow aan en koppel hem *direct* aan een collection.
    Flows kunnen later niet van collection wisselen.
    """
    engine = request.app.state.db_engine

    # 1) Check eigenaarschap van collection
    _assert_collection_owned(engine, collection_id, current_user["sub"])

    # 2) Insert flow
    sql_ins = sql_text("""
        INSERT INTO flows (collection_id, name, description, template_name, template_content)
        VALUES (:cid, :name, :desc, :tname, :tcontent)
        RETURNING id, collection_id, name, description, template_name, context_content,
                       created_at, updated_at, status, template_content;
    """)
    with engine.begin() as conn:
        row = conn.execute(sql_ins, {
            "cid": collection_id,
            "name": payload.name,
            "desc": payload.description,
            "tname": payload.template_name,
            "tcontent": payload.template_content
        }).mappings().first()

    return _row_to_out(row)


@router.delete("/flows/{flow_id}", status_code=204)
def delete_flow(
    flow_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Verwijdert een flow *alleen* als deze bij een collection hoort van de huidige user.
    """
    engine = request.app.state.db_engine

    # 1) Eigenaarscheck via join naar collections
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    # 2) Delete
    sql_del = sql_text("DELETE FROM flows WHERE id = :fid;")
    with engine.begin() as conn:
        conn.execute(sql_del, {"fid": flow_id})
    return


@router.patch("/flows/{flow_id}", response_model=FlowOut)
def update_flow(
    flow_id: str,
    payload: FlowUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Werk een flow gedeeltelijk bij (PATCH).
    Alleen velden die in de payload staan worden aangepast.
    """
    engine = request.app.state.db_engine

    # 1) Eigenaarscheck (zorg dat je deze helper al hebt zoals bij je andere routes)
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    # 2) Bepaal welke velden geüpdatet mogen worden
    data = payload.model_dump(exclude_unset=True)

    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geen velden opgegeven om te updaten.",
        )

    allowed_cols = {"name", "context_content", "template_name",
                    "template_content", "status", "description"}
    set_clauses = []
    params: dict[str, Any] = {"fid": flow_id}

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

    # 3) Bouw de UPDATE-statement
    sql = sql_text(f"""
        UPDATE flows
           SET {', '.join(set_clauses)}, updated_at = NOW()
         WHERE id = :fid
        RETURNING id, collection_id, name, status, description, context_content,
                  template_name, template_content, created_at, updated_at;
    """)

    with engine.begin() as conn:
        row = conn.execute(sql, params).mappings().first()

    if not row:
        # zou in principe niet moeten als _assert_flow_owned slaagt
        raise HTTPException(status_code=404, detail="Flow niet gevonden.")

    return _row_to_out(row)


@router.get("/flows/{flow_id}", response_model=FlowOut)
def get_flow(
    flow_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Haal een specifieke flow op die bij de huidige user hoort.
    """
    engine = request.app.state.db_engine

    # eigenaarscheck
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    sql = sql_text("""
        SELECT id, collection_id, name, description, template_name, context_content,
               template_content, created_at, updated_at, status
          FROM flows
         WHERE id = :fid
         LIMIT 1;
    """)
    with engine.connect() as conn:
        row = conn.execute(sql, {"fid": flow_id}).mappings().first()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found.")

    print(row)
    return _row_to_out(row)


@router.get("/collections/{collection_id}/flows", response_model=List[FlowOut])
def get_flows(
    collection_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Geef alle flows terug die bij een collection horen van de huidige user.
    """
    engine = request.app.state.db_engine

    # eigenaarscheck
    _assert_collection_owned(engine, collection_id, current_user["sub"])

    sql = sql_text("""
        SELECT id, collection_id, name, status, description, context_content, template_name, template_content, created_at, updated_at
          FROM flows
         WHERE collection_id = :cid
         ORDER BY created_at ASC;
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"cid": collection_id}).mappings().all()

    return [_row_to_out(r) for r in rows]


@router.post("/flows/{flow_id}/documents", response_model=DocumentResponse)
async def upload_document(
    flow_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    tags: Optional[str] = Form(default=None, description="JSON list or CSV string"),
    current_user: dict = Depends(get_current_user)
):
    engine = request.app.state.db_engine

    # 1) Basale validaties
    safe_name = sanitize_filename(file.filename or "upload")
    mime_type = detect_by_extension(safe_name)

    # 2) Lees bytes één keer
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (> {MAX_BYTES} bytes)")

    # 3) Hash & grootte
    checksum = sha256(data).hexdigest()
    original_size = len(data)

    # 4) Extract tekst (kan tijd kosten; voor MVP sync, later background task)
    try:
        text = extract_text(data, mime_type)
    except HTTPException as he:
        # laat 4xx/5xx vanuit helpers intact naar de client
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {e}")

    # 5) Opslaan origineel (lokaal; later vervangen door object storage)
    doc_id = uuid4()
    flow_dir = UPLOAD_ROOT / "flows" / str(flow_id)
    flow_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"{doc_id}-{safe_name}"
    storage_path = flow_dir / storage_name
    storage_path.write_bytes(data)

    # 6) Persist metadata in DB (documents)
    tags_list = parse_tags(tags)

    sql_ins = sql_text("""
        INSERT INTO documents (id, flow_id, title, mime_type, size_bytes, tags, text_content)
        VALUES (:id, :flow_id, :title, :mime, :size, :tags, :text_content)
        RETURNING id, flow_id, title, mime_type, size_bytes, tags, text_content, created_at, updated_at;
    """)

    with engine.begin() as conn:
        row = conn.execute(
            sql_ins,
            {
                "id": str(doc_id),
                "flow_id": str(flow_id),
                "title": safe_name,
                "mime": mime_type,
                "size": original_size,
                "tags": tags_list,
                "text_content": text,   # ▼ hier schrijf je de geëxtraheerde tekst weg
            }
        ).mappings().first()

    return DocumentResponse(
        id=doc_id,
        flow_id=flow_id,
        title=safe_name,
        original_filename=file.filename or safe_name,
        mime_type=mime_type,
        original_size_bytes=original_size,
        text_bytes=len(text.encode("utf-8")),
        sha256=checksum,
        tags=row["tags"],
        storage_path=str(storage_path),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/flows/{flow_id}/documents", response_model=List[DocumentResponse])
def get_documents(
    flow_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Haal alle documents op die bij een flow horen van de huidige user.
    """
    engine = request.app.state.db_engine

    # eigenaarscheck
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    sql = sql_text("""
        SELECT id, flow_id, title, mime_type, size_bytes, tags, text_content, created_at, updated_at
          FROM documents
         WHERE flow_id = :fid
         ORDER BY created_at ASC;
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"fid": str(flow_id)}).mappings().all()

    # Construct storage_path for each document
    documents = []
    for row in rows:
        storage_path = UPLOAD_ROOT / "flows" / str(flow_id) / f"{row['id']}-{row['title']}"
        text_content = row.get('text_content') or ''

        documents.append(DocumentResponse(
            id=row["id"],
            flow_id=row["flow_id"],
            title=row["title"],
            original_filename=row["title"],
            mime_type=row["mime_type"],
            original_size_bytes=row["size_bytes"],
            text_bytes=len(text_content.encode("utf-8")),
            sha256="",  # Not stored in DB, empty for listing
            tags=row["tags"] or [],
            storage_path=str(storage_path),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        ))

    return documents


@router.delete("/flows/{flow_id}/documents/{document_id}", status_code=204)
def delete_document(
    flow_id: UUID,
    document_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Verwijdert een document *alleen* als deze bij een flow hoort van de huidige user.
    Verwijdert ook het fysieke bestand van disk.
    """
    engine = request.app.state.db_engine

    # 1) Eigenaarscheck via flow
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    # 2) Haal document metadata op om bestand te kunnen verwijderen
    sql_get = sql_text("""
        SELECT id, title
          FROM documents
         WHERE id = :doc_id AND flow_id = :fid
         LIMIT 1;
    """)
    with engine.connect() as conn:
        doc_row = conn.execute(sql_get, {
            "doc_id": str(document_id),
            "fid": str(flow_id)
        }).mappings().first()

    if not doc_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found for this flow"
        )

    # 3) Verwijder fysiek bestand
    storage_path = UPLOAD_ROOT / "flows" / str(flow_id) / f"{doc_row['id']}-{doc_row['title']}"
    if storage_path.exists():
        storage_path.unlink()

    # 4) Delete uit database
    sql_del = sql_text("DELETE FROM documents WHERE id = :doc_id AND flow_id = :fid;")
    with engine.begin() as conn:
        conn.execute(sql_del, {"doc_id": str(document_id), "fid": str(flow_id)})

    return


async def run_search(query: str, k: int, flow_id, engine):

    ua = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    browser = Browser(
        headless=True,
        user_agent=ua,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-gpu",
        ],
        ignore_default_args=['--enable-automation'],
        user_data_dir="./.browser-profile",
        window_size={'width': 1366, 'height': 768},
        viewport={'width': 1366, 'height': 768},
        auto_download_pdfs=False,   # of set smaller limit
        accept_downloads=False,
        record_video_dir=None,
        record_har_path=None,
        wait_for_network_idle_page_load_time=1.0,
    )

    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
    if not deployment:
        raise RuntimeError("AZURE_OPENAI_DEPLOYMENT env var is missing")

    llm = ChatAzureOpenAI(model=deployment)

    sql_run_ins = sql_text("""
        INSERT INTO web_search_runs (flow_id, query, max_results, status, started_at)
        VALUES (:fid, :query, :k, 'running', NOW())
        RETURNING id;
    """)
    with engine.begin() as conn:
        run_row = conn.execute(
            sql_run_ins,
            {"fid": str(flow_id), "query": query, "k": k},
        ).mappings().first()
    run_id = run_row["id"]

    async def _hook_log(agent: Agent):
        # bijvoorbeeld: log URL / history / step info
        state = await agent.browser_session.get_browser_state_summary()
        url = state.url
        # jouw eigen log-functie, bijvoorbeeld:
        _log_search_event(engine, run_id, message=f"Browser at {url}")

    t0 = time.monotonic()
    status = "succeeded"
    error_msg = None

    prompt = PROMPT_TEMPLATE.substitute(q=query, k=k)
    agent = Agent(
        task=prompt,
        llm=llm,
        browser=browser,
        output_model_schema=WebSearchResultLLM,
        max_failures=5
    )

    sources: list[Source] = []

    try:

        history = await agent.run(
            on_step_start=_hook_log,
            on_step_end=_hook_log
        )

        # If structured output is available, use it
        if hasattr(history, "structured_output") and history.structured_output is not None:
            result: WebSearchResultLLM = history.structured_output
            data_to_insert = []

            async with httpx.AsyncClient(
                headers={"User-Agent": ua},
                timeout=httpx.Timeout(15.0, read=20.0),
                follow_redirects=True,
            ) as client:

                for idx, s in enumerate(result.sources, start=1):

                    try:
                        resp = await client.get(str(s.canonical_url))
                        resp.raise_for_status()
                        ctype = resp.headers.get("content-type", "").lower()
                        if "text/html" in ctype:
                            raw_html = resp.text
                            raw_html = _sanitize_blob(raw_html)
                            main_text = _extract_main_text(raw_html)
                            store_text = _sanitize_blob(main_text) or raw_html  # prefer main text
                        else:
                            store_text = f"<!-- non-html content-type: {ctype} -->"
                    except Exception as e:
                        store_text = f"<!-- fetch_error: {e} -->"

                    sources.append(
                        Source(
                            id=f"s{idx}",
                            url=str(s.canonical_url),
                            title=s.page_title,
                            summary=f"{s.summary} (Relevance: {s.relevance})"
                        )
                    )

                    data_to_insert.append(
                        {
                            "flow_id": str(flow_id),
                            "source_id": f"s{idx}",
                            "url": str(s.canonical_url),
                            "title": s.page_title,
                            "summary": f"{s.summary} (Relevance: {s.relevance})",
                            "html_content": store_text,  # sanitized + extracted
                        }
                    )

                    if len(sources) >= k:
                        break

            sql_ins = sql_text("""
                INSERT INTO web_search_sources (flow_id, source_id, url, title, summary, html_content)
                VALUES (:flow_id, :source_id, :url, :title, :summary, :html_content)
            """)
            with engine.begin() as conn:
                for param in data_to_insert:
                    conn.execute(sql_ins, param)

    except Exception as e:
        status = "failed"
        error_msg = str(e)[:1000]
        sources = []

    finally:
        duration_ms = int((time.monotonic() - t0) * 1000)
        sql_run_upd = sql_text("""
            UPDATE web_search_runs
               SET status = :st,
                   num_sources = :n,
                   error = :err,
                   finished_at = NOW(),
                   duration_ms = :dur
             WHERE id = :rid;
        """)
        with engine.begin() as conn:
            conn.execute(
                sql_run_upd,
                {
                    "st": status,
                    "n": len(sources),
                    "err": error_msg,
                    "dur": duration_ms,
                    "rid": str(run_id),
                },
            )

    return sources


@router.post("/flows/{flow_id}/websearch", status_code=201)
async def websearch_sources(payload: WebSearchIn,
                            request: Request,
                            flow_id: UUID,
                            background_tasks: BackgroundTasks,
                            current_user: dict = Depends(get_current_user)):

    engine = request.app.state.db_engine

    # eigenaarscheck
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    background_tasks.add_task(
        run_search,
        payload.query,
        payload.max_results,
        flow_id,
        engine,
    )

    return {
        "status": "started",
        "flow_id": str(flow_id),
        "query": payload.query,
        "max_results": payload.max_results,
    }



@router.post("/flows/{flow_id}/websearch/get_sources")
async def get_sources(flow_id: UUID, request: Request,
                      current_user: dict = Depends(get_current_user)):
    engine = request.app.state.db_engine

    # eigenaarscheck
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    sql = sql_text("""
        SELECT flow_id, id, source_id, url, title, summary, include_in_result
        FROM web_search_sources
        WHERE flow_id = :flow_id;
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"flow_id": str(flow_id)}).mappings().all()

    return DBWebSearchOut(sources=[DbSource(**row) for row in rows])


@router.post("/flows/{flow_id}/websearch/source/{source_id}/include/{checked}")
async def include_source(flow_id: UUID, request: Request,
                         source_id: UUID, checked: bool,
                         current_user: dict = Depends(get_current_user)):
    engine = request.app.state.db_engine
    # eigenaarscheck
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    sql = sql_text("""
        UPDATE web_search_sources SET include_in_result = :checked
        WHERE flow_id = :flow_id AND id = :source_id
        RETURNING id, flow_id, source_id, url, title, summary, include_in_result;
    """)

    with engine.begin() as conn:
        result = conn.execute(sql, {
            "flow_id": str(flow_id),
            "source_id": str(source_id),
            "checked": checked
        })
        row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Source not found for given flow")

    return DbSource(**row)


@router.get("/flows/{flow_id}/websearch/status")
def websearch_status(
    flow_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = request.app.state.db_engine

    _assert_flow_owned(engine, flow_id, current_user["sub"])

    # 1) laatste run ophalen
    sql_run = sql_text("""
        SELECT *
        FROM web_search_runs
        WHERE flow_id = :fid
        ORDER BY started_at DESC
        LIMIT 1;
    """)
    with engine.connect() as conn:
        run = conn.execute(sql_run, {"fid": str(flow_id)}).mappings().first()

    if not run:
        raise HTTPException(404, "Nog geen websearch uitgevoerd.")

    # 2) logs ophalen
    sql_logs = sql_text("""
        SELECT step, level, message, created_at
        FROM web_search_logs
        WHERE run_id = :rid
        ORDER BY created_at ASC;
    """)
    with engine.connect() as conn:
        logs = conn.execute(sql_logs, {"rid": str(run["id"])}).mappings().all()

    return {
        "run": {
            "id": str(run["id"]),
            "query": run["query"],
            "status": run["status"],
            "started_at": run["started_at"].isoformat(),
            "finished_at": run["finished_at"].isoformat() if run["finished_at"] else None,
            "duration_ms": run["duration_ms"],
            "num_sources": run["num_sources"],
            "error": run["error"],
        },
        "logs": [
            {
                "step": l["step"],
                "level": l["level"],
                "message": l["message"],
                "created_at": l["created_at"].isoformat(),
            }
            for l in logs
        ],
    }

# Start een nieuwe run
def _truncate(s: str, limit: int) -> str:
    if s is None:
        return ""
    return s if len(s) <= limit else s[:limit] + "\n...[truncated]"

# --- Start een nieuwe run -------------------------------------------------


@router.post("/flows/{flow_id}/runs", status_code=201)
async def start_run(
    flow_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = request.app.state.db_engine

    # 1) Eigenaarschap
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    # 2) Haal alle documenten (text_content) voor deze flow
    sql_docs = sql_text("""
        SELECT id, title, text_content
          FROM documents
         WHERE flow_id = :fid
         ORDER BY created_at ASC;
    """)
    with engine.connect() as conn:
        doc_rows = conn.execute(sql_docs, {"fid": str(flow_id)}).mappings().all()

    # 3) Start run in database pluggen
    # 3) Start run in database pluggen
    selected_ids = [str(r["id"]) for r in doc_rows]
    sql_run_ins = sql_text("""
        INSERT INTO flow_runs (flow_id, status, variables, selected_document_ids, started_at)
        VALUES (:fid, :status, :variables, :selected_ids, NOW())
        RETURNING id;
    """)

    with engine.begin() as conn:
        row = conn.execute(
            sql_run_ins,
            {
                "fid": str(flow_id),
                "status": "running",
                "variables": json.dumps({}),          # wordt netjes jsonb
                "selected_ids": json.dumps(selected_ids),
            },
        ).mappings().first()
    run_id = row["id"]

    # Bouw een compacte context uit documenten (limiteer om prompt blow-ups te voorkomen)
    # Max ~15k chars totaal uit docs
    docs_blob_parts = []
    remaining = 15000
    for r in doc_rows:
        chunk = f"# {r['title']}\n{r['text_content'] or ''}\n"
        chunk = _truncate(chunk, min(4000, remaining))
        if not chunk:
            continue
        docs_blob_parts.append(chunk)
        remaining -= len(chunk)
        if remaining <= 0:
            break
    docs_blob = "\n\n".join(docs_blob_parts).strip() or "[no documents]"

    # 4) Haal aangevinkte websearch bronnen op en download HTML (headless avoided; simpele HTTP GET)
    sql_ws = sql_text("""
        SELECT id, url, title
          FROM web_search_sources
         WHERE flow_id = :fid AND include_in_result = TRUE
         ORDER BY created_at ASC;
    """)
    with engine.connect() as conn:
        ws_rows = conn.execute(sql_ws, {"fid": str(flow_id)}).mappings().all()

    # REPLACE: i.p.v. httpx downloaden – haal html_content direct uit DB
    sql_ws_html = sql_text("""
        SELECT title, url, html_content
          FROM web_search_sources
         WHERE flow_id = :fid AND include_in_result = TRUE
         ORDER BY created_at ASC;
    """)
    with engine.connect() as conn:
        ws_html_rows = conn.execute(sql_ws_html, {"fid": str(flow_id)}).mappings().all()

    if ws_html_rows:
        web_html_blob = "\n\n".join(
            f"### {r['title'] or r['url']}\nURL: {r['url']}\n\n```html\n{r.get('html_content') or ''}\n```"
            for r in ws_html_rows
        ).strip()
    else:
        # Geen aangevinkte bronnen: lege (maar expliciete) context
        web_html_blob = "[no websearch sources selected]"


    # 5) Haal de template die bij de flow hoort + collectie-prompt
    sql_tpl = sql_text("""
        SELECT f.template_name, f.template_content,
               c.template_content AS collection_template_content
          FROM flows f
          JOIN collections c ON c.id = f.collection_id
         WHERE f.id = :fid
         LIMIT 1;
    """)
    with engine.connect() as conn:
        tpl_row = conn.execute(sql_tpl, {"fid": str(flow_id)}).mappings().first()
    if not tpl_row or not tpl_row["template_content"]:
        raise HTTPException(status_code=400, detail="Flow heeft geen template_content.")

    template_content = tpl_row["template_content"]
    collection_template_content = tpl_row["collection_template_content"]
    
    # 6) Stuur naar OpenAI: template + injected bronnen/context
    #    We binden alles in één user message (systeemrol kan je later finetunen)
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")

    if not (endpoint and api_key ):
        raise HTTPException(status_code=500, detail="Azure OpenAI env vars ontbreken (endpoint/key).")

    # Maak een samengestelde prompt die jouw template *leidend* maakt en
    # documents/web_html als context aanbiedt.
    collection_context = ""
    if collection_template_content:
        collection_context = f"<<COLLECTION_CONTEXT>>\n{collection_template_content}\n\n"

    user_payload = (
        f"{collection_context}"
        f"<<TEMPLATE_CONTENT>>\n{template_content}\n\n"
        f"<<DOCUMENTS_CONTEXT>>\n{docs_blob}\n\n"
        f"<<WEB_SOURCES_HTML>>\n{web_html_blob}\n\n"
        "Gebruik uitsluitend de informatie hierboven. Wees specifiek en onderbouwd; "
        "verwijs impliciet naar bronnen (niet als footnotes), en maak een samenhangende tekst passend bij de template."
    )

    from utils.admin_utils import get_setting

    system_prompt = get_setting(engine, "system_prompt") or (
        "Je bent een schrijfhulp, help de gebruiker een fijne tekst te schrijven. "
        "De gebruiker moet dit systeem prompt nog aanpassen via het beheerpaneel."
    )

    chat_body = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]

    # Log the full prompt being sent to the LLM
    logger.info("=== CONCEPTTEKST PROMPT (flow_id=%s) ===", flow_id)
    for msg in chat_body:
        logger.info("--- role: %s ---\n%s", msg["role"], msg["content"])
    logger.info("=== END PROMPT ===")

    # Call Azure OpenAI (async)
    client = AzureOpenAI(
        api_version=os.getenv("API_VERSION"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    )

    t0 = time.monotonic()
    response = client.chat.completions.create(
        messages=chat_body,
        max_completion_tokens=16384,
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT")
    )

    latency_ms = int((time.monotonic() - t0) * 1000)
    model_name = os.getenv("AZURE_OPENAI_DEPLOYMENT") or "unknown"
    resp_text = (response.choices[0].message.content or "")
    tokens_prompt = getattr(getattr(response, "usage", None), "prompt_tokens", None)
    tokens_completion = getattr(getattr(response, "usage", None), "completion_tokens", None)

    sql_gen_ins = sql_text("""
        INSERT INTO generations (flow_run_id, model_name, prompt, response, tokens_prompt, tokens_completion, latency_ms)
        VALUES (:run_id, :model, :prompt, :response, :tp, :tc, :latency)
        RETURNING id;
    """)

    sql_run_ok = sql_text("""
        UPDATE flow_runs SET status = :st, finished_at = NOW()
        WHERE id = :rid;
    """)

    with engine.begin() as conn:
        gen_row = conn.execute(sql_gen_ins, {
            "run_id": str(run_id),
            "model": model_name,
            "prompt": user_payload,      # of json.dumps(chat_body)
            "response": resp_text,
            "tp": tokens_prompt,
            "tc": tokens_completion,
            "latency": latency_ms,
        }).mappings().first()

        conn.execute(sql_run_ok, {"st": "succeeded", "rid": str(run_id)})

    generation_id = gen_row["id"]

    # 7) Return 201 (bewuste minimalistische response)
    return {
        "status": "started",
        "message": "Run gestart: template en bronnen zijn naar OpenAI gestuurd.",
        "flow_id": str(flow_id),
        "run_id": str(run_id),
        "generation_id": str(generation_id),
        "documents_used": len(doc_rows),
        "web_sources_used": len(ws_html_rows),
    }


# Haal een lijst van runs op
# Haal een lijst van runs op
@router.get("/flows/{flow_id}/runs")
def get_runs(
    flow_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = request.app.state.db_engine

    # eigenaarscheck
    _assert_flow_owned(engine, str(flow_id), current_user["sub"])

    sql = sql_text("""
        SELECT fr.id, fr.flow_id, fr.status, fr.variables, fr.selected_document_ids,
               fr.started_at, fr.finished_at, fr.error, fr.created_at,
               g.response, g.created_at AS generation_created_at,
               g.edited_response, g.edited_at, g.is_user_edited
          FROM flow_runs fr
         LEFT JOIN generations g ON g.flow_run_id = fr.id
         WHERE fr.flow_id = :fid
         ORDER BY fr.created_at DESC;
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"fid": str(flow_id)}).mappings().all()

    # gewoon ruwe dicts teruggeven
    return [dict(r) for r in rows]


# Haal details van een specifieke run op
@router.get("/flows/{flow_id}/runs/{run_id}")
def get_run(
    flow_id: UUID,
    run_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    engine = request.app.state.db_engine

    # eigenaarscheck op de flow
    _assert_flow_owned(engine, str(flow_id), current_user["sub"])

    sql_run = sql_text("""
        SELECT id, flow_id, status, variables, selected_document_ids,
               started_at, finished_at, error, created_at
          FROM flow_runs
         WHERE id = :rid AND flow_id = :fid
         LIMIT 1;
    """)
    sql_gen = sql_text("""
        SELECT id, flow_run_id, model_name, prompt, response,
               tokens_prompt, tokens_completion, latency_ms, created_at
          FROM generations
         WHERE flow_run_id = :rid
         ORDER BY created_at ASC;
    """)

    with engine.connect() as conn:
        run_row = conn.execute(
            sql_run, {"rid": str(run_id), "fid": str(flow_id)}
        ).mappings().first()

        if not run_row:
            raise HTTPException(status_code=404, detail="Run not found for this flow")

        gen_rows = conn.execute(
            sql_gen, {"rid": str(run_id)}
        ).mappings().all()

    return {
        "run": dict(run_row),
        "generations": [dict(g) for g in gen_rows],
    }


@router.post("/flows/{flow_id}/checkboxes")
def create_checkbox(
    flow_id: str,
    payload: CheckboxCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)):

    engine = request.app.state.db_engine

    # 1) Check eigenaarschap van collection
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    # 2) Insert flow
    sql_ins = sql_text("""
        INSERT INTO flow_checkboxes (flow_id, name)
        VALUES (:fid, :name)
        RETURNING id, flow_id, name, created_at, checked;
    """)

    with engine.begin() as conn:
        row = conn.execute(sql_ins, {
            "fid": flow_id,
            "name": payload.name
        }).mappings().first()

    return checkbox_format_out(row)

# Get all checkboxes
@router.get("/flows/{flow_id}/checkboxes/")
def get_checkboxes(flow_id: UUID, request: Request,
                   current_user: dict = Depends(get_current_user)):

    engine = request.app.state.db_engine

    # 1) Check eigenaarschap van flow
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    # 2) Get all checkboxes for this flow
    sql_get = sql_text("""
        SELECT id, flow_id, name, created_at, checked
        FROM flow_checkboxes
        WHERE flow_id = :fid
        ORDER BY created_at ASC;
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql_get, {"fid": str(flow_id)}).mappings().all()

    return [checkbox_format_out(r) for r in rows]


@router.post("/flows/{flow_id}/checkboxes/{checkbox_id}/toggle/{checked}")
def toggle_checkbox(flow_id: UUID, checkbox_id: UUID, checked: bool,
                    request: Request,
                    current_user: dict = Depends(get_current_user)):

    engine = request.app.state.db_engine

    # eigenaarscheck
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    sql = sql_text("""
        UPDATE flow_checkboxes SET checked=:checked
        WHERE id = :checkbox_id AND flow_id = :flow_id
        RETURNING id, flow_id, name, created_at, checked;
    """)

    with engine.begin() as conn:
        result = conn.execute(sql, {
            "flow_id": str(flow_id),
            "checkbox_id": str(checkbox_id),
            "checked": checked
        })
        row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Source not found for given flow")

    return checkbox_format_out(row)


@router.post("/flows/{flow_id}/websearch/download")
async def dowload_weblinks(
    flow_id: UUID,
    payload: DownloadLinksIn,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Haal alle opgegeven weblinks op, scrape basisinformatie met BeautifulSoup
    en sla ze op in web_search_sources.
    """
    engine = request.app.state.db_engine

    # eigenaarscheck
    _assert_flow_owned(engine, flow_id, current_user["sub"])

    # simpele HTTP client
    ua = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    inserted_rows = []

    async with httpx.AsyncClient(headers={"User-Agent": ua},
                                 timeout=httpx.Timeout(15.0, read=20.0),
                                 follow_redirects=True) as client:
        idx = 0
        for url in payload.urls:
            idx += 1
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                html = resp.text

                # BeautifulSoup parsing
                soup = BeautifulSoup(html, "html.parser")

                # Titel: <title> of fallback
                title = (soup.title.string.strip()
                         if soup.title and soup.title.string else url)

                # Een eenvoudige "summary": eerste ~400 chars van de zichtbare tekst
                text = soup.get_text(separator=" ", strip=True)
                text = _sanitize_blob(text)  # hergebruik je bestaande sanitiser
                summary = (text[:400] + "…") if len(text) > 400 else text

                # Wat we in html_content opslaan: geschoonde, eventueel ingekorte tekst
                main_text = _extract_main_text(html)
                store_text = _sanitize_blob(main_text) or text or ""
            except Exception as e:
                # Fallback bij fouten
                title = url
                summary = f"<!-- fetch_error: {e} -->"
                store_text = summary

            source_id = f"m{idx}"  # eigen ID voor deze bron (manual)

            sql_ins = sql_text("""
                INSERT INTO web_search_sources (flow_id, source_id, url, title, summary, html_content)
                VALUES (:flow_id, :source_id, :url, :title, :summary, :html_content)
                RETURNING flow_id, id, source_id, url, title, summary, include_in_result;
            """)

            with engine.begin() as conn:
                row = conn.execute(sql_ins, {
                    "flow_id": str(flow_id),
                    "source_id": source_id,
                    "url": url,
                    "title": title,
                    "summary": summary,
                    "html_content": store_text,
                }).mappings().first()
                inserted_rows.append(row)

    # Gebruik hetzelfde DB-outputmodel als /get_sources
    return DBWebSearchOut(sources=[DbSource(**row) for row in inserted_rows])


def _log_search_event(engine, run_id: str, message: str, step: int | None = None, level: str = "info"):
    sql = sql_text("""
        INSERT INTO web_search_logs (run_id, step, level, message)
        VALUES (:run_id, :step, :level, :msg)
    """)
    with engine.begin() as conn:
        conn.execute(sql, {
            "run_id": run_id,
            "step": step,
            "level": level,
            "msg": message,
        })

