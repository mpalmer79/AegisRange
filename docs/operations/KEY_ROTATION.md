# JWT Key Rotation Procedure

This document describes how to rotate the JWT signing key for the
AegisRange platform with zero downtime.

## Overview

AegisRange uses HS256 (HMAC-SHA256) for JWT signing. The service
supports **two keys simultaneously**: the *current* key and the
*previous* key. New tokens are always signed with the current key.
Token verification tries the current key first, then falls back to
the previous key if configured. This enables a rolling rotation
window where existing tokens signed with the old key remain valid
until they expire.

Each token includes a `kid` (Key ID) claim in the JWT header so
operators and audit logs can identify which key signed a given token.

## Environment Variables

| Variable              | Purpose                                     |
|-----------------------|---------------------------------------------|
| `JWT_SECRET`          | Current signing key (required in production)|
| `JWT_SECRET_PREVIOUS` | Previous signing key (optional)             |
| `JWT_KEY_ID`          | Key identifier included in JWT `kid` header |

## Rotation Steps

### 1. Generate a new secret

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Save the output securely (e.g. in your secrets manager).

### 2. Update environment variables

Move the current secret to `JWT_SECRET_PREVIOUS` and set the new
secret as `JWT_SECRET`. Update `JWT_KEY_ID` to a new identifier
(e.g. `k2`, `k3`, or a date-based tag like `2025-04`).

```bash
# Before rotation
JWT_SECRET=<current-key>  # gitleaks:allow
JWT_KEY_ID=k1             # gitleaks:allow

# After rotation
JWT_SECRET=<new-key>              # gitleaks:allow
JWT_SECRET_PREVIOUS=<current-key> # gitleaks:allow
JWT_KEY_ID=k2                     # gitleaks:allow
```

### 3. Deploy the application

Restart or redeploy the application. The service will:

- Sign all **new** tokens with `JWT_SECRET` (current key)
- **Verify** tokens using `JWT_SECRET` first, then fall back to
  `JWT_SECRET_PREVIOUS` if the current key fails
- Include `JWT_KEY_ID` in the `kid` header of every new token

### 4. Wait for old tokens to expire

The default token lifetime is 24 hours (`TOKEN_EXPIRY_HOURS`).
After one full token lifetime has elapsed, all tokens signed with
the old key will have expired naturally.

### 5. Remove the previous key

Once the rotation window has passed (at least `TOKEN_EXPIRY_HOURS`
after deployment), you can safely remove `JWT_SECRET_PREVIOUS`:

```bash
JWT_SECRET=<new-key>    # gitleaks:allow
JWT_SECRET_PREVIOUS=    # gitleaks:allow
JWT_KEY_ID=k2           # gitleaks:allow
```

Redeploy to apply.

## Verification

After rotation, verify that:

1. New logins produce tokens with the updated `kid` header
2. Existing sessions (tokens signed with the old key) continue to
   work until they expire
3. The audit log records which key was used for verification
   (look for "Token verified with previous key" log entries)

```bash
# Decode a token header to check the kid
python -c "
import jwt
token = '<paste-token-here>'
header = jwt.get_unverified_header(token)
print(f\"kid: {header.get('kid')}\")"
```

## Emergency Revocation

To immediately invalidate **all** existing tokens (e.g. in case of
key compromise):

1. Set `JWT_SECRET` to a completely new value
2. Clear `JWT_SECRET_PREVIOUS` (do NOT set the old key here)
3. Update `JWT_KEY_ID` to a new identifier
4. Redeploy

All existing tokens will fail verification and users will need to
re-authenticate.

## Audit Trail

The authentication service logs key rotation events:

- `"Token verified with previous key (kid rotation in progress)"`
  indicates that a token was verified using the fallback key
- Login audit entries include the `kid` of the issued token
- Failed verification attempts are logged with context about which
  keys were tried
