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

import 'web_session.dart';

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
  var notificationsEnabled = false;
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    notificationsEnabled = true;
  } catch (_) {
    debugPrint(
      'Push notifications unavailable; the web app remains accessible.',
    );
  }
  try {
    await initializeBackgroundService();
  } catch (_) {
    debugPrint(
      'Background location unavailable; foreground tracking remains available.',
    );
  }
  runApp(
    FoodMoodApp(
      home: FoodMoodWebView(notificationsEnabled: notificationsEnabled),
    ),
  );
}

Future<void> initializeBackgroundService() async {
  if (defaultTargetPlatform != TargetPlatform.android) return;
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
      autoStartOnBoot: false,
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
  var sending = false;
  var stopped = false;
  Timer? timer;

  Future<void> stopTracking() async {
    stopped = true;
    token = null;
    livreurId = null;
    timer?.cancel();
    await service.stopSelf();
  }

  if (service is AndroidServiceInstance) {
    await service.setAsForegroundService();

    service.setForegroundNotificationInfo(
      title: 'WinRak نشط',
      content: 'تمت مشاركة موقعك',
    );
  }

  Future<void> sendPosition() async {
    if (stopped || sending || token == null || livreurId == null) return;
    sending = true;
    final currentToken = token;
    final currentDriver = livreurId;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return;
      final permission = await Geolocator.checkPermission();
      if (permission != LocationPermission.whileInUse &&
          permission != LocationPermission.always) {
        return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      // A logout/account switch may arrive while obtaining the position.
      if (stopped || currentToken != token || currentDriver != livreurId) {
        return;
      }
      final response = await http
          .patch(
            Uri.parse("$backendUrl/livreurs/$currentDriver/update_position/"),
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer $currentToken",
            },
            body: jsonEncode({
              "latitude": position.latitude,
              "longitude": position.longitude,
            }),
          )
          .timeout(const Duration(seconds: 12));
      if (response.statusCode == 401 || response.statusCode == 403) {
        token = null;
        livreurId = null;
      }
    } catch (_) {
      // GPS/network interruptions are retried without overlapping requests.
    } finally {
      sending = false;
    }
  }

  service.on('stopService').listen((_) => stopTracking());
  service.on('setAuth').listen((event) {
    if (stopped) return;
    token = event?['token']?.toString();
    livreurId = event?['livreurId']?.toString();
    if (token == null || token!.isEmpty || !isValidAccountId(livreurId)) {
      stopTracking();
      return;
    }
    sendPosition();
  });
  timer = Timer.periodic(const Duration(seconds: 15), (_) => sendPosition());
  service.invoke('ready');
}

class FoodMoodApp extends StatelessWidget {
  final Widget home;

  const FoodMoodApp({super.key, this.home = const FoodMoodWebView()});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WinRak',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFF97316)),
        useMaterial3: true,
      ),
      home: home,
    );
  }
}

class FoodMoodWebView extends StatefulWidget {
  const FoodMoodWebView({super.key, this.notificationsEnabled = true});

  final bool notificationsEnabled;

  @override
  State<FoodMoodWebView> createState() => _FoodMoodWebViewState();
}

class _FoodMoodWebViewState extends State<FoodMoodWebView>
    with WidgetsBindingObserver {
  late final WebViewController controller;
  bool isLoading = true;
  bool pageFailed = false;
  Uri lastPage = Uri.parse(webAppUrl);

  final FlutterLocalNotificationsPlugin localNotifications =
      FlutterLocalNotificationsPlugin();
  String? fcmToken;
  Timer? syncTimer;
  StreamSubscription<String>? tokenSubscription;
  StreamSubscription<RemoteMessage>? messageSubscription;
  StreamSubscription<RemoteMessage>? openedSubscription;
  StreamSubscription<Map<String, dynamic>?>? serviceReadySubscription;
  WebSession? _session;
  String? _locationAuth;
  bool _appIsForeground = true;

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
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  String? _syncedAccount;
  bool _syncingAuth = false;

  Future<void> syncAuthFromWebView() async {
    if (_syncingAuth || !mounted) return;
    _syncingAuth = true;
    try {
      final currentUrl = Uri.tryParse(await controller.currentUrl() ?? '');
      if (!isTrustedWebUrl(currentUrl)) return;
      final auth = await controller.runJavaScriptReturningResult("""
        JSON.stringify({token: localStorage.getItem('access'),
          role: localStorage.getItem('role'),
          online: localStorage.getItem('livreurOnline'),
          activeCourseId: localStorage.getItem('activeDriverCourseId'),
          account: localStorage.getItem(localStorage.getItem('role') === 'client' ? 'client' : 'livreur')})
      """);
      final session = WebSession.fromJavaScript(auth);
      _session = session;
      try {
        await syncLocationService();
      } catch (_) {
        debugPrint('Background location synchronization will retry.');
      }
      if (session == null) {
        _syncedAccount = null;
        return;
      }
      if (!widget.notificationsEnabled) return;
      final token = fcmToken ?? await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      final identity = '${session.identity}:$token';
      if (_syncedAccount == identity) return;
      final response = await http
          .patch(
            Uri.parse(
              '$backendUrl/${session.collection}/${session.accountId}/update_fcm_token/',
            ),
            headers: {
              'Authorization': 'Bearer ${session.accessToken}',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'fcm_token': token}),
          )
          .timeout(const Duration(seconds: 12));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        _syncedAccount = identity;
      }
    } catch (_) {
      debugPrint('WinRak notification registration will retry.');
    } finally {
      _syncingAuth = false;
    }
  }

  Future<void> syncLocationService() async {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    final service = FlutterBackgroundService();
    final session = _session;
    final running = await service.isRunning();
    if (session == null || !session.locationEnabled) {
      _locationAuth = null;
      if (running) service.invoke('stopService');
      return;
    }
    // Android requires a visible activity and granted location permission to
    // start this foreground service. The website requests GPS when needed.
    if (!await Permission.location.isGranted) {
      _locationAuth = null;
      if (running) service.invoke('stopService');
      return;
    }
    if (!running) {
      if (!_appIsForeground) return;
      _locationAuth = null;
      await service.startService();
    }
    final identity = '${session.identity}:${session.accessToken}';
    if (_locationAuth == identity && running) return;
    _locationAuth = identity;
    service.invoke('setAuth', {
      'token': session.accessToken,
      'livreurId': session.accountId,
    });
  }

  Future<void> openExternal(String url) async {
    try {
      final uri = Uri.tryParse(url);
      if (uri == null ||
          !{
            'https',
            'http',
            'tel',
            'mailto',
            'sms',
            'whatsapp',
            'geo',
            'comgooglemaps',
          }.contains(uri.scheme)) {
        return;
      }
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
    } catch (_) {
      debugPrint('External application unavailable.');
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تعذر فتح الرابط. تحقق من التطبيقات المثبتة.'),
        ),
      );
    }
  }

  void listenFirebaseMessages() {
    // Foreground notifications are rendered once by our local plugin on iOS.
    FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: false,
      badge: false,
      sound: false,
    );
    FirebaseMessaging.instance
        .getToken()
        .then((token) {
          fcmToken = token;
          _syncedAccount = null;
          syncAuthFromWebView();
        })
        .catchError((Object _) {
          debugPrint('Push token will be retried.');
        });

    tokenSubscription = FirebaseMessaging.instance.onTokenRefresh.listen((
      token,
    ) {
      fcmToken = token;
      _syncedAccount = null;
      syncAuthFromWebView();
    });

    messageSubscription = FirebaseMessaging.onMessage.listen((
      RemoteMessage message,
    ) async {
      try {
        await showForegroundNotification(message);
        if (mounted &&
            isTrustedWebUrl(
              Uri.tryParse(await controller.currentUrl() ?? ''),
            )) {
          await controller.runJavaScript(
            'window.dispatchEvent(new CustomEvent("winrakPush", {detail: ${jsonEncode(notificationPayload(message.data))}}));',
          );
        }
      } catch (_) {
        debugPrint('Foreground notification could not be displayed.');
      }
    });

    openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen((
      RemoteMessage message,
    ) {
      debugPrint("NOTIFICATION CLIQUÉE : ${message.notification?.title}");
      openCourseFromNotification(jsonEncode(message.data));
    });

    FirebaseMessaging.instance
        .getInitialMessage()
        .then((message) {
          if (message != null) {
            openCourseFromNotification(jsonEncode(message.data));
          }
        })
        .catchError((Object _) {
          debugPrint('Initial push unavailable.');
        });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFFFFFFF))
      ..addJavaScriptChannel(
        'WinRakSession',
        onMessageReceived: (_) {
          syncAuthFromWebView();
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            if (!mounted) return;
            setState(() {
              isLoading = true;
              pageFailed = false;
              final uri = Uri.tryParse(url);
              if (isTrustedWebUrl(uri)) lastPage = uri!;
            });
          },
          onPageFinished: (String url) async {
            if (!mounted) return;
            setState(() {
              isLoading = false;
            });
            if (!isTrustedWebUrl(Uri.tryParse(url)) || pageFailed) return;
            try {
              await controller.runJavaScript('''
                if (!window.__winrakSessionBridge) {
                  window.__winrakSessionBridge = true;
                  const sync = () => WinRakSession.postMessage('sync');
                  window.addEventListener('authChanged', sync);
                  window.addEventListener('storage', sync);
                  document.addEventListener('visibilitychange', sync);
                }
              ''');
            } catch (_) {
              // A navigation can replace the document before this executes.
            }
            await syncAuthFromWebView();
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame == true ||
                error.url == lastPage.toString()) {
              showPageFailure();
            }
          },
          onHttpError: (error) {
            if (error.request?.uri == lastPage) showPageFailure();
          },
          onNavigationRequest: (NavigationRequest request) async {
            final uri = Uri.tryParse(request.url);
            if (isTrustedWebUrl(uri)) return NavigationDecision.navigate;
            if (request.isMainFrame) await openExternal(request.url);
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(lastPage);
    if (controller.platform is AndroidWebViewController) {
      final androidController = controller.platform as AndroidWebViewController;

      androidController.setOnShowFileSelector((params) async {
        try {
          if (!isTrustedWebUrl(
            Uri.tryParse(await controller.currentUrl() ?? ''),
          )) {
            return [];
          }
          final picker = ImagePicker();
          if (params.mode == FileSelectorMode.openMultiple &&
              !params.isCaptureEnabled) {
            final images = await picker.pickMultiImage();
            return images
                .map((image) => Uri.file(image.path).toString())
                .toList();
          }
          final image = await picker.pickImage(
            source: params.isCaptureEnabled
                ? ImageSource.camera
                : ImageSource.gallery,
          );
          return image == null ? [] : [Uri.file(image.path).toString()];
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'تعذر اختيار الصورة. تحقق من الأذونات وحاول مجددًا.',
                ),
              ),
            );
          }
          return [];
        }
      });

      androidController.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (request) async {
          if (!isTrustedWebUrl(Uri.tryParse(request.origin))) {
            return const GeolocationPermissionsResponse(
              allow: false,
              retain: false,
            );
          }
          final status = await Permission.location.request();
          syncAuthFromWebView();
          return GeolocationPermissionsResponse(
            allow: status.isGranted,
            retain: status.isGranted,
          );
        },
      );
    }

    syncTimer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      await syncAuthFromWebView();
    });

    if (defaultTargetPlatform == TargetPlatform.android) {
      serviceReadySubscription = FlutterBackgroundService().on('ready').listen((
        _,
      ) {
        _locationAuth = null;
        syncLocationService().catchError((Object _) {
          debugPrint('Background location synchronization will retry.');
        });
      });
    }
    if (widget.notificationsEnabled) initializeNotifications();
  }

  Future<void> initializeNotifications() async {
    try {
      await initializeLocalNotifications();
      await requestPermissions();
      if (mounted) listenFirebaseMessages();
    } catch (_) {
      debugPrint('Push notifications unavailable for this session.');
    }
  }

  void showPageFailure() {
    if (!mounted) return;
    setState(() {
      isLoading = false;
      pageFailed = true;
    });
  }

  Future<void> handleBack() async {
    if (await controller.canGoBack()) {
      await controller.goBack();
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      await SystemNavigator.pop();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appIsForeground = state == AppLifecycleState.resumed;
    if (_appIsForeground) syncAuthFromWebView();
  }

  @override
  void dispose() {
    syncTimer?.cancel();
    tokenSubscription?.cancel();
    messageSubscription?.cancel();
    openedSubscription?.cancel();
    serviceReadySubscription?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) handleBack();
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: controller),
              if (pageFailed)
                WebConnectionError(
                  onRetry: () {
                    setState(() {
                      pageFailed = false;
                      isLoading = true;
                    });
                    controller.loadRequest(lastPage);
                  },
                ),
              if (isLoading)
                const Align(
                  alignment: Alignment.topCenter,
                  child: LinearProgressIndicator(
                    semanticsLabel: 'جارٍ التحميل',
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class WebConnectionError extends StatelessWidget {
  const WebConnectionError({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Theme.of(context).colorScheme.surface,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.wifi_off_rounded,
                  size: 48,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: 20),
                Text(
                  'تعذر تحميل WinRak',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                const Text(
                  'تحقق من اتصال الإنترنت ثم حاول مجددًا.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('إعادة المحاولة'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
