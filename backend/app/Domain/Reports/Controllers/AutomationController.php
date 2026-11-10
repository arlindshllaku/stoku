<?php

namespace App\Domain\Reports\Controllers;

use App\Domain\Reports\Models\ReportAutomation;
use App\Domain\Reports\Models\StoreMailSetting;
use App\Domain\Reports\Services\ReportMailer;
use App\Domain\Reports\Services\ReportService;
use App\Domain\Stores\Models\Store;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AutomationController extends Controller
{
    public function index(Store $store)
    {
        return response()->json(['data' => ReportAutomation::where('store_id', $store->id)->latest()->get()]);
    }

    public function save(Request $request, Store $store, ?int $automation = null)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'recipients' => ['required', 'array', 'min:1', 'max:20'],
            'recipients.*' => ['required', 'email', 'distinct', 'max:254'],
            'report_types' => ['required', 'array', 'min:1', 'max:5'],
            'report_types.*' => ['required', 'distinct', Rule::in(ReportService::TYPES)],
            'formats' => ['required', 'array', 'min:1', 'max:2'],
            'formats.*' => ['required', 'distinct', Rule::in(['xlsx', 'pdf'])],
            'interval_minutes' => ['required', 'integer', 'min:15', 'max:525600'],
            'period_days' => ['required', 'integer', 'min:1', 'max:366'],
            'enabled' => ['required', 'boolean'],
            'next_run_at' => ['required', 'date', 'after:now'],
        ]);
        if ($automation) {
            $rule = ReportAutomation::where('store_id', $store->id)->findOrFail($automation);
            $rule->update([...$data, 'created_by' => $request->user()->id]);
        } else {
            $rule = ReportAutomation::create([...$data, 'store_id' => $store->id, 'created_by' => $request->user()->id]);
        }

        return response()->json($rule);
    }

    public function destroy(Store $store, int $automation)
    {
        ReportAutomation::where('store_id', $store->id)->findOrFail($automation)->delete();

        return response()->noContent();
    }

    public function smtp(Store $store)
    {
        $settings = StoreMailSetting::where('store_id', $store->id)->first();

        return response()->json(['settings' => $settings, 'has_password' => $settings && filled($settings->password)]);
    }

    public function saveSmtp(Request $request, Store $store)
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:255'],
            'port' => ['required', 'integer', 'between:1,65535'],
            'encryption' => ['required', Rule::in(['tls', 'ssl'])],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:2048'],
            'from_address' => ['required', 'email', 'max:254'],
            'from_name' => ['required', 'string', 'max:120'],
        ]);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        $settings = StoreMailSetting::firstOrNew(['store_id' => $store->id]);
        $settings->fill($data)->save();

        return $this->smtp($store);
    }

    public function test(Request $request, Store $store, ReportMailer $mailer)
    {
        $data = $request->validate(['recipient' => ['required', 'email']]);
        $mailer->send($store, [$data['recipient']]);

        return response()->json(['message' => 'Email-i testues u dërgua.']);
    }
}
