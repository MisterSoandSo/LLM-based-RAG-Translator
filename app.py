import csv
import ollama
from pathlib import Path
from fastapi import FastAPI, Form,Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# --- FastAPI setup ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- Utility: read CSV into dict ---
def read_csv_to_dict(filename, key_col, value_col):
    mapping_dict = {}
    try:
        with open(filename, mode='r', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            for row in reader:
                if len(row) > max(key_col, value_col):
                    key_text = row[key_col].strip()
                    value_text = row[value_col].strip()
                    mapping_dict[key_text] = value_text
    except FileNotFoundError:
        print(f"Error: The file '{filename}' was not found.")
    except Exception as e:
        print(f"An error occurred while reading {filename}: {e}")
    return mapping_dict

# --- Load glossary from multiple CSVs ---
dict1 = read_csv_to_dict("dictionary.csv", 0, 1)
dict2 = read_csv_to_dict("dictionary2.csv", 0, 1)
dict1.update(dict2)
try:
    dict3 = read_csv_to_dict("dictionary3.csv", 0, 1)
    dict1.update(dict3)
except:
    pass

GLOSSARY = dict1

# --- Extract relevant glossary entries as dict ---
def get_relevant_glossary(text: str) -> dict:
    relevant = {}
    for src, tgt in GLOSSARY.items():
        if len(src) > 1 and src in text:  # ignore single chars
            relevant[src] = tgt
    return relevant

# --- Convert dict → prompt block ---
def glossary_to_prompt(glossary: dict) -> str:
    if not glossary:
        return ""
    return "You MUST follow this glossary exactly. Replace the source word with the mapped target \n\n GLOSSARY (do not deviate):\n" + "\n".join(f"{k} → {v}" for k, v in glossary.items()) + "\n\n"


# --- Chat endpoint ---
@app.post("/add_glossary_term")
async def add_glossary_term(term: str = Form(...), definition: str = Form(...)):
    # Append to dictionary3.csv
    with open("dictionary3.csv", "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([term, definition])

    # Update in-memory glossary
    GLOSSARY[term] = definition

    return JSONResponse({"status": "success", "term": term, "definition": definition})

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("chat.html", {"request": request})

def enforce_glossary(translation: str, glossary: dict) -> str:
    for source, target in glossary.items():
        translation = translation.replace(source, target)
    return translation

@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    user_message = data.get("message")
    model = "deepseek-v2:16b"

    # Get relevant glossary dict + prompt block
    glossary_dict = get_relevant_glossary(user_message)
    glossary_prompt = glossary_to_prompt(glossary_dict)

    prompt = "Translate the following text into English:\n\n" + user_message

    # Call Ollama
    response = ollama.chat(
    model=model,
    messages=[
        {"role": "system", "content": (
            "You are a careful translator.\n\n"
                "Translation Rules:\n"
                "1. Always follow the provided glossary mappings strictly.\n"
                "2. Do not add explanations, commentary, or personal opinions.\n"
                "3. Do not use Sanskritized or overly religious terminology unless it appears explicitly in the glossary.\n"
                "4. Use simple, modern English equivalents whenever possible.\n"
                "5. Ensure the result can be understood by a high school level reader.\n\n"
                "Output format:\n"
                "- Return only the translated text.\n"
                "- Do not include notes, explanations, or metadata.\n\n"
                "Glossary (strictly apply):\n"
                + glossary_prompt

        )},
        {"role": "user", "content": (
            prompt
            + "\n\nReminder: Apply glossary terms exactly as listed. "
            + "Do not use Sanskritized or religious-sounding alternatives."
        )}
    ]
)

    # Apply deterministic glossary enforcement
    reply = enforce_glossary(response["message"]["content"], glossary_dict)

    return JSONResponse({
        "reply": reply,
        "glossary_prompt": glossary_prompt
    })


