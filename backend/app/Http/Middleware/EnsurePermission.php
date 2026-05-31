<?php

namespace App\Http\Middleware;

use App\Domain\Stores\Models\Store;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $store = $request->route('store');

        if ($store !== null && ! $store instanceof Store) {
            $store = Store::query()->findOrFail($store);
            $request->route()->setParameter('store', $store);
        }

        abort_unless($request->user()?->hasPermission($permission, $store), 403);

        return $next($request);
    }
}
