export type Language = 'en' | 'ar' | 'fr';
export type Environment = 'test' | 'preprod' | 'prod';
export type Region = 'egypt' | 'ksa' | 'uae';
export interface StartWithConfigOptions {
    sessionId: string;
    language?: Language;
    environment?: Environment;
    region?: Region;
}
export interface PaymentMethod {
    type?: string;
    brand?: string;
    maskedCardNumber?: string;
    cardholderName?: string;
    wallet?: string;
    expiryDate?: {
        month: number;
        year: number;
    };
}
export interface PaymentResult {
    orderId?: string;
    tokenId?: string;
    agreementId?: string;
    paymentMethod?: PaymentMethod;
}
export interface GeideaResult {
    status: 'completed' | 'canceled';
    result?: PaymentResult;
}
