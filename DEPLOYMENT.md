# First deployment: Laravel Cloud + Android

This repository contains two deployable applications:

- The Laravel web portal and API at the repository root.
- The Expo Android application in `school-app`.

## 1. Prepare source control

Laravel Cloud deploys from a Git repository. Create a private GitHub repository, then push this project. Do not commit either `.env` file. The existing `.gitignore` files exclude them.

## 2. Deploy Laravel

1. Create a Laravel Cloud account and create an application from the repository.
2. Add a production environment and attach a managed MySQL database.
3. Set the environment variables below in Laravel Cloud. Generate a new `APP_KEY` with `php artisan key:generate --show`; never reuse the local value.
4. Use these deploy commands:

   ```sh
   php artisan migrate --force
   php artisan storage:link
   php artisan optimize
   ```

5. Deploy. Laravel Cloud will assign an HTTPS `*.laravel.cloud` address. Save the address **without** `/api`; it is the mobile app's API origin.

Required Laravel Cloud variables:

```dotenv
APP_NAME=SchoolBuds
APP_ENV=production
APP_KEY=base64:GENERATE_A_NEW_VALUE
APP_DEBUG=false
APP_URL=https://YOUR-APP.laravel.cloud
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=SET_BY_LARAVEL_CLOUD
DB_PORT=3306
DB_DATABASE=SET_BY_LARAVEL_CLOUD
DB_USERNAME=SET_BY_LARAVEL_CLOUD
DB_PASSWORD=SET_BY_LARAVEL_CLOUD

CACHE_STORE=database
SESSION_DRIVER=database
QUEUE_CONNECTION=database
FILESYSTEM_DISK=public
```

Also copy the real payment and mail values from your local configuration into Cloud's secret environment variables when those features are ready. In particular, set `PAYMONGO_SUCCESS_URL` and `PAYMONGO_CANCEL_URL` to the deployed `APP_URL` paths.

After deploying, open `https://YOUR-APP.laravel.cloud` and confirm `https://YOUR-APP.laravel.cloud/api/courses` responds. Configure the database and seed accounts before sharing the app.

## 3. Build a test APK

1. In `school-app`, copy `.env.example` to `.env.local` for local development. Set `EXPO_PUBLIC_API_URL` to the Laravel Cloud URL from step 2, with no trailing `/api`.
2. Create an Expo account, then run:

   ```sh
   npm install
   npx eas-cli@latest login
   npx eas-cli@latest build:configure
   npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://YOUR-APP.laravel.cloud --environment preview --visibility plaintext
   npx eas-cli@latest build --platform android --profile preview
   ```

3. When prompted, let EAS create and store the Android signing key. Download the resulting APK from the EAS build page and install it on your Android phone.

The `preview` profile produces an installable APK. Do not put passwords, PayMongo secret keys, or other private values in `EXPO_PUBLIC_*` variables; they are embedded in the app.

## 4. Publish to Google Play

1. Create a Google Play Console developer account and a new app.
2. Add the production API origin to EAS (or use the Expo dashboard's Environment Variables screen):

   ```sh
   npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://YOUR-APP.laravel.cloud --environment production --visibility plaintext
   ```
3. Build the Play Store bundle:

   ```sh
   npx eas-cli@latest build --platform android --profile production
   ```

4. Upload the generated `.aab` to Play Console's Internal testing track first. Test sign-in, images, payments, password reset, and every role before requesting production release.

The Android package identifier is `com.schoolbuds.app`. It is permanent once published; verify that the name represents your school or organization before the first Play Store upload.

## Custom domain later

When you buy a domain, attach it in Laravel Cloud, change `APP_URL`, update the PayMongo callback URLs, and create a new Android build with `EXPO_PUBLIC_API_URL` set to the new HTTPS origin. Existing installed Android builds will continue to call the old Cloud address until updated.
