<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->status !== 'active') {
            $request->user()?->currentAccessToken()?->delete();
            abort(403, 'Your account is inactive.');
        }

        return $next($request);
    }
}
