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