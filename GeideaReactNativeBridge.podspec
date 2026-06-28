Pod::Spec.new do |s|
  s.name         = 'GeideaReactNativeBridge'
  s.version      = '0.0.1'
  s.summary      = 'Local CocoaPods bridge for the Geidea React Native SDK'
  s.homepage     = 'https://geidea.net'
  s.license      = { :type => 'MIT' }
  s.author       = { 'Geidea' => 'support@geidea.net' }
  s.platforms    = { :ios => '15.0' }
  s.source       = { :path => '.' }
  s.source_files = 'node_modules/@geidea/payment-sdk-react-native/ios/GeideaBridge.{m,swift}'
  s.vendored_frameworks = [
    'node_modules/@geidea/payment-sdk-react-native/ios/CardScan.xcframework',
    'node_modules/@geidea/payment-sdk-react-native/ios/GeideaPaymentSDK.xcframework',
  ]
  s.resource_bundles = {
    'GeideaReactNativeBridgeAssets' => [
      'node_modules/@geidea/payment-sdk-react-native/ios/Assets.xcassets',
    ],
  }
  s.dependency 'React-Core'
  s.swift_version = '5.0'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
end
