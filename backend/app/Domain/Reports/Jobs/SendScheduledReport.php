<?php

namespace App\Domain\Reports\Jobs;

use App\Domain\Reports\Models\ReportAutomation;
use App\Domain\Reports\Services\ReportMailer;
use App\Domain\Reports\Services\ReportService;
use App\Domain\Stores\Models\Store;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class SendScheduledReport implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 110;

    public int $uniqueFor = 3600;

    public function __construct(public int $automationId) {}

    public function uniqueId(): string
    {
        return (string) $this->automationId;
    }

    public function backoff(): array
    {
        return [60, 300];
    }

    public function failed(?Throwable $error): void
    {
        $rule = ReportAutomation::find($this->automationId);
        if ($rule) {
            $rule->update(['next_run_at' => now()->addMinutes(max(15, $rule->interval_minutes)),
                'last_error' => 'Dërgimi dështoi pas tri provave. Kontrolloni SMTP ose regjistrimet e serverit.']);
        }
    }

    public function handle(ReportService $reports, ReportMailer $mailer): void
    {
        $rule = ReportAutomation::find($this->automationId);
        if (! $rule || ! $rule->enabled || $rule->next_run_at->isFuture()) {
            return;
        }
        $store = Store::find($rule->store_id);
        $user = User::find($rule->created_by);
        if (! $store || $store->status !== 'active' || ! $user || $user->status !== 'active'
            || ! $user->hasPermission('reports.export', $store)
            || (! $user->hasPlatformRole('super_admin') && ! $store->users()->where('users.id', $user->id)->wherePivot('status', 'active')->exists())) {
            $rule->update(['enabled' => false, 'last_error' => 'Qasja e krijuesit ose dyqanit nuk është aktive.']);

            return;
        }
        try {
            $end = now()->setTimezone($store->timezone ?: 'Europe/Budapest');
            $start = $end->copy()->subDays($rule->period_days - 1);
            $attachments = [];
            foreach ($rule->report_types as $type) {
                $report = $reports->build($store, $type, $start->toDateString(), $end->toDateString());
                foreach ($rule->formats as $format) {
                    $attachments[] = ['name' => $type.'-'.$end->toDateString().'.'.$format,
                        'mime' => $format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'content' => $reports->export($report, $format)];
                }
            }
            $mailer->send($store, $rule->recipients, $attachments);
            $rule->update(['last_sent_at' => now(), 'next_run_at' => now()->addMinutes($rule->interval_minutes), 'last_error' => null]);
        } catch (Throwable $error) {
            $rule->update(['last_error' => 'Dërgimi dështoi. Kontrolloni SMTP ose regjistrimet e serverit.']);
            throw $error;
        }
    }
}
