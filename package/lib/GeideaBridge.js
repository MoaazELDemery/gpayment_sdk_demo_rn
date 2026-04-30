"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payWithGeidea = payWithGeidea;
const react_native_1 = require("react-native");
const { GeideaBridge } = react_native_1.NativeModules;
let inFlight = null;
function payWithGeidea(opts) {
    if (!(opts === null || opts === void 0 ? void 0 : opts.sessionId)) {
        return Promise.reject(new Error('sessionId is required'));
    }
    if (inFlight) {
        return inFlight;
    }
    inFlight = GeideaBridge.startWithConfig(Object.assign({ language: 'en', environment: 'test', region: 'egypt' }, opts)).finally(() => {
        inFlight = null;
    });
    return inFlight;
}
