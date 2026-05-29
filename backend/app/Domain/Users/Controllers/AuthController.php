<?php

namespace App\Domain\Users\Controllers;

use App\Domain\Audit\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $user = User::query()->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password) || $user->status !== 'active') {
            throw ValidationException::withMessages(['email' => 'The provided credentials are incorrect.']);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $this->auditLogger->log('auth.login', null, $user);

        return response()->json([
            'token' => $user->createToken($credentials['device_name'] ?? 'api')->plainTextToken,
            'user' => $user->load('stores'),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();
        $this->auditLogger->log('auth.logout', null, $request->user());

        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user()->load('stores', 'roles.permissions'),
        ]);
    }
}
