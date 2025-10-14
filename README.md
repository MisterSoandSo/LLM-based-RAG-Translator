# LLM-based RAG Translator

Problem Statement
A local translation assistant that integrates the **Ollama engine** with a **glossary database** (SQLite by default) to ensure **privacy-preserving translations**.

The client requires that all translation data and glossary terms remain **offline** and **self-contained** — no cloud API calls or third-party data sharing.

## Scope
The system allows a user to:

- **Translate** passages via Ollama with glossary-aware context
    - User input → server
    - Server checks for matching glossary terms
    - System prompt generated with glossary dictionary + base prompt
    - Returns translated text and (optionally) glossary prompt for debugging
        
-  **Manage glossary terms**
    - Add, edit, delete, and search terms
    - Pagination and fuzzy search supported
    - Notes field for internal use (not shared with the LLM)
## System Overview
The backend acts as a mediator between the user and Ollama:
- Extracts glossary terms from user input
- Builds a translation prompt enriched with definitions
- Sends prompt to the local Ollama model
- Returns the translation response

## API Endpoints

### Chat Routes

#### `POST /chat/translate/start`

- **Input:** JSON `{ "message": "<text>" }`
    
- **Output:** JSON with either:
    
    - `stage: "confirm_glossary"` + `glossary_options` if matches found
        
    - `stage: "complete"` + `"No glossary match found."` if no matches
        
- **Logic:**
    
    1. Parse user input
        
    2. Fetch glossary from database
        
    3. Match glossary terms present in the text
        
    4. Return matched terms for user confirmation
        

#### `POST /chat/translate/confirm`

- **Input:** JSON `{ "message": "<text>", "confirmed_glossary": { ... } }`
    
- **Output:** JSON `{ "stage": "complete", "reply": "<translated text>", "glossary_prompt": "<glossary used>" }`
    
- **Logic:**
    
    1. Generate system prompt including confirmed glossary
        
    2. Query Ollama for Chinese → English translation
        
    3. Return translated text with glossary context
        

#### `POST /chat/translate/polish`

- **Input:** JSON `{ "message": "<text>" }`
    
- **Output:** JSON `{ "reply": "<corrected text>" }`
    
    - Returns `"No change necessary."` if grammar is already correct
        
- **Logic:**
    
    1. Generate grammar-check system prompt
        
    2. Query Ollama
        
    3. Compare corrected text with original
        
    4. Return full corrected text only if changed
        

---

|Method|Endpoint|Description|
|---|---|---|
|`POST`|`/chat/translate/start`|Submit message for translation (detect glossary terms)|
|`POST`|`/chat/translate/confirm`|Confirm glossary and get final translation|
|`POST`|`/chat/translate/polish`|Submit message for grammar/fluency check|

---




### Glossary Route
|Method|Endpoint|Description|
|---|---|---|
|`GET`|`/glossary`|View or search glossary terms. Query params: `?search=<term>&page=<n>&limit=<m>`|
|`POST`|`/glossary`|Add a new glossary term|
|`PATCH`|`/glossary/{term_id}`|Edit existing term|
|`DELETE`|`/glossary/{term_id}`|Delete term by ID|
|`GET`|`/glossary/export` _(optional)_|Export glossary as JSON or CSV|


## Data Model

|Field|Type|Description|
|---|---|---|
|`id`|INTEGER (PK, AUTOINCREMENT)|Unique term identifier|
|`chinese`|TEXT|Source term (unique with English)|
|`english`|TEXT|Target term (unique with Chinese)|
|`notes`|TEXT (optional)|Internal notes, not used in LLM prompt|
|`created_at`|DATETIME|Auto-generated timestamp|
|`updated_at`|DATETIME|Auto-updated on edit|



## Requirements
 - [Python 3.10+](https://www.python.org/downloads/)
 - [Ollama (local LLM engine)](https://ollama.com)

**Recommended: virtual environment (e.g. venv or conda)**

1. Follow the official instructions on the Ollama website.
2. Verify you have installed Ollama with the command `ollama --version`
3. Pull a model with `ollama pull deepseek-v2:16b` or [any other model](https://ollama.com/search)