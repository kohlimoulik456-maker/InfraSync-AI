import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';

/// Points at the same Next.js backend and PostgreSQL database used by the
/// web app. Set this to your deployed backend URL, e.g.
/// https://infrasync.example.com or http://10.0.2.2:3000 for the Android
/// emulator talking to a local dev server.
class ApiConfig {
  static const String _configuredBaseUrl = String.fromEnvironment(
    'INFRASYNC_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
  static const String baseUrl = kIsWeb && _configuredBaseUrl == 'http://10.0.2.2:3000'
      ? 'http://localhost:3000'
      : _configuredBaseUrl;
  static const String apiKey = String.fromEnvironment(
    'INFRASYNC_API_KEY',
    defaultValue: 'local-dev-mobile-key',
  );

  static Map<String, String> get headers => {
        if (apiKey.isNotEmpty) 'Authorization': 'Bearer $apiKey',
      };
}

class Project {
  final String projectId;
  final String projectName;
  final int totalActivities;
  final double overallProgressPct;
  final int pendingAiAuditReviews;

  Project({
    required this.projectId,
    required this.projectName,
    this.totalActivities = 0,
    this.overallProgressPct = 0,
    this.pendingAiAuditReviews = 0,
  });

  factory Project.fromJson(Map<String, dynamic> json) => Project(
        projectId: '${json['projectId'] ?? ''}',
        projectName: '${json['projectName'] ?? 'Unnamed project'}',
        totalActivities: _asInt(json['totalActivities']),
        overallProgressPct: _asDouble(json['overallProgressPct']),
        pendingAiAuditReviews: _asInt(json['pendingAiAuditReviews']),
      );
}

int _asInt(dynamic value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;

double _asDouble(dynamic value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

Map<String, dynamic> _decodeObject(String body) {
  final decoded = jsonDecode(body);
  if (decoded is Map<String, dynamic>) return decoded;
  throw const FormatException('The server returned an invalid response.');
}

String _errorMessage(http.Response response, String fallback) {
  try {
    final data = _decodeObject(response.body);
    return '${data['error'] ?? fallback}';
  } catch (_) {
    return fallback;
  }
}

/// Thin REST client. Mirrors the same API routes the Next.js web app calls -
/// API keys (Gemini) stay server-side and are never embedded in this app.
class ApiService {
  static Future<List<Project>> listProjects() async {
    final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/api/projects'), headers: ApiConfig.headers);
    if (res.statusCode != 200) throw Exception(_errorMessage(res, 'Failed to load projects.'));
    final data = _decodeObject(res.body);
    return (data['projects'] as List)
      .whereType<Map<String, dynamic>>()
      .map(Project.fromJson)
        .toList();
  }

  static Future<Map<String, dynamic>> submitTextUpdate({
    required String projectId,
    required String supervisorId,
    required String updateDate,
    String? discipline,
    String? areaUnit,
    required String activityUpdateText,
    String? delayReason,
    String? remarks,
  }) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/supervisor/text-update'),
      headers: {'Content-Type': 'application/json', ...ApiConfig.headers},
      body: jsonEncode({
        'project_id': projectId,
        'supervisor_id': supervisorId,
        'update_date': updateDate,
        'discipline': discipline,
        'area_unit': areaUnit,
        'activity_update_text': activityUpdateText,
        'delay_reason': delayReason,
        'remarks': remarks,
      }),
    );
    if (res.statusCode != 200) {
      throw Exception(_errorMessage(res, 'Failed to process update.'));
    }
    return _decodeObject(res.body);
  }

  static Future<Map<String, dynamic>> uploadExcel({
    required String projectId,
    required String supervisorId,
    required File file,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/api/supervisor/excel-upload'),
    );
    request.headers.addAll(ApiConfig.headers);
    request.fields['project_id'] = projectId;
    request.fields['supervisor_id'] = supervisorId;
    request.files.add(await http.MultipartFile.fromPath('file', file.path));

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode != 200) {
      throw Exception(_errorMessage(res, 'Failed to upload file.'));
    }
    return _decodeObject(res.body);
  }

  /// Stub only - mirrors backend voiceProcessor.ts. Never sends audio,
  /// never calls Gemini. Included so the mobile app's Coming Soon flow
  /// matches the web app exactly.
  static Map<String, dynamic> voiceComingSoon() => {
        'status': 'COMING_SOON',
        'message':
            'Voice-to-text processing is not available in the MVP. Please use Text Update or Excel Upload.',
      };

  /// Stub only - mirrors backend diaryScanProcessor.ts.
  static Map<String, dynamic> diaryScanComingSoon() => {
        'status': 'COMING_SOON',
        'message':
            'OCR processing for scanned diaries is not available in the MVP. Please use Text Update or Excel Upload.',
      };
}
