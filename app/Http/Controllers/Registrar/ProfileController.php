<?php

namespace App\Http\Controllers\Registrar;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    use AuthorizesPortal;

    public function show(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        return view('registrar.profile.show', ['user' => $request->user()]);
    }

    public function updatePhoto(Request $request): RedirectResponse
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);

        $request->validate([
            'profile_photo' => ['required', 'image', 'max:4096'],
        ]);

        $user = $request->user();
        $oldPath = $user->profile_photo_path;
        $path = $request->file('profile_photo')->store('profile-photos', 'public');

        if (!$path) {
            return back()->withErrors(['profile_photo' => 'The profile photo could not be saved.']);
        }

        $user->forceFill(['profile_photo_path' => $path])->save();

        if ($oldPath) {
            Storage::disk('public')->delete($oldPath);
        }

        ActivityLog::record($request, 'profile_photo_updated', "{$user->name} updated their profile photo.", [
            'user' => $user,
            'subject_type' => $user::class,
            'subject_id' => $user->id,
        ]);

        return back()->with('status', 'Profile photo updated.');
    }
}
