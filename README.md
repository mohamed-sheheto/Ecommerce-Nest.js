# Ecommerce Backend API

Ecommerce is an online store backend for browsing products, managing carts, and checking out with cash or card. Customers can sign up, verify password resets by email, shop the catalog, apply coupons, and place orders. It is built with NestJS, MongoDB and Mongoose, with Stripe for card payments, Cloudinary for image uploads, and Google OAuth for social sign-in.

## Table of Contents

- [Short Description](#ecommerce-backend-api)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [Basic Workflow](#basic-workflow)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [API Endpoints Overview](#api-endpoints-overview)
- [Architecture](#architecture)
- [Testing](#testing)
- [Contributing](#contributing)

---

## Key Features

- **Product discovery** — list products with search, filters and pagination, plus detailed product pages linked to category, sub-category and brand.
- **Catalog management** — admin CRUD for categories, sub-categories, brands, products, suppliers and tax settings.
- **Authentication** — sign-up, sign-in, reset password via emailed code, verify code, change password, refresh tokens, and Google sign-in.
- **User management** — admin CRUD for users plus self-service profile (`/me`): view, update and deactivate account, with `user` / `admin` roles.
- **Cart and coupons** — add, update and remove cart items, apply coupon codes, with separate admin views for any user's cart.
- **Checkout and payments** — cash or Stripe card checkout, Stripe Checkout Sessions with `success_url` / `cancel_url`, and a raw-body Stripe webhook that marks card orders paid.
- **Order management** — user order history plus admin views for all orders and per-user orders, including cash-order confirmation.
- **Engagement** — product reviews, product-request submissions for out-of-stock items, and email notifications via Gmail.
- **Uploads** — single and multi-image uploads to Cloudinary.
- **Localization and hardening** — English/Arabic validation messages via `nestjs-i18n`, Helmet headers, CORS, request throttling, and bcrypt password hashing.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) 10 |
| Language | TypeScript |
| Database | MongoDB + Mongoose (`@nestjs/mongoose`, `mongoose`) |
| Auth | JWT access + refresh tokens (`@nestjs/jwt`), Google OAuth (`passport-google-oauth20`) |
| Validation | `class-validator` + `ValidationPipe`, `nestjs-i18n` (`I18nValidationPipe`) |
| Config | `@nestjs/config` + `src/config/env.ts` fail-fast check |
| Payments | Stripe (`stripe`) — card sessions + webhook |
| Uploads | Cloudinary (`cloudinary` + `streamifier`) |
| Mail | Gmail via `@nestjs-modules/mailer` + `nodemailer` |
| Security | `helmet`, CORS, `@nestjs/throttler`, `bcrypt` |
| Localization | `nestjs-i18n` (en fallback, `?lang`, `Accept-Language`, `x-lang`) |

---

## How It Works

1. **Request flow** — global prefix `api` plus per-controller `v1/...` prefix, DTOs validated with `forbidNonWhitelisted`, `AuthGuard` verifies JWT and `@Roles()` checks `user` / `admin`, then controllers delegate to Mongoose-backed services.
2. **Catalog** — products reference categories, sub-categories and brands; suppliers and tax are separate collections that feed product pricing and sourcing.
3. **Cart** — each user has one cart document; adding/updating items re-validates product existence and stock, and coupons are applied by name with expiry/discount checks.
4. **Checkout** — `POST /api/v1/cart/checkout/:paymentMethodType` creates an order as cash (pending) or card (Stripe Checkout Session); the Stripe webhook `POST /api/v1/checkout/session` verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET` and marks the order paid.
5. **Background work** — auth and order flows send transactional emails (reset codes, order confirmations) through the Gmail mailer; image uploads stream buffers to Cloudinary.

---

## Basic Workflow

**Shopper places an order:**

```
browse products → sign up / sign in
  → add to cart → apply coupon → checkout (cash | card)
  → card: Stripe session → webhook confirms payment
  → order appears in history
```

**Admin manages the store:**

```
create category → sub-category → brand
  → create product + upload images
  → create coupon + set tax → review carts / orders
  → confirm cash orders
```

---

## Installation

### Prerequisites

- Node.js 20+, npm
- MongoDB running at `mongodb://localhost:27017/ecommerce` (hardcoded in `src/app.module.ts`)
- Gmail app password + Cloudinary + Stripe + Google OAuth credentials

### 1. Clone the repository

```bash
git clone <repo-url>
cd Ecommerce-Back-End-Nest.Js-main
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required variables (the app throws on boot if any are missing — see `src/config/env.ts`):

```env
PORT=3000
BCRYPT_ROUNDS=10

JWT_SECRET=your_jwt_secret
JWT_SECRET_REFRESHTOKEN=your_refresh_secret

MAIL_USER=shop@example.com
EMAIL_USERNAME=shop@gmail.com
EMAIL_PASSWORD=your_gmail_app_password

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

CLOUDINARY_NAME=your-cloud-name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
```

### 3. Run locally

```bash
npm install
npm run start:dev
```

API base: `http://localhost:3000/api`. Other commands: `npm run build`, `npm run start:prod`, `npm run lint`, `npm test`.

For Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/v1/checkout/session
```

---

## Project Structure

```
src/
├── main.ts                  # bootstrap: rawBody (Stripe), helmet, CORS, I18nValidationPipe, api prefix
├── app.module.ts            # module wiring: Mongoose, Jwt, Mailer, i18n, Throttler
├── config/env.ts            # fail-fast env validation + typed env export
├── common/pagination.ts     # shared pagination helpers
├── i18n/en|ar/              # validation message translations
├── auth/                    # sign-up, sign-in, reset/verify/change password, refresh token
├── oauth/                   # Google strategy, sign + callback
├── user/                    # users CRUD, /me profile, AuthGuard, @Roles(), @CurrentUser()
├── category/                # categories CRUD
├── sub-category/            # sub-categories CRUD
├── brand/                   # brands CRUD
├── product/                 # products CRUD + filtered listing
├── suppliers/               # suppliers CRUD
├── tax/                     # tax settings
├── coupon/                  # coupons CRUD
├── cart/                    # user cart + coupon apply, admin cart views
├── order/                   # cash/card checkout, Stripe webhook, user/admin order history
├── review/                  # product reviews + dashboard reviews
├── request-product/         # customer product requests CRUD
└── upload-files/            # Cloudinary single/multi image upload
```

---

## API Endpoints Overview

Base prefix: `/api`. Public browsing of the catalog; cart, checkout and profile routes require a signed-in user; catalog writes and admin order/cart views require `admin`.

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/auth/sign-up` | Register a new user account | Public |
| `POST` | `/api/v1/auth/sign-in` | Authenticate user and issue tokens | Public |
| `POST` | `/api/v1/auth/reset-password` | Send password-reset code by email | Public |
| `POST` | `/api/v1/auth/verify-code` | Verify password-reset code | Public |
| `POST` | `/api/v1/auth/change-password` | Change password after code verification | Public |
| `POST` | `/api/v1/auth/refresh-token` | Issue new tokens via refresh token | Authenticated |
| `GET` | `/api/v1/auth/google/sign` | Start Google OAuth sign-in | Public |
| `GET` | `/api/v1/auth/google/callback` | Google OAuth callback (sign-in or sign-up) | Public |
| `GET` | `/api/v1/products` | List products with filters/pagination | Public |
| `GET` | `/api/v1/products/:id` | Get a single product | Public |
| `POST` | `/api/v1/products` | Create a product | Admin |
| `GET` | `/api/v1/categories` | List categories | Public |
| `GET` | `/api/v1/sub-categories` | List sub-categories | Public |
| `GET` | `/api/v1/brands` | List brands | Public |
| `POST` | `/api/v1/cart/:productId` | Add a product to cart | User |
| `GET` | `/api/v1/cart` | Get current user's cart | User |
| `PATCH` | `/api/v1/cart/:productId` | Update cart item quantity/options | User |
| `DELETE` | `/api/v1/cart/:productId` | Remove item from cart | User |
| `POST` | `/api/v1/cart/coupon/:couponName` | Apply a coupon to cart | User |
| `POST` | `/api/v1/cart/checkout/:paymentMethodType` | Checkout with `card` or `cash` | User |
| `PATCH` | `/api/v1/cart/checkout/:orderId/cash` | Confirm a cash order | Admin |
| `POST` | `/api/v1/checkout/session` | Stripe webhook marking card orders paid | Stripe |
| `GET` | `/api/v1/order/user` | Get current user's orders | User |
| `GET` | `/api/v1/order/admin` | Get all orders | Admin |
| `POST` | `/api/v1/coupons` | Create a coupon | Admin |
| `POST` | `/api/v1/reviews` | Add a product review | Authenticated |
| `POST` | `/api/v1/request-products` | Request an unavailable product | Authenticated |
| `POST` | `/api/v1/image/upload` | Upload a single image | Authenticated |
| `POST` | `/api/v1/image/uploads` | Upload multiple images | Authenticated |
| `GET` | `/api/v1/users/me` | Get current profile | Authenticated |
| `PATCH` | `/api/v1/users/me` | Update current profile | Authenticated |

See the controllers in `src/*/` for the full route list. All write routes validate input with DTOs.

---

## Architecture

Feature modules (`auth`, `product`, `cart`, `order`, ...) behind a validated request pipeline, MongoDB via Mongoose as the source of truth with one document per cart/order, JWT + role guards for access control, Stripe for card money movement with webhook reconciliation, Cloudinary for binary assets, and Gmail for transactional email. Security is layered with Helmet, CORS allow-listing, and per-minute throttling.

---

## Testing

```bash
npm test                                   # unit suites (src, *.spec.ts)
npm run test:e2e                            # e2e (test/jest-e2e.json)
npm run test:cov                            # coverage
```

Unit specs cover auth and order services plus the auth guard; `test/setup-env.ts` injects dummy env values so suites run without real credentials. E2E config lives in `test/jest-e2e.json`.

---

## Contributing

1. Create a feature branch from `main`.
2. Follow the existing module structure (Controller → Service → Schema + DTOs).
3. Add DTO validation and tests for new behavior.
4. Open a pull request with a clear description of the change.
