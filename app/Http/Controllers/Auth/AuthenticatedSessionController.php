<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): View
    {
        return view('auth.login');
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $user = $request->user();
        $isPropertyCustodian = (
            $user->role === User::ROLE_STAFF
            && $user->position === User::POSITION_PROPERTY_CUSTODIAN
        ) || $user->role === User::POSITION_PROPERTY_CUSTODIAN;
        $isAllowedWebUser = in_array($user->role, [
            User::ROLE_ADMIN,
            User::ROLE_REGISTRAR,
            User::ROLE_FACULTY,
        ], true) || in_array($user->position, User::POSITIONS[User::ROLE_FACULTY], true) || $isPropertyCustodian;

        if (!$isAllowedWebUser) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => 'Only admin, registrar, teacher, and property custodian accounts can sign in to the web portal.',
            ]);
        }

        $route = match (true) {
            $user->role === User::ROLE_ADMIN => route('admin.dashboard'),
            $user->role === User::ROLE_REGISTRAR => route('registrar.dashboard'),
            $user->role === User::ROLE_FACULTY || in_array($user->position, User::POSITIONS[User::ROLE_FACULTY], true) => route('teacher.dashboard'),
            $isPropertyCustodian => route('property-custodian.dashboard'),
        };

        return redirect($route);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user) {
            ActivityLog::record($request, 'logout', "{$user->name} logged out from the web portal.", [
                'user' => $user,
                'subject_type' => User::class,
                'subject_id' => $user->id,
                'meta' => ['portal' => 'web'],
            ]);
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
