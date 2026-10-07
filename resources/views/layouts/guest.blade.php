<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>SchoolBuds | St. Cecilia College Cebu</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=dm-sans:400,500,600,700|manrope:600,700,800&display=swap" rel="stylesheet" />
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="guest-page antialiased">
        <main class="guest-shell">
            <section class="guest-brand-panel" aria-label="SchoolBuds">
                <div class="guest-school-header">
                    <img src="{{ asset('images/st-cecilia-college-seal.png') }}" alt="St. Cecilia's College seal" />
                    <span>St. Cecilia's College<br />Cebu, Inc.</span>
                </div>

                <div class="guest-brand-main">
                    <span class="guest-logo-mark">
                        <img src="{{ asset('images/schoolbuds-login-logo.png') }}" alt="" />
                    </span>
                    <h1>
                        SchoolBuds
                        <svg class="guest-bud-mark" width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
                            <path d="M16 28V15" fill="none" stroke="#187a45" stroke-linecap="round" stroke-width="2.4" />
                            <path d="M15.5 19C7.8 18.6 4.7 12.5 6.5 5.2c7.5-.3 12.2 4.2 11.7 10.4" fill="#187a45" />
                            <path d="M16 15C15.3 7.5 20 3.3 27.5 3c2.2 7.1-1.4 12.5-10.4 14.6" fill="#35a852" />
                            <path d="M9 8.2c3.8 1.4 5.8 4.3 6.7 8.2M24.4 6.1c-3.3 2-5.6 4.7-7 8.1" fill="none" stroke="#b9e4c0" stroke-linecap="round" stroke-width="1.1" />
                        </svg>
                    </h1>
                    <p class="guest-brand-tagline">All Things School. One Bud Away.</p>
                    <p class="guest-brand-description">Enrollment, grades, attendance and more for students, parents, faculty and staff.</p>
                </div>

                <div class="guest-brand-chart" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
                <div class="guest-brand-stripe" aria-hidden="true"><span></span><span></span></div>
            </section>

            <section class="guest-form-panel">
                <div class="guest-form-card">
                    <div class="guest-form-wrap">
                        {{ $slot }}
                    </div>
                    <p class="guest-legal">Accounts are issued by your school.</p>
                </div>
            </section>
        </main>
    </body>
</html>
