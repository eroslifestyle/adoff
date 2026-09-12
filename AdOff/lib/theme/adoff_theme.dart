import 'package:flutter/material.dart';

const _primaryColor = Color(0xFF7C5CFC); // shield-purple
const _primaryLight = Color(0xFFB8A9FF);
const _background = Color(0xFF0A0A1A); // deep-space
const _surface = Color(0xFF12122A); // midnight-blue
const _text = Color(0xFFE2E2F0);
const _textMuted = Color(0xFF8A8AAA);

ThemeData get adoffTheme => ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  colorScheme: ColorScheme.dark(
    primary: _primaryColor,
    secondary: _primaryLight,
    surface: _surface,
    onPrimary: Colors.white,
    onSurface: _text,
  ),
  scaffoldBackgroundColor: _background,
  appBarTheme: const AppBarTheme(
    backgroundColor: _background,
    foregroundColor: _text,
    elevation: 0,
  ),
  cardTheme: CardThemeData(
    color: _surface,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: _primaryColor,
      foregroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
    ),
  ),
  textTheme: const TextTheme(
    headlineLarge: TextStyle(color: _text, fontWeight: FontWeight.w800),
    headlineMedium: TextStyle(color: _text, fontWeight: FontWeight.w700),
    bodyLarge: TextStyle(color: _text),
    bodyMedium: TextStyle(color: _textMuted),
  ),
);
