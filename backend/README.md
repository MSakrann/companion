# POV - Companion Backend

Production-grade MVP backend for the **POV - Companion** FlutterFlow app. Node.js 20 + TypeScript, Cloud Run, Firebase (Auth, Firestore, Storage), Cloud Tasks, OpenAI, ElevenLabs, and Meta WhatsApp Cloud API.

## Features

- **Phone verification**: Client uses Firebase Auth Phone; backend verifies Firebase ID token and enforces `uid` isolation.
- **Recording pipeline**: Create recording → upload audio via Firebase Storage SDK → finalize → Cloud Task processes: Whisper transcription → extraction (Zod-validated) → memory merge → response generation → ElevenLabs TTS → WhatsApp (free-form or template).
- **WhatsApp**: Free-form messages within 24h of last inbound; otherwise approved template (e.g. CHECKIN) to re-open. Webhook for inbound messages with idempotency.

## Repository layout

```
backend/
├── src/
│   ├── server.ts              # Express app entry
│   ├── config/                # Env + secret loading
│   ├── auth/                  # Firebase token verification middleware
│   ├── firestore/             # Collections + types
│   ├── storage/               # Firebase Storage helpers
│   ├── openai/                # Transcription, extraction, response generation
│   ├── elevenlabs/            # TTS
│   ├── whatsapp/              # Cloud API client, webhook, templates
│   ├── jobs/                  # Cloud Tasks enqueue + processRecording worker
│   ├── validators/            # Zod schemas (extraction, requests)
│   ├── middleware/            # Internal auth
│   ├── routes/                # Recordings, jobs, internal, webhook
│   └── lib/                   # Logger, Firebase init
├── test/
│   ├── unit/                  # Extraction schema, memory merge, 24h window
│   └── integration/           # Recordings API, internal worker, webhook (emulators)
├── firebase.json              # Emulator config
├── package.json
├── tsconfig.json
└── README.md
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Yes | GCP project ID |
| `FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket (e.g. `project.appspot.com`) |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | Yes | ElevenLabs voice ID |
| `WHATSAPP_ACCESS_TOKEN` | Yes | Meta WhatsApp Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | WhatsApp Business phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Yes | WhatsApp Business account ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Yes | Token for webhook GET verify |
| `TEMPLATE_OPTIN_NAME` | Yes | Approved template name for opt-in |
| `TEMPLATE_CHECKIN_NAME` | Yes | Approved template name for check-in |
| `INTERNAL_TOKEN` | Yes | Secret for internal endpoints (Cloud Tasks / worker) |
| `BASE_URL` | Yes | Base URL of the service (e.g. Cloud Run URL) |
| `NODE_ENV` | No | `development` \| `production` \| `test` (default: development) |
| `PORT` | No | Server port (default: 8080) |
| `FIRESTORE_EMULATOR_HOST` | No | e.g. `127.0.0.1:8080` for local Firestore emulator |
| `FIREBASE_STORAGE_EMULATOR_HOST` | No | e.g. `127.0.0.1:9199` for Storage emulator |

Secrets must never be committed. Use `.env` locally (not in repo) or Secret Manager / Cloud Run env in production.

## Local development

1. **Prerequisites**: Node.js 20+, npm or yarn.

2. **Install dependencies**
   ```bash
   cd backend && npm install
   ```

3. **Environment**
   - Copy env vars into `.env` (or export them). For minimal local runs you can stub WhatsApp/OpenAI/ElevenLabs and use emulators (see below).

4. **Firebase**
   - Use a real Firebase project or emulators. For real project: set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON path.
   - For emulators, set `FIRESTORE_EMULATOR_HOST` and `FIREBASE_STORAGE_EMULATOR_HOST` and start emulators (see Emulator instructions).

5. **Run**
   ```bash
   npm run dev
   ```
   Server listens on `PORT` (default 8080). Health: `GET /health`.

## Emulator instructions

1. **Start Firebase emulators** (Firestore + Storage)
   ```bash
   firebase emulators:start --only firestore,storage
   ```
   Defaults: Firestore `8080`, Storage `9199`. Adjust `firebase.json` if needed.

2. **Point app to emulators**
   ```bash
   export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
   export FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
   export GOOGLE_CLOUD_PROJECT=your-demo-project
   export FIREBASE_STORAGE_BUCKET=your-demo-project.appspot.com
   ```

3. **Run integration tests**
   ```bash
   npm run test:integration
   ```
   Or all tests: `npm run test`. Unit tests do not require emulators.

## Deploy to Cloud Run

1. **Build**
   ```bash
   npm run build
   ```

2. **Build container** (example Dockerfile in repo or use Cloud Build)
   - Base image Node 20.
   - Copy `dist/` and `package.json`, run `npm ci --omit=dev` and `node dist/server.js`.
   - Listen on `PORT` (Cloud Run sets this).

3. **Deploy**
   ```bash
   gcloud run deploy pov-companion-api \
     --source . \
     --region us-central1 \
     --allow-unauthenticated
   ```
   Or use a Dockerfile and `gcloud run deploy --image ...`.

4. **Configure**
   - Set all env vars (or mount Secret Manager) in Cloud Run.
   - Set `BASE_URL` to the deployed Cloud Run URL.
   - Ensure the service account has: Firestore, Storage, Cloud Tasks (if using), and Secret Manager if used.

5. **Cloud Tasks**
   - Create a queue (e.g. `default` in `us-central1`) and ensure the Cloud Run service allows the Cloud Tasks service account to invoke it (or use `INTERNAL_TOKEN` and call the worker URL from your task).

## API summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/recordings/create` | Firebase ID token | Create recording doc; returns `recordingId`, `audioPath`, `jobHint`. |
| POST | `/v1/recordings/:recordingId/finalize` | Firebase ID token | Check audio exists; create job; enqueue process task; return `jobId`. |
| GET | `/v1/jobs/:jobId` | Firebase ID token | Return job; if done, include `ttsAudioUrl` (signed) and `responseText`. |
| POST | `/v1/internal/processRecording` | X-Internal-Token or OIDC | Worker: transcribe → extract → memory → response → TTS → WhatsApp. |
| GET | `/webhook/whatsapp` | Query params | WhatsApp webhook verification. |
| POST | `/webhook/whatsapp` | None | WhatsApp inbound messages; idempotent by `providerMessageId`. |

## Firestore data model

- `users/{uid}` — phone, whatsapp (waPhoneE164, optInStatus, lastInboundAt, lastOutboundAt).
- `users/{uid}/memory/profile` — memoryJson, updatedAt.
- `recordings/{recordingId}` — uid, audioPath, durationSec, createdAt.
- `jobs/{jobId}` — uid, recordingId, status, error, result (transcriptId, responseId, ttsAudioPath, responseText).
- `transcripts/{transcriptId}`, `extractions/{extractionId}`, `responses/{responseId}`.
- `whatsapp_sessions/{sessionId}`, `whatsapp_messages/{messageId}`.

## Tests

- **Unit**: Extraction schema, memory merge, WhatsApp 24h window.
- **Integration**: Recordings create/finalize, internal processRecording (e.g. job not found), webhook verify and POST. Use Firestore + Storage emulators and mocked auth/OpenAI/WhatsApp where applicable.

```bash
npm run test          # all
npm run test:unit     # unit only
npm run test:integration  # integration (start emulators first for full coverage)
```

## Security

- Client sends Firebase ID token; backend verifies and uses `uid` for all data access.
- Do not log transcript text in plaintext.
- Internal worker protected by `X-Internal-Token` or Cloud Tasks OIDC.
- Secrets only from env or Secret Manager; never committed.

## Firestore rules and uid ownership

Firestore security rules should enforce the following so that client access is safe and consistent with the backend:

1. **UID ownership**  
   For the collections **recordings**, **jobs**, **transcripts**, **extractions**, and **responses**, every document includes a top-level field **`uid`** set to the authenticated user’s Firebase UID. Rules should allow read/write only when `request.auth != null` and `request.auth.uid == resource.data.uid` (for existing docs) or `request.auth.uid == request.resource.data.uid` (for creates). The backend always sets `uid` on create and never removes it on update (e.g. job updates only change status/error/result/updatedAt).

2. **Server-only collections**  
   **whatsapp_sessions** and **whatsapp_messages** are written only by the backend (webhook and processRecording worker). Clients must not write to these collections. Rules should deny all client writes (and optionally allow reads only where needed, e.g. by matching a server-set `uid` or session id to the authenticated user).
