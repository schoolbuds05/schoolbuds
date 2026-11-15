<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Mail;

class PasswordChangeNotifier
{
    public static function send(User $user, ?User $changedBy = null, ?string $recipient = null): void
    {
        $recipient ??= $user->email;
        if (!$recipient) {
            return;
        }

        $changedByText = $changedBy && $changedBy->isNot($user)
            ? "An administrator ({$changedBy->name}) changed your password."
            : 'Your password was changed from your account.';
        $when = now()->timezone(config('app.timezone'))->format('F j, Y \\a\\t g:i A T');
        $body = "SchoolBuds\nSt. Cecilia's College Cebu, Inc.\n\n"
            . "This is a security notice that the password for your account was changed.\n\n"
            . "{$changedByText}\n"
            . "Time: {$when}\n\n"
            . "If you did not expect this change, contact the school administrator immediately.";

        try {
            Mail::raw($body, function ($message) use ($recipient) {
                $message->to($recipient)
                    ->from(config('mail.from.address'), "SchoolBuds | St. Cecilia's College Cebu, Inc.")
                    ->subject('SchoolBuds | Password changed');
            });
        } catch (\Throwable $e) {
            logger()->error('Password change notification email failed.', [
                'user_id' => $user->id,
                'exception' => $e->getMessage(),
            ]);
        }
    }
}
