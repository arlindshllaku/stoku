<?php

use App\Domain\Reports\Jobs\SendScheduledReport;
use App\Domain\Reports\Models\ReportAutomation;
use Illuminate\Support\Facades\Schedule;

Schedule::command('queue:work --stop-when-empty')->everyMinute()->withoutOverlapping();

Schedule::call(function (): void {
    ReportAutomation::query()
        ->where('enabled', true)->where('next_run_at', '<=', now())
        ->chunkById(100, function ($rules): void {
            foreach ($rules as $rule) {
                SendScheduledReport::dispatch($rule->id);
            }
        });
})->name('scheduled-reports')->everyMinute()->withoutOverlapping();
