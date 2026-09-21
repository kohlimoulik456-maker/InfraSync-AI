import 'package:flutter/material.dart';
import 'screens/supervisor_entry_screen.dart';

void main() {
  runApp(const InfraSyncApp());
}

class InfraSyncApp extends StatelessWidget {
  const InfraSyncApp({super.key});

  @override
  Widget build(BuildContext context) {
    const navy = Color(0xFF0F2A4A);
    const teal = Color(0xFF12866F);
    return MaterialApp(
      title: 'InfraSync-AI Supervisor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: navy, primary: navy, secondary: teal),
        scaffoldBackgroundColor: const Color(0xFFF5F6F8),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: navy,
          elevation: 0.5,
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFFE7E9ED)),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: navy,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFE7E9ED)),
          ),
        ),
      ),
      home: const SupervisorEntryScreen(),
    );
  }
}
