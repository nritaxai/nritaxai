# Android Keystore Instructions

## Generate The Keystore

Run this command from any terminal with Java installed:

```powershell
keytool -genkeypair -v -keystore "D:\secure-android-keys\nritaxai-release.jks" -alias nritaxai-release -keyalg RSA -keysize 2048 -validity 9125
```

Recommended path:

- Store the `.jks` file outside the project folder, for example `D:\secure-android-keys\nritaxai-release.jks`.
- Never keep the keystore inside `e:\nritax\nri\client`.

Fields to fill during generation:

- `alias`: `nritaxai-release`
- `validity`: `9125` days
- `first and last name`: your signing owner or team name
- `organizational unit`: team or department
- `organization`: company or legal entity
- `city or locality`: your city
- `state or province`: your state
- `two-letter country code`: your country code

## SHA-256 Fingerprint

Use this command to read the SHA-256 fingerprint later:

```powershell
keytool -list -v -keystore "D:\secure-android-keys\nritaxai-release.jks" -alias nritaxai-release
```

Look for the `SHA256:` value in the output.

## Git Safety

Warning:

- Never commit the keystore to Git.
- Never commit the keystore password, key password, or private signing details.

## Configure `key.properties`

Create `android/key.properties` with values like:

```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=nritaxai-release
storeFile=D:\\secure-android-keys\\nritaxai-release.jks
```

Example `build.gradle` wiring:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties["storeFile"])
                storePassword keystoreProperties["storePassword"]
                keyAlias keystoreProperties["keyAlias"]
                keyPassword keystoreProperties["keyPassword"]
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

## Android Studio Signed AAB

1. Open the Android project in Android Studio.
2. Go to `Build` -> `Generate Signed Bundle / APK`.
3. Choose `Android App Bundle`.
4. Select the keystore path outside the repo.
5. Enter the keystore passwords and alias.
6. Choose the `release` variant.
7. Build the signed `.aab` for Play Store upload.
