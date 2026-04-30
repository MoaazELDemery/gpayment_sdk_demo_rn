package net.geidea.paymentsdk

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
        val isSandbox = mapEnvironment(params.getString("environment"))
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
                    Log.i("GeideaBridge", "Payment completed")
                    promise.resolve(response)
                }

                override fun onPaymentFailure(error: GDPaymentError) {
                    val promise = currentPromise ?: return
                    currentPromise = null

                    val errorMap = convertPaymentErrorToMap(error)
                    val errorCode = errorMap.getString("code") ?: "E_PAYMENT_FAILED"
                    val errorMessage = errorMap.getString("message") ?: "Payment failed"
                    Log.i("GeideaBridge", "Payment failed: $errorMessage")
                    promise.reject(errorCode, errorMessage)
                }

                override fun onPaymentCanceled() {
                    Log.i("GeideaBridge", "Payment canceled")
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

            Log.i("GeideaBridge", "Starting SDK with sessionId: $sessionId, sandbox: $isSandbox")

            val presentationStyle = SDKPresentationStyle.Push()
            sdk.start(config, activity, presentationStyle)

        } catch (e: Exception) {
            Log.e("GeideaBridge", "Failed to start SDK: ${e.localizedMessage}")
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
            name,
            "drawable",
            reactContext.packageName
        )
        if (resId == 0) {
            Log.w("GeideaBridge", "Drawable not found: $name")
            return null
        }
        return ContextCompat.getDrawable(reactContext, resId)
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
            Log.e("GeideaBridge", "Error converting result: ${e.message}", e)
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
