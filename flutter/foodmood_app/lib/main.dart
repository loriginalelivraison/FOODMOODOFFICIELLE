import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
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
const String courseEventCategory = "COURSE_EVENT";
const String acceptCourseAction = "accept";
const String rejectCourseAction = "reject";
const String winrakNotificationChannel = 'winrak_events_v2';
const String winrakNotificationSound = 'winrak_notification.wav';
final Set<String> _shownPushEvents = {};

Map<String, dynamic> notificationPayload(Map<String, dynamic> data) => {
  'type': data['type']?.toString() ?? 'course_accepted',
  'course_id': data['course_id']?.toString(),
  if (data['recipient_role'] != null) 'recipient_role': data['recipient_role'],
  if (data['open_home'] != null) 'open_home': data['open_home'],
  if (data['account_id'] != null) 'account_id': data['account_id'],
};

Uri? notificationDestination(Map<String, dynamic> data, {String? action}) {
  final courseId = data['course_id']?.toString();
  if (courseId == null || !RegExp(r'^\d+$').hasMatch(courseId)) return null;
  final isClient = data['recipient_role'] == 'client';
  if (data['open_home'] == 'true' && !isClient) {
    final accountId = data['account_id']?.toString();
    if (accountId != null && RegExp(r'^\d+$').hasMatch(accountId)) {
      return Uri.https('www.winrak.fr', '/livreur-dashboard/$accountId');
    }
  }
  return Uri.https(
    'www.winrak.fr',
    '${isClient ? '/course' : '/livreur-course'}/$courseId',
    !isClient &&
            data['type'] == 'course_offer' &&
            [acceptCourseAction, rejectCourseAction].contains(action)
        ? {'offer_action': action!}
        : null,
  );
}

InitializationSettings get notificationSettings => InitializationSettings(
  android: const AndroidInitializationSettings('ic_winrak_offer'),
  iOS: DarwinInitializationSettings(
    notificationCategories: [
      DarwinNotificationCategory(
        courseEventCategory,
        actions: [
          DarwinNotificationAction.plain(
            'open_course',
            'فتح',
            options: {DarwinNotificationActionOption.foreground},
          ),
        ],
      ),
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
      winrakNotificationChannel,
      'إشعارات WinRak',
      channelDescription: 'إشعارات طلبات الرحلات الجديدة',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      sound: const RawResourceAndroidNotificationSound('winrak_notification'),
      icon: 'ic_winrak_offer',
      color: const Color(0xFFF97316),
      visibility: NotificationVisibility.private,
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
        categoryIdentifier: courseOffer
            ? courseOfferCategory
            : courseEventCategory,
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        sound: winrakNotificationSound,
      ),
    );

String _notificationAddressLabel(String address) {
  final words = address.trim().split(RegExp(r'\s+'));
  return words.length > 5 ? '${words.take(5).join(' ')}...' : address;
}

Future<void> showPushNotification(
  FlutterLocalNotificationsPlugin notifications,
  RemoteMessage message,
) async {
  final eventId = message.data['event_id']?.toString() ?? message.messageId;
  if (eventId != null) {
    if (_shownPushEvents.contains(eventId)) return;
    if (defaultTargetPlatform == TargetPlatform.android) {
      try {
        final claimed = await const MethodChannel(
          'winrak/course_notifications',
        ).invokeMethod<bool>('claimEvent', {'event_id': eventId});
        if (claimed == false) return;
      } on PlatformException catch (_) {
        // Memory deduplication remains available if the native plugin fails.
      } on MissingPluginException catch (_) {}
    }
    if (_shownPushEvents.length >= 128) {
      _shownPushEvents.remove(_shownPushEvents.first);
    }
    _shownPushEvents.add(eventId);
  }
  final type = message.data['type']?.toString() ?? 'course_accepted';
  final courseId = message.data['course_id']?.toString();
  final isCourseOffer = type == 'course_offer';
  final title =
      message.notification?.title ??
      message.data['title']?.toString() ??
      'طلب رحلة جديد';
  final body =
      message.notification?.body ??
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
        'pickup': _notificationAddressLabel(
          message.data['pickup_address']?.toString() ?? 'موقع العميل',
        ),
        'destination': _notificationAddressLabel(
          message.data['destination']?.toString() ?? 'تفاصيل الرحلة',
        ),
        'payload': jsonEncode(notificationPayload(message.data)),
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
    id:
        int.tryParse(courseId ?? '') ??
        DateTime.now().millisecondsSinceEpoch ~/ 1000,
    title: title,
    body: body,
    notificationDetails: notificationPlatformDetails(
      courseOffer: isCourseOffer,
    ),
    payload: jsonEncode(notificationPayload(message.data)),
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
    winrakNotificationChannel,
    'إشعارات WinRak',
    description: 'إشعارات طلبات الرحلات الجديدة',
    importance: Importance.high,
    sound: RawResourceAndroidNotificationSound('winrak_notification'),
  );

  final FlutterLocalNotificationsPlugin notifications =
      FlutterLocalNotificationsPlugin();

  await notifications
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >()
      ?.createNotificationChannel(locationChannel);

  await notifications
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >()
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
      foregroundServiceTypes: [AndroidForegroundType.location],
    ),
    iosConfiguration: IosConfiguration(autoStart: false, onForeground: onStart),
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
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
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
      title: 'WinRak',
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
  Timer? syncTimer;
  StreamSubscription<String>? tokenSubscription;
  StreamSubscription<RemoteMessage>? messageSubscription;
  StreamSubscription<RemoteMessage>? openedSubscription;

  Future<void> initializeLocalNotifications() async {
    await localNotifications.initialize(
      settings: notificationSettings,
      onDidReceiveNotificationResponse: handleNotificationResponse,
    );

    final launchDetails = await localNotifications
        .getNotificationAppLaunchDetails();
    if (launchDetails?.didNotificationLaunchApp == true &&
        launchDetails?.notificationResponse != null) {
      await handleNotificationResponse(launchDetails!.notificationResponse!);
    }
  }

  Future<void> handleNotificationResponse(NotificationResponse response) async {
    final action =
        response.actionId == acceptCourseAction ||
            response.actionId == rejectCourseAction
        ? response.actionId
        : null;
    await openCourseFromNotification(response.payload, action: action);
  }

  Future<void> openCourseFromNotification(
    String? payload, {
    String? action,
  }) async {
    if (payload == null || payload.isEmpty) return;

    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      final destination = notificationDestination(data, action: action);
      if (destination != null) await controller.loadRequest(destination);
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

  String? _syncedAccount;
  bool _syncingAuth = false;

  Future<void> syncAuthFromWebView() async {
    if (_syncingAuth) return;
    _syncingAuth = true;
    try {
      final currentUrl = Uri.tryParse(await controller.currentUrl() ?? '');
      if (currentUrl?.scheme != 'https' ||
          !{'www.winrak.fr', 'winrak.fr'}.contains(currentUrl?.host)) {
        return;
      }
      dynamic auth = await controller.runJavaScriptReturningResult("""
        JSON.stringify({token: localStorage.getItem('access'),
          role: localStorage.getItem('role'),
          account: localStorage.getItem(localStorage.getItem('role') === 'client' ? 'client' : 'livreur')})
      """);
      for (var i = 0; i < 2 && auth is String; i++) {
        auth = jsonDecode(auth);
      }
      if (auth is! Map ||
          auth['token'] == null ||
          auth['account'] == null ||
          !['client', 'livreur'].contains(auth['role'])) {
        _syncedAccount = null;
        return;
      }
      final account = jsonDecode(auth['account'] as String) as Map;
      final token = fcmToken ?? await FirebaseMessaging.instance.getToken();
      if (token == null || account['id'] == null) return;
      final identity = '${auth['role']}:${account['id']}:$token';
      if (_syncedAccount == identity) return;
      final collection = auth['role'] == 'client' ? 'clients' : 'livreurs';
      final response = await http.patch(
        Uri.parse('$backendUrl/$collection/${account['id']}/update_fcm_token/'),
        headers: {
          'Authorization': 'Bearer ${auth['token']}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'fcm_token': token}),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        _syncedAccount = identity;
      }
    } catch (_) {
      debugPrint('WinRak notification registration will retry.');
    } finally {
      _syncingAuth = false;
    }
  }

  Future<void> openExternal(String url) async {
    final uri = Uri.parse(url);

    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint("Impossible d'ouvrir : $url");
    }
  }

  void listenFirebaseMessages() {
    // Foreground notifications are rendered once by our local plugin on iOS.
    FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: false,
      badge: false,
      sound: false,
    );
    FirebaseMessaging.instance.getToken().then((token) {
      fcmToken = token;
      _syncedAccount = null;
    });

    tokenSubscription = FirebaseMessaging.instance.onTokenRefresh.listen((
      token,
    ) {
      fcmToken = token;
      _syncedAccount = null;
    });

    messageSubscription = FirebaseMessaging.onMessage.listen((
      RemoteMessage message,
    ) {
      debugPrint(
        "NOTIFICATION REÇUE FOREGROUND : ${message.notification?.title}",
      );
      showForegroundNotification(message);
      controller.runJavaScript(
        'window.dispatchEvent(new CustomEvent("winrakPush", {detail: ${jsonEncode(notificationPayload(message.data))}}));',
      );
    });

    openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen((
      RemoteMessage message,
    ) {
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
            if (!mounted) return;
            setState(() {
              isLoading = true;
            });
          },
          onPageFinished: (String url) async {
            if (!mounted) return;
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
      ..loadRequest(Uri.parse("https://www.winrak.fr"));
    if (controller.platform is AndroidWebViewController) {
      final androidController = controller.platform as AndroidWebViewController;

      androidController.setOnShowFileSelector((params) async {
        final image = await ImagePicker().pickImage(
          source: ImageSource.gallery,
        );

        if (image == null) {
          return [];
        }

        return [Uri.file(image.path).toString()];
      });

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

    syncTimer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      await syncAuthFromWebView();
    });

    initializeLocalNotifications().then((_) {
      if (mounted) listenFirebaseMessages();
    });
  }

  @override
  void dispose() {
    syncTimer?.cancel();
    tokenSubscription?.cancel();
    messageSubscription?.cancel();
    openedSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: controller),
            if (isLoading) const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }
}
