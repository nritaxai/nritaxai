# Google Play Store Checklist

## Required Graphic Assets

- App icon: `512 x 512` PNG, 32-bit, no transparency in the final Play listing icon.
- Feature graphic: `1024 x 500` JPG or 24-bit PNG, no alpha.
- Phone screenshots: minimum 2, maximum 8, JPEG or 24-bit PNG, each side between `320 px` and `3840 px`, 16:9 or 9:16 recommended.
- 7-inch tablet screenshots: recommended if tablet support is claimed.
- 10-inch tablet screenshots: recommended if tablet support is claimed.
- Promotional video: optional YouTube URL.

## Store Listing Copy

- App name: up to `30` characters.
- Short description: up to `80` characters.
- Full description: up to `4000` characters.
- Privacy policy URL: public HTTPS URL, no login required.
- Contact email: required.
- Contact website: optional but recommended.
- Contact phone: optional.

## Release Readiness

- Confirm `versionCode` is incremented in `android/app/build.gradle` before every upload.
- Build a signed `.aab`, not a debug APK, for Play Store release.
- Verify the privacy policy route is publicly reachable.
- Confirm the package id is final before first production release.
- Test login, payments, navigation, and any deep links on a physical Android device.

## Policy And Console Tasks

- Complete the Data safety form in Play Console.
- Declare whether the app collects personal info, financial info, diagnostics, and device identifiers.
- Fill out the app access section if reviewers need a demo account.
- Complete the ads declaration.
- Complete the content rating questionnaire.
- Set the target audience and news/government declarations only if relevant.
- Confirm whether the app uses sensitive permissions or background behavior.

## Pre-Launch QA

- Validate startup performance and splash screen behavior on slow devices.
- Check that the public privacy policy page loads without authentication.
- Verify offline handling when the device loses connectivity.
- Confirm Play Store screenshots match the current app UI.
- Review crash logs and Android vitals after internal testing.
