package com.***REMOVED***.***REMOVED***solutions.constant;

public class Constants {

    //Security
    public static final String[] PUBLIC_URLS = {"/user/login/**", "/user/register/**", "/user/verify/code/**",
            "/user/verify/password/**", "/user/verify/account/**", "/user/resetpassword/**","/user/new/password/**",
            "/user/refresh/token/**", "/user/image/**", "/api/v1/test/**", "/analytics/**"};

    public static final String TOKEN_PREFIX = "Bearer ";
    public static final String[] PUBLIC_ROUTES = {"/user/new/password","/user/login/", "/user/register", "/user/verify/code", "/user/refresh/token", "/user/image"};
    public static final String HTTP_OPTIONS_METHOD = "OPTIONS";

    public static final String AUTHORITIES = "authorities";
    public static final String BOSTONEO_SOLUTIONS_LLC = "BOSTONEO_SOLUTIONS_LLC";
    public static final String CLIENT_MANAGEMENT_SERVICE = "CLIENT_MANAGEMENT_SERVICE";
    public static final long ACCESS_TOKEN_EXPIRATION_TIME = 432_000_000; //1_800_000 - 30 min to expire in ms
    public static final long REFRESH_TOKEN_EXPIRATION_TIME = 432_000_000; //5 days to expire in ms
    public static final String TOKEN_CANNOT_BE_VERIFIED = "Token cannot be verified";

    //Date
    private static final String DATE_FORMAT_NEW = "yyyy-MM-dd hh:mm:ss";


}
