package com.bostoneo.bostoneosolutions.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utility class for converting cloud storage sharing URLs to direct download URLs.
 * Supports Google Drive, Dropbox, OneDrive, and Box.
 */
@Component
@Slf4j
public class CloudStorageUrlConverter {

    // Google Drive patterns
    private static final Pattern GOOGLE_DRIVE_FILE_PATTERN = Pattern.compile(
            "drive\\.google\\.com/file/d/([a-zA-Z0-9_-]+)"
    );
    private static final Pattern GOOGLE_DRIVE_OPEN_PATTERN = Pattern.compile(
            "drive\\.google\\.com/open\\?id=([a-zA-Z0-9_-]+)"
    );

    // Dropbox pattern
    private static final Pattern DROPBOX_PATTERN = Pattern.compile(
            "dropbox\\.com/(s|scl)/([a-zA-Z0-9_-]+)"
    );

    // OneDrive/SharePoint patterns
    private static final Pattern ONEDRIVE_PATTERN = Pattern.compile(
            "(onedrive\\.live\\.com|1drv\\.ms)"
    );
    private static final Pattern SHAREPOINT_PATTERN = Pattern.compile(
            "sharepoint\\.com.*/_layouts/"
    );

    // Box pattern
    private static final Pattern BOX_PATTERN = Pattern.compile(
            "box\\.com/s/([a-zA-Z0-9]+)"
    );

    /**
     * Converts a cloud storage sharing URL to a direct download URL.
     * If the URL is already a direct URL or not a recognized cloud storage URL,
     * returns the original URL.
     *
     * @param url The original URL (sharing or direct)
     * @return The direct download URL
     */
    public String convertToDirectUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            return url;
        }

        try {
            // Google Drive
            Matcher googleFileMatcher = GOOGLE_DRIVE_FILE_PATTERN.matcher(url);
            if (googleFileMatcher.find()) {
                String fileId = googleFileMatcher.group(1);
                String directUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
                log.info("Converted Google Drive URL: {} → {}", url, directUrl);
                return directUrl;
            }

            Matcher googleOpenMatcher = GOOGLE_DRIVE_OPEN_PATTERN.matcher(url);
            if (googleOpenMatcher.find()) {
                String fileId = googleOpenMatcher.group(1);
                String directUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
                log.info("Converted Google Drive URL: {} → {}", url, directUrl);
                return directUrl;
            }

            // Dropbox
            Matcher dropboxMatcher = DROPBOX_PATTERN.matcher(url);
            if (dropboxMatcher.find()) {
                String directUrl = url.replace("?dl=0", "?dl=1").replace("&dl=0", "&dl=1");
                if (!directUrl.contains("?dl=1") && !directUrl.contains("&dl=1")) {
                    directUrl += (directUrl.contains("?") ? "&" : "?") + "dl=1";
                }
                log.info("Converted Dropbox URL: {} → {}", url, directUrl);
                return directUrl;
            }

            // OneDrive
            if (ONEDRIVE_PATTERN.matcher(url).find()) {
                String directUrl = url.replace("redir", "download").replace("view.aspx", "download.aspx");
                if (!directUrl.contains("download")) {
                    directUrl += (directUrl.contains("?") ? "&" : "?") + "download=1";
                }
                log.info("Converted OneDrive URL: {} → {}", url, directUrl);
                return directUrl;
            }

            // SharePoint
            if (SHAREPOINT_PATTERN.matcher(url).find()) {
                String directUrl = url.replace("view.aspx", "download.aspx");
                log.info("Converted SharePoint URL: {} → {}", url, directUrl);
                return directUrl;
            }

            // Box
            Matcher boxMatcher = BOX_PATTERN.matcher(url);
            if (boxMatcher.find()) {
                String directUrl = url.replace("/s/", "/shared/static/");
                log.info("Converted Box URL: {} → {}", url, directUrl);
                return directUrl;
            }

            // If no conversion was needed, return original URL
            log.debug("URL does not require conversion: {}", url);
            return url;

        } catch (Exception e) {
            log.error("Error converting URL: {}", url, e);
            return url; // Return original on error
        }
    }

    /**
     * Validates that a URL is not a private/internal address (SSRF protection).
     *
     * @param url The URL to validate
     * @return true if the URL is safe to fetch, false otherwise
     */
    public boolean isSafeUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }

        try {
            URI uri = new URI(url);
            String host = uri.getHost();

            if (host == null) {
                return false;
            }

            // Block localhost and common internal hostnames
            if (host.equalsIgnoreCase("localhost") ||
                host.equals("127.0.0.1") ||
                host.equals("0.0.0.0") ||
                host.startsWith("192.168.") ||
                host.startsWith("10.") ||
                host.startsWith("172.16.") ||
                host.startsWith("172.17.") ||
                host.startsWith("172.18.") ||
                host.startsWith("172.19.") ||
                host.startsWith("172.2") ||
                host.startsWith("172.30.") ||
                host.startsWith("172.31.") ||
                host.equals("::1") ||
                host.startsWith("169.254.")) {
                log.warn("Blocked unsafe URL (private/internal address): {}", url);
                return false;
            }

            // Only allow HTTP and HTTPS
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                log.warn("Blocked unsafe URL (invalid scheme): {}", url);
                return false;
            }

            return true;

        } catch (URISyntaxException e) {
            log.error("Invalid URL syntax: {}", url, e);
            return false;
        }
    }

    /**
     * Gets a descriptive name for the cloud storage provider.
     *
     * @param url The URL to check
     * @return The provider name or "Unknown" if not recognized
     */
    public String getProviderName(String url) {
        if (url == null) return "Unknown";

        if (url.contains("drive.google.com")) return "Google Drive";
        if (url.contains("dropbox.com")) return "Dropbox";
        if (url.contains("onedrive.live.com") || url.contains("1drv.ms")) return "OneDrive";
        if (url.contains("sharepoint.com")) return "SharePoint";
        if (url.contains("box.com")) return "Box";

        return "Direct URL";
    }
}
