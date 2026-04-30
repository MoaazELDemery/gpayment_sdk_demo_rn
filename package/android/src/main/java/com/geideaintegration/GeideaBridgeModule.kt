package com.geideaintegration

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.*
import net.geidea.sdk.sdk.*
import android.util.Log
import android.graphics.drawable.Drawable
import androidx.core.content.ContextCompat

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
        val primaryColor = params.getString("primaryColor")
        val secondaryColor = params.getString("secondaryColor")
        val merchantLogo = params.getString("merchantLogo")


        currentPromise = promise

        try {
            val activity = reactContext.currentActivity
            if (activity == null) {
                currentPromise = null
                promise.reject("E_ACTIVITY", "Activity not found")
                return
            }

            val logoDrawable: Drawable? = resolveDrawableByName(merchantLogo)
            val theme = SDKTheme(
                primaryColor = primaryColor,
                secondaryColor = secondaryColor,
                merchantLogo = logoDrawable
            )
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
                    Log.i("reslove", "Resolve called")
                    promise.resolve(response)
                }

                override fun onPaymentFailure(error: GDPaymentError) {
                    val promise = currentPromise ?: return
                    currentPromise = null

                    val errorMap = convertPaymentErrorToMap(error)
                    val errorCode = errorMap.getString("code") ?: "E_PAYMENT_FAILED"
                    val errorMessage = errorMap.getString("message") ?: "Payment failed"
                    Log.i("Payment Failed", errorMap.getString("message") ?: "Payment failed")
                    promise.reject(errorCode, errorMessage, errorMap)
                }

                override fun onPaymentCanceled() {
                    Log.i("Payment Canclled", "Payment Canclled")
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

            // ✅ FIX HERE — adjust to your SDK version
            Log.i("Session ID", sessionId)
            Log.i("is Sandbox", isSandbox.toString())

            val presentationStyle = SDKPresentationStyle.Push()
            sdk.start(config, activity, presentationStyle)

        } catch (e: Exception) {
            Log.i("Payment Failed", "Failed to start SDK: ${e.localizedMessage}")
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

    private fun mapEnvironment(raw: String?): Boolean {
        return when (raw?.lowercase()) {
            "prod", "production" -> false
            else -> true
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

    private fun resolveDrawableByName(name: String?): Drawable? {
        if (name.isNullOrEmpty()) return null
        val resId = reactContext.resources.getIdentifier(
            name,       // e.g. "my_logo"
            "drawable",
            reactContext.packageName
        )
        if (resId == 0) {
            Log.w("GeideaBridge", "Drawable not found: $name")
            return null
        }
        return ContextCompat.getDrawable(reactContext, resId)
    }

//    private fun convertPaymentResultToMap(result: GDPaymentResult): WritableMap {
//        Log.i("PaymentResult", "the Result is: $result")
//        val map = Arguments.createMap()
//        try {
//            result.javaClass.declaredFields.forEach { field ->
//                field.isAccessible = true
//                val value = field.get(result)
//                Log.i("FieldValue", "the value is: $value")
//
//                when (value) {
//                    null -> map.putNull(field.name)
//                    is String -> map.putString(field.name, value)
//                    is Int -> map.putInt(field.name, value)
//                    is Long -> map.putDouble(field.name, value.toDouble())
//                    is Double -> map.putDouble(field.name, value)
//                    is Float -> map.putDouble(field.name, value.toDouble())
//                    is Boolean -> map.putBoolean(field.name, value)
//
//                    else -> map.putString(field.name, value.toString())
//                }
//            }
//        } catch (e: Exception) {
//            map.putString("_parseError", e.localizedMessage)
//        }
//        return map
//    }

    private fun convertPaymentResultToMap(result: GDPaymentResult): WritableMap {
        Log.i("PaymentResult", "Converting result: $result")
        val map = Arguments.createMap()

        try {
            // Add orderId
            result.orderId?.let { map.putString("orderId", it) } ?: map.putNull("orderId")

            // Add tokenId
            result.tokenId?.let { map.putString("tokenId", it) } ?: map.putNull("tokenId")

            // Add agreementId
            result.agreementId?.let { map.putString("agreementId", it) } ?: map.putNull("agreementId")

            // Add paymentMethod (nested object)
            result.paymentMethod?.let { pm ->
                val paymentMethodMap = Arguments.createMap()

                pm.type?.let { paymentMethodMap.putString("type", it) }
                pm.brand?.let { paymentMethodMap.putString("brand", it) }
                pm.cardholderName?.let { paymentMethodMap.putString("cardholderName", it) }
                pm.maskedCardNumber?.let { paymentMethodMap.putString("maskedCardNumber", it) }
                pm.wallet?.let { paymentMethodMap.putString("wallet", it) } ?: paymentMethodMap.putNull("wallet")

                // Add expiryDate (nested object)
                pm.expiryDate?.let { expiry ->
                    val expiryMap = Arguments.createMap()
                    expiryMap.putInt("month", expiry.month ?: 0)
                    expiryMap.putInt("year", expiry.year ?: 0)
                    paymentMethodMap.putMap("expiryDate", expiryMap)
                } ?: paymentMethodMap.putNull("expiryDate")

                map.putMap("paymentMethod", paymentMethodMap)
            } ?: map.putNull("paymentMethod")

            Log.i("PaymentResult", "Successfully converted to map")

        } catch (e: Exception) {
            Log.e("PaymentResult", "Error converting result: ${e.message}", e)
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
