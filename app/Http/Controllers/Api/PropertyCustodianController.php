<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PropertyAsset;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PropertyCustodianController extends Controller
{
    public function dashboard(Request $request)
    {
        $this->authorizeCustodian($request);

        $assets = PropertyAsset::query()
            ->when($request->query('search'), function ($query, string $search) {
                $search = trim($search);
                $query->where(function ($inner) use ($search) {
                    $inner->where('asset_tag', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%")
                        ->orWhere('location', 'like', "%{$search}%")
                        ->orWhere('assigned_to', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'counts' => [
                'total' => PropertyAsset::count(),
                'available' => PropertyAsset::where('status', 'available')->count(),
                'assigned' => PropertyAsset::where('status', 'assigned')->count(),
                'maintenance' => PropertyAsset::where('status', 'maintenance')->count(),
                'needs_attention' => PropertyAsset::whereIn('condition', ['needs_repair', 'damaged', 'lost'])->count(),
            ],
            'assets' => $assets,
            'conditions' => PropertyAsset::CONDITIONS,
            'statuses' => PropertyAsset::STATUSES,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizeCustodian($request);

        $data = $request->validate($this->rules());
        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;

        $asset = PropertyAsset::create($data);

        return response()->json($asset, 201);
    }

    public function update(Request $request, PropertyAsset $asset)
    {
        $this->authorizeCustodian($request);

        $data = $request->validate($this->rules($asset));
        $data['updated_by'] = $request->user()->id;

        $asset->update($data);

        return response()->json($asset);
    }

    public function destroy(Request $request, PropertyAsset $asset)
    {
        $this->authorizeCustodian($request);

        $asset->delete();

        return response()->json(['message' => 'Asset deleted.']);
    }

    private function rules(?PropertyAsset $asset = null): array
    {
        return [
            'asset_tag' => [
                'required',
                'string',
                'max:255',
                Rule::unique('property_assets', 'asset_tag')->ignore($asset?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'condition' => ['required', Rule::in(PropertyAsset::CONDITIONS)],
            'status' => ['required', Rule::in(PropertyAsset::STATUSES)],
            'assigned_to' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function authorizeCustodian(Request $request): void
    {
        $user = $request->user();

        if (!$user) {
            abort(response()->json(['message' => 'Unauthorized'], 401));
        }

        $isCustodian = $user->role === User::ROLE_STAFF
            && $user->position === User::POSITION_PROPERTY_CUSTODIAN;

        if (!$isCustodian && $user->role !== User::ROLE_ADMIN && !$user->hasRole(User::ROLE_ADMIN)) {
            abort(response()->json(['message' => 'Property custodian access is required.'], 403));
        }
    }
}
