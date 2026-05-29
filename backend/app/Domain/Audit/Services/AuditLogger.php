<?php

namespace App\Domain\Audit\Services;

use App\Domain\Audit\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogger
{
    public function log(string $action, ?int $storeId, ?object $entity = null, array $old = [], array $new = [], array $metadata = []): AuditLog
    {
        /** @var Request|null $request */
        $request = request();

        return AuditLog::query()->create([
            'store_id' => $storeId,
            'user_id' => $request?->user()?->id,
            'action' => $action,
            'entity_type' => $entity ? $entity::class : null,
            'entity_id' => $entity->id ?? null,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'old_values' => $old ?: null,
            'new_values' => $new ?: null,
            'metadata' => $metadata ?: null,
            'created_at' => now(),
        ]);
    }
}
