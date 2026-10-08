# WinRak course offer notifications

Android-only Flutter plugin, automatically registered in both the main engine
and Firebase Messaging's background engine. Other notifications remain managed
by `flutter_local_notifications`.

Uses `DecoratedCustomViewStyle` with the Android system header, a compact price
summary, a heads-up route preview, and an expanded route with 48 dp actions.
Colors are applied to custom RemoteViews buttons, not the system action bar.
Text uses system theme colors; addresses use Unicode bidi isolation for mixed
Arabic, French and numeric content. Expanded addresses wrap to two lines.

Buttons launch the app directly using immutable, distinct PendingIntents and
the `flutter_local_notifications` 21.x intent contract. Existing cold-start
and foreground handlers receive the original `type`, `course_id`, and action.
Recheck this contract when upgrading that dependency. No notification receiver
or Activity trampoline is introduced.

Deploy the backend update to include `price`, `pickup_address`, and
`destination` in FCM data. Earlier payloads retain their actual price and use
explicit route placeholders. Delivery remains high-priority data-only FCM.
The Dart caller falls back to the existing notification if native posting fails.

## Device validation before release

On Android 12+ and an older supported device, send a real offer while the app
is visible, backgrounded, and removed from recents. Verify exactly one alert,
the correct price and route, then accept and reject different offers from both
the heads-up banner and expanded shade. Repeat with a locked screen, dark mode,
mixed Arabic/French addresses, long addresses and increased font size. Confirm
that each action reaches the correct course once, including after cold launch.

Collapsed content is limited by Android and shows the title, price and a
single-line route preview; expand for labeled addresses and actions. Lock-screen content follows the user's privacy
settings. FCM reception is subject to Android permissions, connectivity and
OEM battery policies; Android Settings force-stop prevents reception until
the user opens the app again.
