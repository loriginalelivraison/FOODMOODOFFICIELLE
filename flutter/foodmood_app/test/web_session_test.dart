import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:foodmood_app/web_session.dart';

void main() {
  Map<String, Object?> auth({String role = 'livreur', String online = 'true', String? course}) => {
    'token': 'access-token',
    'role': role,
    'account': jsonEncode({'id': 7}),
    'online': online,
    'activeCourseId': course,
  };

  test('only the HTTPS application origin can read native session features', () {
    expect(isTrustedWebUrl(Uri.parse('https://www.winrak.fr/course/42')), isTrue);
    expect(isTrustedWebUrl(Uri.parse('https://winrak.fr')), isTrue);
    for (final url in ['http://www.winrak.fr', 'https://www.winrak.fr.example.com', 'https://example.com', 'https://www.winrak.fr:8443', 'https://user@www.winrak.fr']) {
      expect(isTrustedWebUrl(Uri.parse(url)), isFalse, reason: url);
    }
  });

  test('both WebView JSON encodings preserve the authenticated account', () {
    for (final value in [auth(), jsonEncode(auth()), jsonEncode(jsonEncode(auth()))]) {
      final session = WebSession.fromJavaScript(value);
      expect(session?.identity, 'livreur:7');
      expect(session?.accessToken, 'access-token');
      expect(session?.collection, 'livreurs');
      expect(session?.locationEnabled, isTrue);
    }
  });

  test('background GPS follows driver availability or an active assignment', () {
    expect(WebSession.fromJavaScript(auth(role: 'client'))?.locationEnabled, isFalse);
    expect(WebSession.fromJavaScript(auth(role: 'client', course: '42'))?.locationEnabled, isFalse);
    expect(WebSession.fromJavaScript(auth(online: 'false'))?.locationEnabled, isFalse);
    expect(WebSession.fromJavaScript(auth(online: 'false', course: '42'))?.locationEnabled, isTrue);
    expect(WebSession.fromJavaScript(auth(online: 'false', course: 'null'))?.locationEnabled, isFalse);
    expect(WebSession.fromJavaScript(auth(role: 'client'))?.collection, 'clients');
  });

  test('logout and malformed session data cannot start native tracking', () {
    for (final value in [
      null,
      'invalid JSON',
      {'token': null},
      {...auth(), 'token': ''},
      {...auth(), 'token': 'null'},
      {...auth(), 'role': 'admin'},
      {...auth(), 'account': 'null'},
      {...auth(), 'account': '{'},
      {...auth(), 'account': jsonEncode({'id': '../1'})},
      {...auth(), 'account': jsonEncode({'id': 0})},
    ]) {
      expect(WebSession.fromJavaScript(value), isNull);
    }
  });
}
