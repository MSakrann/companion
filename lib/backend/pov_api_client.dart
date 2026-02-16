import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

// ---------------------------------------------------------------------------
// Response models
// ---------------------------------------------------------------------------

/// Response from POST /v1/recordings/create
class CreateRecordingResponse {
  const CreateRecordingResponse({
    required this.recordingId,
    required this.audioPath,
  });

  final String recordingId;
  final String audioPath;

  factory CreateRecordingResponse.fromJson(Map<String, dynamic> json) {
    return CreateRecordingResponse(
      recordingId: json['recordingId'] as String? ?? '',
      audioPath: json['audioPath'] as String? ?? '',
    );
  }
}

/// Response from POST /v1/recordings/:recordingId/finalize
class FinalizeRecordingResponse {
  const FinalizeRecordingResponse({required this.jobId});

  final String jobId;

  factory FinalizeRecordingResponse.fromJson(Map<String, dynamic> json) {
    return FinalizeRecordingResponse(
      jobId: json['jobId'] as String? ?? '',
    );
  }
}

/// Response from GET /v1/jobs/:jobId
class GetJobResponse {
  const GetJobResponse({
    required this.jobId,
    required this.status,
    this.error,
    this.responseText,
    this.ttsAudioUrl,
  });

  final String jobId;
  final String status;
  final String? error;
  final String? responseText;
  final String? ttsAudioUrl;

  bool get isDone => status == 'done';
  bool get isFailed => status == 'failed';

  factory GetJobResponse.fromJson(Map<String, dynamic> json) {
    return GetJobResponse(
      jobId: json['jobId'] as String? ?? '',
      status: json['status'] as String? ?? 'unknown',
      error: json['error'] as String?,
      responseText: json['responseText'] as String?,
      ttsAudioUrl: json['ttsAudioUrl'] as String?,
    );
  }
}

// ---------------------------------------------------------------------------
// API errors
// ---------------------------------------------------------------------------

/// Thrown when an API call fails. Message is user-readable when possible.
class PovApiException implements Exception {
  PovApiException(this.message, {this.statusCode, this.errorCode});

  final String message;
  final int? statusCode;
  final String? errorCode;

  @override
  String toString() => 'PovApiException: $message'
      '${statusCode != null ? ' (status $statusCode)' : ''}'
      '${errorCode != null ? ' [$errorCode]' : ''}';
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

/// Client for the POV Companion backend API.
/// Automatically attaches Firebase ID token to all requests.
class PovApiClient {
  PovApiClient({String? baseUrl})
      : _baseUrl = baseUrl ?? backendApiBaseUrl;

  final String _baseUrl;

  /// Gets a fresh Firebase ID token. Use [forceRefresh] true when you need
  /// a token guaranteed to be valid (e.g. before a sensitive call).
  Future<String> _getIdToken({bool forceRefresh = false}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw PovApiException(
        'You must be signed in to use the recording API.',
        errorCode: 'not_authenticated',
      );
    }
    final token = await user.getIdToken(forceRefresh);
    if (token == null || token.isEmpty) {
      throw PovApiException(
        'Could not get authentication token. Try signing in again.',
        errorCode: 'token_failed',
      );
    }
    return token;
  }

  Future<Map<String, String>> _authHeaders({bool forceRefresh = false}) async {
    final token = await _getIdToken(forceRefresh: forceRefresh);
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /// Throws [PovApiException] with a readable message from response body or status.
  Never _handleError(http.Response response, {String? fallbackMessage}) {
    String message = fallbackMessage ?? 'Request failed';
    try {
      final body = jsonDecode(response.body) as Map<String, dynamic>?;
      if (body != null && body['error'] != null) {
        final code = body['error'] as String?;
        message = _errorMessageFromCode(code, response.statusCode) ?? message;
      }
    } catch (_) {
      if (response.body.isNotEmpty) {
        message = response.body;
      }
    }
    throw PovApiException(
      message,
      statusCode: response.statusCode,
      errorCode: _tryParseErrorCode(response.body),
    );
  }

  String? _errorMessageFromCode(String? code, int statusCode) {
    switch (code) {
      case 'missing_or_invalid_authorization':
        return 'Please sign in again.';
      case 'invalid_token':
        return 'Your session may have expired. Please sign in again.';
      case 'recording_not_found':
        return 'Recording not found.';
      case 'job_not_found':
        return 'Job not found.';
      case 'forbidden':
        return 'You don\'t have permission for this.';
      case 'audio_not_found':
        return 'Audio file not found. Please upload the recording first.';
      case 'internal_error':
        return 'Something went wrong on the server. Please try again.';
      default:
        if (statusCode == 401) return 'Please sign in again.';
        if (statusCode == 403) return 'Access denied.';
        if (statusCode == 404) return 'Not found.';
        if (statusCode >= 500) return 'Server error. Please try again later.';
        return null;
    }
  }

  String? _tryParseErrorCode(String body) {
    try {
      final m = jsonDecode(body) as Map<String, dynamic>?;
      return m?['error'] as String?;
    } catch (_) {
      return null;
    }
  }

  /// POST /v1/recordings/create
  /// Optional [durationSec] can be sent; backend still returns recordingId and audioPath.
  Future<CreateRecordingResponse> createRecording({int? durationSec}) async {
    final uri = Uri.parse('$_baseUrl/v1/recordings/create');
    final headers = await _authHeaders();

    final body = durationSec != null
        ? jsonEncode({'durationSec': durationSec})
        : '{}';

    final response = await http
        .post(uri, headers: headers, body: body)
        .timeout(const Duration(seconds: 30));

    if (response.statusCode != 201) {
      _handleError(
        response,
        fallbackMessage: 'Failed to create recording.',
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>?;
      if (json == null) throw FormatException('empty body');
      return CreateRecordingResponse.fromJson(json);
    } catch (e) {
      throw PovApiException(
        'Invalid response from server.',
        statusCode: response.statusCode,
      );
    }
  }

  /// POST /v1/recordings/:recordingId/finalize
  /// Call after uploading audio to the returned [audioPath] (e.g. via Firebase Storage).
  Future<FinalizeRecordingResponse> finalizeRecording(String recordingId) async {
    if (recordingId.isEmpty) {
      throw PovApiException('Recording ID is required.');
    }
    final uri = Uri.parse('$_baseUrl/v1/recordings/$recordingId/finalize');
    final headers = await _authHeaders();

    final response = await http
        .post(uri, headers: headers, body: '{}')
        .timeout(const Duration(seconds: 30));

    if (response.statusCode != 201) {
      _handleError(
        response,
        fallbackMessage: 'Failed to finalize recording.',
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>?;
      if (json == null) throw FormatException('empty body');
      return FinalizeRecordingResponse.fromJson(json);
    } catch (e) {
      throw PovApiException(
        'Invalid response from server.',
        statusCode: response.statusCode,
      );
    }
  }

  /// GET /v1/jobs/:jobId
  /// Returns status, responseText, and ttsAudioUrl when status is 'done'.
  Future<GetJobResponse> getJob(String jobId) async {
    if (jobId.isEmpty) {
      throw PovApiException('Job ID is required.');
    }
    final uri = Uri.parse('$_baseUrl/v1/jobs/$jobId');
    final headers = await _authHeaders();

    final response = await http
        .get(uri, headers: headers)
        .timeout(const Duration(seconds: 15));

    if (response.statusCode != 200) {
      _handleError(
        response,
        fallbackMessage: 'Failed to get job status.',
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>?;
      if (json == null) throw FormatException('empty body');
      return GetJobResponse.fromJson(json);
    } catch (e) {
      throw PovApiException(
        'Invalid response from server.',
        statusCode: response.statusCode,
      );
    }
  }
}
