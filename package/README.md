# GDPaymentSDK React Native Integration

A comprehensive guide for integrating the GDPaymentSDK into React Native applications for both iOS and Android platforms.

## Table of Contents
- [Generate New SDK](#Generate SDK)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Android Integration](#android-integration)
- [iOS Integration](#ios-integration)
- [React Native Bridge Implementation](#react-native-bridge-implementation)
- [Testing the Integration](#testing-the-integration)

---

## Generate SDK
- Go to the root SDK project 
  - "cd /Users/amr.fawaz/Documents/geidea-gateway-reactnative"

- Swap
cp android/build.gradle android/build.gradle.dev
cp android/build.gradle.publish android/build.gradle

- Verify
head -3 android/build.gradle

- Pack
npm pack

- Restore
cp android/build.gradle.dev android/build.gradle



## Prerequisites

Before starting the integration, ensure you have:

- React Native development environment configured
- Node.js and npm/yarn installed
- Android Studio for Android development
- Xcode for iOS development (macOS only)
- GDPaymentSDK files:
  - **Android**: `PGW-SDK-1.0.0.aar`, `PGW-SDK-1.0.0.module`, `PGW-SDK-1.0.0.pom`
  - **iOS**: `CardScan.xcframework`, `GeideaPaymentSDK.xcframework`

---

## Project Setup

### 1. Create a New React Native Project

```bash
npx react-native init GeideaPaymentApp
cd GeideaPaymentApp
```

### 2. Install Required Dependencies

```bash
npm install react-native-safe-area-context
```

### 3. Create Project Structure

```
GeideaPaymentApp/
├── App.tsx
├── native/
│   └── GeideaBridge.ts
├── android/
│   └── app/
│       ├── maven-repo/
│       │   └── net/
│       │       └── geidea/
│       │           └── PGW-SDK/
│       │               └── 1.0.0/
│       └── src/
│           └── main/
│               └── java/
│                   └── net/
│                       └── geidea/
│                           └── paymentsdk/
│                               ├── GeideaBridgeModule.kt
│                               └── GeideaBridgePackage.kt
└── ios/
    ├── Frameworks/
    │   ├── CardScan.xcframework
    │   └── GeideaPaymentSDK.xcframework
    └── GeideaPaymentApp/
        ├── GeideaBridge.m
        └── GeideaBridge.swift
```

---

## Android Integration

### Step 1: Add SDK Files to Maven Repository

1. Create the directory structure: `android/app/maven-repo/net/geidea/PGW-SDK/1.0.0/`
2. Copy the following files into this directory:
   - `PGW-SDK-1.0.0.aar`
   - `PGW-SDK-1.0.0.module`
   - `PGW-SDK-1.0.0.pom`

### Step 2: Configure Build Gradle (Project Level)

Edit `android/build.gradle`:

```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
        maven {
            url "$rootDir/app/maven-repo"
        }
    }
}
```

### Step 3: Configure Build Gradle (App Level)

Edit `android/app/build.gradle`:

```gradle
dependencies {
    implementation("com.facebook.react:react-android")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("net.geidea:PGW-SDK:1.0.0")
    implementation("com.google.android.material:material:1.9.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.core:core-ktx:1.10.1")

    if (hermesEnabled.toBoolean()) {
        implementation("com.facebook.react:hermes-android")
    } else {
        implementation jscFlavor
    }
}
```

### Step 4: Create Bridge Module

Create `android/app/src/main/java/net/geidea/paymentsdk/GeideaBridgeModule.kt`:

```kotlin
package net.geidea.paymentsdk

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.*
import net.geidea.sdk.sdk.*
import android.util.Log

class GeideaBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var currentPromise: Promise? = null

    private val activityEventListener = object : ActivityEventListener {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            // SDK handles results via listener
        }

        override fun onNewIntent(intent: Intent) {
            // Not needed
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = "GeideaBridge"

    @ReactMethod
    fun startWithConfig(params: ReadableMap, promise: Promise) {
        if (currentPromise != null) {
            promise.reject("E_IN_PROGRESS", "Payment already in progress")
            return
        }

        val sessionId = params.getString("sessionId")
        if (sessionId.isNullOrEmpty()) {
            promise.reject("E_ARGS", "sessionId is required")
            return
        }

        val language = mapLanguage(params.getString("language"))
        val isSandbox = params.getString("environment") == "sandbox"
        val region = mapRegion(params.getString("region"))

        currentPromise = promise

        try {
            val activity = reactContext.currentActivity
            if (activity == null) {
                currentPromise = null
                promise.reject("E_ACTIVITY", "Activity not found")
                return
            }

            val theme = SDKTheme()
            val config = GDPaymentSDKConfiguration(
                theme = theme,
                sessionId = sessionId,
                language = language,
                isSandbox = isSandbox,
                region = region
            )

            val resultListener = object : GDPaymentResultListener {
                override fun onPaymentCompleted(result: GDPaymentResult) {
                    val promise = currentPromise ?: return
                    currentPromise = null

                    val resultMap = convertPaymentResultToMap(result)
                    val response = Arguments.createMap().apply {
                        putString("status", "completed")
                        putMap("result", resultMap)
                    }
                    promise.resolve(response)
                }

                override fun onPaymentFailure(error: GDPaymentError) {
                    val promise = currentPromise ?: return
                    currentPromise = null

                    val errorMap = convertPaymentErrorToMap(error)
                    val errorCode = errorMap.getString("code") ?: "E_PAYMENT_FAILED"
                    val errorMessage = errorMap.getString("message") ?: "Payment failed"
                    promise.reject(errorCode, errorMessage, errorMap)
                }

                override fun onPaymentCanceled() {
                    val promise = currentPromise ?: return
                    currentPromise = null

                    val response = Arguments.createMap().apply {
                        putString("status", "canceled")
                    }
                    promise.resolve(response)
                }
            }

            val sdk = GDPaymentSDK.sharedInstance()
            sdk.setPaymentCallback(resultListener)

            val presentationStyle = SDKPresentationStyle.Push()
            sdk.start(config, activity, presentationStyle)

        } catch (e: Exception) {
            currentPromise = null
            promise.reject("E_SDK_START", "Failed to start SDK: ${e.localizedMessage}", e)
        }
    }

    private fun mapLanguage(raw: String?): SDKLanguage {
        return when (raw?.lowercase()) {
            "ar", "arabic", "ar-eg", "ar-sa" -> SDKLanguage.ARABIC
            else -> SDKLanguage.ENGLISH
        }
    }

    private fun mapRegion(raw: String?): REGION {
        return when (raw?.lowercase()) {
            "sa", "ksa", "saudi", "saudi arabia" -> REGION.KSA
            "ae", "uae", "emirates" -> REGION.UAE
            "eg", "egypt", "egy" -> REGION.EGY
            else -> REGION.EGY
        }
    }
    
    private fun convertPaymentResultToMap(result: GDPaymentResult): WritableMap {
        val map = Arguments.createMap()

        try {
            result.orderId?.let { map.putString("orderId", it) } ?: map.putNull("orderId")
            result.tokenId?.let { map.putString("tokenId", it) } ?: map.putNull("tokenId")
            result.agreementId?.let { map.putString("agreementId", it) } ?: map.putNull("agreementId")

            result.paymentMethod?.let { pm ->
                val paymentMethodMap = Arguments.createMap()
                pm.type?.let { paymentMethodMap.putString("type", it) }
                pm.brand?.let { paymentMethodMap.putString("brand", it) }
                pm.cardholderName?.let { paymentMethodMap.putString("cardholderName", it) }
                pm.maskedCardNumber?.let { paymentMethodMap.putString("maskedCardNumber", it) }
                pm.wallet?.let { paymentMethodMap.putString("wallet", it) } ?: paymentMethodMap.putNull("wallet")

                pm.expiryDate?.let { expiry ->
                    val expiryMap = Arguments.createMap()
                    expiryMap.putInt("month", expiry.month ?: 0)
                    expiryMap.putInt("year", expiry.year ?: 0)
                    paymentMethodMap.putMap("expiryDate", expiryMap)
                } ?: paymentMethodMap.putNull("expiryDate")

                map.putMap("paymentMethod", paymentMethodMap)
            } ?: map.putNull("paymentMethod")

        } catch (e: Exception) {
            map.putString("_parseError", e.localizedMessage ?: "Unknown error")
        }

        return map
    }

    private fun convertPaymentErrorToMap(error: GDPaymentError): WritableMap {
        val map = Arguments.createMap()
        try {
            error.javaClass.declaredFields.forEach { field ->
                field.isAccessible = true
                val value = field.get(error)
                when (value) {
                    null -> map.putNull(field.name)
                    is String -> map.putString(field.name, value)
                    is Int -> map.putInt(field.name, value)
                    is Long -> map.putDouble(field.name, value.toDouble())
                    is Double -> map.putDouble(field.name, value)
                    is Float -> map.putDouble(field.name, value.toDouble())
                    is Boolean -> map.putBoolean(field.name, value)
                    else -> map.putString(field.name, value.toString())
                }
            }
        } catch (e: Exception) {
            map.putString("code", "E_PAYMENT_ERROR")
            map.putString("message", e.localizedMessage)
        }
        return map
    }
}
```

### Step 5: Create Bridge Package

Create `android/app/src/main/java/net/geidea/paymentsdk/GeideaBridgePackage.kt`:

```kotlin
package net.geidea.paymentsdk

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class GeideaBridgePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(GeideaBridgeModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

### Step 6: Register Package

Edit `android/app/src/main/java/com/geideapaymentapp/MainApplication.java` (or `.kt`):

```java
import net.geidea.paymentsdk.GeideaBridgePackage; // Add this import

@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    packages.add(new GeideaBridgePackage()); // Add this line
    return packages;
}
```

---

## iOS Integration

### Step 1: Add Framework Files

1. Create a `Frameworks` folder inside the `ios` directory
2. Copy `CardScan.xcframework` and `GeideaPaymentSDK.xcframework` into this folder

### Step 2: Link Frameworks in Xcode

1. Open `ios/GeideaPaymentApp.xcworkspace` in Xcode
2. Select your project in the Project Navigator
3. Select your app target
4. Go to **General** tab
5. Scroll to **Frameworks, Libraries, and Embedded Content**
6. Click the **+** button and add:
   - `CardScan.xcframework`
   - `GeideaPaymentSDK.xcframework`
7. Set both to **Embed & Sign**

### Step 3: Create Bridging Header

If you don't have a bridging header, create one:

1. In Xcode, go to **File → New → File**
2. Select **Header File**
3. Name it `GeideaPaymentApp-Bridging-Header.h`
4. Add the following content:

```objc
#import <React/RCTBridgeModule.h>
```

5. In **Build Settings**, set **Objective-C Bridging Header** to `GeideaPaymentApp/GeideaPaymentApp-Bridging-Header.h`

### Step 4: Create Objective-C Bridge File

Create `ios/GeideaPaymentApp/GeideaBridge.m`:

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(GeideaBridge, NSObject)

RCT_EXTERN_METHOD(startWithConfig:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
```

### Step 5: Create Swift Implementation

Create `ios/GeideaPaymentApp/GeideaBridge.swift`:

```swift
import Foundation
import React
import GeideaPaymentSDK
import UIKit

@objc(GeideaBridge)
class GeideaBridge: NSObject {
  
  @objc static func requiresMainQueueSetup() -> Bool { true }
  
  private var currentDelegate: RNGeideaDelegate?
  
  @objc(startWithConfig:resolver:rejecter:)
  func startWithConfig(
    _ params: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let sessionId = params["sessionId"] as? String, !sessionId.isEmpty else {
      return reject("E_ARGS", "sessionId is required", nil)
    }
    
    let lang   = mapLanguage(params["language"] as? String)
    let env    = mapEnvironment(params["environment"] as? String)
    let region = mapRegion(params["region"] as? String)
    
    let cfg = GeideaPaymentSDK.GDPaymentSDKConfiguration(
      sessionId: sessionId,
      applePayConfig: ApplePayConfigurations(merchantId: "merchant.com.geidea.sdk.payment.mock"),
      language: lang,
      environmentType: env,
      region: region
    )
    
    Task { @MainActor in
      let delegate = RNGeideaDelegate(
        onCompleted: { result in
          self.currentDelegate = nil
          resolve([
            "status": "completed",
            "result": result
          ])
        },
        onCanceled: {
          self.currentDelegate = nil
          resolve([
            "status": "canceled"
          ])
        },
        onFailed: { code, message, error in
          self.currentDelegate = nil
          reject(code, message, error)
        }
      )
      
      self.currentDelegate = delegate
      
      do {
        let instance = GeideaPaymentSDK.GDPaymentSDK.sharedInstance()
        try instance.start(configuration: cfg, delegate: delegate)
      } catch {
        self.currentDelegate = nil
        reject("E_SDK_START", "Failed to start SDK: \(error.localizedDescription)", error as NSError)
      }
    }
  }
  
  private func mapLanguage(_ raw: String?) -> GeideaPaymentSDK.AppLanguage {
    if let key = raw?.lowercased(), let val = GeideaPaymentSDK.AppLanguage(rawValue: key) {
      return val
    }
    switch (raw ?? "").lowercased() {
      case "ar", "arabic", "ar-eg", "ar-sa": return .arabic
      default: return .english
    }
  }
  
  private func mapEnvironment(_ raw: String?) -> GeideaPaymentSDK.EnvironmentType {
    if let key = raw?.lowercased(), let val = GeideaPaymentSDK.EnvironmentType(rawValue: key) {
      return val
    }
    switch (raw ?? "").lowercased() {
      case "production": return .production
      default: return .sandbox
    }
  }
  
  private func mapRegion(_ raw: String?) -> GeideaPaymentSDK.Region {
    if let s = raw?.lowercased(), let v = GeideaPaymentSDK.Region(rawValue: s) {
      return v
    }
    switch (raw ?? "").lowercased() {
      case "sa", "ksa": return .ksa
      case "ae", "uae": return .uae
      case "eg", "egypt": return .egy
      default: return .egy
    }
  }
}

final class RNGeideaDelegate: NSObject, GeideaPaymentSDK.GDSDKProtocol {
  
  private let onCompleted: (_ result: [String: Any]) -> Void
  private let onCanceled: () -> Void
  private let onFailed: (_ code: String, _ message: String, _ error: NSError?) -> Void
  
  init(onCompleted: @escaping (_ result: [String: Any]) -> Void,
       onCanceled: @escaping () -> Void,
       onFailed: @escaping (_ code: String, _ message: String, _ error: NSError?) -> Void) {
    self.onCompleted = onCompleted
    self.onCanceled = onCanceled
    self.onFailed = onFailed
  }
  
  @MainActor
  func onPaymentCompleted(result: GeideaPaymentSDK.GDPaymentResult) {
    onCompleted(Self.flattenToDictionary(result))
  }
  
  @MainActor
  func onPaymentFailed(error: GeideaPaymentSDK.GDSDKError) {
    let dict = Self.flattenToDictionary(error)
    let code = (dict["code"] as? String) ?? "E_PAYMENT_FAILED"
    let msg  = (dict["message"] as? String)
    ?? (dict["localizedDescription"] as? String)
    ?? "Payment failed"
    onFailed(code, msg, NSError(domain: code, code: -1, userInfo: dict))
  }
  
  @MainActor
  func onPaymentCanceled() {
    onCanceled()
  }
  
  private static func flattenToDictionary(_ value: Any) -> [String: Any] {
    if let d = value as? [String: Any] { return d }
    if let e = value as? NSError {
      return ["code": e.domain, "message": e.localizedDescription]
    }
    let m = Mirror(reflecting: value)
    var out: [String: Any] = ["description": String(describing: value)]
    for child in m.children {
      if let label = child.label {
        out[label] = unwrap(child.value)
      }
    }
    return out
  }
  
  private static func unwrap(_ any: Any) -> Any {
    let mirror = Mirror(reflecting: any)
    if mirror.displayStyle != .optional { return any }
    if let child = mirror.children.first { return child.value }
    return NSNull()
  }
}
```

---

## React Native Bridge Implementation

### Create TypeScript Bridge

Create `native/GeideaBridge.ts`:

```typescript
import { NativeModules } from 'react-native';

type Language = 'en' | 'ar';
type Environment = 'sandbox' | 'production';
type Region = 'egypt' | 'ksa' | 'uae';

type StartWithConfigOptions = {
  sessionId: string;
  language?: Language;
  environment?: Environment;
  region?: Region;
};

type PaymentMethod = {
  type?: string;
  brand?: string;
  maskedCardNumber?: string;
  cardholderName?: string;
  wallet?: string;
  expiryDate?: {
    month: number;
    year: number;
  };
};

type GeideaResult = {
  status: 'completed' | 'canceled';
  result?: {
    orderId?: string;
    tokenId?: string;
    agreementId?: string;
    paymentMethod?: PaymentMethod;
  };
};

const { GeideaBridge } = NativeModules as {
  GeideaBridge: { startWithConfig(opts: StartWithConfigOptions): Promise<GeideaResult> };
};

let inFlight: Promise<GeideaResult> | null = null;

export function payWithGeidea(opts: StartWithConfigOptions): Promise<GeideaResult> {
  if (!opts?.sessionId) return Promise.reject(new Error('sessionId is required'));
  if (inFlight) return inFlight;
  
  inFlight = GeideaBridge.startWithConfig({
    language: 'en',
    environment: 'sandbox',
    region: 'egypt',
    ...opts,
  }).finally(() => {
    inFlight = null;
  });
  
  return inFlight;
}
```

---

## Testing the Integration

### Android Testing

```bash
npx react-native run-android
```

### iOS Testing

```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

### Test Flow

1. Select region (Egypt, KSA, or UAE)
2. Select environment (Testing or Pre-Production)
3. Select language (English or Arabic)
4. Enter a valid session ID
5. Tap the **PAY** button
6. Complete the payment flow in the SDK
7. Verify the response is displayed correctly

---

## Support

For issues or questions, please refer to the official GDPaymentSDK documentation or contact Geidea support.

---

## License

This integration guide is provided as-is for developers implementing the GDPaymentSDK in React Native applications.
