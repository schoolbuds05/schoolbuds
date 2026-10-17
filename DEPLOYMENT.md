# Deploy SchoolBuds to Railway and build an Android APK

The repository root is the Laravel API/web app. The Expo Android app is in
`school-app`. Railway hosts Laravel and its database; EAS builds the APK.

## 1. Deploy Laravel to Railway

1. Push this repository to a private GitHub repository. Do not commit either
   `.env` file.
2. In Railway, create a project and deploy the GitHub repository as a service.
   Set the service root directory to `/` if Railway asks. It should detect the
   Laravel app and use its PHP web server.
3. Add a MySQL service to the same Railway project.
4. Add these variables to the Laravel service. For the database values, use
   Railway's **Add Reference** picker to reference the matching MySQL service
   variables; do not type placeholder credentials.

   ```dotenv
   APP_NAME=SchoolBuds
   APP_ENV=production
   APP_KEY=base64:GENERATE_A_UNIQUE_KEY
   APP_DEBUG=false
   APP_URL=https://api.schoolbuds.online
   LOG_CHANNEL=stderr
   LOG_LEVEL=warning

   DB_CONNECTION=mysql
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_DATABASE=${{MySQL.MYSQLDATABASE}}
   DB_USERNAME=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

   CACHE_STORE=database
   SESSION_DRIVER=database
   QUEUE_CONNECTION=database
   FILESYSTEM_DISK=public
   ```

   If your MySQL service has a different Railway name, select that service's
   variables in the reference picker. Generate a new application key locally
   with `php artisan key:generate --show`, then paste the output into Railway's
   `APP_KEY` variable. Never put a real production key in this file or Git.

5. The included `railway.json` builds the Laravel frontend assets, creates the
   public-storage symlink, runs database migrations before deploying, and
   checks Laravel's `/up` health endpoint. Review the Railway deployment logs
   and confirm the deployment is healthy.
6. In the Laravel service's **Settings → Networking**, generate a Railway
   domain first so you can test the service. Confirm that
   `https://YOUR-RAILWAY-DOMAIN/api/courses` responds.

## 2. Connect `schoolbuds.online`

1. In the Laravel service's Railway **Settings → Networking → Custom Domain**,
   add `api.schoolbuds.online`.
2. Railway will show the DNS record values it requires. In Namecheap, open
   **Domain List → Manage → Advanced DNS → Host Records**, and enter the exact
   record(s) Railway provides. Do not guess the CNAME target or TXT value.
3. Keep existing email DNS records. Wait until Railway verifies the domain and
   HTTPS certificate, then check `https://api.schoolbuds.online/up` and
   `https://api.schoolbuds.online/api/courses`.
4. Set `APP_URL=https://api.schoolbuds.online` in Railway. If you use
   EngineMailer, add its domain authentication records separately, exactly as
   its dashboard instructs.

Laravel trusts Railway's forwarding headers so generated links and Vite assets
use the original HTTPS scheme. Keep `APP_URL` set to the public HTTPS origin so
URLs generated outside an HTTP request also use HTTPS.

## 3. Keep uploaded files between deployments

This app stores profile photos, enrollment documents, and marketplace images
on Laravel's `public` storage disk. Railway's normal container filesystem is
ephemeral. Attach a Railway Volume to the Laravel service at:

```text
/app/storage/app/public
```

The mount path assumes Railway's Laravel app root is `/app`. Verify the
deployment's root directory in Railway before using that path. Files stored
before a volume is attached are not automatically moved onto it.

## 4. Build an installable APK

The mobile app must use a reachable HTTPS API origin, without `/api`.

1. In `school-app`, create `.env.local` from `.env.example` for local
   development only. Do not use the LAN IP for a release APK.
2. From a terminal in `school-app`, log in to Expo and set the preview
   environment variable to your deployed API URL:

   ```powershell
   npx eas-cli@latest login
   npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://api.schoolbuds.online --environment preview --visibility plaintext
   npx eas-cli@latest build --platform android --profile preview
   ```

3. Download the APK from the EAS build page and test sign-in, email flows,
   uploads, and the main features using mobile data or a different Wi-Fi
   network.

The production EAS profile produces an Android App Bundle (`.aab`) for Google
Play. Set `EXPO_PUBLIC_API_URL` in EAS's `production` environment before making
that build.

## Email and secrets

Laravel's mailer defaults to `log`, so email is not delivered until a mail
provider is configured. Add the provider's credentials only as Railway service
variables. Never put mail credentials, Laravel keys, or other secrets in the
APK or any `EXPO_PUBLIC_*` variable.

## One-month evaluation

Keep both the Railway app service and database active for the whole evaluation.
If you stop or delete them, the APK will no longer be able to log in or load
server data. Export a database backup before deleting the Railway project.
