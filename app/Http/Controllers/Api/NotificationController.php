<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use App\Models\SchoolNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private const CATEGORIES = [
        'grades',
        'assignments',
        'enrollment',
        'marketplace',
        'points',
        'attendance',
        'low_grade',
        'general',
    ];

    public function index(Request $request)
    {
        $notifications = SchoolNotification::query()
            ->where(function ($query) use ($request) {
                $query->where('user_id', $request->user()->id)
                    ->orWhereNull('user_id');
            })
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'unread_count' => $notifications->whereNull('read_at')->count(),
            'notifications' => $notifications->values(),
        ]);
    }

    public function preferences(Request $request)
    {
        return response()->json([
            'categories' => self::CATEGORIES,
            'preferences' => $this->preferencesFor($request->user()->id),
        ]);
    }

    public function updatePreferences(Request $request)
    {
        $data = $request->validate([
            'preferences' => ['required', 'array'],
            'preferences.*.category' => ['required', 'string', 'in:' . implode(',', self::CATEGORIES)],
            'preferences.*.in_app' => ['nullable', 'boolean'],
            'preferences.*.email' => ['nullable', 'boolean'],
            'preferences.*.push' => ['nullable', 'boolean'],
        ]);

        foreach ($data['preferences'] as $preference) {
            NotificationPreference::updateOrCreate(
                [
                    'user_id' => $request->user()->id,
                    'category' => $preference['category'],
                ],
                [
                    'in_app' => $preference['in_app'] ?? true,
                    'email' => $preference['email'] ?? true,
                    'push' => $preference['push'] ?? true,
                ]
            );
        }

        return response()->json([
            'message' => 'Notification preferences updated.',
            'preferences' => $this->preferencesFor($request->user()->id),
        ]);
    }

    public function markRead(Request $request, SchoolNotification $notification)
    {
        if ($notification->user_id !== null && $notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $notification->update(['read_at' => now()]);

        return response()->json($notification);
    }

    public function markAllRead(Request $request)
    {
        SchoolNotification::query()
            ->where(function ($query) use ($request) {
                $query->where('user_id', $request->user()->id)
                    ->orWhereNull('user_id');
            })
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'Notifications marked as read.']);
    }

    private function preferencesFor(int $userId): array
    {
        $stored = NotificationPreference::where('user_id', $userId)
            ->get()
            ->keyBy('category');

        return collect(self::CATEGORIES)
            ->map(fn ($category) => [
                'category' => $category,
                'in_app' => $stored[$category]->in_app ?? true,
                'email' => $stored[$category]->email ?? true,
                'push' => $stored[$category]->push ?? true,
            ])
            ->values()
            ->all();
    }
}
