# Geidea Payment SDK — React Native Demo

A demo React Native app showing how to integrate the [Geidea Payment SDK](https://github.com/geidea/payment-sdk-react-native) for in-app card payments.

## Features

- Accept payments using a Geidea session ID
- Language selection (English / Arabic)
- Environment switching (Test / Pre-Production / Production)
- Region support (Egypt / KSA / UAE)
- Payment result display (order ID, token, card brand, masked card number)

## Prerequisites

- Node.js >= 22.11.0
- Yarn >= 3.6.4
- React Native development environment set up ([official guide](https://reactnative.dev/docs/set-up-your-environment))
- iOS: Xcode 15+, CocoaPods
- Android: Android Studio with SDK 34+

## Setup

```bash
# Install dependencies
yarn install

# iOS only — install CocoaPods
cd ios && bundle exec pod install && cd ..
```

The Geidea SDK package (`geidea-payment-sdk-react-native-0.0.1.tgz`) is included in the repo root. It's referenced as a local dependency in `package.json`.

## Running

```bash
# Start Metro bundler
yarn start

# Run on iOS
yarn ios

# Run on Android
yarn android
```

## How It Works

1. Enter a **session ID** obtained from your backend (created via the Geidea Order API).
2. Select language, environment, and region.
3. Tap **PAY** — the SDK presents the native payment sheet.
4. On completion, an alert shows the order ID, token, and card details.
5. On cancellation, the user is informed.

### Integration Point

The entire integration lives in `App.tsx`:

```typescript
import { payWithGeidea } from '@geidea/payment-sdk-react-native';

const result = await payWithGeidea({
  sessionId: 'your-session-id',
  language: 'en',
  environment: 'test',
  region: 'egypt',
});
```

## Project Structure

```
App.tsx                          # Demo UI and SDK integration
app.json                         # React Native app config
package.json                     # Dependencies (SDK referenced as local .tgz)
index.js                         # App entry point
metro.config.js                  # Metro bundler config
react-native.config.js           # RN CLI config
tsconfig.json                    # TypeScript config
ios/                             # Native iOS project
android/                         # Native Android project
geidea-payment-sdk-react-native-0.0.1.tgz  # Local SDK package
```

## SDK API

| Param          | Type   | Required | Default   | Values                    |
|----------------|--------|----------|-----------|---------------------------|
| `sessionId`    | string | Yes      | —         | Geidea order session ID   |
| `language`     | string | No       | `'en'`    | `'en'`, `'ar'`, `'fr'`   |
| `environment`  | string | No       | `'test'`  | `'test'`, `'preprod'`, `'prod'` |
| `region`       | string | No       | `'egypt'` | `'egypt'`, `'ksa'`, `'uae'`     |

Returns a `GeideaResult`:

```typescript
{ status: 'completed', result: { orderId, tokenId, paymentMethod } }
// or
{ status: 'canceled' }
```

## Troubleshooting

- **`startWithConfig` of null** — Run `cd ios && pod install` to link the native module, then rebuild.
- **Metro cache issues** — Run `yarn start --reset-cache`.
- **iOS build errors** — Ensure you're opening `.xcworkspace`, not `.xcodeproj`.
