# SatQuery AI — Authentication & Analysis API Documentation

## Table of Contents
1. [Authentication Architecture & Security Guarantees](#authentication-architecture--security-guarantees)
2. [Local Registration & Email Verification Flow](#local-registration--email-verification-flow)
   - [`POST /api/auth/register`](#post-apiauthregister)
   - [`POST /api/auth/verify-email`](#post-apiauthverify-email)
   - [`POST /api/auth/resend-verification`](#post-apiauthresend-verification)
   - [`POST /api/auth/login`](#post-apiauthlogin)
   - [`GET /api/auth/me`](#get-apiauthme)
3. [Social Authentication (Google & Facebook OAuth 2.0)](#social-authentication-google--facebook-oauth-20)
   - [`GET /api/auth/google`](#get-apiauthgoogle)
   - [`GET /api/auth/google/callback`](#get-apiauthgooglecallback)
   - [`GET /api/auth/facebook`](#get-apiauthfacebook)
   - [`GET /api/auth/facebook/callback`](#get-apiauthfacebookcallback)
   - [`POST /api/auth/oauth/exchange`](#post-apiauthoauthexchange)
4. [Account Linking Rules & Protections](#account-linking-rules--protections)
5. [Analysis Endpoints & History (Unchanged Core)](#analysis-endpoints--history)
   - [`POST /api/analysis`](#post-apianalysis)
   - [`GET /api/analyses`](#get-apianalyses)
   - [`GET /api/analyses/{analysis_id}`](#get-apianalysesanalysis_id)
6. [Environment Variables & Configuration](#environment-variables--configuration)
7. [Frontend Integration Contract](#frontend-integration-contract)

---

## Authentication Architecture & Security Guarantees

SatQuery AI employs a multi-layered, zero-trust authentication design:

1. **Password Security**: Passwords hashed with **Argon2id** (`time_cost=3`, `memory_cost=64MB`, `parallelism=4`). Plaintext passwords and `password_hash` are never exposed or logged.
2. **Email OTP Verification**:
   - 6-digit cryptographically secure numeric codes (`secrets.choice`).
   - 15-minute expiration window.
   - Maximum 5 attempts per code before invalidation.
   - 60-second resend cooldown.
   - **Database stores only SHA-256 `code_hash`**; plaintext OTPs are never stored in the database.
   - **Zero OTP Logging**: Verification codes, client secrets, and passwords are never logged in application logs.
   - **One-Time Verification**: Verification is required once during account creation; subsequent logins require only email and password without OTP prompts.
3. **OAuth 2.0 & OIDC Flow**:
   - **JWT is NEVER placed in redirect URLs or fragments**: OAuth redirects provide only a short-lived (120s), single-use `oauth_code`.
   - **OAuth Exchange Endpoint**: The frontend exchanges `oauth_code` for the SatQuery JWT via `POST /api/auth/oauth/exchange`. The code is invalidated immediately.
   - **CSRF State Tokens**: 32-byte cryptographic random state tokens stored as SHA-256 hashes with 10-minute expiry; strictly validated and consumed upon provider callback.
   - **Strict Account Linking**: Social accounts only automatically link to existing local accounts if **both** the provider email and local account email are verified. Unverified accounts reject silent merging.

---

## Local Registration & Email Verification Flow

### `POST /api/auth/register`

Creates an unverified account (`email_verified=False`), generates a 6-digit OTP, records its SHA-256 hash, and dispatches a verification email.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "display_name": "Earth Observation Analyst"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | `string` | **Yes** | Valid RFC email format; whitespace-trimmed and lowercased. |
| `password` | `string` | **Yes** | Minimum 8 characters. |
| `display_name` | `string` | No | Optional full name/display name. |

#### Response (`201 Created`)
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "user@example.com",
  "display_name": "Earth Observation Analyst",
  "email_verified": false,
  "auth_provider": "local",
  "avatar_url": null,
  "created_at": "2026-09-06T10:00:00Z"
}
```

---

### `POST /api/auth/verify-email`

Submits the 6-digit OTP code to verify an account.

#### Request Body
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

#### Response (`200 OK`)
```json
{
  "message": "Email verified successfully. You may now sign in.",
  "email": "user@example.com",
  "email_verified": true
}
```

#### Error Responses
- `400 Bad Request`: Code invalid, expired, already verified, or maximum attempts exceeded.

---

### `POST /api/auth/resend-verification`

Requests a fresh 6-digit OTP code if the previous one expired.

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Response (`200 OK`)
```json
{
  "message": "A new verification code has been sent to your email address.",
  "email": "user@example.com",
  "email_verified": false
}
```

#### Error Responses
- `429 Too Many Requests`: Triggered if requested within the 60-second cooldown window (includes `Retry-After` header).

---

### `POST /api/auth/login`

Authenticates a verified user with email and password.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### Responses

##### `200 OK` (Verified User)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "user@example.com",
    "display_name": "Earth Observation Analyst",
    "email_verified": true,
    "auth_provider": "local",
    "avatar_url": null,
    "created_at": "2026-09-06T10:00:00Z"
  }
}
```

##### `403 Forbidden` (Unverified User)
```json
{
  "detail": "EMAIL_NOT_VERIFIED: Please verify your email address before signing in."
}
```

##### `401 Unauthorized` (Invalid Credentials or Social-Only Account)
- Password mismatch: `{"detail": "Invalid email or password."}`
- Social-only account attempting password login: `{"detail": "This account was created with social login. Please sign in with Google or Facebook."}`

---

### `GET /api/auth/me`

Returns the profile of the currently authenticated user from the JWT Bearer token.

#### Request Headers
- `Authorization: Bearer <access_token>`

#### Response (`200 OK`)
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "user@example.com",
  "display_name": "Earth Observation Analyst",
  "email_verified": true,
  "auth_provider": "local",
  "avatar_url": null,
  "created_at": "2026-09-06T10:00:00Z"
}
```

---

## Social Authentication (Google & Facebook OAuth 2.0)

### Flow Overview
1. User clicks **Continue with Google** / **Continue with Facebook**.
2. Frontend opens `GET /api/auth/google` or `GET /api/auth/facebook`.
3. Backend generates cryptographically random CSRF `state`, stores its SHA-256 hash with 10m expiry, and redirects to provider's consent screen.
4. User authenticates with provider; provider redirects back to backend callback endpoint with `code` and `state`.
5. Backend validates `state` (rejects missing, mismatched, expired, or reused state).
6. Backend exchanges authorization code with provider server-side.
7. Backend validates identity (verifies issuer, audience, and verified email status).
8. Backend links or creates the SatQuery user according to strict account linking rules.
9. Backend creates a 120-second single-use exchange code (`oauth_code`), stores its SHA-256 hash, and redirects to:
   ```
   ${FRONTEND_URL}/dashboard?oauth_code=<one_time_code>
   ```
   *(JWT is NEVER exposed in the URL, browser history, or logs)*.
10. Frontend extracts `oauth_code` from query params and calls `POST /api/auth/oauth/exchange`.
11. Backend validates and consumes `oauth_code` immediately, returning standard SatQuery JWT `TokenResponse`.

---

### `GET /api/auth/google`
Redirects the user to Google OAuth 2.0 consent screen.

### `GET /api/auth/google/callback`
Validates Google OIDC response, creates/links user, and redirects to frontend with `oauth_code`.

### `GET /api/auth/facebook`
Redirects the user to Facebook OAuth dialog.

### `GET /api/auth/facebook/callback`
Validates Facebook Graph API identity with `appsecret_proof`, creates/links user, and redirects to frontend with `oauth_code`.

---

### `POST /api/auth/oauth/exchange`

Exchanges the single-use OAuth code for a full SatQuery JWT access token.

#### Request Body
```json
{
  "oauth_code": "4Fk9xQ_..."
}
```
*(Accepts either `"oauth_code"` or `"code"`).*

#### Response (`200 OK`)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "e47bc10b-58cc-4372-a567-0e02b2c3d480",
    "email": "user@gmail.com",
    "display_name": "Google User",
    "email_verified": true,
    "auth_provider": "google",
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "created_at": "2026-09-06T10:05:00Z"
  }
}
```

#### Error Responses
- `400 Bad Request`: Code invalid, expired, or already used.

---

## Account Linking Rules & Protections

When an OAuth user logs in, the backend links or creates accounts according to this strict precedence:

1. **Provider ID Match**:
   - If `user.google_id == provider_id` or `user.facebook_id == provider_id`:
   - Returns existing user immediately (no duplicate users).
2. **Verified Email Match**:
   - If provider email is marked verified AND an existing local user has `email_verified == True`:
   - Safely links `google_id` / `facebook_id` to the existing local user.
3. **Unverified Local Account Guard (Anti-Hijacking)**:
   - If an existing local user has `email_verified == False`, social linking is **strictly rejected**.
   - Callback redirects to `${FRONTEND_URL}/login?error=email_not_verified`.
   - Prevents an attacker from registering an unverified account with someone else's email to capture their social login.
4. **New User Creation**:
   - If no provider ID or email matches, creates a new user with `email_verified=True`, `auth_provider="google"|"facebook"`, and `password_hash=None`.

---

## Analysis Endpoints & History

The core satellite analysis endpoints and persistence contracts remain unchanged:

- `POST /api/analysis`: Supports optional JWT Bearer token. Authenticated requests persist analysis results to PostgreSQL with user ownership. Anonymous requests run analysis without persistence.
- `GET /api/analyses`: Returns authenticated user's analysis history (`200 OK`).
- `GET /api/analyses/{analysis_id}`: Retrieves full persisted analysis details (`200 OK` or `404 Not Found`).

---

## Environment Variables & Configuration

The following variables configure the authentication subsystem in `.env`:

```ini
# Core Configuration
ENVIRONMENT=development
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# JWT Settings
JWT_SECRET_KEY=your_secure_random_jwt_secret_key_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Email Verification (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_smtp_app_password
SMTP_FROM_EMAIL=no-reply@satquery.com
SMTP_FROM_NAME=SatQuery AI
SMTP_USE_TLS=true
SMTP_USE_SSL=false
EMAIL_VERIFY_EXPIRE_MINUTES=15
EMAIL_RESEND_COOLDOWN_SECONDS=60

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# Facebook OAuth 2.0
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:8000/api/auth/facebook/callback
```

---

## Frontend Integration Contract

### 1. Registration Flow
1. Call `POST /api/auth/register` with `{ email, password, display_name }`.
2. Transition UI to "Verify Email" screen.
3. Prompt user for the 6-digit code.
4. Call `POST /api/auth/verify-email` with `{ email, code }`.
5. Upon 200 OK, transition to login or automatically log in.
6. Provide a "Resend Code" button calling `POST /api/auth/resend-verification`.

### 2. Login Flow
1. Call `POST /api/auth/login` with `{ email, password }`.
2. If status is `403 Forbidden` (`EMAIL_NOT_VERIFIED`):
   - Direct user to enter verification code.
3. If status is `200 OK`:
   - Store `access_token`.

### 3. Google & Facebook OAuth Flow
1. Render "Sign in with Google" button linking to:
   ```
   http://localhost:8000/api/auth/google
   ```
2. Render "Sign in with Facebook" button linking to:
   ```
   http://localhost:8000/api/auth/facebook
   ```
3. After authorization, browser redirects to:
   ```
   http://localhost:5173/dashboard?oauth_code=<one_time_code>
   ```
4. Frontend router checks for `oauth_code` in query parameters.
5. If present, immediately POSTs to:
   ```json
   POST /api/auth/oauth/exchange
   { "oauth_code": "<one_time_code>" }
   ```
6. Stores returned `access_token` and redirects to `/dashboard` without query params.
