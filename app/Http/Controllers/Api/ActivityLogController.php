<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $search = trim((string) $request->query('search', ''));
        $action = trim((string) $request->query('action', ''));

        $logs = ActivityLog::query()
            ->when($action !== '', fn ($query) => $query->where('action', $action))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('actor_name', 'like', "%{$search}%")
                        ->orWhere('actor_email', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('action', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'logs' => $logs,
            'actions' => ActivityLog::query()
                ->select('action')
                ->distinct()
                ->orderBy('action')
                ->pluck('action')
                ->values(),
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();

        if (!$user || ($user->role !== 'admin' && !$user->hasRole('admin'))) {
            abort(response()->json(['message' => 'Admin access is required.'], 403));
        }
    }
}
