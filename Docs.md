# Eburon Voice Studio — Architectural Notes

## App shell
- `App.tsx` wires Supabase auth (`AuthProvider` / `AuthPage`), initializes the data layer, and renders the main layout once authenticated. Layout = `LeftSidebar` navigation, `CenterPanel` content, `RightSidebar` iPhone simulator/preview, `GlobalCallIndicator`, and `FeedbackModal`. Mobile toggles collapse/expand the sidebars.
- Views are lazily loaded via `CenterPanel` and keyed by `ActiveView`. `WebDemoView` is loaded separately when a template is activated.

## Data layer & persistence
- `services/dataService.ts` selects backend per session: tries Supabase, falls back to IndexedDB (`idbService.ts`) for offline use. All reads/writes pass through here.
  - Agents: Supabase for CRUD; IndexedDB cache; `AYLA_DEFAULT_AGENT` injected if nothing is active.
  - Voices: Pulled from Bland AI API, merged with custom tags from Supabase, cached locally.
  - Call logs: Prefer cached IDB, otherwise parse `data.csv` (robust CSV parsing with transcript reconstruction) then sync to Supabase; Bland API is a final fallback.
  - TTS generations, chatbot messages, feedback, agent feedback: cached in IDB with best-effort Supabase sync.
  - CRM bookings delegate to `crmService.ts` (in-memory data with subscription hooks).
- `services/supabaseService.ts` wraps Supabase client for auth, tables (agents, call_logs, tts_generations, chatbot_messages, feedback, agent_feedback), and storage uploads (avatars, TTS audio, chat images, voice tags).
- Offline cache schema lives in `idbService.ts`; stores agents/voices/call logs/TTS/chat/feedback/agent feedback.

## External integrations
- Google Gemini (`services/geminiService.ts`, `hooks/useGeminiLive.ts`, `components/VoicesView.tsx`, `TTSStudioView.tsx`): chat streaming, TTS, transcription, image generation, and live audio sessions with tool calling; requires `process.env.API_KEY`.
- Bland AI (`services/blandAiService.ts`): telephony (place calls, start Ayla call), recordings fetch, live-listen WebSocket URL, voice catalog and samples. Keys are currently hardcoded for the demo.
- Supabase: auth, database, and storage (keys also hardcoded for the demo).
- React Dropzone powers CSV import; Supabase OAuth supports Google sign-in.

## Major views
- **Agents (`components/AgentsView.tsx`)**: list/create/edit agents, edit system prompts/voices/tools, preview voices through Bland AI, set an agent as active for the dialer. Uses `VOICE_PREVIEW_CONFIG` defaults for multi-language samples.
- **Voices (`components/VoicesView.tsx`)**: Gemini TTS previews for a curated set of prebuilt voices.
- **Chatbot (`components/ChatbotView.tsx`)**: multimodal chat with history persistence, optional web/maps grounding, “Pro” thinking mode, fast mode, developer mode that returns self-contained HTML and renders in the right-hand simulator, image upload, mic-to-text via Gemini, telemetry (tokens/energy/wps), and grounding source display.
- **TTS Studio (`components/TTSStudioView.tsx`)**: Gemini TTS generator with on-page audio preview/download and session-only history; selectable prebuilt voices.
- **Call History (`components/CallLogsView.tsx`)**: loads logs from cache/CSV/API, search by number/text, detail view with recording fetch/replay, summary, and transcript export (copy).
- **CRM (`components/CrmView.tsx` + `CrmDetailView`, `BookingModal`)**: browse/search mock bookings, view details with notes/timeline, create/edit/delete via modal; data updates broadcast through `crmService` subscriptions.
- **Data Import (`components/DataImportView.tsx`)**: drop-in CSV importer for call logs using `dataService.loadCallLogsFromCSV`; option to clear cached logs.
- **Templates (`components/TemplatesView.tsx`)**: lists `MOCK_TEMPLATES`; selecting one starts `WebDemoView` with the template’s system prompt/voice.
- **Web Demo (`components/WebDemoView.tsx`)**: end-to-end IVR + live agent simulation. Plays intro, dials IVR keys, starts Gemini live session with CRM tool schema, streams transcripts/tool calls, plays hold/background audio, allows CRM inline edits, and collects session feedback.
- **Dialer (`components/Dialer.tsx`)**: mobile/web toggle, keypad with short/long press, uses active agent and Bland AI `placeCall`, status messaging, and manual hangup.
- **Active Call Listener (`components/ActiveCallView.tsx`)**: connect to Bland AI WebSocket to monitor an in-progress call audio stream with buffered playback.
- **Right Sidebar (`components/RightSidebar.tsx` + `IphoneSimulator`)**: shows live web preview (e.g., developer-mode HTML) inside an iPhone frame; collapsible.
- **Call controls**: `CallContext` simulates call state/duration/tones for UI indicators; `GlobalCallIndicator` surfaces status over layout.
- **Auth (`contexts/AuthContext.tsx`, `components/AuthPage.tsx`)**: Supabase email/password and Google OAuth; guards main app while `CallProvider` still wraps authenticated content.

## Constants & types
- `constants.ts` holds navigation items, the extensive Ayla persona prompt, Eburon system prompt, CRM tool schema, voice preview text/locale, audio assets, and default agent definition.
- Shared interfaces/enums live in `types.ts` (agents, voices, call logs, transcripts, CRM bookings, chatbot messages, feedback, live transcripts, tool calls, etc.).

## Configuration notes
- Required env var: `API_KEY` for Google Gemini. Supabase and Bland AI keys are embedded for this demo but should be environment-driven in production.
- `data.csv` in the repo provides seed call-history data; `database.sql`/`schema.sql` reflect Supabase tables.
- Scripts (`package.json`): `npm run dev`, `build`, `preview` (Vite).

## Operational behaviors
- Offline-first: if Supabase is unreachable at startup, the session runs entirely on IndexedDB caches; writes continue locally.
- Audio handling: multiple helpers decode PCM/base64 for both Gemini and Bland AI streams; sound assets are loaded from remote URLs.
- Feedback: quick modal submits text to IDB and attempts Supabase sync; agent feedback in `WebDemoView` uses the same path.

## How to extend
- New feature views should register in `constants.NAV_ITEMS` and handle `ActiveView`.
- Data going to Supabase should be routed through `dataService` to keep offline support intact.
- New external calls belong in `services/*` wrappers; cache them in `idbService` if they affect offline UX.

## Data to persist (and APIs to query)
- Agents (`agents` table) — CRUD via `supabaseService` (`getAgentsFromSupabase`, `upsertAgentsToSupabase`, `deleteAgentFromSupabase`); uploads (avatars) to Supabase Storage bucket `eburon-files/public/agent-avatars`.
- Active dialer agent flag — stored locally in IndexedDB; mirror to Supabase if a column is added.
- Voices (from Bland AI) — list via Bland API `/v1/voices`; custom tags stored in Supabase table `voices_tags_backup` via `getCustomVoiceTags`/`updateCustomVoiceTags`; samples generated through Bland API `/v1/voices/{id}/sample`.
- Call logs (`call_logs` table) — query/insert via `upsertCallLogsToSupabase`; recordings fetched from Bland API `/v1/recordings/{callId}`; fallback seed from `data.csv`.
- Chatbot messages (`chatbot_messages` table) — upsert/clear via Supabase (`upsertChatbotMessageToSupabase`, `clearChatbotMessagesFromSupabase`); images stored in Storage `eburon-files/public/chat-images`.
- TTS generations (`tts_generations` table) — save/fetch via `saveTtsGeneration`/`getTtsGenerations` in `supabaseService`; audio stored in Storage `eburon-files/public/tts-generations`.
- Feedback (`feedback` table) and agent feedback (`agent_feedback` table) — insert via `saveFeedbackToSupabase` and `saveAgentFeedbackToSupabase`.
- CRM bookings — currently in-memory via `crmService`; future persistence should map to a `crm_bookings` table and be routed through `dataService` for Supabase + IndexedDB parity.
- Live transcripts/tool calls (Gemini live) — kept in React state; persist to Supabase if long-term storage is required (e.g., new `live_transcripts` and `tool_calls` tables).

## Enforcing “save everything to Supabase”
- Route all mutations through `dataService` so offline caching and Supabase sync both fire.
- For features currently session-only (e.g., TTS Studio history, Web Demo transcripts/tool calls), add Supabase upserts in `dataService` and call them from the views; keep IndexedDB as the offline cache.
- Ensure file outputs (avatars, chat images, TTS audio) go through Supabase Storage helper functions so URLs remain public and cache-busted.

## Self-hosted Supabase for local/backup
- Use Supabase CLI + Docker: `npm i -g supabase` then `supabase init` and `supabase start` to launch local Postgres/Auth/Storage. This yields local `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`.
- Point the app to local backup when offline by swapping envs (or detecting connectivity): set `SUPABASE_URL`/`SUPABASE_KEY` env vars and update `supabaseService` to read them instead of hardcoded values.
- To keep backup parity, schedule a `pg_dump`/`supabase db dump` from the hosted instance and `supabase db restore` into the self-hosted instance, or run logical replication between the two Postgres endpoints.
- Storage mirroring: run periodic sync (e.g., `rclone` or `supabase storage cp`) from hosted `eburon-files` to the local bucket so audio/images stay available offline.
