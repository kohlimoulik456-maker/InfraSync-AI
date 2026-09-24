import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ExcelUploadScreen extends StatefulWidget {
  final String supervisorId;
  final Project project;

  const ExcelUploadScreen({super.key, required this.supervisorId, required this.project});

  @override
  State<ExcelUploadScreen> createState() => _ExcelUploadScreenState();
}

class _ExcelUploadScreenState extends State<ExcelUploadScreen> {
  File? _file;
  String? _fileName;
  bool _submitting = false;
  String? _error;
  Map<String, dynamic>? _summary;

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'csv'],
    );
    if (result != null && result.files.single.path != null) {
      setState(() {
        _file = File(result.files.single.path!);
        _fileName = result.files.single.name;
      });
    }
  }

  Future<void> _submit() async {
    if (_file == null) {
      setState(() => _error = 'Please choose a file to upload.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _summary = null;
    });
    try {
      final data = await ApiService.uploadExcel(
        projectId: widget.project.projectId,
        supervisorId: widget.supervisorId,
        file: _file!,
      );
      if (mounted) setState(() => _summary = data['summary'] as Map<String, dynamic>?);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Excel Upload')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Supervisor: ${widget.supervisorId}  ·  Project: ${widget.project.projectId}',
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFCBD5E0), style: BorderStyle.solid),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.table_chart_outlined, color: Colors.grey),
                  const SizedBox(width: 12),
                  Expanded(child: Text(_fileName ?? 'No file selected — .xlsx or .csv')),
                  OutlinedButton(onPressed: _pickFile, child: const Text('Choose File')),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Use the same Supervisor Excel Format as the web app. Download it from the '
              'Program Manager web dashboard (Excel Upload page) if needed.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 20),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFB4232C))),
              ),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? 'Uploading and processing…' : 'Upload and Process Updates'),
            ),
            if (_summary != null) ...[
              const SizedBox(height: 24),
              const Text('Batch Summary', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _StatChip(label: 'Total', value: _summary!['totalRows']),
                  _StatChip(label: 'Valid', value: _summary!['validRows']),
                  _StatChip(label: 'Invalid', value: _summary!['invalidRows']),
                  _StatChip(label: 'Auto Accepted', value: _summary!['autoAccepted']),
                  _StatChip(label: 'Accept/Monitor', value: _summary!['acceptMonitor']),
                  _StatChip(label: 'Review Required', value: _summary!['reviewRequired']),
                  _StatChip(label: 'No Match', value: _summary!['noMatch']),
                ],
              ),
              const SizedBox(height: 16),
              ...List.generate((_summary!['rows'] as List? ?? const []).length, (i) {
                final row = ((_summary!['rows'] as List?) ?? const [])[i] as Map<String, dynamic>;
                final result = row['result'];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Row ${row['rowIndex']}: ${row['activityDescription'] ?? '—'}',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        const SizedBox(height: 4),
                        if (result != null)
                          Text(
                            '${result['matchStatus']} · ${result['decision']} · ${(result['confidence'] as Map?)?['overall_score'] ?? '—'}%',
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          )
                        else
                            Text(((row['errors'] as List?) ?? const []).join(' · '),
                              style: const TextStyle(fontSize: 12, color: Color(0xFFB4232C))),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final dynamic value;
  const _StatChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: const Color(0xFFF5F6F8), borderRadius: BorderRadius.circular(8)),
      child: Text('$label: $value', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
    );
  }
}
