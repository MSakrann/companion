import 'dart:async';

import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_video_player.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:universal_io/io.dart';
import 'home_page_model.dart';
export 'home_page_model.dart';

class HomePageWidget extends StatefulWidget {
  const HomePageWidget({super.key});

  static String routeName = 'home_page';
  static String routePath = '/homePage';

  @override
  State<HomePageWidget> createState() => _HomePageWidgetState();
}

class _HomePageWidgetState extends State<HomePageWidget> {
  late HomePageModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();
  final PovApiClient _apiClient = PovApiClient();
  final AudioPlayer _audioPlayer = AudioPlayer();

  static const int _pollTimeoutSeconds = 120;
  static const int _pollIntervalSeconds = 2;

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => HomePageModel());
    _model.setOnUpdate(
      onUpdate: () {
        if (mounted) setState(() {});
      },
      updateOnChange: true,
    );
  }

  @override
  void dispose() {
    _model.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _runPipeline(String localRecordingPath) async {
    if (!mounted) return;
    _model.setPipelineState(homePagePipelineUploading);
    try {
      final create = await _apiClient.createRecording();
      final recordingId = create.recordingId;
      final audioPath = create.audioPath;

      final file = File(localRecordingPath);
      if (!(await file.exists())) {
        _model.setPipelineState(homePagePipelineError, error: 'Recording file not found.');
        return;
      }
      final ref = FirebaseStorage.instance.ref(audioPath);
      await ref.putFile(file);

      if (!mounted) return;
      _model.setPipelineState(homePagePipelineProcessing);

      final finalize = await _apiClient.finalizeRecording(recordingId);
      final jobId = finalize.jobId;

      final deadline = DateTime.now().add(const Duration(seconds: _pollTimeoutSeconds));
      void poll() async {
        if (!mounted) return;
        if (DateTime.now().isAfter(deadline)) {
          _model.cancelPolling();
          _model.setPipelineState(homePagePipelineError, error: 'Processing timed out.');
          return;
        }
        try {
          final job = await _apiClient.getJob(jobId);
          if (!mounted) return;
          if (job.isDone) {
            _model.cancelPolling();
            _model.setPipelineState(
              homePagePipelineSuccess,
              text: job.responseText,
              url: job.ttsAudioUrl,
            );
            if (job.ttsAudioUrl != null && job.ttsAudioUrl!.isNotEmpty) {
              _audioPlayer.play(UrlSource(job.ttsAudioUrl!));
            }
            return;
          }
          if (job.isFailed) {
            _model.cancelPolling();
            _model.setPipelineState(
              homePagePipelineError,
              error: job.error ?? 'Processing failed.',
            );
            return;
          }
          _model.schedulePoll(poll);
        } catch (e) {
          if (!mounted) return;
          _model.cancelPolling();
          _model.setPipelineState(
            homePagePipelineError,
            error: e is PovApiException ? e.message : 'Something went wrong.',
          );
        }
      }

      _model.schedulePoll(poll);
    } on PovApiException catch (e) {
      if (!mounted) return;
      _model.setPipelineState(homePagePipelineError, error: e.message);
    } catch (e) {
      if (!mounted) return;
      _model.setPipelineState(
        homePagePipelineError,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _onMicPressed() async {
    if (_model.pipelineState != homePagePipelineIdle &&
        _model.pipelineState != homePagePipelineSuccess &&
        _model.pipelineState != homePagePipelineError) {
      return;
    }
    if (_model.isRecording) {
      try {
        final path = await _model.audioRecorder.stop();
        _model.stopRecording();
        if (path != null && path.isNotEmpty) {
          await _runPipeline(path);
        } else {
          _model.setPipelineState(homePagePipelineError, error: 'No recording saved.');
        }
      } catch (e) {
        _model.stopRecording();
        _model.setPipelineState(homePagePipelineError, error: 'Failed to stop recording.');
      }
      return;
    }
    final hasPermission = await _model.audioRecorder.hasPermission();
    if (!hasPermission) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Microphone permission is required to record.')),
        );
      }
      return;
    }
    try {
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/recording_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _model.audioRecorder.start(const RecordConfig(), path: path);
      _model.startRecording();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not start recording: ${e.toString().replaceFirst('Exception: ', '')}')),
        );
      }
    }
  }

  String _statusText() {
    switch (_model.pipelineState) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing...';
      case 'success':
        return _model.responseText ?? '';
      case 'error':
        return _model.errorMessage ?? 'Something went wrong.';
      default:
        return 'Hit record and tell me everything I need to know about you';
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        FocusScope.of(context).unfocus();
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: Scaffold(
        key: scaffoldKey,
        backgroundColor: Colors.black,
        drawer: Drawer(
          elevation: 16.0,
          child: Container(
            width: 100.0,
            height: 100.0,
            decoration: BoxDecoration(
              color: FlutterFlowTheme.of(context).secondaryBackground,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.max,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(24.0, 24.0, 24.0, 0.0),
                  child: Image.asset(
                    'assets/images/1753172568904001_1001933365[16313].png',
                    width: 100.0,
                    height: 100.0,
                    fit: BoxFit.contain,
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(0.0, 0.0, 0.0, 50.0),
                  child: Row(
                    mainAxisSize: MainAxisSize.max,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Padding(
                        padding: EdgeInsetsDirectional.fromSTEB(
                            20.0, 0.0, 20.0, 0.0),
                        child: AuthUserStreamWidget(
                          builder: (context) => InkWell(
                            splashColor: Colors.transparent,
                            focusColor: Colors.transparent,
                            hoverColor: Colors.transparent,
                            highlightColor: Colors.transparent,
                            onTap: () async {
                              context.pushNamed(ProfileWidget.routeName);
                            },
                            child: Container(
                              width: 40.0,
                              height: 40.0,
                              clipBehavior: Clip.antiAlias,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                              ),
                              child: currentUserPhoto.isNotEmpty
                                  ? Image.network(
                                      currentUserPhoto,
                                      fit: BoxFit.cover,
                                    )
                                  : Icon(
                                      Icons.person,
                                      size: 24.0,
                                      color: FlutterFlowTheme.of(context).primaryText,
                                    ),
                            ),
                          ),
                        ),
                      ),
                      Align(
                        alignment: AlignmentDirectional(0.0, -1.0),
                        child: AuthUserStreamWidget(
                          builder: (context) => InkWell(
                            splashColor: Colors.transparent,
                            focusColor: Colors.transparent,
                            hoverColor: Colors.transparent,
                            highlightColor: Colors.transparent,
                            onTap: () async {
                              context.pushNamed(ProfileWidget.routeName);
                            },
                            child: Text(
                              currentUserDisplayName.isNotEmpty
                                  ? currentUserDisplayName
                                  : 'Profile',
                              style: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .override(
                                    fontFamily: 'ClashDisplay',
                                    letterSpacing: 0.0,
                                  ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        appBar: PreferredSize(
          preferredSize:
              Size.fromHeight(MediaQuery.sizeOf(context).height * 0.1),
          child: AppBar(
            backgroundColor: FlutterFlowTheme.of(context).primary,
            automaticallyImplyLeading: false,
            leading: Align(
              alignment: AlignmentDirectional(0.0, 0.0),
              child: FlutterFlowIconButton(
                borderRadius: 8.0,
                buttonSize: 40.0,
                fillColor: FlutterFlowTheme.of(context).primary,
                hoverIconColor: FlutterFlowTheme.of(context).secondary,
                icon: Icon(
                  Icons.menu,
                  color: FlutterFlowTheme.of(context).info,
                  size: 24.0,
                ),
                onPressed: () async {
                  scaffoldKey.currentState!.openDrawer();
                },
              ),
            ),
            title: Align(
              alignment: AlignmentDirectional(0.0, 0.0),
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(0.0, 0.0, 60.0, 0.0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8.0),
                  child: Image.asset(
                    'assets/images/1753172568904001_1001933365[16313].png',
                    width: 100.0,
                    height: 100.0,
                    fit: BoxFit.cover,
                    alignment: Alignment(0.0, 0.0),
                  ),
                ),
              ),
            ),
            actions: [],
            centerTitle: false,
            toolbarHeight: MediaQuery.sizeOf(context).height * 0.1,
            elevation: 2.0,
          ),
        ),
        body: SafeArea(
          top: true,
          child: Container(
            width: double.infinity,
            height: double.infinity,
            decoration: BoxDecoration(
              color: Colors.black,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.max,
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(10.0, 16.0, 10.0, 8.0),
                  child: Row(
                    mainAxisSize: MainAxisSize.max,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Flexible(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _statusText(),
                              textAlign: TextAlign.center,
                              style: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .override(
                                    fontFamily: 'ClashDisplay',
                                    fontSize: 28.0,
                                    letterSpacing: 0.0,
                                  ),
                            ),
                            if (_model.pipelineState == homePagePipelineSuccess &&
                                _model.ttsAudioUrl != null &&
                                _model.ttsAudioUrl!.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 12.0),
                                child: FlutterFlowIconButton(
                                  borderRadius: 20.0,
                                  buttonSize: 48.0,
                                  icon: Icon(
                                    Icons.volume_up,
                                    color: FlutterFlowTheme.of(context).primaryText,
                                    size: 28.0,
                                  ),
                                  onPressed: () {
                                    _audioPlayer.play(UrlSource(_model.ttsAudioUrl!));
                                  },
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Visibility(
                  visible: _model.isRecording,
                  maintainState: false,
                  child: SizedBox(
                    height: 180.0,
                    child: FlutterFlowVideoPlayer(
                      path: 'assets/videos/orange_wave_animation.mp4',
                      videoType: VideoType.asset,
                      autoPlay: true,
                      looping: true,
                      showControls: false,
                      allowFullScreen: false,
                      allowPlaybackSpeedMenu: false,
                      lazyLoad: false,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 32.0),
                  child: Container(
                    width: 100.0,
                    height: 100.0,
                    decoration: BoxDecoration(
                      color: FlutterFlowTheme.of(context)
                          .secondaryBackground,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: FlutterFlowTheme.of(context).secondary,
                        width: 2.0,
                      ),
                    ),
                    child: FlutterFlowIconButton(
                      borderRadius: 22.0,
                      buttonSize: 30.0,
                      hoverIconColor:
                          FlutterFlowTheme.of(context).secondary,
                      icon: Icon(
                        _model.isRecording ? Icons.stop : Icons.mic,
                        color: FlutterFlowTheme.of(context).primaryText,
                        size: 40.0,
                      ),
                      onPressed: _onMicPressed,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
