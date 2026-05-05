# Email Template System Redesign

**Date:** 2026-03-23
**Status:** Approved

## Problem

1. Email templates have inconsistent branding — some use old "Bostoneo" names, some use "Legience", some are plain text
2. Client-facing emails show "Legience" instead of the law firm's own brand
3. Templates are split between database (12 calendar reminders) and code (7 others) with no shared structure
4. No environment-aware URL handling — links are hardcoded or inconsistent
5. Plain text emails (verification, password reset, deadline reminder) look unprofessional

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Branding model | Hybrid (C) — send from `info@legience.com`, Reply-To = firm email, visual firm branding | Best balance of simplicity and professionalism. Full white-label is a future premium feature. |
| Design aesthetic | Minimal & Clean (A) | Best email client compatibility, professional, lets firm logo/color do the work |
| Firm color | Configurable `primary_color` per org (A) | Single column addition, real firm ownership of email appearance |
| Architecture | Centralized code-based template engine (1) | Single source of truth, version-controlled, no more "rebranded code but forgot DB templates" |
| Logo size | 24px height for Legience platform logo | User-approved after iteration |

## Email Classification

Every email falls into one of three categories:

| Category | Branding | From | Reply-To | Sign-off | Footer |
|----------|----------|------|----------|----------|--------|
| **Platform** | Legience logo (24px) + Legience colors (#1e56b6) | `info@legience.com` | `info@legience.com` | "Legience Team" | "Legience - Legal Practice Management" |
| **Firm → Client** | Firm logo/name + firm `primary_color` | `info@legience.com` | Firm email (`org.email`) | "{Org Name}" | Firm address/phone/email + "Powered by Legience" |
| **Firm Internal** | Firm logo/name + firm `primary_color` | `info@legience.com` | Firm email (`org.email`) | "{Org Name}" | "Powered by Legience" (compact, no address) |

### Email Type → Category Mapping

**Platform:** MFA codes, account verification, password reset

**Firm → Client:** Invoices (created, reminder, urgent, overdue, payment received), client meeting reminders, document requests, intake confirmations, signature reminders, appointment confirmations, organization invitations

**Firm Internal:** Case status notifications, task/deadline reminders, all calendar reminders (hearing, meeting, team meeting, court date, deposition, mediation, consultation, other), assignment alerts

## Base HTML Template Structure

All emails share one base layout. No border-top accents. White card with rounded corners and subtle shadow.

```
┌─────────────────────────────────────────┐
│         [Urgency Banner]                │  ← Optional. Red/amber bg.
│                                         │     HEARING/COURT/DEADLINE only.
├─────────────────────────────────────────┤
│                                         │
│      [Logo 24px] or [Firm Name 24px]    │  ← Centered. Generous top padding.
│                                         │     Logo if org.logoUrl set,
│                                         │     else styled text in primary_color.
│                                         │     Platform: Legience logo SVG.
├─────────────────────────────────────────┤
│                                         │
│  Hello {firstName},                     │  ← 18px, 600 weight, #111827
│                                         │
│  {body text}                            │  ← 15px, #6b7280, line-height 1.7
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ▌ accent border (primary_color)  │    │  ← Detail card. Left border =
│  │                                  │    │     primary_color (or red for urgent).
│  │  Title (17px, bold)              │    │     bg: #f9fafb, rounded right corners.
│  │  Key: Value (14px)               │    │
│  │  Key: Value                      │    │
│  │  $Amount (30px, primary_color)   │    │  ← Optional large amount for invoices
│  └─────────────────────────────────┘    │
│                                         │
│  {additional text}                      │
│                                         │
│         [ CTA Button ]                  │  ← Optional. primary_color bg,
│                                         │     white text, 8px radius.
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  ← Thin divider (#f3f4f6)
│                                         │
│  Best regards,                          │
│  {sign-off name}                        │
│                                         │
├─────────────────────────────────────────┤
│  {footer content}                       │  ← bg: #f9fafb
│  Powered by Legience                    │  ← Only for firm-branded. 11px, #d1d5db
└─────────────────────────────────────────┘
```

## Design Specifications

- **Max width:** 600px, centered
- **Card:** White (#ffffff), border-radius 12px, box-shadow 0 4px 16px rgba(0,0,0,0.08)
- **Font stack:** `-apple-system, 'Segoe UI', Roboto, Arial, sans-serif`
- **All CSS inline** — no `<style>` blocks (Gmail/Outlook strip them)
- **Colors:** Tailwind gray scale — #111827 (headings), #374151 (labels), #6b7280 (body), #9ca3af (secondary), #d1d5db (muted)
- **Detail card:** bg #f9fafb, left border 3px solid {accent_color}, border-radius 0 8px 8px 0
- **CTA button:** Built with nested `<table>` for Outlook compatibility, padding 14px 44px, border-radius 8px
- **MFA code:** Individual digit boxes — 52x64px each, bg #f0f4ff, border 1px #dce3f5, monospace font 32px
- **Urgency banner:** Full-width colored bar above header. Red (#fef2f2 bg, #991b1b text) for court/hearing. Amber (#fffbeb bg, #92400e text) for deadlines.
- **No border-top accents** on any email
- **Logo:** 24px height, auto width, centered with 44px top padding

## Branding Fallback Rules

1. If `org.logoUrl` is set → show `<img>` with logo
2. If `org.logoUrl` is null → show org name as styled text in `primary_color`
3. If `org.primaryColor` is null → use `#405189` (Velzon indigo default)
4. If `org.email` is null → omit Reply-To header (defaults to from address)
5. If `org.address`/`phone` is null → omit from footer (no "N/A" placeholders)
6. Platform emails always use Legience logo SVG at 24px, color #1e56b6

## URL Strategy

All links use the existing `UI_APP_URL` environment variable (already used by `OrganizationInvitationServiceImpl` and `SuperAdminServiceImpl`).

| Environment | UI_APP_URL | Example |
|-------------|-----------|---------|
| Local dev | `http://localhost:4200` | `http://localhost:4200/invoices/42` |
| Staging | `https://staging.legience.com` | `https://staging.legience.com/invoices/42` |
| Production | `https://app.legience.com` | `https://app.legience.com/invoices/42` |

The template engine reads this via `@Value("${UI_APP_URL:http://localhost:4200}")`.

Legience logo: hosted at a fixed public URL (e.g., `https://legience.com/assets/legience-logo.png`), same across all environments. For emails, a PNG version is needed since many clients don't support SVG.

## Architecture

### New Components

**`EmailTemplateEngine.java`** — Central class that generates all email HTML.

```
EmailTemplateEngine
├── renderPlatformEmail(content)      → HTML for MFA, verification, password reset
├── renderFirmEmail(org, content)     → HTML for client-facing & internal firm emails
├── buildHeader(branding)             → Logo/name header section
├── buildDetailCard(items, color)     → Key-value detail card
├── buildCtaButton(text, url, color)  → Outlook-compatible CTA button
├── buildFooter(branding)             → Footer with optional "Powered by"
└── buildUrgencyBanner(text, level)   → Optional urgency banner
```

**`EmailBranding.java`** — Value object holding branding context.

```java
record EmailBranding(
    String name,          // "Legience" or org name
    String logoUrl,       // URL or null
    String primaryColor,  // hex color
    String email,         // for Reply-To
    String phone,         // for footer
    String address,       // for footer
    String baseUrl,       // UI_APP_URL
    boolean showPoweredBy // false for platform, true for firm
)
```

**`EmailContent.java`** — Value object holding email content.

```java
record EmailContent(
    String recipientName,
    String greeting,          // "Hello {name}," or "You've been invited!"
    List<String> bodyParagraphs,
    DetailCard detailCard,    // nullable
    CtaButton ctaButton,      // nullable
    String signOffName,
    String footerNote,        // nullable
    UrgencyBanner urgency     // nullable
)
```

### DB Schema Change

Add `primary_color` column to `organizations` table:

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#405189';
```

### Migration: Remove DB Email Templates

The `email_templates` table will no longer be used for rendering. The `ReminderQueueServiceImpl` will call the template engine directly instead of fetching DB templates. The table can be kept for backward compatibility but will not be read.

### Files to Modify

1. **`EmailServiceImpl.java`** — Replace all inline HTML building with calls to `EmailTemplateEngine`. Remove `getEmailCSS()`, `buildHtmlNotificationEmail()`, `buildMfaVerificationEmailHtml()`, `buildInvitationEmailHtml()`, `getEmailMessage()`, `getDeadlineReminderMessage()`. Add Reply-To header for firm emails.
2. **`ReminderQueueServiceImpl.java`** — Replace DB template lookup with direct `EmailTemplateEngine` calls. Remove `emailTemplateRepository` dependency.
3. **`InvoiceWorkflowService.java`** — Replace `generateEmailMessage()` with `EmailTemplateEngine` calls.
4. **`Organization.java`** — Add `primaryColor` field.
5. **`OrganizationDTO.java`** — Add `primaryColor` field.
6. **`IntakeFormResource.java`** — Replace inline HTML with `EmailTemplateEngine` calls.

### Files to Create

1. **`EmailTemplateEngine.java`** — in `service/` package
2. **`EmailBranding.java`** — in `dto/` package
3. **`EmailContent.java`** — in `dto/` package (with nested `DetailCard`, `CtaButton`, `UrgencyBanner` records)
4. **`V20__add_primary_color_to_organizations.sql`** — Flyway migration

## Email Types Summary (16 total)

### Platform (3)
| Email | Detail Card | CTA | Urgency |
|-------|------------|-----|---------|
| MFA Verification | Code digits display | No | No |
| Account Verification | No | "Verify My Account" | No |
| Password Reset | Warning box (amber) | "Reset Password" | No |

### Firm → Client (6)
| Email | Detail Card | CTA | Urgency |
|-------|------------|-----|---------|
| Invoice Created | Invoice details + amount | "View Invoice" | No |
| Payment Reminder | Invoice details + amount | "View Invoice" | No |
| Urgent Payment Reminder | Invoice details + amount (red) | "View Invoice" | Red banner |
| Payment Received | Payment details + amount (green) | No | No |
| Client Meeting Reminder | Event details | No | No |
| Organization Invitation | Role + expiry | "Accept Invitation" | No |

### Firm Internal (7)
| Email | Detail Card | CTA | Urgency |
|-------|------------|-----|---------|
| Meeting/Team Meeting Reminder | Event details | "View Calendar" | No |
| Hearing Reminder | Event + case details | "View Case Details" | Red banner |
| Court Date Reminder | Event + case details | "View Case Details" | Red banner |
| Deadline Reminder | Deadline + case details | "View Deadline" | Amber banner |
| Deposition/Mediation/Consultation Reminder | Event details | "View Calendar" | No |
| Case Status Notification | Case details + status change | "View Case" | No |
| Generic Event Reminder | Event details | "View Calendar" | No |
