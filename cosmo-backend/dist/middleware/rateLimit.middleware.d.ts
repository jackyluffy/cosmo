declare const rateLimits: {
    auth: import("express-rate-limit").RateLimitRequestHandler;
    api: import("express-rate-limit").RateLimitRequestHandler;
    upload: import("express-rate-limit").RateLimitRequestHandler;
    stripe: import("express-rate-limit").RateLimitRequestHandler;
};
export declare function rateLimiter(type?: keyof typeof rateLimits): import("express-rate-limit").RateLimitRequestHandler;
export {};
//# sourceMappingURL=rateLimit.middleware.d.ts.map