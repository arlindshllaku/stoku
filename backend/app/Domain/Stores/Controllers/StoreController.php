<?php

namespace App\Domain\Stores\Controllers;

use App\Domain\Audit\Services\AuditLogger;
use App\Domain\Cash\Services\CashService;
use App\Domain\Stores\Models\Store;
use App\Domain\Stores\Requests\StoreRequest;
use App\Domain\Users\Models\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StoreController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger, private readonly CashService $cashService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Store::query()->latest();

        if (! $request->user()->hasPlatformRole('super_admin')) {
            $query->whereHas('users', fn ($users) => $users->whereKey($request->user()->id));
        }

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function store(StoreRequest $request): JsonResponse
    {
        $store = Store::query()->create([
            ...$request->validated(),
            'slug' => $request->input('slug', Str::slug($request->string('name'))),
            'created_by' => $request->user()->id,
        ]);

        $this->cashService->registerFor($store);
        $this->auditLogger->log('store.created', $store->id, $store, [], $store->toArray());

        return response()->json($store, 201);
    }

    public function show(Store $store): JsonResponse
    {
        return response()->json($store->load('users'));
    }

    public function update(StoreRequest $request, Store $store): JsonResponse
    {
        $old = $store->toArray();
        $store->update($request->validated());
        $this->auditLogger->log('store.updated', $store->id, $store, $old, $store->fresh()->toArray());

        return response()->json($store->fresh());
    }

    public function destroy(Store $store): JsonResponse
    {
        $old = $store->toArray();
        $store->update(['status' => 'inactive']);
        $this->auditLogger->log('store.deactivated', $store->id, $store, $old, $store->fresh()->toArray());

        return response()->json(['message' => 'Store deactivated']);
    }

    public function status(Request $request, Store $store): JsonResponse
    {
        abort_unless($request->user()->hasPlatformRole('super_admin'), 403);
        $data = $request->validate(['status' => ['required', 'in:active,inactive']]);
        $old = $store->toArray();
        $store->update($data);
        $this->auditLogger->log('store.status_changed', $store->id, $store, $old, $store->fresh()->toArray());

        return response()->json($store->fresh());
    }

    public function assignOwner(Request $request, Store $store): JsonResponse
    {
        abort_unless($request->user()->hasPlatformRole('super_admin'), 403);
        $data = $request->validate(['user_id' => ['required', 'exists:users,id']]);
        $role = Role::query()->where('name', 'store_owner')->where('scope', 'store')->firstOrFail();
        $user = User::query()->findOrFail($data['user_id']);

        $store->users()->syncWithoutDetaching([$user->id => ['status' => 'active']]);
        $user->roles()->syncWithoutDetaching([$role->id => ['store_id' => $store->id]]);
        $this->auditLogger->log('store.owner_assigned', $store->id, $store, [], ['user_id' => $user->id]);

        return response()->json($store->load('users'));
    }
}
