# RevHub — Android project with one-click cloud APK build

This is a private, single-user Android app project. It packages the local web app in an Android WebView shell.

## Build an APK online (no Android Studio needed)

1. Create a **private** repository on GitHub named `RevHub`.
2. Upload the *contents* of this project folder to the repository root (the `.github` folder must also be uploaded).
3. Open the repository's **Actions** tab. If prompted, enable GitHub Actions.
4. Select **Build RevHub APK** in the left sidebar.
5. Press **Run workflow** and confirm.
6. Wait for the green check mark. Open the completed run and scroll to **Artifacts**.
7. Download `RevHub-debug-apk`. Extract it; inside is `app-debug.apk`.
8. Transfer `app-debug.apk` to your Android phone and install it. If Android prompts you, allow installation from the file manager/browser you used.

A push to the `main` branch also triggers a build automatically. The workflow builds a **debug APK** for personal testing; it is not a Play Store release. GitHub-hosted runner use is subject to GitHub account limits.

## Build locally

Open this folder in Android Studio with Android SDK Platform 35 installed, then build the `assembleDebug` Gradle task.

## Project notes

- Android application ID: `com.revisionhub.app`
- Display name: `RevHub`
- The app stores its working data locally; no account is required.
- OCR currently downloads Tesseract.js and English language data from a CDN, so OCR needs internet access. Core app use is local.
- The 6 AM–4 PM window and 90-minute cap are app-level foreground controls, not tamper-proof device restrictions.
- Test video import/playback, saved data, OCR and vibration on the target phone before relying on it.
