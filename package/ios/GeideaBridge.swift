import Foundation
import React
import GeideaPaymentSDK
import UIKit

@objc(GeideaBridge)
class GeideaBridge: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { true }

  private var currentDelegate: RNGeideaDelegate?

  /// JS -> Native:
  /// GeideaBridge.startWithConfig({
  ///   sessionId: string,
  ///   language?: 'en'|'ar'|'fr',
  ///   environment?: 'test'|'preprod'|'prod',
  ///   region?: 'egypt'|'ksa'|'uae'
  /// })
  @objc(startWithConfig:resolver:rejecter:)
  @MainActor
  func startWithConfig(_ params: NSDictionary,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {

    guard let sessionId = params["sessionId"] as? String, !sessionId.isEmpty else {
      return reject("E_ARGS", "sessionId is required", nil)
    }

    let lang   = mapLanguage(params["language"] as? String)
    let env    = mapEnvironment(params["environment"] as? String)
    let region = mapRegion(params["region"] as? String)
    let merchantId = params["merchantId"] as? String
	var theme: SDKTheme?
	if let primaryColor = params["primaryColor"] as? String,
	   let secondaryColor = params["secondaryColor"] as? String,
	   let merchantLogo = params["merchantLogo"] as? String,
	   let logoImage = UIImage(named: merchantLogo) {
	        theme = SDKTheme(
			primaryColor: primaryColor,
			secondaryColor: secondaryColor,
			merchantLogo: logoImage
		  )
	  }


    let cfg = GeideaPaymentSDK.GDPaymentSDKConfiguration(
      sessionId: sessionId,
      applePayConfig: ApplePayConfigurations(merchantId: merchantId ?? ""),
      language: lang,
      region: region,
      theme: theme
    )
    
    Task { @MainActor in
     guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
     let rootViewController = windowScene.windows.first?.rootViewController else {
         return reject("E_NO_VC", "Could not find root view controller", nil)
     }

     let navigationController = getNavigationController(from: rootViewController)

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
        
		try instance.start(configuration: cfg, navigationController: navigationController, delegate: delegate)
      } catch {
        self.currentDelegate = nil
        reject("E_SDK_START", "Failed to start SDK: \(error.localizedDescription)", error as NSError)
      }
    }
  }

	// Helper to find navigation controller
	@MainActor
	private func getNavigationController(from viewController: UIViewController) -> UINavigationController? {
	  if let navController = viewController as? UINavigationController {
		return navController
	  }
	  if let tabController = viewController as? UITabBarController,
		 let selected = tabController.selectedViewController {
		return getNavigationController(from: selected)
	  }
	  if let presented = viewController.presentedViewController {
		return getNavigationController(from: presented)
	  }
	  for child in viewController.children {
		if let nav = getNavigationController(from: child) {
		  return nav
		}
	  }
	  return nil
	}

  // mappers

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
      case "prod", "production": return .production
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

  // GDSDKProtocol

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
