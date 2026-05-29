<?php

namespace App\Models;

use App\Domain\Stores\Models\Store;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'status',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function stores(): BelongsToMany
    {
        return $this->belongsToMany(Store::class, 'store_users')->withPivot('status')->withTimestamps();
    }

    public function hasPlatformRole(string $role): bool
    {
        return $this->roles()->where('name', $role)->where('scope', 'platform')->exists();
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(\App\Domain\Users\Models\Role::class, 'user_store_roles')
            ->withPivot('store_id')
            ->withTimestamps();
    }
}
