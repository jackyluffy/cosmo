export declare const Constants: {
    readonly JWT_SECRET: string;
    readonly JWT_EXPIRES_IN: "30d";
    readonly OTP_LENGTH: 6;
    readonly OTP_EXPIRY_MINUTES: 10;
    readonly TWILIO_ACCOUNT_SID: string;
    readonly TWILIO_AUTH_TOKEN: string;
    readonly TWILIO_PHONE_NUMBER: string;
    readonly SENDGRID_API_KEY: string;
    readonly SENDGRID_FROM_EMAIL: string;
    readonly MAX_GROUP_SIZE: 6;
    readonly MIN_GROUP_SIZE: 4;
    readonly MAX_PHOTO_UPLOADS: 6;
    readonly MAX_EVENT_DISTANCE_KM: 50;
    readonly FREE_TRIAL_EVENTS: 1;
    readonly SUBSCRIPTION_TIERS: {
        readonly TRIAL: {
            readonly name: "trial";
            readonly events_per_month: 1;
            readonly price: 0;
        };
        readonly BASIC: {
            readonly name: "basic";
            readonly events_per_month: 4;
            readonly price: 19.99;
        };
        readonly PREMIUM: {
            readonly name: "premium";
            readonly events_per_month: -1;
            readonly price: 39.99;
        };
    };
    readonly MATCHING_WEIGHTS: {
        readonly INTERESTS: 0.3;
        readonly AGE_RANGE: 0.2;
        readonly LOCATION: 0.2;
        readonly PERSONALITY: 0.2;
        readonly ACTIVITY_LEVEL: 0.1;
    };
};
export declare const Regex: {
    readonly EMAIL: RegExp;
    readonly PHONE: RegExp;
    readonly OTP: RegExp;
};
//# sourceMappingURL=constants.d.ts.map