# Apple Review Fixes

## Findings Summary

- Stack detected: React + Vite web app wrapped in Capacitor for iOS (`client/ios/App`).
- Auth providers detected:
  - Email/password against custom backend routes in `server/Routes/authRoutes.js`.
  - Google Sign-In via `@react-oauth/google` on the client and Google ID token verification on the server.
  - LinkedIn OAuth via backend redirect/callback flow.
  - Apple login backend route already existed on the server, but client-side Apple login UI/flow was missing.
- Google login implementation before fixes: web Google button inside the Capacitor app. This is likely what caused the iOS app to leave the app / open Safari-style auth behavior.
- Payments/subscriptions detected:
  - External digital subscription checkout via Razorpay in `client/src/app/pages/CheckoutPage.tsx`.
  - Pricing and upgrade CTAs throughout the app route users toward `/pricing` and `/checkout`.
  - No StoreKit or Apple In-App Purchase implementation was found in the codebase.

## Code Changes Made

### Auth and signup reliability

- Made LinkedIn profile optional during signup instead of required.
- Normalized email handling on the server to avoid case-sensitivity mismatches during login/signup/social account linking.
- Improved server status codes for auth validation failures (`400`/`401`/`409` instead of `404` for common auth errors).
- Ensured Google login links an existing local account to Google when the email already exists instead of failing silently.
- Returned a consistent `user` payload on successful signup.
- Allowed profile updates without forcing a LinkedIn URL.
- Removed `/login`, `/pricing`, and `/checkout` from hard route-auth redirects so review testers can reach those screens without being bounced unexpectedly.
- Expanded the login modal width slightly for better iPad presentation and added clearer client-side error reporting/logging.

### iOS auth review fixes

- Added Sign in with Apple client-side scaffolding in `client/src/utils/appleAuth.ts` and wired Apple login buttons into the login/signup modal.
- Added an iOS entitlement file for Sign in with Apple and wired it into the Xcode project config.
- Hid Google and LinkedIn social login inside the native iOS app build so those flows do not open external browser-based auth during App Review.
- Left email/password auth available in the iOS app.

### iOS purchase gating

- Kept existing subscriber access intact.
- Disabled purchase/upgrade actions for paid digital plans on iOS pricing UI.
- Kept checkout unavailable on iOS.
- Adjusted upgrade language in chat/profile/consult surfaces so iOS no longer actively exposes external purchase actions.

## Test Checklist

- Email signup without LinkedIn profile succeeds.
- Email signup with optional valid LinkedIn profile succeeds.
- Email login works with mixed-case email input.
- Forgot password request shows a clear success or failure message.
- Existing Google-linked account can still log in on web.
- iOS native build shows email/password auth and Apple button.
- iOS native build does not show Google or LinkedIn buttons.
- iOS native build pricing page does not allow checkout or plan purchase taps.
- Existing paid subscriber on iOS can use restore/sync and access paid features after login.
- iPad layout check:
  - Login modal is scrollable and fully usable in portrait.
  - Login modal is usable in landscape.
  - Pricing page banner and disabled CTAs render correctly.
- Fresh install check:
  - Unauthenticated user can open `/login`, `/pricing`, and `/checkout` without route-loop issues.
- Upgrade install check:
  - Existing local/session auth still hydrates and closes the login modal after successful auth.

## Manual Steps Not Possible From VS Code

### TODO: Apple Sign in portal setup

- Enable the `Sign in with Apple` capability for the app identifier in Apple Developer.
- Confirm the bundle identifier in Apple Developer matches `www.nritaxai.com`.
- If web-based Apple auth is used, create/configure the proper Services ID and redirect URL that match:
  - `VITE_APPLE_CLIENT_ID`
  - `VITE_APPLE_REDIRECT_URI`
  - server-side `APPLE_CLIENT_ID` / `APPLE_WEB_CLIENT_ID` / `APPLE_SERVICE_ID`
  - server-side `APPLE_REDIRECT_URI`
- Create the Apple private key / key ID / team ID configuration needed by the backend:
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY`
- Verify the Apple auth redirect is approved and reachable in production.

### TODO: App Store Connect / IAP setup

- Create the subscription products in App Store Connect.
- Implement and test StoreKit product loading and purchase flow for iOS.
- Submit the subscription products for review along with the app binary.
- Ensure any paid digital content available to existing subscribers is also purchasable via Apple In-App Purchase for iOS, or remove that access model before resubmission if policy requires it.

### TODO: Google Sign-In native replacement, if Google must remain on iOS

- If Google login is required in the iOS app, replace the hidden web flow with a native or ASWebAuthenticationSession-compatible implementation and complete the required Google iOS client setup.
- Configure any required reversed client ID / URL types / native Google app credentials in the iOS project and Google Cloud Console.
- Re-test sign-in fully inside the app on iPhone and iPad before re-enabling Google on iOS.

### TODO: Review account and submission setup

- Verify the App Review test account credentials are valid and not rate-limited or environment-specific.
- Confirm production API environment variables match the submitted iOS build.
- Add App Review notes describing:
  - Google and LinkedIn are intentionally hidden on iOS in this build.
  - Email/password and Sign in with Apple are the supported iOS login methods.
  - External digital purchase CTAs are disabled on iOS pending Apple IAP implementation.

## Suggested App Review Notes

Paste something close to this into App Store Connect:

> In this submission, external purchase actions for digital subscriptions have been disabled on iOS. Existing subscribers may still sign in and restore access, but new purchases are not offered in the iOS app until Apple In-App Purchase is completed.  
>  
> For login, the iOS app supports email/password and Sign in with Apple. Google and LinkedIn sign-in were intentionally removed from the iOS build to keep authentication in-app during review.  
>  
> We also fixed signup/login robustness issues, including optional LinkedIn profile handling and clearer auth validation behavior for iPad testing.

## Exact Files Changed

- `APPLE_REVIEW_FIXES.md`
- `client/ios/App/App/App.entitlements`
- `client/ios/App/App.xcodeproj/project.pbxproj`
- `client/src/app/App.tsx`
- `client/src/app/components/AIChat.tsx`
- `client/src/app/components/LoginModal.tsx`
- `client/src/app/pages/Chat.tsx`
- `client/src/app/pages/Consult.tsx`
- `client/src/app/pages/Pricing.tsx`
- `client/src/app/pages/Profile.tsx`
- `client/src/config/appConfig.ts`
- `client/src/utils/appleAuth.ts`
- `server/Controllers/authController.js`

## Notes

- The repo already contained unrelated local modifications outside this task. I did not revert them.
- `npm.cmd run build` completed successfully after running outside the sandbox because Vite/esbuild process spawning was blocked in the default sandbox.
