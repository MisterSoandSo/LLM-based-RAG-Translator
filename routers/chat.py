from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import ollama
from .glossary import query_glossary

chat_router = APIRouter(prefix="/chat", tags=["chat"])


# -------------------------
# Prompt Builders
# -------------------------
def build_translate_prompt(glossary_prompt: str | None = None) -> str:
    glossary_section = f"\nGlossary (strictly apply):\n{glossary_prompt}\n" if glossary_prompt else ""
    return (
        "You are a professional translator tasked with translating **Chinese text into natural English**.\n"
        "Follow these steps carefully:\n"
        "1. The input text will be entirely or mostly in Chinese.\n"
        "2. Translate it into fluent, natural, idiomatic English suitable for a high-school-level reader.\n"
        "3. Use the glossary below strictly: whenever a term appears in the text, replace it with its English equivalent.\n"
        "4. Preserve all numbers, dates, and the logical sequence of events.\n"
        "5. Do NOT output any Chinese text in the final answer.\n"
        "6. Do NOT add commentary or explanations—just produce the English translation.\n"
        "7. If something cannot be translated directly, provide the closest natural English phrasing.\n"
        + glossary_section
    )

GRAMMARLY_PROMPT = """
You are a grammar and spelling corrector.
Correct grammar, punctuation, and spelling without changing meaning.
Keep sentence structure and style natural; minimal edits only.
Return only the corrected text.
"""


# -------------------------
# Glossary Helpers
# -------------------------
def glossary_to_prompt(glossary: dict) -> str:
    if not glossary:
        return ""
    return "\n".join(f"{src} → {tgt}" for src, tgt in glossary.items())


def get_relevant_glossary(text: str, glossary_list: list) -> dict:
    relevant = {}
    for term in glossary_list:
        src, tgt = term["chinese"], term["english"]
        if len(src) > 1 and src in text:
            relevant[src] = tgt
    return relevant


async def fetch_glossary_from_db(request: Request) -> list:
    conn = request.app.state.db
    rows = query_glossary(conn=conn, dbDump=True)
    return [{"chinese": r["chinese"], "english": r["english"]} for r in rows]


# -------------------------
# Ollama Helper
# -------------------------
def generate_ollama_prompt(system_prompt: str, model: str, user_prompt: str):
    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            options={"temperature": 0.0},
        )
        return response.get("message", {}).get("content", "[Error: Empty response]")
    except Exception as e:
        return f"[Error from model: {e}]"


# -------------------------
# Routes
# -------------------------

@chat_router.post("/translate/start")
async def start_translation(request: Request):
    data = await request.json()
    user_message = data.get("message")

    glossary_list = await fetch_glossary_from_db(request)
    glossary_dict = get_relevant_glossary(user_message, glossary_list)

    if not glossary_dict:
        return JSONResponse({"stage": "complete", "reply": "No glossary match found."})

    return JSONResponse({
        "stage": "confirm_glossary",
        "glossary_options": glossary_dict
    })


@chat_router.post("/translate/confirm")
async def confirm_translation(request: Request):
    data = await request.json()
    user_message = data.get("message")
    confirmed_glossary = data.get("confirmed_glossary", {})

    glossary_prompt = glossary_to_prompt(confirmed_glossary)
    system_prompt = build_translate_prompt(glossary_prompt)

    resp = generate_ollama_prompt(system_prompt, "deepseek-v2:16b", user_message)
    
    return JSONResponse({
        "stage": "complete",
        "reply": resp,
        "glossary_prompt": glossary_prompt
    })


@chat_router.post("/translate/polish")
async def polish_translation(request: Request):
    data = await request.json()
    user_message = data.get("message", "").strip()
    model = "qwen2.5:7b"

    # Run the grammar model
    corrected = generate_ollama_prompt(GRAMMARLY_PROMPT, model, user_message).strip()

    # Normalize whitespace for comparison
    def normalize(s: str) -> str:
        return " ".join(s.split())

    if normalize(corrected) == normalize(user_message):
        reply = "No change necessary."
    else:
        reply = corrected

    return JSONResponse({"reply": reply})
