module.exports = {
  dependency: {
    platforms: {
      ios: {
        project: 'ios/GeideaIntegration.xcodeproj',
        // If you don't have an xcodeproj, use podspecPath instead:
        podspecPath: __dirname + '/geidea-payment-sdk-react-native.podspec',
      },
      android: {
      sourceDir: './android',
      },
    },
  },
};
