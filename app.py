from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from routers import chat_router, glossary_router
from database import get_connection, init_db
templates = Jinja2Templates(directory="templates")

# This dictionary will store our shared state, which in this case
# includes our database connection.
state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):   
    # --- Code to run on startup ---
    print("Application starting up...")
    
    init_db()
    app.state.db = get_connection()
    print("Application SQL Database connected ...")
    yield  # now the app is running

    # Graceful shutdown
    app.state.db.close()
    print("Shutting down...")

# Create the FastAPI app instance and pass the lifespan event
app = FastAPI(lifespan=lifespan)

# Mount static files (optional, for serving CSS, JS, images, etc.)
app.mount("/static", StaticFiles(directory="static"), name="static")

# API Routes
app.include_router(chat_router)
app.include_router(glossary_router)

# Serve HTML frontend separately
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("chat.html", {"request": request})





