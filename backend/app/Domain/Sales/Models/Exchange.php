<?php

namespace App\Domain\Sales\Models;

use App\Domain\Inventory\Models\InventoryItem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exchange extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'store_id',
        'customer_id',
        'outgoing_item_id',
        'incoming_item_id',
        'cash_difference',
        'cash_direction',
        'estimated_incoming_value',
        'outgoing_sale_value',
        'profit_loss',
        'notes',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'cash_difference' => 'decimal:2',
            'estimated_incoming_value' => 'decimal:2',
            'outgoing_sale_value' => 'decimal:2',
            'profit_loss' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }

    public function outgoingItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'outgoing_item_id');
    }

    public function incomingItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'incoming_item_id');
    }

    public function incomingItems(): HasMany
    {
        return $this->hasMany(ExchangeIncomingItem::class);
    }
}
