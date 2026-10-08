import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodmood_app/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  AndroidFlutterLocalNotificationsPlugin.registerWith();
  const channel = MethodChannel('winrak/course_notifications');
  const fallbackChannel = MethodChannel(
    'dexterous.com/flutter/local_notifications',
  );

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(fallbackChannel, null);
  });

  test(
    'notification routing distinguishes clients, drivers and invalid IDs',
    () {
      expect(
        notificationDestination({
          'recipient_role': 'client',
          'course_id': '42',
          'type': 'course_cancelled',
        })?.path,
        '/course/42',
      );
      expect(
        notificationDestination({
          'course_id': '42',
          'type': 'course_offer',
        }, action: 'accept')?.queryParameters,
        {'offer_action': 'accept'},
      );
      expect(notificationDestination({'course_id': '../admin'}), isNull);
      expect(
        notificationDestination({
          'course_id': '42',
          'account_id': '7',
          'open_home': 'true',
        })?.path,
        '/livreur-dashboard/7',
      );
    },
  );

  test(
    'all event notifications use the versioned channel and bundled sound',
    () {
      final android = notificationDetails(courseOffer: false);
      expect(android.channelId, 'winrak_events_v2');
      expect(android.icon, 'ic_winrak_offer');
      expect(android.sound, isA<RawResourceAndroidNotificationSound>());
      expect(
        notificationPlatformDetails(courseOffer: false).iOS?.sound,
        'winrak_notification.wav',
      );
      expect(android.actions, isEmpty);
    },
  );

  test('repeated push events are posted and sounded once', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    var posts = 0;
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(channel, (call) async => true);
    messenger.setMockMethodCallHandler(fallbackChannel, (call) async {
      posts++;
      return null;
    });
    const message = RemoteMessage(
      data: {
        'type': 'course_cancelled',
        'course_id': '99',
        'event_id': 'cancel-test-99',
        'recipient_role': 'client',
      },
    );
    await showPushNotification(FlutterLocalNotificationsPlugin(), message);
    await showPushNotification(FlutterLocalNotificationsPlugin(), message);
    expect(posts, 1);
  });

  test(
    'persistent native duplicate check suppresses a background replay',
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      var posts = 0;
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(channel, (call) async => false);
      messenger.setMockMethodCallHandler(fallbackChannel, (call) async {
        posts++;
        return null;
      });
      await showPushNotification(
        FlutterLocalNotificationsPlugin(),
        const RemoteMessage(
          data: {
            'type': 'course_cancelled',
            'course_id': '100',
            'event_id': 'cancel-test-100',
          },
        ),
      );
      expect(posts, 0);
    },
  );

  test(
    'native posting failure falls back with both existing actions',
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      MethodCall? fallback;
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(channel, (call) async {
        throw PlatformException(code: 'offer_notification');
      });
      messenger.setMockMethodCallHandler(fallbackChannel, (call) async {
        fallback = call;
        return null;
      });
      await showPushNotification(
        FlutterLocalNotificationsPlugin(),
        const RemoteMessage(
          data: {
            'type': 'course_offer',
            'course_id': '44',
            'title': 'رحلة جديدة',
            'body': '500 دج',
          },
        ),
      );
      expect(fallback?.method, 'show');
      expect(fallback?.arguments['id'], 44);
      final actions =
          fallback?.arguments['platformSpecifics']['actions'] as List;
      expect(actions.map((action) => action['id']), ['accept', 'reject']);
    },
  );

  test(
    'FCM offers retain course identity and structured route in native UI',
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      MethodCall? received;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
            received = call;
            return null;
          });

      await showPushNotification(
        FlutterLocalNotificationsPlugin(),
        const RemoteMessage(
          data: {
            'type': 'course_offer',
            'course_id': '42',
            'price': '500',
            'pickup_address': 'شارع الاستقلال',
            'destination': 'باب الزوار',
          },
        ),
      );

      expect(received?.method, 'showOffer');
      expect(received?.arguments['id'], 42);
      expect(received?.arguments['price'], '500 دج');
      expect(received?.arguments['pickup'], 'شارع الاستقلال');
      expect(received?.arguments['destination'], 'باب الزوار');
      expect(jsonDecode(received?.arguments['payload']), {
        'type': 'course_offer',
        'course_id': '42',
      });
    },
  );

  test(
    'offers from the previous backend still display their actual price',
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      MethodCall? received;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
            received = call;
            return null;
          });
      await showPushNotification(
        FlutterLocalNotificationsPlugin(),
        const RemoteMessage(
          data: {'type': 'course_offer', 'course_id': '43', 'body': '575 دج'},
        ),
      );
      expect(received?.arguments['price'], '575 دج');
      expect(received?.arguments['pickup'], 'موقع العميل');
    },
  );
}
