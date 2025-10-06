from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
import ollama
from .glossary import query_glossary

chat_router = APIRouter(
    prefix="/chat",   
    tags=["chat"]
)

templates = Jinja2Templates(directory="templates")


def build_translate_prompt(glossary_prompt: str | None = None) -> str:
    """Constructs a full translation system prompt, including glossary terms if available."""
    glossary_section = f"\nGlossary (strictly apply):\n{glossary_prompt}\n" if glossary_prompt else ""

    return (
        "You are a careful translator.\n\n"
        "Translation Rules:\n"
        "1. Always follow the provided glossary mappings strictly.\n"
        "2. Do not add explanations, commentary, or personal opinions.\n"
        "3. Do not use Sanskritized or overly religious terminology unless it appears explicitly in the glossary.\n"
        "4. Use simple, modern English equivalents whenever possible.\n"
        "5. Ensure the result can be understood by a high school level reader.\n"
        "6. Preserve all numbers, dates, and numerical expressions literally.\n"
        "7. Do NOT change numbers in meaning or combine them.\n"
        "8. Do NOT approximate or round any numeric values.\n\n"
        "Output format:\n"
        "- Return only the translated text.\n"
        "- Do not include notes, explanations, or metadata.\n"
        + glossary_section
    )

GRAMMARLY_PROMPT = """
You are a grammar and spelling corrector.
Your goal is to correct the provided English text without changing its meaning.

Rules:
1. Fix only grammar, punctuation, and spelling mistakes.
2. Preserve the original meaning and tone exactly.
3. Do not add, remove, or rephrase ideas.
4. Do not introduce examples, commentary, or outside information.
5. Keep sentence structure and style natural, minimal edits only.
6. Return only the corrected text — no extra output, explanations, or notes.
"""


# -------------------------
# Helper functions
# -------------------------

def glossary_to_prompt(glossary: dict) -> str:
    if not glossary:
        return ""
    items = "\n".join(f"{src} → {tgt}" for src, tgt in glossary.items())
    return f"Glossary (strictly apply these mappings):\n{items}\n\n"

def get_relevant_glossary(text: str, glossary_list: list) -> dict:
    relevant = {}
    for term in glossary_list:
        src = term["chinese"]
        tgt = term["english"]
        if len(src) > 1 and src in text:
            relevant[src] = tgt
    return relevant

async def fetch_glossary_from_db(request: Request) -> list:
    conn = request.app.state.db
    rows = query_glossary(conn=conn, dbDump = True)  
    print(f"Retrieved {len(rows)} items ...")
    #print(rows)
    return [{"chinese": r["chinese"], "english": r["english"]} for r in rows]


def generateOllamaPrompt(system_prompt: str, model: str, user_prompt: str):
    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            options={
                "temperature": 0.0
            }
        )
        return response.get("message", {}).get("content", "[Error: Empty response from model]")
    except Exception as e:
        return f"[Error from model: {e}]"
    


@chat_router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("chat.html", {"request": request})

@chat_router.post("/translate")
async def translate(request: Request):
    data = await request.json()
    user_message = data.get("message")

    glossary_list = await fetch_glossary_from_db(request)
    #print(glossary_list) - confirmed glossary gets populated
    glossary_dict = get_relevant_glossary(user_message, glossary_list)
    glossary_prompt = glossary_to_prompt(glossary_dict)


    system_prompt = build_translate_prompt(glossary_prompt)
    print(system_prompt)
    resp = generateOllamaPrompt(system_prompt,"deepseek-v2:16b", user_message)
    return JSONResponse({"reply": resp, "glossary_prompt": glossary_prompt})

@chat_router.post("/grammarly")
async def grammarly(request: Request):
    data = await request.json()
    user_message = data.get("message")
    #currently testing which model to use
    models = ["deepseek-v2:16b","qwen2.5:7b","mistral:7b","llama3:8b"]
    resp = generateOllamaPrompt(GRAMMARLY_PROMPT,models[1], user_message)
    return JSONResponse({"reply": resp})

