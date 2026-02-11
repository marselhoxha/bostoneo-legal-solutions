package com.bostoneo.bostoneosolutions.constant;

public class Constants {

    //Security
    public static final String[] PUBLIC_URLS = {"/user/login/**", "/user/register/**", "/user/verify/code/**",
            "/user/verify/password/**", "/user/verify/account/**", "/user/resetpassword/**","/user/new/password/**",
            "/user/refresh/token/**", "/user/image/**", "/api/v1/test/**", "/analytics/**", "/api/test/**",
            "/api/public/intake-forms/**", "/api/communications/webhook/**"};

    public static final String TOKEN_PREFIX = "Bearer ";
    public static final String[] PUBLIC_ROUTES = {"/user/new/password","/user/login/", "/user/register", "/user/verify/code", "/user/refresh/token", "/user/image", "/api/ai/legal-memo", "/api/ai/search-case-law", "/api/ai/interpret-statute", "/api/ai/find-precedents", "/api/communications/webhook"};
    public static final String HTTP_OPTIONS_METHOD = "OPTIONS";

    public static final String AUTHORITIES = "authorities";
    public static final String BOSTONEO_SOLUTIONS_LLC = "BOSTONEO_SOLUTIONS_LLC";
    public static final String CLIENT_MANAGEMENT_SERVICE = "CLIENT_MANAGEMENT_SERVICE";
    // SECURITY: Token expiration times for HIPAA compliance
    // Access token: 30 minutes (short-lived for security)
    public static final long ACCESS_TOKEN_EXPIRATION_TIME = 1_800_000; // 30 minutes in ms
    // Refresh token: 8 hours (allows workday session without re-login)
    public static final long REFRESH_TOKEN_EXPIRATION_TIME = 28_800_000; // 8 hours in ms
    public static final String TOKEN_CANNOT_BE_VERIFIED = "Token cannot be verified";

    //Date
    private static final String DATE_FORMAT_NEW = "yyyy-MM-dd hh:mm:ss";


}
