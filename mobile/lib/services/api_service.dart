import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

/// Points at the same Next.js backend and PostgreSQL database used by the
/// web app. Set this to your deployed backend URL, e.g.
/// https://infrasync.example.com or http://10.0.2.2:3000 for the Android
/// emulator talking to a local dev server.
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'INFRASYNC_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
}

class Project {
  final String projectId;
  final String projectName;
  Project({required this.projectId, required this.projectName});

  factory Project.fromJson(Map<String, dynamic> json) => Project(
        projectId: json['projectId'],
        projectName: json['projectName'],
      );
}

/// Thin REST client. Mirrors the same API routes the Next.js web app calls -
/// API keys (Gemini) stay server-side and are never embedded in this app.
class ApiService {
  static Future<List<Project>> listProjects() async {
    final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/api/projects'));
    if (res.statusCode != 200) throw Exception('Failed to load projects');
    final data = jsonDecode(res.body);
    return (data['projects'] as List)
        .map((p) => Project(projectId: p['projectId'], projectName: p['projectName']))
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
      headers: {'Content-Type': 'application/json'},
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
    final data = jsonDecode(res.body);
    if (res.statusCode != 200) {
      throw Exception(data['error'] ?? 'Failed to process update');
    }
    return data;
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
    request.fields['project_id'] = projectId;
    request.fields['supervisor_id'] = supervisorId;
    request.files.add(await http.MultipartFile.fromPath('file', file.path));

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    final data = jsonDecode(res.body);
    if (res.statusCode != 200) {
      throw Exception(data['error'] ?? 'Failed to upload file');
    }
    return data;
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
