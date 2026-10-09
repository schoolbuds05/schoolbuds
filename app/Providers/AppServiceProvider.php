<?php

namespace App\Providers;

use App\Models\ActivityLog;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        foreach (['created', 'updated', 'deleted', 'restored'] as $modelEvent) {
            Event::listen("eloquent.{$modelEvent}: App\\Models\\*", function (string $eventName, array $models) use ($modelEvent): void {
                $model = $models[0] ?? null;

                if ($model instanceof Model) {
                    ActivityLog::recordModelChange($model, $modelEvent);
                }
            });
        }

        Event::listen(Login::class, function (Login $event): void {
            ActivityLog::record(request(), 'auth_login', 'User authenticated successfully.', [
                'user' => $event->user,
                'subject_type' => $event->user::class,
                'subject_id' => $event->user->getAuthIdentifier(),
                'meta' => ['guard' => $event->guard],
            ]);
        });

        Event::listen(Failed::class, function (Failed $event): void {
            $email = substr((string) ($event->credentials['email'] ?? 'unknown'), 0, 255);

            ActivityLog::record(request(), 'auth_login_failed', 'Failed web login attempt.', [
                'subject_type' => $event->user ? $event->user::class : null,
                'subject_id' => $event->user?->getKey(),
                'meta' => ['email' => $email, 'guard' => $event->guard],
            ]);
        });

        Event::listen(Lockout::class, function (Lockout $event): void {
            $email = substr((string) $event->request->input('email', 'unknown'), 0, 255);

            ActivityLog::record($event->request, 'auth_login_locked_out', 'Web login rate limit reached.', [
                'meta' => ['email' => $email],
            ]);
        });
    }
}
