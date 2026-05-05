# Email Template System Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 16 email templates with a centralized, firm-branded template engine that eliminates plain text emails and supports per-organization branding.

**Architecture:** A single `EmailTemplateEngine` class generates all email HTML. It accepts an `EmailBranding` (logo, color, org details) and `EmailContent` (greeting, body, detail card, CTA button). Platform emails use Legience branding; firm emails use the organization's branding with "Powered by Legience" footer. DB templates are retired.

**Tech Stack:** Spring Boot, JavaMailSender, MimeMessage, PostgreSQL (Flyway migration), inline CSS HTML emails.

**Spec:** `docs/superpowers/specs/2026-03-23-email-template-redesign-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/email/EmailBranding.java` | Value object: org name, logo URL, primary color, contact info, base URL, showPoweredBy flag |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/email/EmailContent.java` | Value object: greeting, body paragraphs, detail card, CTA button, urgency banner, sign-off |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/EmailTemplateEngine.java` | Central HTML generator: base layout, header, detail card, CTA button, footer, urgency banner |
| `backend/src/main/resources/db/migration/V20__add_primary_color_to_organizations.sql` | Add `primary_color` column to organizations |

### Modified Files
| File | Change |
|------|--------|
| `backend/src/main/java/com/bostoneo/bostoneosolutions/model/Organization.java` | Add `primaryColor` field |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/OrganizationDTO.java` | Add `primaryColor` field |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/EmailServiceImpl.java` | Replace all inline HTML with `EmailTemplateEngine` calls. Add Reply-To header support. Remove old builder methods. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/impl/ReminderQueueServiceImpl.java` | Replace DB template lookup with `EmailTemplateEngine`. Remove `emailTemplateRepository` dependency. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/service/InvoiceWorkflowService.java` | Replace `generateEmailMessage()` with `EmailTemplateEngine` calls. |
| `backend/src/main/java/com/bostoneo/bostoneosolutions/resource/IntakeFormResource.java` | Replace inline HTML with `EmailTemplateEngine` calls. |

---

## Task 1: DB Schema — Add `primary_color` to Organizations

**Files:**
- Create: `backend/src/main/resources/db/migration/V20__add_primary_color_to_organizations.sql`
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/model/Organization.java`
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/OrganizationDTO.java`

- [ ] **Step 1: Create Flyway migration file**

```sql
-- V20__add_primary_color_to_organizations.sql
-- Add primary brand color for email template customization
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#405189';
```

- [ ] **Step 2: Run migration on local dev**

```bash
PGPASSWORD=legience_dev psql -h localhost -U legience_admin -d legience -c "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#405189';"
```

- [ ] **Step 3: Add `primaryColor` field to `Organization.java`**

Add after the `state` field (around line 71):

```java
@Column(name = "primary_color", length = 7)
@Builder.Default
private String primaryColor = "#405189";
```

- [ ] **Step 4: Add `primaryColor` field to `OrganizationDTO.java`**

Add field to the DTO class:

```java
private String primaryColor;
```

- [ ] **Step 5: Verify the app still starts**

Run the backend and check logs for startup errors. Hibernate `ddl-auto: update` should pick up the field.

- [ ] **Step 6: Commit**

```
feat: add primary_color to organizations for email branding
```

---

## Task 2: Create Email DTOs — `EmailBranding` and `EmailContent`

**Files:**
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/email/EmailBranding.java`
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/dto/email/EmailContent.java`

- [ ] **Step 1: Create `EmailBranding.java`**

```java
package com.bostoneo.bostoneosolutions.dto.email;

import lombok.Builder;
import lombok.Getter;

/**
 * Holds branding context for email rendering.
 * Platform emails use Legience defaults; firm emails use Organization data.
 */
@Getter
@Builder
public class EmailBranding {
    private final String name;           // "Legience" or org name
    private final String logoUrl;        // URL or null (falls back to name text)
    @Builder.Default
    private final String primaryColor = "#405189";   // hex color
    private final String replyToEmail;   // for Reply-To header, null = use from address
    private final String phone;          // for footer, null = omit
    private final String address;        // for footer, null = omit
    private final String baseUrl;        // UI_APP_URL for links
    @Builder.Default
    private final boolean showPoweredBy = true;      // false for platform emails
    @Builder.Default
    private final boolean showFullFooter = true;     // false for internal (no address/phone)

    /** Legience platform branding */
    public static EmailBranding platform(String baseUrl, String logoUrl) {
        return EmailBranding.builder()
                .name("Legience")
                .logoUrl(logoUrl)
                .primaryColor("#1e56b6")
                .replyToEmail(null)
                .baseUrl(baseUrl)
                .showPoweredBy(false)
                .showFullFooter(false)
                .build();
    }

    /** Firm branding for client-facing emails (full footer) */
    public static EmailBranding firmClient(String name, String logoUrl, String primaryColor,
                                            String email, String phone, String address, String baseUrl) {
        return EmailBranding.builder()
                .name(name)
                .logoUrl(logoUrl)
                .primaryColor(primaryColor != null ? primaryColor : "#405189")
                .replyToEmail(email)
                .phone(phone)
                .address(address)
                .baseUrl(baseUrl)
                .showPoweredBy(true)
                .showFullFooter(true)
                .build();
    }

    /** Firm branding for internal emails (compact footer) */
    public static EmailBranding firmInternal(String name, String logoUrl, String primaryColor,
                                              String email, String baseUrl) {
        return EmailBranding.builder()
                .name(name)
                .logoUrl(logoUrl)
                .primaryColor(primaryColor != null ? primaryColor : "#405189")
                .replyToEmail(email)
                .baseUrl(baseUrl)
                .showPoweredBy(true)
                .showFullFooter(false)
                .build();
    }
}
```

- [ ] **Step 2: Create `EmailContent.java`**

```java
package com.bostoneo.bostoneosolutions.dto.email;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * Holds the content for an email — everything except branding.
 */
@Getter
@Builder
public class EmailContent {
    private final String recipientName;
    @Builder.Default
    private final String greeting = null; // null = "Hello {recipientName},"
    private final List<String> bodyParagraphs;
    private final DetailCard detailCard;    // nullable
    private final CtaButton ctaButton;      // nullable
    private final String signOffName;
    private final String footerNote;        // nullable — small text below sign-off
    private final UrgencyBanner urgency;    // nullable
    private final MfaCode mfaCode;          // nullable — for MFA emails only
    private final InfoBox infoBox;          // nullable — amber/blue info box

    @Getter
    @Builder
    public static class DetailCard {
        private final String title;
        private final List<Map.Entry<String, String>> rows; // key-value pairs
        private final String accentColor;       // null = use primary_color
        private final String highlightAmount;   // nullable — big number like "$4,500.00"
        private final String highlightColor;    // nullable — color for the amount
    }

    @Getter
    @Builder
    public static class CtaButton {
        private final String text;
        private final String url;
        // color comes from branding.primaryColor
    }

    @Getter
    @Builder
    public static class UrgencyBanner {
        private final String text;       // "COURT APPEARANCE TODAY"
        private final String level;      // "red" or "amber"
    }

    @Getter
    @Builder
    public static class MfaCode {
        private final String code;       // "847293"
    }

    @Getter
    @Builder
    public static class InfoBox {
        private final String html;       // inner HTML content
        private final String level;      // "amber" or "blue"
    }
}
```

- [ ] **Step 3: Commit**

```
feat: add EmailBranding and EmailContent DTOs for template engine
```

---

## Task 3: Create `EmailTemplateEngine`

This is the core of the redesign — one class that generates all email HTML.

**Files:**
- Create: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/EmailTemplateEngine.java`

- [ ] **Step 1: Create `EmailTemplateEngine.java`**

The engine has these public methods:
- `render(EmailBranding branding, EmailContent content)` → full HTML string
- Private helpers: `buildUrgencyBanner`, `buildHeader`, `buildMfaCode`, `buildDetailCard`, `buildCtaButton`, `buildInfoBox`, `buildSignOff`, `buildFooter`

The full implementation renders all inline-CSS HTML per the approved design spec. Key design tokens:
- Font: `-apple-system, 'Segoe UI', Roboto, Arial, sans-serif`
- Card: 600px max-width, border-radius 12px, box-shadow 0 4px 16px rgba(0,0,0,0.08)
- Greeting: 18px, weight 600, #111827
- Body: 15px, #6b7280, line-height 1.7
- Detail card: bg #f9fafb, left border 3px, border-radius 0 8px 8px 0
- CTA: nested `<table>` for Outlook, 14px 44px padding, 8px radius
- MFA digits: 52x64px individual boxes, bg #f0f4ff, border #dce3f5, monospace 32px
- Logo: 24px height
- Footer: bg #f9fafb, "Powered by Legience" in 11px #d1d5db
- Urgency banner: red (#fef2f2/#991b1b) or amber (#fffbeb/#92400e)

This class has NO dependencies on Spring beans — it's a pure function. Annotate with `@Component` for DI convenience.

Read the approved preview HTML at `/tmp/platform-email-preview.html` for the exact inline styles that were approved.

- [ ] **Step 2: Verify it compiles**

Start the backend and check for compilation errors.

- [ ] **Step 3: Commit**

```
feat: add EmailTemplateEngine — centralized HTML email renderer
```

---

## Task 4: Rewire `EmailServiceImpl` — Platform Emails

Replace the 3 platform email methods with `EmailTemplateEngine` calls: MFA, account verification, password reset.

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/EmailServiceImpl.java`

- [ ] **Step 1: Inject `EmailTemplateEngine` and `UI_APP_URL`**

Add to the class:
```java
private final EmailTemplateEngine templateEngine;

@Value("${UI_APP_URL:http://localhost:4200}")
private String frontendUrl;

@Value("${LEGIENCE_LOGO_URL:https://legience.com/assets/legience-logo.png}")
private String legienceLogoUrl;
```

Change `@AllArgsConstructor` to `@RequiredArgsConstructor` (to allow `@Value` fields).

- [ ] **Step 2: Replace `sendMfaVerificationEmail`**

Replace `buildMfaVerificationEmailHtml()` with:
- Build `EmailBranding.platform(frontendUrl, legienceLogoUrl)`
- Build `EmailContent` with `MfaCode`, two body paragraphs, sign-off "Legience Team"
- Call `templateEngine.render(branding, content)`

Remove `buildMfaVerificationEmailHtml()` method entirely.

- [ ] **Step 3: Replace `sendVerificationEmail`**

Currently sends plain text via `SimpleMailMessage`. Change to `MimeMessage` with HTML:
- Account verification: CTA button "Verify My Account" pointing to the verification URL
- Password reset: CTA button "Reset Password" + amber InfoBox about 24h expiry
- Both use `EmailBranding.platform()`

Remove `getEmailMessage()` method entirely.

- [ ] **Step 4: Replace `sendNotificationEmail`**

Replace `buildHtmlNotificationEmail()` and all the CSS/notification-type infrastructure:
- Build firm branding from the organization context (need to inject `OrganizationRepository` or accept org data as parameter)
- Map notification types to appropriate detail card content
- Remove `getEmailCSS()`, `buildHtmlNotificationEmail()`, `getNotificationTypeInfo()`, `NotificationTypeInfo` inner class

- [ ] **Step 5: Test — send a test MFA email**

Login to the app as `marsel.hox@gmail.com` and trigger MFA. Verify the email arrives with the new design.

- [ ] **Step 6: Commit**

```
feat: rewire platform emails (MFA, verification, reset) to template engine
```

---

## Task 5: Rewire `EmailServiceImpl` — Firm Emails (Notifications, Invitations, Deadlines)

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/implementation/EmailServiceImpl.java`
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/EmailService.java` (interface updates)

- [ ] **Step 1: Update `sendDeadlineReminderEmail`**

Currently sends plain text. Change to HTML:
- Determine organization from the event's `organizationId`
- Build `EmailBranding.firmInternal(...)` from the org
- Build `EmailContent` with detail card (title, due date, time, case info), urgency banner for DEADLINE type
- Add CTA "View Deadline" → `{baseUrl}/calendar`
- Remove `getDeadlineReminderMessage()` method

- [ ] **Step 2: Update `sendInvitationEmail`**

- Build `EmailBranding.firmClient(...)` from the passed org name (need to accept org data or resolve from name)
- Build `EmailContent` with detail card (role, expiry), CTA "Accept Invitation" → inviteUrl
- Remove `buildInvitationEmailHtml()` method

Note: `sendInvitationEmail` currently accepts `organizationName` as a string parameter. We need to also accept `logoUrl`, `primaryColor`, `email`, `phone`, `address` — either by passing the full `Organization` object or by updating the method signature. The simplest approach: add a new overloaded method that accepts `Organization` and deprecate the string-only version. Then update `OrganizationInvitationServiceImpl` to call the new method.

- [ ] **Step 3: Add Reply-To header support to `sendEmail`**

Update the base `sendEmail` method to accept an optional `replyTo` parameter. When `branding.replyToEmail` is set, add `helper.setReplyTo(replyTo)` to the MimeMessage.

- [ ] **Step 4: Commit**

```
feat: rewire firm emails (deadline, invitation, notification) to template engine
```

---

## Task 6: Rewire `ReminderQueueServiceImpl` — Calendar Reminders

This is where the DB template lookup happens. Replace with direct `EmailTemplateEngine` calls.

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/impl/ReminderQueueServiceImpl.java`

- [ ] **Step 1: Inject `EmailTemplateEngine` and `OrganizationRepository`**

Add:
```java
@Autowired
private EmailTemplateEngine templateEngine;

@Autowired
private OrganizationRepository organizationRepository;

@Value("${UI_APP_URL:http://localhost:4200}")
private String frontendUrl;

@Value("${LEGIENCE_LOGO_URL:https://legience.com/assets/legience-logo.png}")
private String legienceLogoUrl;
```

- [ ] **Step 2: Replace `processReminderQueue` template lookup**

In the `processReminderQueue()` method (lines 123-215), replace the section that:
1. Fetches `EmailTemplate` from `emailTemplateRepository.findDefaultTemplateForEventType()`
2. Prepares `templateData` map
3. Calls `emailService.sendTemplatedEmail()`

With:
1. Fetch `Organization` from `organizationRepository.findById(reminder.getOrganizationId())`
2. Determine if this is a client-facing event type (CLIENT_MEETING) → use `firmClient`, else `firmInternal`
3. Build `EmailBranding` from the org
4. Build `EmailContent` with appropriate detail card, CTA button, and urgency banner based on event type
5. Render HTML via `templateEngine.render(branding, content)`
6. Send via `emailService.sendEmail()` (the base method that just sends HTML)

- [ ] **Step 3: Determine urgency banner per event type**

Map event types to urgency:
- `HEARING`, `COURT_DATE` → Red banner: "COURT APPEARANCE TODAY"
- `DEADLINE` → Amber banner: "DEADLINE APPROACHING"
- All others → no banner

Map event types to CTA text:
- `HEARING`, `COURT_DATE` → "View Case Details" → `{baseUrl}/cases/{caseId}`
- `DEADLINE` → "View Deadline" → `{baseUrl}/calendar`
- All others → "View Calendar" → `{baseUrl}/calendar`

Map event types to detail card accent color:
- `HEARING`, `COURT_DATE` → `#dc2626` (red)
- `DEADLINE` → `#d97706` (amber)
- `DEPOSITION` → `#7c3aed` (purple)
- All others → org's `primaryColor`

- [ ] **Step 4: Remove `emailTemplateRepository` dependency**

Remove the `@Autowired private EmailTemplateRepository emailTemplateRepository` field. The DB templates are no longer read.

- [ ] **Step 5: Test — create a calendar event with a 1-minute reminder**

Create an event in the app and verify the reminder email arrives with the new firm-branded design.

- [ ] **Step 6: Commit**

```
feat: rewire calendar reminders to template engine, retire DB templates
```

---

## Task 7: Rewire `InvoiceWorkflowService` — Invoice Emails

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/service/InvoiceWorkflowService.java`

- [ ] **Step 1: Inject `EmailTemplateEngine` and resolve org**

Add `EmailTemplateEngine` dependency. The service already has access to invoice data which includes `organizationId`.

- [ ] **Step 2: Replace `generateEmailMessage` method**

Currently builds all invoice email HTML inline (lines 372-468). Replace with:
- Fetch org from the invoice's `organizationId`
- Build `EmailBranding.firmClient(...)` from the org
- For each template type (`invoice_created`, `payment_reminder`, `payment_reminder_urgent`, `overdue_notice`, `payment_received`):
  - Build `EmailContent` with appropriate body text, detail card (invoice number, case, dates, amount), CTA "View Invoice", and urgency banner (for urgent/overdue)
  - Highlight amount color: green for `payment_received`, red for `urgent`/`overdue`, `primaryColor` for others

- [ ] **Step 3: Remove `generateEmailMessage` method**

Delete the entire old method after replacement.

- [ ] **Step 4: Commit**

```
feat: rewire invoice emails to template engine with firm branding
```

---

## Task 8: Rewire `IntakeFormResource` — Intake Confirmation Emails

**Files:**
- Modify: `backend/src/main/java/com/bostoneo/bostoneosolutions/resource/IntakeFormResource.java`

- [ ] **Step 1: Inject `EmailTemplateEngine`**

- [ ] **Step 2: Replace inline HTML**

The intake form already uses dynamic org name. Replace the inline HTML construction with:
- Build `EmailBranding.firmClient(...)` from the org
- Build `EmailContent` with detail card (submission type, date), body text about follow-up timeline, footer note about attorney-client privilege

- [ ] **Step 3: Commit**

```
feat: rewire intake confirmation email to template engine
```

---

## Task 9: Cleanup and Final Verification

- [ ] **Step 1: Remove dead code from `EmailServiceImpl`**

Delete these methods if they still exist:
- `getEmailCSS()` (~220 lines of CSS)
- `buildHtmlNotificationEmail()`
- `getNotificationTypeInfo()`
- `NotificationTypeInfo` inner class
- `getNotificationEmailMessage()`
- `getEmailMessage()`
- `getDeadlineReminderMessage()`
- `buildMfaVerificationEmailHtml()`
- `buildInvitationEmailHtml()`

Also remove the `sendTemplatedEmail` / `processTemplate` methods if no longer called anywhere.

- [ ] **Step 2: Grep for any remaining old branding**

```bash
grep -r "Boston EO\|Bostoneo\|Boston.*Solutions" backend/src/ --include="*.java" | grep -v "package\|import\|Binary"
```

Fix any stragglers.

- [ ] **Step 3: Update the HTML preview file**

Regenerate `/tmp/email-templates-v2-preview.html` with the actual rendered output from the template engine (optional — for verification).

- [ ] **Step 4: End-to-end test — trigger each email type**

Test at minimum:
1. Login → MFA code email (platform)
2. Create calendar event with 1-min reminder → meeting reminder (firm internal)
3. Create invoice → invoice email (firm → client)
4. Send org invitation → invitation email (firm → client)
5. Reset password → password reset email (platform)

- [ ] **Step 5: Commit**

```
refactor: remove legacy email template code, verify all 16 email types
```

---

## Task Summary

| # | Task | Creates | Modifies | Risk |
|---|------|---------|----------|------|
| 1 | DB schema — `primary_color` | V20 migration | Organization, OrganizationDTO | Low |
| 2 | Email DTOs | EmailBranding, EmailContent | — | Low |
| 3 | EmailTemplateEngine | EmailTemplateEngine | — | Medium — core of redesign |
| 4 | Platform emails | — | EmailServiceImpl | Medium — touches auth flow |
| 5 | Firm emails (notifications, invitations) | — | EmailServiceImpl, EmailService | Medium |
| 6 | Calendar reminders | — | ReminderQueueServiceImpl | Medium — the original bug |
| 7 | Invoice emails | — | InvoiceWorkflowService | Low |
| 8 | Intake emails | — | IntakeFormResource | Low |
| 9 | Cleanup & verification | — | EmailServiceImpl | Low |
