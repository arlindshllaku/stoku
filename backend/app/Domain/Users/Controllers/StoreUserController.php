<?php

namespace App\Domain\Users\Controllers;

use App\Domain\Audit\Services\AuditLogger;
use App\Domain\Stores\Models\Store;
use App\Domain\Users\Models\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
        $this->authorizeManageUsers($request, $store);

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:180'],
            'password' => ['nullable', Password::min(8)],
            'role' => ['required', 'in:store_owner,employee'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user) {
            if (empty($data['name'])) {
                throw ValidationException::withMessages(['name' => 'Name is required for a new user.']);
            }

            if (empty($data['password'])) {
                throw ValidationException::withMessages(['password' => 'Password is required for a new user.']);
            }

            $user = User::query()->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'status' => 'active',
            ]);
        }

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

    public function update(Request $request, Store $store, User $user): JsonResponse
    {
        $this->authorizeManageUsers($request, $store);
        abort_unless($store->users()->whereKey($user->id)->exists(), 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:180', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', Password::min(8)],
            'role' => ['required', 'in:store_owner,employee'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $old = $user->load('roles')->toArray();
        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
            ...(! empty($data['password']) ? ['password' => $data['password']] : []),
            'status' => $data['status'],
        ]);

        $store->users()->updateExistingPivot($user->id, ['status' => $data['status']]);
        $this->syncStoreRole($store, $user, $data['role']);

        $this->auditLogger->log('store_user.updated', $store->id, $user, $old, [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $data['role'],
            'status' => $data['status'],
        ]);

        return response()->json($user->fresh()->load('roles'));
    }

    public function status(Request $request, Store $store, User $user): JsonResponse
    {
        $this->authorizeManageUsers($request, $store);

        $data = $request->validate(['status' => ['required', 'in:active,inactive']]);
        abort_unless($store->users()->whereKey($user->id)->exists(), 404);

        $store->users()->updateExistingPivot($user->id, ['status' => $data['status']]);
        $user->update(['status' => $data['status']]);

        $this->auditLogger->log('store_user.status_changed', $store->id, $user, [], $data);

        return response()->json($user->fresh()->load('roles'));
    }

    public function destroy(Request $request, Store $store, User $user): JsonResponse
    {
        $this->authorizeManageUsers($request, $store);
        abort_unless($store->users()->whereKey($user->id)->exists(), 404);

        $old = $user->load('roles')->toArray();
        $store->users()->detach($user->id);
        $roleIds = Role::query()->where('scope', 'store')->pluck('id');
        $user->roles()->wherePivot('store_id', $store->id)->detach($roleIds->all());

        if (! $user->stores()->exists() && ! $user->hasPlatformRole('super_admin')) {
            $user->update(['status' => 'inactive']);
        }

        $this->auditLogger->log('store_user.removed', $store->id, $user, $old, [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        return response()->json(['message' => 'User access removed from store.']);
    }

    private function authorizeManageUsers(Request $request, Store $store): void
    {
        $user = $request->user();

        abort_unless(
            $user?->hasPlatformRole('super_admin')
            || $user?->roles()
                ->where('name', 'store_owner')
                ->where('scope', 'store')
                ->wherePivot('store_id', $store->id)
                ->exists(),
            403,
        );
    }

    private function syncStoreRole(Store $store, User $user, string $roleName): void
    {
        $storeRoleIds = Role::query()->where('scope', 'store')->pluck('id');
        $user->roles()->wherePivot('store_id', $store->id)->detach($storeRoleIds->all());

        $role = Role::query()->where('name', $roleName)->where('scope', 'store')->firstOrFail();
        $user->roles()->syncWithoutDetaching([$role->id => ['store_id' => $store->id]]);
    }
}
