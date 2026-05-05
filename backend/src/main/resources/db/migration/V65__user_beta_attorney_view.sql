-- Phase 3 of PI case workflow migration: per-user beta opt-in for the new
-- attorney-facing PI case view (`pi-case-detail.component`, ships in P4).
--
-- Resolution at runtime is OR-of:
--   1. `environment.features.attorneyFacingPiView === true`  (global flag, ops-controlled)
--   2. `users.beta_attorney_view = true`                      (per-user opt-in for prod beta)
-- Either path can flip the flip; both off = legacy view.
--
-- Defaulting to false means existing users see no behavior change after V63
-- runs. The new view stays dark until either the env flag flips or a user
-- opts in (P4 ships a "Try the new view" toggle in user settings).

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS beta_attorney_view BOOLEAN DEFAULT false;
