<?php

namespace Tests\Unit;

use App\Http\Middleware\EnsureMarketplaceAccess;
use App\Models\User;
use Illuminate\Http\Request;
use Tests\TestCase;

class EnsureMarketplaceAccessTest extends TestCase
{
    public function test_administrators_are_denied_marketplace_access(): void
    {
        $request = Request::create('/api/marketplace', 'GET', server: ['HTTP_ACCEPT' => 'application/json']);
        $request->setUserResolver(fn () => new User(['role' => 'admin']));

        $response = (new EnsureMarketplaceAccess())->handle($request, fn () => response()->noContent());

        $this->assertSame(403, $response->getStatusCode());
    }
}
