import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

// For web: set via --dart-define=WEB_API_KEY=your_key at build time,
// or replace YOUR_WEB_API_KEY before building. Never commit real keys.
const String _webApiKey = String.fromEnvironment(
  'WEB_API_KEY',
  defaultValue: 'YOUR_WEB_API_KEY',
);

Future initFirebase() async {
  if (kIsWeb) {
    await Firebase.initializeApp(
        options: FirebaseOptions(
            apiKey: _webApiKey,
            authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
            messagingSenderId: "YOUR_SENDER_ID",
            appId: "YOUR_WEB_APP_ID"));
  } else {
    await Firebase.initializeApp();
  }
}
