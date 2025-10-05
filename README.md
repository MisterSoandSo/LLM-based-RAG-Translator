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

### Chat Route
#### `POST /chat/translate`

- Input: text passage
- Output: translated text + glossary context (if debug mode)
- Logic:
    - Parse user input
    - Match glossary terms (`LIKE` or fuzzy search)
    - Generate system prompt including matched terms
    - Query Ollama locally
    - Return response

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