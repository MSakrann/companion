import 'dart:async';

import '/flutter_flow/flutter_flow_util.dart';
import 'home_page_widget.dart' show HomePageWidget;
import 'package:flutter/material.dart';
import 'package:record/record.dart';

/// Pipeline state: idle | uploading | processing | success | error
String get homePagePipelineIdle => 'idle';
String get homePagePipelineUploading => 'uploading';
String get homePagePipelineProcessing => 'processing';
String get homePagePipelineSuccess => 'success';
String get homePagePipelineError => 'error';

class HomePageModel extends FlutterFlowModel<HomePageWidget> {
  HomePageModel() {
    _audioRecorder = AudioRecorder();
  }

  late AudioRecorder _audioRecorder;

  bool isRecording = false;
  String pipelineState = 'idle';
  String? responseText;
  String? ttsAudioUrl;
  String? errorMessage;

  Timer? _pollTimer;

  @override
  void initState(BuildContext context) {}

  void startRecording() {
    isRecording = true;
    pipelineState = 'idle';
    responseText = null;
    ttsAudioUrl = null;
    errorMessage = null;
    updatePage(() {});
  }

  void stopRecording() {
    isRecording = false;
    updatePage(() {});
  }

  void setPipelineState(String state, {String? text, String? url, String? error}) {
    pipelineState = state;
    responseText = text;
    ttsAudioUrl = url;
    errorMessage = error;
    updatePage(() {});
  }

  void cancelPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  void schedulePoll(void Function() callback) {
    _pollTimer?.cancel();
    _pollTimer = Timer(const Duration(seconds: 2), callback);
  }

  AudioRecorder get audioRecorder => _audioRecorder;

  @override
  void dispose() {
    cancelPolling();
  }
}
