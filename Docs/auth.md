# SatQuery AI — Authentication & Analysis API Documentation

## User Registration

### `POST /api/auth/register`

Creates a new user account with secure **Argon2id** password hashing.

#### Request Headers
- `Content-Type: application/json`

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "display_name": "Earth Observation Analyst"
}
```

| Field | Type | Required | Constraints / Validation |
|---|---|---|---|
| `email` | `string` | **Yes** | Valid RFC email syntax; automatically trimmed of whitespace and converted to lowercase. |
| `password` | `string` | **Yes** | Minimum 8 characters; never logged or exposed in plaintext. |
| `display_name` | `string` | No | Maximum 100 characters; whitespace trimmed. |

#### Responses

##### `201 Created`
Returned upon successful account creation.
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "user@example.com",
  "display_name": "Earth Observation Analyst",
  "created_at": "2026-09-06T00:00:00.000000Z"
}
```
*Note: Neither `password` nor `password_hash` is ever returned in responses.*

##### `409 Conflict`
Returned when an account with the specified normalized email address already exists.
```json
{
  "detail": "An account with this email already exists."
}
```

##### `422 Unprocessable Content`
Returned when validation fails (e.g. password shorter than 8 characters, invalid email format, or missing required fields).

##### `500 Internal Server Error`
Returned on unexpected database failure. Transactions are rolled back automatically. No SQL errors or stack traces are leaked.

---

## User Authentication (Login)

### `POST /api/auth/login`

Authenticates a user with email and password, issuing a signed, stateless **JWT access token**.

#### Request Headers
- `Content-Type: application/json`

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

| Field | Type | Required | Constraints / Validation |
|---|---|---|---|
| `email` | `string` | **Yes** | User email address; automatically trimmed of whitespace and lowercased. |
| `password` | `string` | **Yes** | Candidate plaintext password. |

#### Responses

##### `200 OK`
Returned upon successful authentication.
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "user@example.com",
    "display_name": "Earth Observation Analyst",
    "created_at": "2026-09-06T00:00:00.000000Z"
  }
}
```

##### `401 Unauthorized`
Returned when either the email does not exist or the password does not match. Generic message prevents account enumeration attacks.
```json
{
  "detail": "Invalid email or password."
}
```
*Headers: `WWW-Authenticate: Bearer`*

---

## Current User Profile

### `GET /api/auth/me`

Retrieves the authenticated user's profile using the stateless JWT bearer token.

#### Request Headers
- `Authorization: Bearer <access_token>`

#### Responses

##### `200 OK`
Returned upon successful token validation and user retrieval.
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "user@example.com",
  "display_name": "Earth Observation Analyst",
  "created_at": "2026-09-06T00:00:00.000000Z"
}
```
*Note: Credentials (`password`, `password_hash`) are never exposed.*

##### `401 Unauthorized`
Returned when the Authorization header is missing, token is malformed/expired, signature is invalid, or the user does not exist.
```json
{
  "detail": "Could not validate credentials."
}
```
*Headers: `WWW-Authenticate: Bearer`*

---

## Analysis Endpoint (with Optional Authentication)

### `POST /api/analysis`

Runs satellite image analysis through the full pipeline (Query Understanding → Agent Router → Tool Executor → Specialist Tool). Supports optional JWT Bearer authentication for analysis persistence.

#### Request Headers
- `Content-Type: multipart/form-data`
- `Authorization: Bearer <access_token>` *(optional)*

#### Multipart Form Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | **Yes** | Natural language query for satellite analysis. |
| `mode` | `string` | No | Frontend analysis mode hint (e.g. `compare_images`, `single_image`). |
| `capability` | `string` | No | Frontend capability hint (e.g. `change_detection`, `vqa`). |
| `before_image` | `file` | No | Before/first satellite image upload (JPEG, PNG, TIFF). |
| `after_image` | `file` | No | After/second satellite image upload (JPEG, PNG, TIFF). |

#### Authentication Behavior

| Authorization Header | Behavior |
|---|---|
| Not present | Anonymous analysis. No persistence. Response returned directly. |
| Valid Bearer token | Analysis persisted to PostgreSQL with user ownership. |
| Invalid/expired/malformed token | HTTP 401 returned. Analysis does **not** run. |

#### Persistence Behavior (Authenticated Requests)

When a valid Bearer token is supplied:
1. The analysis pipeline runs normally.
2. The structured camelCase response is built.
3. The analysis result is persisted to the `analyses` table with the authenticated user's UUID.
4. The `analysisId` in the HTTP response matches the database record `id`.
5. If the database commit fails, the transaction is rolled back and **HTTP 500** is returned. The client does not receive a successful `analysisId` that doesn't exist in the database.

#### Response (`200 OK`)
```json
{
  "analysisId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "task": "change_detection",
  "answer": "Analysis result text...",
  "confidence": 0.85,
  "evidence": [...],
  "visualizations": [...],
  "executionTrace": [...],
  "warnings": [],
  "isDemo": false
}
```

---

## Analysis History

### `GET /api/analyses`

Returns all analyses belonging to the authenticated user, ordered by creation date (newest first).

#### Request Headers
- `Authorization: Bearer <access_token>` **(required)**

#### Responses

##### `200 OK`
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "query": "What changed between 2023 and 2025?",
    "mode": "compare_images",
    "capability": "change_detection",
    "status": "completed",
    "date": "2026-09-06T10:30:00+00:00",
    "isDemo": false
  }
]
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Analysis UUID. |
| `query` | `string` | Original natural language query. |
| `mode` | `string \| null` | Analysis mode (e.g. `compare_images`, `single_image`). |
| `capability` | `string \| null` | Analysis capability (e.g. `change_detection`, `vqa`). |
| `status` | `string` | Analysis outcome (`completed`, `error`). |
| `date` | `string` | ISO 8601 creation timestamp. |
| `isDemo` | `boolean` | Always `false` for persisted analyses. |

> **Note:** The `modality` field is **not** provided by the backend. The frontend should derive display-level modality labels from the `mode` field (e.g. `compare_images` → "Bi-temporal Optical").

**Ordering:** Newest first (`created_at DESC`).

**Pagination:** Not currently implemented. All user analyses are returned.

##### `401 Unauthorized`
Returned when the Authorization header is missing or the token is invalid.

---

## Single Analysis Retrieval

### `GET /api/analyses/{analysis_id}`

Retrieves a single analysis record including the complete response payload.

#### Request Headers
- `Authorization: Bearer <access_token>` **(required)**

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `analysis_id` | `string` | UUID of the analysis to retrieve. |

#### Responses

##### `200 OK`
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "query": "What changed between 2023 and 2025?",
  "mode": "compare_images",
  "capability": "change_detection",
  "status": "completed",
  "date": "2026-09-06T10:30:00+00:00",
  "isDemo": false,
  "response": {
    "analysisId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed",
    "task": "change_detection",
    "answer": "...",
    "confidence": 0.85,
    "evidence": [...],
    "visualizations": [...],
    "executionTrace": [...],
    "warnings": [],
    "isDemo": false
  }
}
```

The `response` field contains the complete structured analysis result payload as originally returned by `POST /api/analysis`.

##### `401 Unauthorized`
Returned when the Authorization header is missing or the token is invalid.

##### `404 Not Found`
Returned when:
- The `analysis_id` is not a valid UUID.
- The analysis does not exist.
- The analysis belongs to another user (no information leakage).

```json
{
  "detail": "Analysis not found."
}
```

---

## Security Specifications
- **Password Hashing**: Argon2id via `argon2-cffi` (`PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)`).
- **Token Signing**: HMAC SHA-256 (`HS256`) via `PyJWT`.
- **JWT Claims**:
  - `sub`: User UUID string
  - `iat`: UTC epoch timestamp of issuance
  - `exp`: UTC epoch timestamp of expiration
- **Configuration**:
  - `JWT_SECRET_KEY`: Provided via environment variable or `.env` (never hardcoded in source code).
  - `JWT_ALGORITHM`: Default `HS256`.
  - `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`: Default `60` (3600 seconds).
- **Enumeration Prevention**: Generic HTTP 401 error message for non-existent users and wrong passwords.
- **Relational Integrity**: `users.email` is protected by application-level duplicate checks and PostgreSQL unique index constraint (`ix_users_email`).
- **Analysis Ownership**: Users can only access their own analyses. Cross-user access returns 404 (no information leakage).

---

## Frontend Integration Notes

The following changes are needed in the frontend when integrating with the real backend API:

### 1. Analysis Submission
- Replace mock `submitAnalysis()` with a real `POST /api/analysis` request.
- If the user is logged in, attach `Authorization: Bearer <token>` header to the multipart request.
- The response shape matches the existing `AnalysisResponse` type.
- The `analysisId` from an authenticated response is a real UUID persisted in the database.

### 2. Analysis History
- Replace mock `getRecentAnalyses()` with `GET /api/analyses`.
- Attach `Authorization: Bearer <token>` header.
- The response is an array of analysis summary objects.
- **`modality` is not provided by the backend.** The frontend should derive its own display label from the `mode` field (e.g. `compare_images` → "Bi-temporal Optical", `optical_sar` → "Optical + SAR", `single_image` → "Optical").
- Map `date` to the existing `AnalysisRecord.date` field.
- Map `id` to the existing `AnalysisRecord.id` field.

### 3. Single Analysis Retrieval
- Use `GET /api/analyses/{analysis_id}` to fetch full analysis details.
- The `response` field contains the complete `AnalysisResponse` payload.
- Handle 404 for analyses that no longer exist.

### 4. Authentication Flow
- Register via `POST /api/auth/register`.
- Login via `POST /api/auth/login` to obtain JWT.
- Store the `access_token` in the frontend (e.g. localStorage or state).
- Attach `Authorization: Bearer <token>` to all authenticated API calls.
- `GET /api/auth/me` to verify/refresh user profile.
