import 'package:flutter/material.dart';

/// Shown for Voice Update and Scan Site Diary. Never requests microphone or
/// camera permission, never opens a recorder/camera, and never touches the
/// backend AI pipeline - matches the web app's ComingSoonModal exactly.
Future<void> showComingSoonDialog({
  required BuildContext context,
  required String title,
  required String message,
  required VoidCallback onUseText,
  required VoidCallback onUseExcel,
}) {
  return showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      content: Text(message, style: const TextStyle(fontSize: 14, height: 1.4)),
      actionsAlignment: MainAxisAlignment.spaceBetween,
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(ctx);
            onUseText();
          },
          child: const Text('Use Text Update'),
        ),
        TextButton(
          onPressed: () {
            Navigator.pop(ctx);
            onUseExcel();
          },
          child: const Text('Use Excel Upload'),
        ),
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
      ],
    ),
  );
}
