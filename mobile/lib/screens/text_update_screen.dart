import 'package:intl/intl.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class TextUpdateScreen extends StatefulWidget {
  final String supervisorId;
  final Project project;

  const TextUpdateScreen({super.key, required this.supervisorId, required this.project});

  @override
  State<TextUpdateScreen> createState() => _TextUpdateScreenState();
}

class _TextUpdateScreenState extends State<TextUpdateScreen> {
  DateTime _updateDate = DateTime.now();
  String? _discipline;
  final _areaController = TextEditingController();
  final _textController = TextEditingController();
  final _delayController = TextEditingController();
  final _remarksController = TextEditingController();

  bool _submitting = false;
  Map<String, dynamic>? _result;
  String? _error;

  static const disciplines = ['CIVIL', 'PIPING', 'ELECTRICAL', 'INSTRUMENTATION', 'MECHANICAL', 'HSE'];

  @override
  void dispose() {
    _areaController.dispose();
    _textController.dispose();
    _delayController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_textController.text.trim().isEmpty) {
      setState(() => _error = 'Please describe the activity/progress update.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _result = null;
    });
    try {
      final data = await ApiService.submitTextUpdate(
        projectId: widget.project.projectId,
        supervisorId: widget.supervisorId,
        updateDate: DateFormat('yyyy-MM-dd').format(_updateDate),
        discipline: _discipline,
        areaUnit: _areaController.text.trim().isEmpty ? null : _areaController.text.trim(),
        activityUpdateText: _textController.text.trim(),
        delayReason: _delayController.text.trim().isEmpty ? null : _delayController.text.trim(),
        remarks: _remarksController.text.trim().isEmpty ? null : _remarksController.text.trim(),
      );
      if (mounted) setState(() => _result = data);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Text Update')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: _result != null ? _buildResult() : _buildForm(),
      ),
    );
  }

  Widget _buildForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Supervisor: ${widget.supervisorId}  ·  Project: ${widget.project.projectId}',
            style: const TextStyle(fontSize: 12, color: Colors.grey)),
        const SizedBox(height: 16),
        const Text('Update_Date', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        OutlinedButton(
          onPressed: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _updateDate,
              firstDate: DateTime(2020),
              lastDate: DateTime(2100),
            );
            if (picked != null) setState(() => _updateDate = picked);
          },
          child: Text(DateFormat('yyyy-MM-dd').format(_updateDate)),
        ),
        const SizedBox(height: 16),
        const Text('Discipline', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: _discipline,
          items: disciplines.map((d) => DropdownMenuItem(value: d, child: Text(d))).toList(),
          onChanged: (v) => setState(() => _discipline = v),
          decoration: const InputDecoration(hintText: 'Select…'),
        ),
        const SizedBox(height: 16),
        const Text('Area / Unit', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(controller: _areaController, decoration: const InputDecoration(hintText: 'Rack 3')),
        const SizedBox(height: 16),
        const Text('Activity / Progress Update', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(
          controller: _textController,
          maxLines: 5,
          decoration: const InputDecoration(
            hintText: 'Example: Piping crew started erection of Line 24-A spool at Rack 3 today at 9 AM. Six workers deployed.',
          ),
        ),
        const SizedBox(height: 16),
        const Text('Delay Reason (optional)', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(controller: _delayController),
        const SizedBox(height: 16),
        const Text('Remarks (optional)', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(controller: _remarksController),
        const SizedBox(height: 20),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(_error!, style: const TextStyle(color: Color(0xFFB4232C))),
          ),
        ElevatedButton(
          onPressed: _submitting ? null : _submit,
          child: Text(_submitting ? 'Processing with AI…' : 'Process Update with AI'),
        ),
      ],
    );
  }

  Widget _buildResult() {
    final r = _result!;
    final confidence = r['confidence'];
    final candidates = (r['candidates'] as List?) ?? [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (r['demoMode'] == true) const _Chip(text: 'Demo AI Mode', color: Color(0xFFC97A0C)),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          _Chip(text: r['matchStatus'], color: _statusColor(r['matchStatus'])),
          _Chip(text: r['decision'], color: _statusColor(r['decision'])),
        ]),
        const SizedBox(height: 16),
        _DetailRow(label: 'Update ID', value: '${r['updateId'] ?? '—'}'),
        _DetailBlock(label: 'Original Input', value: _textController.text),
        const SizedBox(height: 8),
        const Text('Candidate Matches', style: TextStyle(fontWeight: FontWeight.w600)),
        ...candidates.map((c) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(child: Text('${c['activity_name']} (${c['activity_id']})', style: const TextStyle(fontSize: 12))),
                  Text('${c['similarity']}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            )),
        const SizedBox(height: 12),
        _DetailRow(label: 'Confidence Score', value: '${confidence is Map ? confidence['overall_score'] ?? '—' : '—'}%'),
        _DetailBlock(label: 'Audit Reason', value: '${r['reason'] ?? 'No audit reason returned.'}'),
        _DetailBlock(
          label: 'Outcome',
          value: (r['decision'] == 'AUTO_ACCEPT' || r['decision'] == 'ACCEPT_MONITOR')
              ? 'Schedule actuals were applied automatically.'
              : 'Sent to Program Manager review queue. Schedule actuals were not changed.',
        ),
        const SizedBox(height: 20),
        OutlinedButton(
          onPressed: () => setState(() {
            _result = null;
            _textController.clear();
          }),
          child: const Text('Submit Another Update'),
        ),
      ],
    );
  }

  Color _statusColor(String status) {
    if (['AUTO_ACCEPT', 'ACCEPT_MONITOR', 'MATCHED'].contains(status)) return const Color(0xFF12866F);
    if (['FLAG_FOR_REVIEW', 'AMBIGUOUS'].contains(status)) return const Color(0xFFC97A0C);
    return const Color(0xFFB4232C);
  }
}

class _Chip extends StatelessWidget {
  final String text;
  final Color color;
  const _Chip({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(text.replaceAll('_', ' '), style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _DetailBlock extends StatelessWidget {
  final String label;
  final String value;
  const _DetailBlock({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 4),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFFF5F6F8), borderRadius: BorderRadius.circular(8)),
            child: Text(value, style: const TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
