<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rules;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $firstName = trim($request->first_name);
        $middleName = trim((string) $request->middle_name) ?: null;
        $lastName = trim($request->last_name);
        $name = collect([$firstName, $middleName, $lastName])
            ->filter()
            ->implode(' ');

        $user = User::create([
            'name' => $name,
            'first_name' => $firstName,
            'middle_name' => $middleName,
            'last_name' => $lastName,
            'email' => strtolower(trim($request->email)),
            'password' => Hash::make($request->password),
            'role' => User::ROLE_STUDENT,
        ]);

        Role::findOrCreate(User::ROLE_STUDENT, 'web');
        $user->assignRole(User::ROLE_STUDENT);

        $token = $user->createToken('school-app')->plainTextToken;

        ActivityLog::record($request, 'register', "{$user->name} registered a student account.", [
            'user' => $user,
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'meta' => ['role' => User::ROLE_STUDENT],
        ]);

        return response()->json([
            'message' => 'Account created successfully.',
            'token' => $token,
            'role' => User::ROLE_STUDENT,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'first_name' => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => User::ROLE_STUDENT,
                'position' => $user->position,
                'profile_photo_url' => $user->profile_photo_url,
            ],
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        [$role, $position] = $this->normalizedRoleAndPosition($user);

        if ($user->role !== $role || $user->position !== $position) {
            $user->forceFill([
                'role' => $role,
                'position' => $position,
            ])->save();
        }

        $token = $user->createToken('school-app')->plainTextToken;

        Role::findOrCreate($role, 'web');
        $user->syncRoles([$role]);

        ActivityLog::record($request, 'login', "{$user->name} logged in.", [
            'user' => $user,
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'meta' => ['role' => $role, 'position' => $position],
        ]);

        return response()->json([
            'token' => $token,
            'role'  => $role,
            'user'  => [
                'id'    => $user->id,
                'name'  => $user->name,
                'first_name' => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role'  => $role,
                'position' => $position,
                'department' => $user->department,
                'profile_photo_url' => $user->profile_photo_url,
            ],
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();
        if (! $user) {
            return response()->json(['message' => 'Email not found.'], 422);
        }

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('password_resets')->where('email', $request->email)->delete();
        DB::table('password_resets')->insert([
            'email' => $request->email,
            'token' => Hash::make($otp),
            'created_at' => Carbon::now(),
        ]);

        try {
            Mail::raw("Your School System OTP is: {$otp}\n\nEnter this code in the app to reset your password. It expires in 60 minutes.", function ($message) use ($request) {
                $message->to($request->email)
                    ->subject('School System Password Reset OTP');
            });
        } catch (\Throwable $e) {
            logger()->error('OTP email send failed: ' . $e->getMessage());

            if (app()->environment('local')) {
                \Log::info('OTP for ' . $request->email . ': ' . $otp);
                return response()->json([
                    'message' => 'OTP generated, but email sending failed in local environment.',
                ]);
            }

            return response()->json(['message' => 'Unable to send OTP email. Please try again later.'], 500);
        }

        $responsePayload = ['message' => 'OTP sent to your email.'];
        if (app()->environment('local') && config('mail.default') === 'log') {
            \Log::info('OTP for ' . $request->email . ': ' . $otp);
            $responsePayload['note'] = 'Local dev: email is logged instead of delivered.';
        }

        return response()->json($responsePayload);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'otp' => 'required|string',
            'email' => 'required|email',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $reset = DB::table('password_resets')
            ->where('email', $request->email)
            ->first();

        if (! $reset || ! Hash::check($request->otp, $reset->token)) {
            return response()->json(['message' => 'Invalid OTP.'], 422);
        }

        if (Carbon::parse($reset->created_at)->addMinutes(60)->isPast()) {
            DB::table('password_resets')->where('email', $request->email)->delete();
            return response()->json(['message' => 'OTP has expired. Please request a new one.'], 422);
        }

        $user = User::where('email', $request->email)->first();
        if (! $user) {
            return response()->json(['message' => 'Email not found.'], 422);
        }

        $user->forceFill([
            'password' => Hash::make($request->password),
            'remember_token' => Str::random(60),
        ])->save();

        DB::table('password_resets')->where('email', $request->email)->delete();

        return response()->json(['message' => 'Password has been reset.']);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        ActivityLog::record($request, 'logout', "{$user?->name} logged out.", [
            'user' => $user,
            'subject_type' => User::class,
            'subject_id' => $user?->id,
        ]);

        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user'  => $request->user(),
            'roles' => $request->user()->getRoleNames(),
        ]);
    }

    public function updateProfilePhoto(Request $request)
    {
        $request->validate([
            'profile_photo' => ['required', 'image', 'max:4096'],
        ]);

        $user = $request->user();

        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
        }

        $path = $request->file('profile_photo')->store('profile-photos', 'public');

        $user->forceFill([
            'profile_photo_path' => $path,
        ])->save();

        ActivityLog::record($request, 'profile_photo_updated', "{$user->name} updated their profile photo.", [
            'user' => $user,
            'subject_type' => User::class,
            'subject_id' => $user->id,
        ]);

        return response()->json([
            'message' => 'Profile photo updated.',
            'user' => $user->fresh(),
        ]);
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->forceFill([
            'password' => Hash::make($request->password),
            'remember_token' => Str::random(60),
        ])->save();

        ActivityLog::record($request, 'password_updated', "{$user->name} changed their password.", [
            'user' => $user,
            'subject_type' => User::class,
            'subject_id' => $user->id,
        ]);

        return response()->json(['message' => 'Password updated.']);
    }

    private function normalizedRoleAndPosition(User $user): array
    {
        $role = $user->role ?: ($user->getRoleNames()->first() ?? User::ROLE_STUDENT);
        $position = $user->position;

        return match ($role) {
            User::ROLE_FACULTY => [User::ROLE_FACULTY, $position ?: User::POSITION_TEACHER],
            User::ROLE_STAFF => [User::ROLE_STAFF, $position],
            User::ROLE_TEACHER => [User::ROLE_FACULTY, User::POSITION_TEACHER],
            User::ROLE_HEAD_TEACHER => [User::ROLE_FACULTY, User::POSITION_HEAD_TEACHER],
            User::ROLE_DEAN => [User::ROLE_FACULTY, User::POSITION_DEAN],
            User::POSITION_LIBRARIAN => [User::ROLE_STAFF, User::POSITION_LIBRARIAN],
            User::POSITION_PROPERTY_CUSTODIAN => [User::ROLE_STAFF, User::POSITION_PROPERTY_CUSTODIAN],
            default => [$role, $position],
        };
    }
}
