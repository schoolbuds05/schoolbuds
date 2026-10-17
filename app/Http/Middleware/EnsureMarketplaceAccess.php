<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureMarketplaceAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ($user->role === 'admin' || $user->hasRole('admin'))) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Marketplace access is not available to administrators.'], 403);
            }

            abort(403, 'Marketplace access is not available to administrators.');
        }

        return $next($request);
    }
}
