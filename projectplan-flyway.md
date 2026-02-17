# Flyway Automatic Database Migrations Setup

## Overview
Set up Flyway so migrations run automatically on ECS deploy. Dev stays unchanged (Hibernate auto-update).

## Tasks

- [x] 1. Add Flyway dependencies to `backend/pom.xml`
- [x] 2. Archive 221 old migration files to `migration-archive/`
- [x] 3. Create first Flyway migration `V1__feb_2026_ai_features.sql`
- [x] 4. Configure Flyway in `application.yml` and `application-dev.yml`
- [x] 5. Update CI workflow `.github/workflows/ci.yml`
- [ ] 6. Verify local dev starts normally

## Configuration Strategy
| Profile | Flyway | ddl-auto |
|---------|--------|----------|
| dev | disabled | update |
| staging/prod | enabled | validate |
| test | disabled | create-drop |

## Review

### Changes Made
1. **`backend/pom.xml`** — Added `flyway-core` + `flyway-database-postgresql` (versions from Spring Boot BOM)
2. **`backend/src/main/resources/db/migration-archive/`** — Moved 221 historical SQL files here (all already applied)
3. **`backend/src/main/resources/db/migration/V1__feb_2026_ai_features.sql`** — First migration (copy of `aws-migration-feb2026.sql`, all idempotent `IF NOT EXISTS`)
4. **`backend/src/main/resources/application.yml`** — Added Flyway config (enabled, baseline-on-migrate, baseline-version 0), changed `ddl-auto: none` → `validate`
5. **`backend/src/main/resources/application-dev.yml`** — Added `spring.flyway.enabled: false`
6. **`.github/workflows/ci.yml`** — Added Flyway config, changed `ddl-auto: update` → `validate`

### How It Works
- **First deploy**: Flyway creates `flyway_schema_history`, baselines at v0, runs V1 (idempotent — safe even if already applied)
- **Future deploys**: Add `V2__description.sql`, commit, deploy — Flyway runs it automatically
- **Dev unchanged**: Flyway disabled, Hibernate `ddl-auto: update` still manages schema locally
