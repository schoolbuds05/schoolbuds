<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoomManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_and_registrar_can_manage_rooms(): void
    {
        $this->withoutVite();
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/admin/rooms')->assertOk()->assertSee('Manage lecture rooms and labs');
        $this->post('/admin/rooms', [
            'name' => '  Science Lab 1  ',
            'room_type' => Room::TYPE_LAB,
            'capacity' => 32,
            'is_active' => '1',
        ])->assertRedirect()->assertSessionHasNoErrors();
        $room = Room::firstOrFail();
        $this->assertSame('Science Lab 1', $room->name);
        $this->assertSame(Room::TYPE_LAB, $room->room_type);
        $this->assertSame(32, $room->capacity);

        $registrar = User::factory()->create(['role' => 'registrar', 'position' => null]);
        $this->actingAs($registrar)->get('/registrar/rooms')->assertOk();
        $this->put("/registrar/rooms/{$room->id}", [
            'name' => 'Science Lab 1',
            'room_type' => Room::TYPE_FLEXIBLE,
            'capacity' => 40,
        ])->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'room_type' => Room::TYPE_FLEXIBLE, 'capacity' => 40, 'is_active' => false]);
    }

    public function test_room_management_validates_room_details_and_restricts_chairs(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Room::create(['name' => 'Lecture 1', 'room_type' => Room::TYPE_LECTURE, 'capacity' => 40, 'is_active' => true]);

        $this->actingAs($admin)->post('/admin/rooms', [
            'name' => 'Lecture 1',
            'room_type' => 'computer_lab',
            'capacity' => 0,
        ])->assertSessionHasErrors(['name', 'room_type', 'capacity']);

        $chair = User::factory()->create(['role' => 'faculty', 'position' => 'head_department']);
        $this->actingAs($chair)->get('/registrar/rooms')->assertForbidden();
        $this->post('/registrar/rooms', [
            'name' => 'Unauthorized Lab',
            'room_type' => Room::TYPE_LAB,
            'capacity' => 30,
        ])->assertForbidden();
    }
}
