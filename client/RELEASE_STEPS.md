## Every Play Store Release — Run in This Order
1. Increment versionCode in android/app/build.gradle
2. Update versionName if user-visible version changes
3. Run: npm run android:build
4. Open Android Studio: npm run android:open
5. Build -> Generate Signed Bundle -> Android App Bundle
6. Select C:\Keys\nritaxai-release.jks
7. Enter alias: nritaxai-key
8. Select release build variant
9. Output: android/app/release/app-release.aab
10. Upload .aab to Play Console -> Production or Testing track

## Keystore Backup Reminder
- Location: C:\Keys\nritaxai-release.jks
- Back up to: encrypted USB + cloud storage
- SHA256: AD:70:7E:48:6A:6D:3A:81:9D:19:45:6B:E9:50:C8:4F:
           75:25:A6:D9:6A:24:8F:03:40:D8:5A:EF:50:98:90:26
- Loss of this file = cannot update app on Play Store

## Dev vs Prod Config Switch (PowerShell)
# Switch to dev (local live reload):
Copy-Item capacitor.config.dev.ts capacitor.config.ts -Force
npm run android:sync

# Switch back to prod before any release:
Copy-Item capacitor.config.prod.ts capacitor.config.ts -Force
npm run android:sync
