import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
const String courseOfferCategory = "COURSE_OFFER";
const String acceptCourseAction = "accept";
const String rejectCourseAction = "reject";

InitializationSettings get notificationSettings => InitializationSettings(
      android: const AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        notificationCategories: [
          DarwinNotificationCategory(
            courseOfferCategory,
            actions: [
              DarwinNotificationAction.plain(
                acceptCourseAction,
                'قبول',
                options: {DarwinNotificationActionOption.foreground},
              ),
              DarwinNotificationAction.plain(
                rejectCourseAction,
                'رفض',
                options: {DarwinNotificationActionOption.foreground},
              ),
            ],
          ),
        ],
      ),
    );

AndroidNotificationDetails notificationDetails({required bool courseOffer}) =>
    AndroidNotificationDetails(
      'high_importance_channel',
      'إشعارات التوصيل',
      channelDescription: 'إشعارات طلبات الرحلات الجديدة',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      actions: courseOffer
          ? const [
              AndroidNotificationAction(
                acceptCourseAction,
                'قبول',
                showsUserInterface: true,
              ),
              AndroidNotificationAction(
                rejectCourseAction,
                'رفض',
                showsUserInterface: true,
              ),
            ]
          : const [],
    );

NotificationDetails notificationPlatformDetails({required bool courseOffer}) =>
    NotificationDetails(
      android: notificationDetails(courseOffer: courseOffer),
      iOS: DarwinNotificationDetails(
        categoryIdentifier: courseOffer ? courseOfferCategory : null,
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );

Future<void> showPushNotification(
  FlutterLocalNotificationsPlugin notifications,
  RemoteMessage message,
) async {
  final type = message.data['type']?.toString() ?? 'course_accepted';
  final courseId = message.data['course_id']?.toString();
  final isCourseOffer = type == 'course_offer';
  final title = message.notification?.title ??
      message.data['title']?.toString() ??
      'طلب رحلة جديد';
  final body = message.notification?.body ??
      message.data['body']?.toString() ??
      'افتح WinRak للاطلاع على تفاصيل الرحلة.';

  if (isCourseOffer && defaultTargetPlatform == TargetPlatform.android) {
    try {
      await const MethodChannel(
        'winrak/course_notifications',
      ).invokeMethod<void>('showOffer', {
        'id':
            int.tryParse(courseId ?? '') ??
            DateTime.now().millisecondsSinceEpoch ~/ 1000,
        'price': message.data['price'] != null
            ? '${message.data['price']} دج'
            : body,
        'pickup': message.data['pickup_address']?.toString() ?? 'موقع العميل',
        'destination':
            message.data['destination']?.toString() ?? 'تفاصيل الرحلة',
        'payload': jsonEncode({'type': type, 'course_id': courseId}),
      });
      return;
    } on PlatformException catch (error) {
      debugPrint('Native offer notification fallback: ${error.code}');
    } on MissingPluginException {
      debugPrint(
        'Native offer notifications unavailable; using standard notification',
      );
    }
  }

  await notifications.show(
    id: int.tryParse(courseId ?? '') ?? DateTime.now().millisecondsSinceEpoch ~/ 1000,
    title: title,
    body: body,
    notificationDetails: notificationPlatformDetails(courseOffer: isCourseOffer),
    payload: jsonEncode({"type": type, "course_id": courseId}),
  );
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  DartPluginRegistrant.ensureInitialized();
  await Firebase.initializeApp();
  if (defaultTargetPlatform != TargetPlatform.android) return;
  final notifications = FlutterLocalNotificationsPlugin();
  await notifications.initialize(settings: notificationSettings);
  await showPushNotification(notifications, message);
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp();

  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  await initializeBackgroundService();

  runApp(const FoodMoodApp());
}

Future<void> initializeBackgroundService() async {
  const AndroidNotificationChannel locationChannel = AndroidNotificationChannel(
    'foodmood_location',
    'موقع WinRak',
    description: 'خدمة الموقع في الخلفية',
    importance: Importance.low,
  );

  const AndroidNotificationChannel fcmChannel = AndroidNotificationChannel(
    'high_importance_channel',
    'إشعارات التوصيل',
    description: 'إشعارات طلبات الرحلات الجديدة',
    importance: Importance.high,
  );

  final FlutterLocalNotificationsPlugin notifications =
      FlutterLocalNotificationsPlugin();

  await notifications
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(locationChannel);

  await notifications
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(fcmChannel);

  final service = FlutterBackgroundService();

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: false,
      isForegroundMode: true,
      notificationChannelId: 'foodmood_location',
      initialNotificationTitle: 'WinRak نشط',
      initialNotificationContent: 'جارٍ مشاركة الموقع',
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
      title: 'WinRak نشط',
      content: 'تمت مشاركة موقعك',
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
  final Widget home;

  const FoodMoodApp({super.key, this.home = const FoodMoodWebView()});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: home,
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

  final FlutterLocalNotificationsPlugin localNotifications =
      FlutterLocalNotificationsPlugin();
  String? fcmToken;
  bool fcmTokenSent = false;
  Timer? syncTimer;

  Future<void> initializeLocalNotifications() async {
    await localNotifications.initialize(
      settings: notificationSettings,
      onDidReceiveNotificationResponse: handleNotificationResponse,
    );

    final launchDetails = await localNotifications.getNotificationAppLaunchDetails();
    if (launchDetails?.didNotificationLaunchApp == true &&
        launchDetails?.notificationResponse != null) {
      await handleNotificationResponse(launchDetails!.notificationResponse!);
    }
  }

  Future<void> handleNotificationResponse(NotificationResponse response) async {
    final action = response.actionId == acceptCourseAction ||
            response.actionId == rejectCourseAction
        ? response.actionId
        : null;
    await openCourseFromNotification(response.payload, action: action);
  }

  Future<void> openCourseFromNotification(String? payload, {String? action}) async {
    if (payload == null || payload.isEmpty) return;

    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      final courseId = data["course_id"]?.toString();

      if (courseId == null || courseId.isEmpty) return;

      final query = action != null && data['type'] == 'course_offer'
          ? {"offer_action": action}
          : <String, String>{};
      await controller.loadRequest(Uri.https(
        "www.winrak.fr",
        "/livreur-course/$courseId",
        query.isEmpty ? null : query,
      ));
    } catch (e) {
      debugPrint("Erreur navigation notification : $e");
    }
  }

  Future<void> showForegroundNotification(RemoteMessage message) async {
    await showPushNotification(localNotifications, message);
  }

  Future<void> requestPermissions() async {
    await Permission.location.request();
    await Permission.notification.request();

    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    debugPrint("PERMISSION NOTIFICATION = ${settings.authorizationStatus}");

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

      debugPrint("URL FCM = $backendUrl/livreurs/$livreurId/update_fcm_token/");
      debugPrint("STATUS FCM = ${response.statusCode}");
      debugPrint("BODY FCM = ${response.body}");

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
    final token = await controller.runJavaScriptReturningResult(
      "localStorage.getItem('access');",
    );

    final livreurRaw = await controller.runJavaScriptReturningResult(
      "localStorage.getItem('livreur');",
    );

    final fcmToken = await FirebaseMessaging.instance.getToken();

    print("JWT WEBVIEW = $token");
    print("LIVREUR RAW = $livreurRaw");
    print("FCM TOKEN LOCAL = $fcmToken");

    if (token == null ||
        livreurRaw == null ||
        fcmToken == null) {
      return;
    }

    final cleanToken =
        token.toString().replaceAll('"', '');

    String cleanLivreur = livreurRaw.toString();

    if (cleanLivreur.startsWith('"')) {
      cleanLivreur =
          cleanLivreur.substring(1, cleanLivreur.length - 1);

      cleanLivreur =
          cleanLivreur.replaceAll(r'\"', '"');
    }

    final livreur = jsonDecode(cleanLivreur);

    final livreurId = livreur["id"];

    print("LIVREUR ID MATCH = $livreurId");

    final response = await http.patch(
      Uri.parse(
        "https://foodmood-backend-bfc29fe902a0.herokuapp.com/api/livreurs/$livreurId/update_fcm_token/",
      ),
      headers: {
        "Authorization": "Bearer $cleanToken",
        "Content-Type": "application/json",
      },
      body: jsonEncode({
        "fcm_token": fcmToken,
      }),
    );

    print("STATUS FCM = ${response.statusCode}");
    print("BODY FCM = ${response.body}");
  } catch (e) {
    print("Erreur syncAuthFromWebView : $e");
  }
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

  void listenFirebaseMessages() {
    FirebaseMessaging.instance.getToken().then((token) {
      fcmToken = token;
      fcmTokenSent = false;
      debugPrint("FCM TOKEN LIVREUR = $token");
    });

    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      fcmToken = token;
      fcmTokenSent = false;
      debugPrint("NOUVEAU FCM TOKEN LIVREUR = $token");
    });

    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint(
        "NOTIFICATION REÇUE FOREGROUND : ${message.notification?.title}",
      );
      showForegroundNotification(message);
    });

    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint("NOTIFICATION CLIQUÉE : ${message.notification?.title}");
      openCourseFromNotification(jsonEncode(message.data));
    });

    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        openCourseFromNotification(jsonEncode(message.data));
      }
    });
  }

  @override
  void initState() {
    super.initState();

    requestPermissions();

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

            if (url.startsWith('https://www.google.com/maps/') ||
                url.startsWith('https://maps.google.com/')) {
              await openExternal(url);
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(
        Uri.parse("https://www.winrak.fr"),
      );
final androidController =
    controller.platform as AndroidWebViewController;
   
androidController.setOnShowFileSelector(
  (params) async {
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

    syncTimer = Timer.periodic(
      const Duration(seconds: 5),
      (timer) async {
        await syncAuthFromWebView();
      },
    );

    initializeLocalNotifications().then((_) {
      listenFirebaseMessages();
    });
  }

  @override
  void dispose() {
    syncTimer?.cancel();
    super.dispose();
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