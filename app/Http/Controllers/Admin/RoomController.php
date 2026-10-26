<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\AuthorizesPortal;
use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoomController extends Controller
{
    use AuthorizesPortal;

    public function index(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $rooms = Room::query()->orderBy('name')->get();
        $routePrefix = $request->user()->role === 'admin' || $request->user()->hasAnyRole(['admin']) ? 'admin' : 'registrar';

        return view('rooms.index', compact('rooms', 'routePrefix'));
    }

    public function store(Request $request)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $data = $this->validated($request);
        $data['name'] = trim($data['name']);
        $data['is_active'] = $request->boolean('is_active');
        Room::create($data);

        return back()->with('status', 'Room added to the inventory.');
    }

    public function update(Request $request, Room $room)
    {
        $this->requireAnyRole($request, ['admin', 'registrar']);
        $data = $this->validated($request, $room);
        $data['name'] = trim($data['name']);
        $data['is_active'] = $request->boolean('is_active');
        $room->update($data);

        return back()->with('status', 'Room updated.');
    }

    private function validated(Request $request, ?Room $room = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('rooms', 'name')->ignore($room?->id)],
            'room_type' => ['required', Rule::in([Room::TYPE_LECTURE, Room::TYPE_LAB, Room::TYPE_FLEXIBLE])],
            'capacity' => ['required', 'integer', 'min:1', 'max:10000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
