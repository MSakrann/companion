# Security

## Firebase / Google API keys

- **Do not commit real API keys.** This repo uses placeholders in:
  - `android/app/google-services.json`
  - `ios/Runner/GoogleService-Info.plist`
  - `lib/backend/firebase/firebase_config.dart` (web: use `--dart-define=WEB_API_KEY=...` or replace before build)

- **If keys were ever committed:** Rotate them immediately in [Firebase Console](https://console.firebase.google.com) (Project settings → Your apps) and [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Old keys remain in git history until rotated.

- **Local setup:** Download your real `google-services.json` and `GoogleService-Info.plist` from Firebase and replace the placeholder files locally. For web, pass the API key at build time: `flutter build web --dart-define=WEB_API_KEY=your_key`.
