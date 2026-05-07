import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { UserService } from '../../service/user.service';

/**
 * Resolves runtime feature flags. Each flag is the OR of:
 *   1. A global compile-time switch on `environment.features.*`
 *      (ops-controlled — flip per-environment to dark-launch or roll out broadly).
 *   2. A per-user opt-in column on `users.beta_*` exposed on the User profile.
 *      (Lets a single attorney try the new view in prod without flipping the global flag.)
 *
 * Either path can flip the flag on; both off = legacy behavior.
 *
 * To add a new flag:
 *   1. Add the field to both `environment.ts` and `environment.prod.ts` under `features`.
 *   2. Mirror the addition in the GitHub Secrets used by CI (ENV_TS / ENV_PROD_TS /
 *      ENV_STAGING_TS) — CI rewrites the env files from those secrets at build time.
 *   3. (Optional) add a per-user column + entity field + DTO field + repository toggle.
 *   4. Add a getter here that ORs the two sources.
 *   5. Consume via dependency injection in components/route guards.
 */
// CI builds rewrite environment.ts from a GitHub Secret (ENV_TS / ENV_PROD_TS /
// ENV_STAGING_TS) at build time. If the secret omits the `features` block, the
// strict TS type for `environment` won't carry that property and a plain
// `environment.features?` access fails type-check. Narrowing through this
// helper type keeps the optional access valid regardless of which env shape
// the secret carries — without resorting to `as any`.
type EnvWithFeatures = { features?: { attorneyFacingPiView?: boolean } };

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {

  constructor(private userService: UserService) {}

  /**
   * V61–V63 PI workflow migration: when true, route /legal/cases/{id} to the new
   * pi-case-detail.component for Personal Injury cases (P4+). Resolves OR of:
   *   - environment.features.attorneyFacingPiView (global)
   *   - currentUser.betaAttorneyView (per-user opt-in)
   */
  isAttorneyFacingPiViewEnabled(): boolean {
    if ((environment as EnvWithFeatures).features?.attorneyFacingPiView) return true;
    const user = this.userService.getCurrentUser();
    return !!user?.betaAttorneyView;
  }
}
