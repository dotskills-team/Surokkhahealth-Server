# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run with ts-node-dev (auto-restart, transpile-only). Listens on `PORT`.
- `npm run build` — `tsc` to `dist/`. Required before `npm start` and before Vercel deploys (`vercel.json` serves `dist/server.js`).
- `npm start` — runs `node dist/server.js` (needs a prior build).
- `npm run lint` — `eslint ./src`. Note: there is no ESLint config file in this repo root, so this will likely fail until one is added.
- `npm test` — placeholder; there is no test framework. There is no single-test command.
- One-off scripts (run with `npx ts-node-dev <file>` or the matching npm script):
  - `npm run migrate:deliveredAt` — data migration in `src/scripts/migrateDeliveredAt.ts`.
  - `npm run clear:db` — `src/scripts/clearDB.ts`. Destructive; read it before running.
  - `npm run generate:secret` — `src/scripts/generateSecret.ts` (generates a secret; check the script for output).

Startup fails fast if any variable in `requiredEnvVariables` (`src/app/config/env.ts`) is missing. The server needs MongoDB (`DB_URL`), Redis (`REDIS_*`), Cloudinary, SMS, and the SSLCommerz and SurjoPay gateway settings to boot. Do not print or copy values from `.env`; it contains live credentials.

## Architecture

**Entry and wiring.** `src/server.ts` connects Mongoose, runs `seedAdmin()` (creates the SUPER_ADMIN from env if none exists), then calls `app.listen`. The three cron starters (`registerSubscriptionExpireTracker`, `startSurjoPayRefundCron`, `startSSLRefundCron`) run at module load, not after the DB connects. `src/app.ts` sets up Express 5, cookie parsing, a hard-coded CORS origin list (plus `FRONTEND_URL`), and mounts everything under `/api/v1`. It also forces DNS resolvers to 1.1.1.1 / 8.8.8.8 at import time.

**Module layout.** Each domain lives in `src/app/modules/<name>/` and follows the same split: `*.route.ts` → `*.controller.ts` → `*.service.ts`, with `*.model.ts`, `*.interface.ts`, `*.validation.ts` (Zod), and `*.constants.ts`. All modules are registered in the array in `src/app/routes/index.ts`. Controllers wrap handlers in `catchAsync`; business logic lives in services.

**Auth and authorization.** `checkAuth(...roles)` (`src/app/middlewares/checkAuth.ts`) reads the JWT from the `Authorization` header or the `accessToken` cookie, verifies it, then loads the User from the DB on every request. It rejects users who are inactive, blocked, or deleted, and checks the token's role against the allowed list. Role permissions are declared per-route in each `*.route.ts`, so check the route file before changing who can access an endpoint. Roles are in `modules/user/user.interface.ts` (`SUPER_ADMIN`, `ADMIN`, `AGENT_LEADER`, `AGENT`, `CUSTOMER`, `MANAGER`, `CLAIMS_MANAGER`, `A_A_MANAGER`).

**Errors and responses.** Throw `AppError` (`src/app/errorHelpers/appError.ts`) for expected failures. `globalErrorHandler` maps Mongo duplicate-key, CastError, Mongoose validation, and Zod errors into a uniform `{ success, message, errorSources }` body. Success responses go through `sendResponse`.

**Listing, search, and pagination.** `utils/QueryBuilder.ts` chains `filter()`, `search()`, `sort()`, `fields()`, and `paginate()` over a Mongoose query, then `getMeta()` for totals. The reserved query params are `searchTerm`, `sort`, `fields`, `limit`, and `page` (`constants.ts`). Search also matches a numeric `customOrderId` and ObjectIds.

**Soft delete / trash.** Most entities use an `isDeleted` flag. Routes follow a consistent pattern: `GET /all-trash-*`, `PATCH /soft-delete/:id`, `PATCH /restore/:id`, and `DELETE /permanent-delete/:id`. Queries for live records must filter `isDeleted: false`.

**Sequential IDs.** `utils/counterHelper.ts` `generateCustomId(key, prefix)` atomically increments a `Counter` document and returns IDs like `PREFIX-000123`.

**Subscriptions (the core flow).** `modules/subscription/subscription.service.ts` `createSubscription` runs inside a Mongoose transaction. It validates the package and plan, requires `price` to equal the plan's `discountPrice || regularPrice`, resolves or creates the customer (staff can create a customer inline via `customerPayload`), and handles `isJoint` packages (a second covered person via `joinMember`) and `subscribeFor` beneficiaries. `subscription.analytics.service.ts` backs the `/overview/*` dashboards.

**Payments.** `modules/payment/payment.service.ts` picks the gateway from the DB-stored active setting (`PaymentSettingService.getActiveGateway()`, `PaymentGateway.SSLCOMMERZ` or SURJOPAY) and creates the checkout session in `createGatewaySession`. Callbacks land on `/payment/ssl/ipn` and the validate routes. The file still contains a large commented-out v1 flow; the live code is the `v2` section below it.

**Background jobs.** Cron jobs use `node-cron` and live in `src/app/utils/`:
- `subscriptionExpireTracker.ts` — daily at 23:59 and expiry reminders via SMS and in-app notifications, deduplicated per day.
- `sslRefundTracker.ts` and `surjopayRefundTracker.ts` — every 30 minutes, polling refund status.

**Redis.** Used for OTPs (`utils/otpRedis.ts`, keys `otp:<phone>`) and in the auth routes. The client is a singleton in `config/redis.ts`.

**Files and integrations.** Uploads go through Multer with `multer-storage-cloudinary` (`config/multer.config.ts`). PDFs are generated with PDFKit (`utils/generatePdf.ts`). SMS goes through `utils/sendSms.ts`. Zaynax crypto is in `utils/zaynaxCrypto.ts`.

**Frontend relationship.** The Next.js app in the sibling repo `insurance-management-frontend` is the only client. Its origin must be in the CORS list in `app.ts`.

**Deployment.** Vercel, via `vercel.json`, which routes all requests to `dist/server.js`.

## Notes

- `package.json` has `"main": "index.js"`, but the real entry point is `src/server.ts`.
- `dist/` is present locally but is git-ignored; rebuild rather than editing it.
