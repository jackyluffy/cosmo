import * as admin from 'firebase-admin';
export declare const db: admin.firestore.Firestore;
export declare const Collections: {
    readonly USERS: "users";
    readonly EVENTS: "events";
    readonly MATCHES: "matches";
    readonly GROUPS: "groups";
    readonly MESSAGES: "messages";
    readonly NOTIFICATIONS: "notifications";
    readonly REPORTS: "reports";
    readonly SUBSCRIPTIONS: "subscriptions";
    readonly OTP_CODES: "otp_codes";
    readonly ANALYTICS: "analytics";
};
export declare const Buckets: {
    readonly PROFILE_PHOTOS: "profile-photos";
    readonly EVENT_PHOTOS: "event-photos";
    readonly CHAT_MEDIA: "chat-media";
};
export default admin;
//# sourceMappingURL=firebase.d.ts.map