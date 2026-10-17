<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
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

        abort(Response::HTTP_FORBIDDEN);
    }
}
