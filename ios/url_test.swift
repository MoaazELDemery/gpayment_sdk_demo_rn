import Foundation
import GeideaPaymentSDK
print("KSA Sandbox: \(GeideaPaymentSDK.getBaseurl(region: .ksa, type: .sandbox))")
print("KSA Prod: \(GeideaPaymentSDK.getBaseurl(region: .ksa, type: .production))")
print("EGY Sandbox: \(GeideaPaymentSDK.getBaseurl(region: .egy, type: .sandbox))")
print("EGY Prod: \(GeideaPaymentSDK.getBaseurl(region: .egy, type: .production))")
