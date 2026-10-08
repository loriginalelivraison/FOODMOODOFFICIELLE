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
  const fallbackChannel = MethodChannel('dexterous.com/flutter/local_notifications');

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(fallbackChannel, null);
  });

  test('native posting failure falls back with both existing actions', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    MethodCall? fallback;
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(channel, (call) async {
      throw PlatformException(code: 'offer_notification');
    });
    messenger.setMockMethodCallHandler(fallbackChannel, (call) async {
      fallback = call;
      return null;
    });
    await showPushNotification(
      FlutterLocalNotificationsPlugin(),
      const RemoteMessage(data: {
        'type': 'course_offer',
        'course_id': '44',
        'title': 'رحلة جديدة',
        'body': '500 دج',
      }),
    );
    expect(fallback?.method, 'show');
    expect(fallback?.arguments['id'], 44);
    final actions = fallback?.arguments['platformSpecifics']['actions'] as List;
    expect(actions.map((action) => action['id']), ['accept', 'reject']);
  });

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
