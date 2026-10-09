import 'dart:convert';

const webAppUrl = 'https://www.winrak.fr';

bool isTrustedWebUrl(Uri? uri) =>
    uri != null &&
    uri.scheme == 'https' &&
    {'winrak.fr', 'www.winrak.fr'}.contains(uri.host) &&
    uri.port == 443 &&
    uri.userInfo.isEmpty;

bool isValidAccountId(Object? value) =>
    value != null && RegExp(r'^[1-9]\d*$').hasMatch(value.toString());

/// The web app owns authentication; native features follow the same session.
class WebSession {
  const WebSession({
    required this.accessToken,
    required this.role,
    required this.accountId,
    required this.locationEnabled,
  });

  final String accessToken;
  final String role;
  final String accountId;
  final bool locationEnabled;

  String get identity => '$role:$accountId';
  String get collection => role == 'client' ? 'clients' : 'livreurs';

  static WebSession? fromJavaScript(Object? value) {
    try {
      // Android may return a JSON string wrapped in another JSON string.
      for (var i = 0; i < 2 && value is String; i++) {
        value = jsonDecode(value);
      }
      if (value is! Map || !['client', 'livreur'].contains(value['role'])) {
        return null;
      }
      final token = value['token'];
      if (token is! String ||
          token.trim().isEmpty ||
          ['null', 'undefined'].contains(token.trim())) {
        return null;
      }
      final rawAccount = value['account'];
      final account = rawAccount is String
          ? jsonDecode(rawAccount)
          : rawAccount;
      if (account is! Map || !isValidAccountId(account['id'])) return null;
      return WebSession(
        accessToken: token.trim(),
        role: value['role'] as String,
        accountId: account['id'].toString(),
        locationEnabled:
            value['role'] == 'livreur' &&
            (value['online'] == 'true' ||
                isValidAccountId(value['activeCourseId'])),
      );
    } on FormatException {
      return null;
    }
  }
}
