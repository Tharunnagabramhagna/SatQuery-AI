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
```json
{
  "status": "error",
  "error_type": "validation_error",
  "detail": [
    {
      "field": "body -> password",
      "message": "String should have at least 8 characters"
    }
  ]
}
```

##### `500 Internal Server Error`
Returned on unexpected database failure. Transactions are rolled back automatically. No SQL errors or stack traces are leaked.
```json
{
  "detail": "An unexpected error occurred while creating your account. Please try again later."
}
```

---

## Security Specifications
- **Algorithm**: Argon2id via `argon2-cffi` (`PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)`).
- **Data Protection**: Plaintext passwords exist in memory only during hashing/validation and are never logged, persisted, or stored in traces.
- **Relational Integrity**: `users.email` is protected by both application-level duplicate checks and PostgreSQL unique index constraint (`ix_users_email`).
