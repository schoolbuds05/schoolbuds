# SchoolBuds mobile app

## Local development

1. Start Laravel from the project root:

   ```powershell
   php artisan serve --host=0.0.0.0 --port=8000
   ```

2. Set `EXPO_PUBLIC_API_URL` in `.env.local` to your computer's LAN IP, for example `http://192.168.1.22:8000`. Do not add `/api`; `src/api.js` appends it automatically.
3. Connect the phone and computer to the same network, then start Expo:

   ```powershell
   npx expo start --clear
   ```

## Android builds

Both EAS profiles in `eas.json` use `https://scc.schoolbuds.online` as the API base URL. The app calls `https://scc.schoolbuds.online/api/...`.

Build an installable APK for internal distribution:

```powershell
eas build --platform android --profile preview
```

Build the production Android App Bundle:

```powershell
eas build --platform android --profile production
```

The domain must have valid DNS and HTTPS and route to this Laravel installation for the API to work.
