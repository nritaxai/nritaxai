# Backend Guide

## Endpoint contract

The iOS wrapper posts native Apple credentials to:

`POST https://nritax.ai/api/auth/apple`

Recommended JSON body:

```json
{
  "identityToken": "<apple-jwt>",
  "authorizationCode": "<apple-auth-code>",
  "email": "user@example.com",
  "fullName": "First Last"
}
```

The current mobile client also sends:

```json
{
  "name": "First Last",
  "user": {
    "name": {
      "firstName": "First",
      "lastName": "Last"
    }
  }
}
```

That extra data helps when Apple only returns the email and full name once.

## Verification flow

1. Read `identityToken` and `authorizationCode` from the request body.
2. If `identityToken` is missing but `authorizationCode` is present, exchange the code with Apple at `https://appleid.apple.com/auth/token`.
3. Decode the JWT header and payload from `identityToken`.
4. Fetch Apple's public keys from `https://appleid.apple.com/auth/keys`.
5. Match the JWT `kid` to the correct Apple JWK.
6. Verify the JWT signature with `RS256`.
7. Validate:
   - `iss === "https://appleid.apple.com"`
   - `aud` matches one of your configured Apple client IDs
   - `exp` is in the future
   - `sub` exists
8. Find or create the user using `email` first, then Apple `sub`.
9. Return your own app session token plus a safe user payload.

The existing implementation in [authController.js](/Users/loganathananandan/Downloads/nritax/nri/server/Controllers/authController.js:575) already does this and now accepts `fullName` as either a string or an object.

## Apple code exchange

When you exchange `authorizationCode`, send:

```text
grant_type=authorization_code
code=<authorizationCode>
client_id=<your-apple-client-id>
client_secret=<your-generated-es256-client-secret>
redirect_uri=<optional-if-your-setup-requires-it>
```

Your ES256 client secret must be signed with:

- `iss`: Apple Team ID
- `sub`: Apple client ID / Service ID
- `aud`: `https://appleid.apple.com`
- header `kid`: Apple Key ID

## Recommended success response

Return JSON that the iOS app can inject directly into web storage:

```json
{
  "success": true,
  "message": "Apple login successful",
  "token": "<your-app-session-token>",
  "user": {
    "_id": "mongodb-user-id",
    "name": "First Last",
    "email": "user@example.com",
    "provider": "apple",
    "profileImage": null
  }
}
```

## WebView session handoff

After the backend responds, the iOS app writes:

```js
localStorage.setItem("token", token);
localStorage.setItem("user", JSON.stringify(user));
sessionStorage.setItem("auth_popup", "WELCOME First Last!");
window.dispatchEvent(new Event("storage"));
window.dispatchEvent(new Event("auth-changed"));
```

This matches the existing website auth model in:

- [api.ts](/Users/loganathananandan/Downloads/nritax/nri/client/src/utils/api.ts:5)
- [LoginModal.tsx](/Users/loganathananandan/Downloads/nritax/nri/client/src/app/components/LoginModal.tsx:98)

## Required server env vars

Set these on the backend:

- `APPLE_CLIENT_ID`
- `APPLE_WEB_CLIENT_ID` or `APPLE_SERVICE_ID`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_REDIRECT_URI` if your code exchange requires it
- `JWT_SECRET`

## Failure responses

Use clear 4xx/5xx JSON messages so the native app can show them directly:

```json
{
  "success": false,
  "message": "Apple authentication failed",
  "error": "Invalid Apple token audience"
}
```

Good error text matters because the iOS client surfaces it to App Review for:

- cancellation
- missing tokens
- invalid JWT
- revoked credentials
- server-side exchange failures
