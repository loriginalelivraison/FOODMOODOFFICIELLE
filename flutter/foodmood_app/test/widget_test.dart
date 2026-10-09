// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:foodmood_app/main.dart';

void main() {
  testWidgets('FoodMoodApp displays its configured root screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      const FoodMoodApp(home: Text('WinRak test screen')),
    );

    expect(find.byType(FoodMoodApp), findsOneWidget);
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.text('WinRak test screen'), findsOneWidget);
  });

  testWidgets('connection failure gives a visible retry action', (tester) async {
    var retries = 0;
    await tester.pumpWidget(FoodMoodApp(
      home: Scaffold(body: WebConnectionError(onRetry: () => retries++)),
    ));
    expect(find.text('تعذر تحميل WinRak'), findsOneWidget);
    await tester.tap(find.text('إعادة المحاولة'));
    expect(retries, 1);
  });
}
