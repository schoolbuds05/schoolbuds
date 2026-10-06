1st: Laravel backend

cd C:\xampp\htdocs\school-system
composer install
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve --host=0.0.0.0 --port=8000

Before opening Expo Go, check your PC LAN IP:

ipconfig

Then make sure this file uses that same IP:

C:\xampp\htdocs\school-system\school-app\src\api.js

Example:

baseURL: 'http://192.168.16.215:8000/api'

2nd: Expo app

cd C:\xampp\htdocs\school-systems\school-app
npm install
npm install babel-preset-expo --save-dev
npx expo start --clear

Notes:

- Your phone and PC must be connected to the same Wi-Fi/network.
- Do not use localhost in the Expo app API URL because localhost means the phone itself, not your PC.
- If your PC IP changes, update school-app\src\api.js with the new IP.