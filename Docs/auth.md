# SatQuery AI — Authentication API Documentation

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
