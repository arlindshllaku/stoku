<?php

namespace App\Domain\Reports\Services;

use App\Domain\Reports\Models\StoreMailSetting;
use App\Domain\Stores\Models\Store;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class ReportMailer
{
    public function send(Store $store, array $recipients, array $attachments = []): void
    {
        $settings = StoreMailSetting::query()->where('store_id', $store->id)->first();
        if (! $settings) {
            throw ValidationException::withMessages(['smtp' => 'Ruani cilësimet SMTP para dërgimit.']);
        }
        $mailer = Mail::build([
            'transport' => 'smtp', 'scheme' => $settings->encryption === 'ssl' ? 'smtps' : 'smtp',
            'host' => $settings->host, 'port' => $settings->port,
            'username' => $settings->username, 'password' => $settings->password, 'timeout' => 30,
            'require_tls' => $settings->encryption === 'tls',
        ]);
        $mailer->raw('Raportet e dyqanit '.$store->name.'. Gjeneruar më '.now()->toIso8601String(), function (Message $message) use ($settings, $recipients, $attachments, $store): void {
            $message->from($settings->from_address, $settings->from_name)->to($recipients)->subject('Stoku - '.$store->name);
            foreach ($attachments as $attachment) {
                $message->attachData($attachment['content'], $attachment['name'], ['mime' => $attachment['mime']]);
            }
        });
    }
}
