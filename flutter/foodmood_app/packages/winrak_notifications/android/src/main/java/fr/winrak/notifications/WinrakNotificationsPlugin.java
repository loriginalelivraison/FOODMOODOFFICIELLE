package fr.winrak.notifications;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.media.AudioAttributes;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.MethodChannel;

/** Registered with every Flutter engine, including the FCM background isolate. */
public final class WinrakNotificationsPlugin implements FlutterPlugin {
    private static final String CHANNEL_ID = "winrak_events_v2";
    private MethodChannel channel;
    @Override public void onAttachedToEngine(FlutterPluginBinding binding) {
        Context context = binding.getApplicationContext();
        channel = new MethodChannel(binding.getBinaryMessenger(), "winrak/course_notifications");
        channel.setMethodCallHandler((call, result) -> {
            if (call.method.equals("claimEvent")) {
                result.success(claimEvent(context, call.argument("event_id")));
                return;
            }
            if (!call.method.equals("showOffer")) { result.notImplemented(); return; }
            try {
                int id = ((Number) call.argument("id")).intValue();
                String payload = call.argument("payload");
                String price = call.argument("price");
                String pickup = call.argument("pickup");
                String destination = call.argument("destination");
                NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/raw/winrak_notification");
                if (Build.VERSION.SDK_INT >= 26) {
                    NotificationChannel notifications = new NotificationChannel(CHANNEL_ID, "إشعارات WinRak", NotificationManager.IMPORTANCE_HIGH);
                    notifications.setSound(sound, new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
                    manager.createNotificationChannel(notifications);
                }
                PendingIntent open = intent(context, id, payload, null);
                PendingIntent accept = intent(context, id, payload, "accept");
                PendingIntent reject = intent(context, id, payload, "reject");
                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_winrak_offer)
                    .setColor(0xFFF97316)
                    .setSound(sound)
                    .setContentTitle("رحلة جديدة · " + price)
                    .setContentText("الانطلاق: " + pickup + " · الوصول: " + destination)
                    .setContentIntent(open).setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_EVENT)
                    .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                    .setShowWhen(false)
                    .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                    .setCustomContentView(view(context, R.layout.offer_compact, price, pickup, destination, accept, reject))
                    .setCustomBigContentView(view(context, R.layout.offer_expanded, price, pickup, destination, accept, reject))
                    .setCustomHeadsUpContentView(view(context, R.layout.offer_heads_up, price, pickup, destination, accept, reject));
                manager.notify(id, builder.build());
                result.success(null);
            } catch (Exception error) {
                result.error("offer_notification", error.getMessage(), null);
            }
        });
    }
    private static synchronized boolean claimEvent(Context context, String eventId) {
        if (eventId == null) return true;
        SharedPreferences events = context.getSharedPreferences("winrak_push_events", Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (now - events.getLong(eventId, 0) < 86400000L) return false;
        SharedPreferences.Editor editor = events.edit();
        for (String key : events.getAll().keySet()) {
            if (now - events.getLong(key, 0) >= 86400000L) editor.remove(key);
        }
        editor.putLong(eventId, now).commit();
        return true;
    }
    private static RemoteViews view(Context context, int layout, String price, String pickup, String destination, PendingIntent accept, PendingIntent reject) {
        RemoteViews view = new RemoteViews(context.getPackageName(), layout);
        view.setTextViewText(R.id.offer_price, "\u2067" + price + "\u2069");
        if (layout == R.layout.offer_compact) {
            view.setTextViewText(R.id.offer_pickup, "\u2068" + pickup + "\u2069 \u2190 \u2068" + destination + "\u2069");
        }
        if (layout != R.layout.offer_compact) {
            view.setTextViewText(R.id.offer_pickup, "📍 الانطلاق · \u2068" + pickup + "\u2069");
            view.setTextViewText(R.id.offer_destination, "🏁 الوصول · \u2068" + destination + "\u2069");
            if (layout == R.layout.offer_heads_up) {
                view.setTextViewText(R.id.offer_pickup, "\u0645\u0646: \u2068" + pickup + "\u2069");
                view.setTextViewText(R.id.offer_destination, "\u0625\u0644\u0649: \u2068" + destination + "\u2069");
            }
            view.setOnClickPendingIntent(R.id.offer_accept, accept);
            view.setOnClickPendingIntent(R.id.offer_reject, reject);
        }
        return view;
    }
    private static PendingIntent intent(Context context, int id, String payload, String action) {
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) throw new IllegalStateException("WinRak launch activity unavailable");
        // Use the existing flutter_local_notifications launch and action contract.
        intent.setAction(action == null ? "SELECT_NOTIFICATION" : "SELECT_FOREGROUND_NOTIFICATION");
        intent.setData(Uri.parse("winrak://offer/" + id + "/" + (action == null ? "open" : action)));
        intent.putExtra("notificationId", id);
        intent.putExtra("payload", payload);
        intent.putExtra("actionId", action);
        intent.putExtra("cancelNotification", true);
        return PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    @Override public void onDetachedFromEngine(FlutterPluginBinding binding) { channel.setMethodCallHandler(null); }
}
