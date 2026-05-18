import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

const String backendUrl =
    "https://foodmood-backend-bfc29fe902a0.herokuapp.com/api";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp();

  await initializeBackgroundService();

  runApp(const FoodMoodApp());
}

Future<void> initializeBackgroundService() async {
  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'foodmood_location',
    'FoodMood localisation',
    description: 'Service de localisation FoodMood en arrière-plan',
    importance: Importance.low,
  );

  final FlutterLocalNotificationsPlugin notifications =
      FlutterLocalNotificationsPlugin();

  await notifications
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(channel);

  final service = FlutterBackgroundService();

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: false,
      isForegroundMode: true,
      notificationChannelId: 'foodmood_location',
      initialNotificationTitle: 'FoodMood actif',
      initialNotificationContent: 'Partage de position en cours',
      foregroundServiceNotificationId: 888,
      foregroundServiceTypes: [
        AndroidForegroundType.location,
      ],
    ),
    iosConfiguration: IosConfiguration(
      autoStart: false,
      onForeground: onStart,
    ),
  );
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  String? token;
  String? livreurId;

  service.on("setAuth").listen((event) {
    token = event?["token"]?.toString();
    livreurId = event?["livreurId"]?.toString();
  });

  if (service is AndroidServiceInstance) {
    await service.setAsForegroundService();

    service.setForegroundNotificationInfo(
      title: 'FoodMood actif',
      content: 'Votre position est partagée',
    );
  }

  Timer.periodic(const Duration(seconds: 15), (timer) async {
    if (token == null || livreurId == null) return;

    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return;

    final permission = await Geolocator.checkPermission();

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return;
    }

    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );

    try {
      await http.patch(
        Uri.parse("$backendUrl/livreurs/$livreurId/update_position/"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({
          "latitude": position.latitude,
          "longitude": position.longitude,
        }),
      );
    } catch (_) {}
  });
}

class FoodMoodApp extends StatelessWidget {
  const FoodMoodApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: FoodMoodWebView(),
    );
  }
}

class FoodMoodWebView extends StatefulWidget {
  const FoodMoodWebView({super.key});

  @override
  State<FoodMoodWebView> createState() => _FoodMoodWebViewState();
}

class _FoodMoodWebViewState extends State<FoodMoodWebView> {
  late final WebViewController controller;
  bool isLoading = true;

  String? fcmToken;
  bool fcmTokenSent = false;

  Future<void> requestPermissions() async {
    await Permission.location.request();
    await Permission.notification.request();

    final service = FlutterBackgroundService();
    final isRunning = await service.isRunning();

    if (!isRunning) {
      await service.startService();
    }
  }

  Future<void> sendFcmTokenToBackend({
    required String tokenJwt,
    required String livreurId,
  }) async {
    if (fcmToken == null || fcmTokenSent) return;

    try {
      final response = await http.patch(
        Uri.parse("$backendUrl/livreurs/$livreurId/update_fcm_token/"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $tokenJwt",
        },
        body: jsonEncode({
          "fcm_token": fcmToken,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        fcmTokenSent = true;
        debugPrint("FCM TOKEN ENVOYÉ AU BACKEND");
      } else {
        debugPrint("Erreur backend FCM token : ${response.body}");
      }
    } catch (e) {
      debugPrint("Erreur envoi FCM token : $e");
    }
  }

  Future<void> syncAuthFromWebView() async {
    try {
      final tokenResult =
          await controller.runJavaScriptReturningResult('''
(() => {
  return localStorage.getItem("access");
})();
''');

      final livreurResult =
          await controller.runJavaScriptReturningResult('''
(() => {
  return localStorage.getItem("livreur");
})();
''');

      String token = tokenResult.toString();
      token = token.replaceAll('"', '');
      token = token.replaceAll(r'\"', '');

      String livreurRaw = livreurResult.toString();
      livreurRaw = livreurRaw.replaceAll(r'\"', '"');

      final match = RegExp(r'"id"\s*:\s*(\d+)').firstMatch(livreurRaw);
      debugPrint("JWT WEBVIEW = $token");
debugPrint("LIVREUR RAW = $livreurRaw");
debugPrint("LIVREUR ID MATCH = ${match?.group(1)}");
debugPrint("FCM TOKEN LOCAL = $fcmToken");
      if (token.isNotEmpty && token != "null" && match != null) {
        final livreurId = match.group(1);

        FlutterBackgroundService().invoke(
          "setAuth",
          {
            "token": token,
            "livreurId": livreurId,
          },
        );

        if (livreurId != null) {
          await sendFcmTokenToBackend(
            tokenJwt: token,
            livreurId: livreurId,
          );
        }
      }
    } catch (_) {}
  }

  Future<void> openExternal(String url) async {
    final uri = Uri.parse(url);

    try {
      await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
    } catch (e) {
      debugPrint("Impossible d'ouvrir : $url");
    }
  }

  @override
  void initState() {
    super.initState();

    requestPermissions();

    FirebaseMessaging.instance.requestPermission();

    FirebaseMessaging.instance.getToken().then((token) {
      fcmToken = token;
      debugPrint("FCM TOKEN LIVREUR = $token");
    });

    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      fcmToken = token;
      fcmTokenSent = false;
      debugPrint("NOUVEAU FCM TOKEN LIVREUR = $token");
    });

    Timer.periodic(
      const Duration(seconds: 5),
      (timer) async {
        await syncAuthFromWebView();
      },
    );

    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFFFFFFF))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() {
              isLoading = true;
            });
          },
          onPageFinished: (String url) async {
            setState(() {
              isLoading = false;
            });

            await syncAuthFromWebView();
          },
          onNavigationRequest: (NavigationRequest request) async {
            final url = request.url;

            if (url.startsWith('tel:')) {
              await openExternal(url);
              return NavigationDecision.prevent;
            }

            if (url.startsWith('https://wa.me/') ||
                url.startsWith('http://wa.me/') ||
                url.startsWith('whatsapp://')) {
              await openExternal(url);
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(
        Uri.parse("https://foodmoodofficielle-3f1e.vercel.app"),
      );

    final androidController = controller.platform as AndroidWebViewController;

    androidController.setOnShowFileSelector(
      (params) async {
        final photoPermission = await Permission.photos.request();

        if (!photoPermission.isGranted && !photoPermission.isLimited) {
          return [];
        }

        final image = await ImagePicker().pickImage(
          source: ImageSource.gallery,
        );

        if (image == null) {
          return [];
        }

        return [Uri.file(image.path).toString()];
      },
    );

    androidController.setGeolocationPermissionsPromptCallbacks(
      onShowPrompt: (request) async {
        final status = await Permission.location.request();

        return GeolocationPermissionsResponse(
          allow: status.isGranted,
          retain: true,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: controller),
            if (isLoading)
              const Center(
                child: CircularProgressIndicator(),
              ),
          ],
        ),
      ),
    );
  }
}