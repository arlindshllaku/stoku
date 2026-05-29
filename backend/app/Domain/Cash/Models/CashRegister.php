<?php

namespace App\Domain\Cash\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CashRegister extends Model
{
    protected $fillable = ['store_id', 'current_balance', 'opening_balance', 'last_closed_at'];

    protected function casts(): array
    {
        return [
            'current_balance' => 'decimal:2',
            'opening_balance' => 'decimal:2',
            'last_closed_at' => 'datetime',
        ];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(CashTransaction::class);
    }
}
