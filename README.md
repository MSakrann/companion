# POV - Companion

A voice-based companion app. Record voice messages, receive AI-generated spoken responses in Egyptian Arabic, and optionally share responses via WhatsApp.

## Features

**Voice recording and AI responses**
- Record voice messages from the app
- Automatic transcription via Whisper (OpenAI)
- AI response generation in Egyptian Arabic (عامية مصرية) regardless of input language
- Text-to-speech playback via ElevenLabs with Arabic language support

**User account**
- Phone verification with Firebase Auth
- Profile with display name and photo
- Edit profile (update name, upload profile image)

**WhatsApp integration**
- Optional WhatsApp delivery of responses
- Free-form messages within 24h of last inbound
- Template-based messages to re-open sessions outside the 24h window
- Webhook for inbound messages with idempotency

**Backend pipeline**
- Recording creation and audio upload via Firebase Storage
- Cloud Tasks–based processing: transcribe, extract, merge memory, generate response, TTS, WhatsApp
- User-scoped memory for context-aware responses
- Safety handling for self-harm risk detection

## Project structure

```
companion/
├── lib/                    # Flutter app (FlutterFlow)
│   ├── pages/              # Home, profile
│   ├── sign_up/            # Auth flows (phone, login, create, verify)
│   ├── subscription/       # Subscription and payment
│   ├── backend/            # API client, Firebase config
│   └── ...
├── backend/                # Node.js 20 + TypeScript API
│   ├── src/
│   │   ├── server.ts       # Express app entry
│   │   ├── openai/         # Whisper, extraction, response generation
│   │   ├── elevenlabs/     # TTS
│   │   ├── whatsapp/       # Meta Cloud API, webhook
│   │   ├── jobs/           # Cloud Tasks + processRecording worker
│   │   └── ...
│   └── README.md           # Backend setup, env vars, deploy
└── ios/                    # iOS app
```

## Getting started

**Flutter app**
- Requires Flutter stable
- `flutter pub get` then run on iOS/Android

**Backend**
- See [backend/README.md](backend/README.md) for environment variables, local development with Firebase emulators, and Cloud Run deployment.

## Tech stack

- **App**: Flutter, Firebase Auth, Firestore, Storage, record, audioplayers, image_picker
- **Backend**: Node.js 20, TypeScript, Express, Cloud Run, Firebase, Cloud Tasks
- **AI**: OpenAI (Whisper, GPT-4o-mini), ElevenLabs (multilingual_v2)
- **Messaging**: Meta WhatsApp Cloud API
