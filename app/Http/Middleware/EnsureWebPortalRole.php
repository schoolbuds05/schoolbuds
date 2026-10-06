<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureWebPortalRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user && (
            in_array($user->role, $roles, true)
            || in_array($user->position, $roles, true)
            || $user->hasAnyRole($roles)
        )) {
            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->withErrors([
            'email' => 'Only admin, registrar, teacher, and property custodian accounts can sign in to the web portal.',
        ]);
    }
}
