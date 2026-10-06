<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>SchoolBuds | St. Cecilia College Cebu</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=dm-sans:400,500,600,700|manrope:600,700,800&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="guest-page font-sans text-slate-900 antialiased">
        <main class="guest-shell">
            <section class="guest-brand-panel">
                <div class="guest-brand-glow guest-brand-glow-one"></div>
                <div class="guest-brand-glow guest-brand-glow-two"></div>
                <div class="guest-brand-content">
                    <a href="/" class="guest-logo-link">
                        <span class="guest-logo-mark"><img src="{{ asset('images/schoolbuds-logo.png') }}" alt="SchoolBuds logo" /></span>
                        <span>
                            <span class="guest-wordmark">SchoolBuds</span>
                            <span class="guest-school">St. Cecilia College Cebu</span>
                        </span>
                    </a>
                    <div class="guest-brand-copy">
                        <p class="guest-kicker">Campus life, in one place</p>
                        <h1>Make school feel a little more connected.</h1>
                        <p>One calm space for learning, enrollment, grades, attendance, and the people who keep campus moving.</p>
                    </div>
                    <div class="guest-brand-footer">
                        <span class="guest-footer-dot"></span>
                        <span>Student and staff portal</span>
                    </div>
                </div>
            </section>

            <section class="guest-form-panel">
                <div class="guest-form-wrap">
                    {{ $slot }}
                </div>
                <p class="guest-legal">St. Cecilia College Cebu <span>/</span> SchoolBuds portal</p>
            </section>
        </main>
    </body>
</html>
