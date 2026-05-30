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

    public function index(Request $request, Store $store): JsonResponse
    {
        $users = $store->users()
            ->with('roles')
            ->orderBy('name')
            ->get();

        if ($request->user()->hasPlatformRole('super_admin')) {
            $superAdmins = User::query()
                ->with('roles')
                ->whereHas(
                    'roles',
                    fn ($roles) => $roles->where('name', 'super_admin')->where('scope', 'platform'),
                )
                ->orderBy('name')
                ->get();

            $users = $users->merge($superAdmins)->unique('id')->sortBy('name')->values();
        }

        return response()->json([
            'data' => $users,
        ]);
    }

    public function store(Request $request, Store $store): JsonResponse
    {
        $this->authorizeManageUsers($request, $store);

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:180'],
            'password' => ['nullable', Password::min(8)],
            'role' => ['required', $this->roleRule($request)],
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
        } else {
            abort_if($user->hasPlatformRole('super_admin') && ! $request->user()->hasPlatformRole('super_admin'), 403);

            $user->update(['status' => 'active']);
        }

        $this->applyRole($request, $store, $user, $data['role'], 'active');

        $this->auditLogger->log('store_user.created', $store->id, $user, [], [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $data['role'],
        ]);

        return response()->json($user->load('roles'), 201);
    }

    public function update(Request $request, Store $store, User $user): JsonResponse
    {
        $this->authorizeManageUsers($request, $store);
        $targetIsSuperAdmin = $user->hasPlatformRole('super_admin');

        abort_unless(
            $store->users()->whereKey($user->id)->exists()
                || ($request->user()->hasPlatformRole('super_admin') && $targetIsSuperAdmin),
            404,
        );
        abort_if($targetIsSuperAdmin && ! $request->user()->hasPlatformRole('super_admin'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:180', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', Password::min(8)],
            'role' => ['required', $this->roleRule($request)],
            'status' => ['required', 'in:active,inactive'],
        ]);

        if ($user->id === $request->user()->id && $user->hasPlatformRole('super_admin') && $data['role'] !== 'super_admin') {
            throw ValidationException::withMessages(['role' => 'You cannot remove your own super admin role.']);
        }

        if ($user->id === $request->user()->id && $data['status'] !== 'active') {
            throw ValidationException::withMessages(['status' => 'You cannot deactivate your own account.']);
        }

        $old = $user->load('roles')->toArray();
        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
            ...(! empty($data['password']) ? ['password' => $data['password']] : []),
            'status' => $data['status'],
        ]);

        $this->applyRole($request, $store, $user, $data['role'], $data['status']);

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
        abort_if($user->hasPlatformRole('super_admin') && ! $request->user()->hasPlatformRole('super_admin'), 403);

        if ($user->id === $request->user()->id && $data['status'] !== 'active') {
            throw ValidationException::withMessages(['status' => 'You cannot deactivate your own account.']);
        }

        $store->users()->updateExistingPivot($user->id, ['status' => $data['status']]);
        $user->update(['status' => $data['status']]);

        $this->auditLogger->log('store_user.status_changed', $store->id, $user, [], $data);

        return response()->json($user->fresh()->load('roles'));
    }

    public function destroy(Request $request, Store $store, User $user): JsonResponse
    {
        $this->authorizeManageUsers($request, $store);
        $targetIsSuperAdmin = $user->hasPlatformRole('super_admin');

        abort_unless(
            $store->users()->whereKey($user->id)->exists()
                || ($request->user()->hasPlatformRole('super_admin') && $targetIsSuperAdmin),
            404,
        );
        abort_if($targetIsSuperAdmin && ! $request->user()->hasPlatformRole('super_admin'), 403);

        if ($user->id === $request->user()->id && $targetIsSuperAdmin) {
            throw ValidationException::withMessages(['user' => 'You cannot remove your own super admin access.']);
        }

        $old = $user->load('roles')->toArray();
        $store->users()->detach($user->id);
        $roleIds = Role::query()->where('scope', 'store')->pluck('id');
        $user->roles()->wherePivot('store_id', $store->id)->detach($roleIds->all());
        $this->detachPlatformSuperAdmin($user);

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

    private function applyRole(Request $request, Store $store, User $user, string $roleName, string $status): void
    {
        if ($roleName === 'super_admin') {
            abort_unless($request->user()->hasPlatformRole('super_admin'), 403);
            $role = Role::query()->where('name', 'super_admin')->where('scope', 'platform')->firstOrFail();
            $user->roles()->syncWithoutDetaching([$role->id => ['store_id' => null]]);

            return;
        }

        if ($user->hasPlatformRole('super_admin')) {
            abort_unless($request->user()->hasPlatformRole('super_admin'), 403);
            $this->detachPlatformSuperAdmin($user);
        }

        $store->users()->syncWithoutDetaching([$user->id => ['status' => $status]]);
        $store->users()->updateExistingPivot($user->id, ['status' => $status]);
        $this->syncStoreRole($store, $user, $roleName);
    }

    private function detachPlatformSuperAdmin(User $user): void
    {
        $role = Role::query()->where('name', 'super_admin')->where('scope', 'platform')->first();

        if ($role) {
            $user->roles()->detach($role->id);
        }
    }

    private function roleRule(Request $request): string
    {
        return $request->user()->hasPlatformRole('super_admin')
            ? 'in:super_admin,store_owner,employee'
            : 'in:store_owner,employee';
    }
}
