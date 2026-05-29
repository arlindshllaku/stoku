<?php

namespace App\Http\Middleware;

use App\Domain\Stores\Models\Store;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStoreAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $store = $request->route('store');

        if (! $store instanceof Store) {
            $store = Store::query()->findOrFail($store);
            $request->route()->setParameter('store', $store);
        }

        if ($user?->hasPlatformRole('super_admin') || $store->users()->whereKey($user?->id)->wherePivot('status', 'active')->exists()) {
            return $next($request);
        }

        abort(403, 'You do not have access to this store.');
    }
}
