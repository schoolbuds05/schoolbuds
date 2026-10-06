<x-guest-layout>
    <!-- Session Status -->
    <div class="login-heading">
        <p class="login-eyebrow">Welcome back</p>
        <h2>Sign in to SchoolBuds</h2>
        <p>Use your school account to continue to your campus workspace.</p>
    </div>

    <x-auth-session-status class="login-status" :status="session('status')" />

    <form method="POST" action="{{ route('login') }}">
        @csrf

        <!-- Email Address -->
        <div class="login-field">
            <x-input-label for="email" :value="__('Email')" />
            <x-text-input id="email" class="block mt-1 w-full" type="email" name="email" :value="old('email')" required autofocus autocomplete="username" />
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <!-- Password -->
        <div class="login-field">
            <x-input-label for="password" :value="__('Password')" />

            <x-text-input id="password" class="block mt-1 w-full"
                            type="password"
                            name="password"
                            required autocomplete="current-password" />

            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <!-- Remember Me -->
        <div class="login-options">
            <label for="remember_me" class="login-remember">
                <input id="remember_me" type="checkbox" class="rounded border-slate-300 text-teal-700 shadow-sm focus:ring-teal-500" name="remember">
                <span>{{ __('Remember me') }}</span>
            </label>
        </div>

        <button class="login-submit" type="submit">
            <span>{{ __('Log in') }}</span>
            <span aria-hidden="true" class="login-submit-arrow">-&gt;</span>
        </button>

        <div class="login-links">
            <a href="{{ route('register') }}">Create a student account</a>
            @if (Route::has('password.request'))
                <a href="{{ route('password.request') }}">
                    {{ __('Forgot your password?') }}
                </a>
            @endif
        </div>
    </form>
</x-guest-layout>
