<x-guest-layout>
    <div class="login-heading">
        <h2>Forgot password?</h2>
        <p>Enter your school email and we&apos;ll send you a secure link to reset your password.</p>
    </div>

    <x-auth-session-status class="login-status" :status="session('status')" />

    <form method="POST" action="{{ route('password.email') }}">
        @csrf

        <div class="login-field">
            <x-input-label for="email" :value="__('Email')" />
            <x-text-input id="email" class="block mt-1 w-full" type="email" name="email" :value="old('email')" placeholder="name@school.edu.ph" required autofocus autocomplete="username" />
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <button class="login-submit" type="submit">
            <span>{{ __('Send reset link') }}</span>
            <span aria-hidden="true" class="login-submit-arrow">-&gt;</span>
        </button>

        <p class="login-register">Remembered your password? <a href="{{ route('login') }}">Sign in</a></p>
    </form>
</x-guest-layout>
