
## AI helpers (2026-10-24)
Six features, all suggestions that a person confirms; each falls back to the non-AI behaviour when the model is down (`src/ai/client.js`, Ollama `AI_MODEL`/`CHAT_MODEL`, default qwen3.8:27b; tests stub it).
- **Translate draft** on the class-announcement form (`POST /portal/ai/translate`, English ⇄ 繁體中文, fills the other fields for editing).
- **Chat hand-off + unanswered log**: when retrieval finds nothing the widget offers "send this question to the office" (`POST /api/chat/handoff`, e-mail to the office via the outbox); `/portal/chat-inbox` lists hand-offs and the most-asked unanswered questions. Migration 021.
- **Smart search**: `/search` adds model-suggested synonyms and the other-language terms to the plain FTS results (`src/ai/query-expand.js`).
- **Ask the finance reports**: a question box on Finance Reports maps the question to an existing report plus dates/year/min-days (`src/ai/nl-report.js`; whitelisted JSON, no SQL, no data sent to the model).
- **Data quality** (`/portal/data-quality`): duplicate people/families by e-mail, phone, name + birth date, one-typo names; students without family; families without parent. Rules only.
- **Volunteer matching** (`/portal/volunteer-match`): suggested job per unassigned family (priority, past job, load balance, preschool-only jobs); staff tick and assign; the server recomputes suggestions on accept. Rules only.
