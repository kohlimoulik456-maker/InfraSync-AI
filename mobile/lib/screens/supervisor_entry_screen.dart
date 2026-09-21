import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../widgets/coming_soon_dialog.dart';
import 'text_update_screen.dart';
import 'excel_upload_screen.dart';

class SupervisorEntryScreen extends StatefulWidget {
  const SupervisorEntryScreen({super.key});

  @override
  State<SupervisorEntryScreen> createState() => _SupervisorEntryScreenState();
}

class _SupervisorEntryScreenState extends State<SupervisorEntryScreen> {
  final _supervisorIdController = TextEditingController();
  List<Project> _projects = [];
  Project? _selectedProject;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    try {
      final projects = await ApiService.listProjects();
      setState(() {
        _projects = projects;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Could not load projects. Check the API base URL and backend connection.';
        _loading = false;
      });
    }
  }

  bool get _canProceed => _supervisorIdController.text.trim().isNotEmpty && _selectedProject != null;

  void _goToTextUpdate() {
    if (!_canProceed) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => TextUpdateScreen(
          supervisorId: _supervisorIdController.text.trim(),
          project: _selectedProject!,
        ),
      ),
    );
  }

  void _goToExcelUpload() {
    if (!_canProceed) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ExcelUploadScreen(
          supervisorId: _supervisorIdController.text.trim(),
          project: _selectedProject!,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Supervisor')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDECEC),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(_error!, style: const TextStyle(color: Color(0xFFB4232C))),
                    ),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Supervisor_ID', style: TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _supervisorIdController,
                            decoration: const InputDecoration(hintText: 'SUP-101'),
                            onChanged: (_) => setState(() {}),
                          ),
                          const SizedBox(height: 16),
                          const Text('Project', style: TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 6),
                          DropdownButtonFormField<Project>(
                            value: _selectedProject,
                            items: _projects
                                .map((p) => DropdownMenuItem(
                                      value: p,
                                      child: Text('${p.projectName} (${p.projectId})', overflow: TextOverflow.ellipsis),
                                    ))
                                .toList(),
                            onChanged: (p) => setState(() => _selectedProject = p),
                            decoration: const InputDecoration(hintText: 'Select a project…'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE7E9ED)),
                    ),
                    child: const Text(
                      'Current prototype supports Text and Excel inputs. Voice transcription and '
                      'scanned-diary OCR are planned for a future release.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF4A5568)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _InputCard(
                    icon: Icons.text_snippet_outlined,
                    title: 'Text Update',
                    description: 'Describe today\'s progress. AI extracts and maps it to your schedule.',
                    badge: 'MVP Available',
                    badgeColor: const Color(0xFF12866F),
                    enabled: _canProceed,
                    onTap: _goToTextUpdate,
                  ),
                  const SizedBox(height: 10),
                  _InputCard(
                    icon: Icons.table_chart_outlined,
                    title: 'Excel Upload',
                    description: 'Submit multiple activity updates using the supervisor Excel/CSV format.',
                    badge: 'MVP Available',
                    badgeColor: const Color(0xFF12866F),
                    enabled: _canProceed,
                    onTap: _goToExcelUpload,
                  ),
                  const SizedBox(height: 10),
                  _InputCard(
                    icon: Icons.mic_none,
                    title: 'Voice Update',
                    description: 'Speak your update and let AI transcribe it.',
                    badge: 'Coming Soon',
                    badgeColor: const Color(0xFFC97A0C),
                    enabled: true,
                    onTap: () => showComingSoonDialog(
                      context: context,
                      title: 'Voice Input Module — Coming Soon',
                      message:
                          'Voice-to-text processing will be available in the next release. For the current prototype, please submit your progress update using Text Update or Excel Upload.',
                      onUseText: _goToTextUpdate,
                      onUseExcel: _goToExcelUpload,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _InputCard(
                    icon: Icons.document_scanner_outlined,
                    title: 'Scan Site Diary',
                    description: 'Capture a handwritten site diary page for OCR extraction.',
                    badge: 'Coming Soon',
                    badgeColor: const Color(0xFFC97A0C),
                    enabled: true,
                    onTap: () => showComingSoonDialog(
                      context: context,
                      title: 'Scan Diary / OCR Module — Coming Soon',
                      message:
                          'Handwritten diary OCR and scanned-document extraction will be available in the next release. For the current prototype, please submit your progress update using Text Update or Excel Upload.',
                      onUseText: _goToTextUpdate,
                      onUseExcel: _goToExcelUpload,
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _InputCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final String badge;
  final Color badgeColor;
  final bool enabled;
  final VoidCallback onTap;

  const _InputCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.badge,
    required this.badgeColor,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEAF0F7),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: const Color(0xFF0F2A4A)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: badgeColor.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(badge, style: TextStyle(fontSize: 10, color: badgeColor, fontWeight: FontWeight.w600)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(description, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568))),
                    ],
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
