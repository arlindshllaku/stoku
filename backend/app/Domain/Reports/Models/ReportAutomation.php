<?php

namespace App\Domain\Reports\Models;

use Illuminate\Database\Eloquent\Model;

class ReportAutomation extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['recipients' => 'array', 'report_types' => 'array', 'formats' => 'array',
            'enabled' => 'boolean', 'next_run_at' => 'datetime', 'last_sent_at' => 'datetime'];
    }
}
