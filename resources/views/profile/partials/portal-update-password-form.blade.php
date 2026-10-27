<details class="group rounded-2xl border border-portal-border bg-portal-card shadow-sm" {{ $errors->updatePassword->any() || session('status') === 'password-updated' ? 'open' : '' }}>
    <summary class="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
        <span>
            <span class="block text-base font-black text-slate-900">Change password</span>
            <span class="mt-1 block text-sm text-slate-500">Update your account password securely.</span>
        </span>
        <svg class="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" /></svg>
    </summary>

    <form method="POST" action="{{ route('password.update') }}" class="space-y-4 border-t border-portal-border px-6 pb-6 pt-5">
        @csrf
        @method('PUT')

        <div>
            <label for="portal_current_password" class="block text-sm font-bold text-slate-700">Current password</label>
            <input id="portal_current_password" name="current_password" type="password" autocomplete="current-password" required class="mt-1 w-full rounded-xl border border-portal-border bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent">
            @error('current_password', 'updatePassword')<p class="mt-1 text-sm font-semibold text-red-700" role="alert">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="portal_new_password" class="block text-sm font-bold text-slate-700">New password</label>
            <input id="portal_new_password" name="password" type="password" autocomplete="new-password" required class="mt-1 w-full rounded-xl border border-portal-border bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent">
            @error('password', 'updatePassword')<p class="mt-1 text-sm font-semibold text-red-700" role="alert">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="portal_password_confirmation" class="block text-sm font-bold text-slate-700">Confirm new password</label>
            <input id="portal_password_confirmation" name="password_confirmation" type="password" autocomplete="new-password" required class="mt-1 w-full rounded-xl border border-portal-border bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-portal-accent focus:outline-none focus:ring-2 focus:ring-portal-accent">
            @error('password_confirmation', 'updatePassword')<p class="mt-1 text-sm font-semibold text-red-700" role="alert">{{ $message }}</p>@enderror
        </div>

        <button type="submit" class="w-full rounded-xl bg-portal-accent px-4 py-3 text-sm font-bold text-white transition hover:brightness-95">Update password</button>
        @if(session('status') === 'password-updated')
            <p class="text-sm font-semibold text-emerald-700" role="status">Your password has been updated.</p>
        @endif
    </form>
</details>
