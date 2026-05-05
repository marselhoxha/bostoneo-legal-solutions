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
 *   2. (Optional) add a per-user column + entity field + DTO field + repository toggle.
 *   3. Add a getter here that ORs the two sources.
 *   4. Consume via dependency injection in components/route guards.
 */
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
    if (environment.features?.attorneyFacingPiView) return true;
    const user = this.userService.getCurrentUser();
    return !!user?.betaAttorneyView;
  }
}
