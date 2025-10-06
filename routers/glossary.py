from fastapi import APIRouter, Request,HTTPException, Form
from fastapi.responses import RedirectResponse,StreamingResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from typing import Optional
import sqlite3
import traceback

glossary_router = APIRouter(
    prefix="/glossary",
    tags=["glossary"]
)

# -------------------------
# Helper functions
# -------------------------

def query_glossary(conn, q: str = None, page: int = 1, limit: int = 20,dbDump = False):
    """
        Shared helper for querying glossary entries.
        If dbDump=True, returns all rows (no pagination or counts).
        Otherwise returns (rows, total_rows, total_pages).
        """
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if dbDump:
        cur.execute(
            """
            SELECT *
            FROM glossary
            """)
        rows = cur.fetchall()
        return rows
    
    # --- Validate pagination ---
    page = max(page, 1)
    limit = min(max(limit, 1), 100)
    offset = (page - 1) * limit

    # --- Fetch rows ---
    if q:
        cur.execute(
            """
            SELECT id, chinese, english
            FROM glossary
            WHERE chinese LIKE ? OR english LIKE ?
            ORDER BY chinese ASC
            LIMIT ? OFFSET ?
            """,
            (f"%{q}%", f"%{q}%", limit, offset)
        )
    else:
        cur.execute(
            """
            SELECT id, chinese, english
            FROM glossary
            ORDER BY chinese ASC
            LIMIT ? OFFSET ?
            """,
            (limit, offset)
        )
    rows = cur.fetchall()

    # --- Count total rows for pagination ---
    if q:
        cur.execute(
            "SELECT COUNT(*) FROM glossary WHERE chinese LIKE ? OR english LIKE ?",
            (f"%{q}%", f"%{q}%")
        )
    else:
        cur.execute("SELECT COUNT(*) FROM glossary")
    total_rows = cur.fetchone()[0]
    total_pages = (total_rows + limit - 1) // limit

    return rows, total_rows, total_pages

templates = Jinja2Templates(directory="templates")

'''
| Method   | Endpoint                        | Description                                                                      |
| -------- | ------------------------------- | -------------------------------------------------------------------------------- |
| `GET`    | `/glossary`                     | View or search glossary terms. Query params: `?search=<term>&page=<n>&limit=<m>` |
| `POST`   | `/glossary`                     | Add a new glossary term                                                          |
| `PATCH`  | `/glossary/{term_id}`           | Edit existing term                                                               |
| `DELETE` | `/glossary/{term_id}`           | Delete term by ID                                                                |
| `GET`    | `/glossary/export` _(optional)_ | Export glossary as JSON or CSV                                                   |
'''

@glossary_router.get("/")
async def get_glossary(
    request: Request,
    q: str = None,
    page: int = 1,
    limit: int = 20
):
    try:
        conn = request.app.state.db
        rows, total_rows, total_pages = query_glossary(conn, q, page, limit)

        has_next = page < total_pages
        has_prev = page > 1

        return templates.TemplateResponse(
            "glossary.html",
            {
                "request": request,
                "rows": rows,
                "q": q,
                "page": page,
                "limit": limit,
                "total_rows": total_rows,
                "total_pages": total_pages,
                "has_next": has_next,
                "has_prev": has_prev,
            }
        )

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")

@glossary_router.post("/")
async def add_term(
    request: Request,
    chinese: str = Form(...),
    english: str = Form(...),
    notes: Optional[str] = Form(None)
    ):
    try:
        conn = request.app.state.db
        cur = conn.cursor()
        cur.execute(
            "INSERT OR IGNORE INTO glossary (chinese, english, notes) VALUES (?, ?, ?)",
            (chinese, english, notes)
        )
        conn.commit()
        return RedirectResponse("/glossary/", status_code=303)
    except Exception as e:
        print("Error adding glossary term:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@glossary_router.patch("/{term_id}")
async def edit_term(
    request: Request,
    term_id: int,
    chinese: str = Form(...),
    english: str = Form(...),
    notes: Optional[str] = Form(None)
    ):
    try:
        conn = request.app.state.db
        cur = conn.cursor()
        cur.execute(
            "UPDATE glossary SET chinese = ?, english = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (chinese, english, notes, term_id)
        )
        conn.commit()
        return RedirectResponse("/glossary/", status_code=303)
    except:
        pass

@glossary_router.delete("/{term_id}")
async def delete_term(
    request: Request,
    term_id: int
    ):
    try:
        conn = request.app.state.db
        cur = conn.cursor()
        cur.execute("DELETE FROM glossary WHERE id = ?", (term_id,))
        conn.commit()
        return RedirectResponse("/glossary/", status_code=303)
    except:
        pass

@glossary_router.get("/export")
async def download_glossary(
    request: Request
    ):
    try:
        conn = request.app.state.db
        cur = conn.cursor()
        cur.execute("SELECT chinese, english FROM glossary")
        rows = cur.fetchall()
   
        import csv, io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerows(rows)
        conn.close()
        
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=glossary.csv"}
        )
    except:
        pass



    