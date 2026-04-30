require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "geidea-payment-sdk-react-native"
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = package['homepage'] || "https://github.com/geidea/payment-sdk-react-native"
  s.license      = package['license'] || "MIT"
  s.authors      = package['author'] || { "Geidea" => "support@geidea.com" }
  s.platforms    = { :ios => "13.4" }
  s.source       = { :git => package['repository']['url'] || "https://github.com/geidea/payment-sdk-react-native.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.requires_arc = true

  if defined?(install_modules_dependencies)
    install_modules_dependencies(s)
  else
    # Fallback for older React Native versions
    s.dependency "React-Core"
  end

  # Embed native frameworks
  s.vendored_frameworks = [
    'ios/CardScan.xcframework',
    'ios/GeideaPaymentSDK.xcframework'
  ]

  s.swift_version = '5.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

