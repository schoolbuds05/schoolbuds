<x-guest-layout>
    <div class="login-heading">
        <h2>Welcome back</h2>
        <p>Sign in with your school account.</p>
    </div>

    <x-auth-session-status class="login-status" :status="session('status')" />

    <form method="POST" action="{{ route('login') }}">
        @csrf

        <div class="login-field">
            <x-input-label for="email" :value="__('Email')" />
            <x-text-input id="email" class="block mt-1 w-full" type="email" name="email" :value="old('email')" placeholder="name@school.edu.ph" required autofocus autocomplete="username" />
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <div class="login-field">
            <x-input-label for="password" :value="__('Password')" />
            <div class="login-password-wrap">
                <x-text-input id="password" class="block mt-1 w-full"
                                type="password"
                                name="password"
                                placeholder="Enter your password"
                                required autocomplete="current-password" />
                <button class="login-password-toggle" type="button" aria-label="Show password" aria-controls="password" aria-pressed="false" data-password-toggle>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
                        <circle cx="12" cy="12" r="2.5" />
                    </svg>
                </button>
            </div>
            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <div class="login-options">
            <label for="remember_me" class="login-remember">
                <input id="remember_me" type="checkbox" name="remember">
                <span>{{ __('Remember me') }}</span>
            </label>
            @if (Route::has('password.request'))
                <a href="{{ route('password.request') }}">Forgot password?</a>
            @endif
        </div>

        <button class="login-submit" type="submit">
            <span>{{ __('Sign in') }}</span>
            <span aria-hidden="true" class="login-submit-arrow">-&gt;</span>
        </button>

        <p class="login-register">New student? <a href="{{ route('register') }}">Create an account</a></p>
    </form>
</x-guest-layout>
