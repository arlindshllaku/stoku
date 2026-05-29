<?php

namespace App\Domain\Users\Controllers;

use App\Domain\Audit\Services\AuditLogger;
use App\Domain\Stores\Models\Store;
use App\Domain\Users\Models\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class StoreUserController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Store $store): JsonResponse
    {
        return response()->json([
            'data' => $store->users()
                ->with('roles')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:180', 'unique:users,email'],
            'password' => ['required', Password::min(8)],
            'role' => ['required', 'in:store_owner,employee'],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'status' => 'active',
        ]);

        $role = Role::query()->where('name', $data['role'])->where('scope', 'store')->firstOrFail();
        $store->users()->syncWithoutDetaching([$user->id => ['status' => 'active']]);
        $user->roles()->syncWithoutDetaching([$role->id => ['store_id' => $store->id]]);

        $this->auditLogger->log('store_user.created', $store->id, $user, [], [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role->name,
        ]);

        return response()->json($user->load('roles'), 201);
    }

    public function status(Request $request, Store $store, User $user): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:active,inactive']]);
        abort_unless($store->users()->whereKey($user->id)->exists(), 404);

        $store->users()->updateExistingPivot($user->id, ['status' => $data['status']]);
        $user->update(['status' => $data['status']]);

        $this->auditLogger->log('store_user.status_changed', $store->id, $user, [], $data);

        return response()->json($user->fresh()->load('roles'));
    }
}
