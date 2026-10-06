<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RegistrarProfilePhotoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
            $table->string('position')->nullable();
            $table->string('profile_photo_path')->nullable();
            $table->timestamps();
        });

        Schema::create('activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('actor_name')->nullable();
            $table->string('actor_email')->nullable();
            $table->string('actor_role')->nullable();
            $table->string('action');
            $table->text('description');
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_registrar_can_upload_and_replace_profile_photo(): void
    {
        Storage::fake('public');
        $oldPath = 'profile-photos/old.jpg';
        Storage::disk('public')->put($oldPath, 'old photo');

        $user = User::create([
            'name' => 'Registrar User',
            'email' => 'registrar@example.com',
            'password' => 'password',
            'role' => 'registrar',
            'profile_photo_path' => $oldPath,
        ]);

        $this->actingAs($user)
            ->from(route('registrar.profile.show'))
            ->post(route('registrar.profile.photo.update'), [
                'profile_photo' => UploadedFile::fake()->image('registrar.png'),
            ])
            ->assertRedirect(route('registrar.profile.show'))
            ->assertSessionHasNoErrors();

        $user->refresh();

        $this->assertNotSame($oldPath, $user->profile_photo_path);
        Storage::disk('public')->assertExists($user->profile_photo_path);
        Storage::disk('public')->assertMissing($oldPath);
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $user->id,
            'action' => 'profile_photo_updated',
        ]);
    }
}