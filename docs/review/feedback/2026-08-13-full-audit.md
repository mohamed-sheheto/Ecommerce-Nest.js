# Code Review — E-commerce NestJS Backend (full audit)

- **Date:** 2026-08-13
- **Scope:** `src/**` (all modules), `tsconfig.json`, `package.json`, `test/`, `src/main.ts`, `src/app.module.ts`
- **Catalogs applied:** `clean-code.md` (CC), `typescript.md` (TS), `testing-jest.md` (JT), `restful-api.md` (RS)
- **Note:** the catalogs target an Express codebase; findings map to the NestJS equivalents (controller = controller, `ValidationPipe` = validation middleware, `AuthGuard` = auth middleware, guard `UnauthorizedException` = HTTP status mapping).
- **Protocol:** every finding below was detected by heuristic and then confirmed by reading the surrounding code (step 4 of the manual). Nothing survives as a reportable finding is omitted; no padding added.

Severity is the catalog default, escalated one level where the violation sits on an authentication or payment path.

---

## Critical — none remaining

## Major — none remaining

## Minor — none remaining

---

## Suggested fix order (mentor's priority)

All findings fixed; nothing outstanding.

## Fixed (removed as they were solved, in this order)

`CC-701` (env.ts + .env.example, boot-time validation — the i18n-path claim was a false positive: dist/apps/api/i18n exists via nest-cli.json assets, so the path is correct) · `CC-802` (UpdateProfileDto + whitelist) · `RS-501` (public callback/sign route deleted) · `CC-805` (verified-code gating on change-password, passwordResetVerifiedAt TTL) · `CC-801` (select:false secrets + toUserResponse mapper everywhere) · `CC-804` (hashed OTP, timing-safe compare, TTL, 5-attempt cap) · `RS-504` (refresh token moved to body) · `CC-803` (parsePagination caps limit; regex filters only applied when present) · `RS-204` (AuthGuard now throws 403 Forbidden) · `CC-302` (BCRYPT_ROUNDS from env) · `RS-506` (reset-password returns identical response for unknown emails) · `CC-702` (Stripe keys moved to env.ts; remember to rotate the committed keys) · `CC-102` (buildLineItems: per-item unit amount from price × quantity + Tax & Shipping line) · `CC-501` (awaited Promise.all decrements; webhook idempotent on isPaid) · `TS-401` (order/cart null-guarded; webhook returns {received:true} for unknown sessions) · `CC-504` (stock-decrement compensation on webhook failure) · `CC-605` (Nest Logger in order service) · `TS-001` (strict:true + noUnusedLocals/Parameters + forceConsistentCasingInFileNames; noUncheckedIndexedAccess intentionally skipped — tracked work) · `CC-207` + TS-101 remainder (guard bypass removed; all controllers use typed @CurrentUser) · `CC-206` (ValidationPipe on request-product PATCH and tax create) · `TS-106` (all 11 @ts-ignore removed via typed cart subdocuments/populate generics) · `CC-203` (request-product service takes {userId, role} value object) · `CC-301` (recomputeProductRating helper) · `CC-201` (coupon expiry moved into CouponService) · `CC-002` (tex→tax, virify-code→verify-code, dashbourd→dashboard, isDeliverd→isDelivered/deliverdAt→deliveredAt, req-product→request-product, categoty→category, qauntity→quantity, prodcut_id→product_id) · `RS-002` (plural routes: products/users/coupons/brands/categories/sub-categories/reviews/request-products; cart/tax kept singular) · `RS-205` (409 Conflict on duplicates incl. coupon/review; 400 for invalid payment method) · `TS-203` (Role/gender/paymentMethodType unions; coupon.schema fields already concrete) · `JT-701` (stale e2e boilerplate deleted; unit tests for AuthGuard, AuthService, OrderService with model-boundary mocks; jest setupFiles + src/ moduleNameMapper; 34 tests green, build + lint clean).