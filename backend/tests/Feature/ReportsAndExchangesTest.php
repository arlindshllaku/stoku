<?php

namespace Tests\Feature;

use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Services\InventoryService;
use App\Domain\Reports\Jobs\SendScheduledReport;
use App\Domain\Reports\Models\ReportAutomation;
use App\Domain\Reports\Models\StoreMailSetting;
use App\Domain\Reports\Services\ReportMailer;
use App\Domain\Reports\Services\ReportService;
use App\Domain\Sales\Services\SalesService;
use App\Domain\Stores\Models\Store;
use App\Domain\Users\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ReportsAndExchangesTest extends TestCase
{
    protected Store $store;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'foreign_key_constraints' => true], 'cache.default' => 'array']);
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $this->seed(DatabaseSeeder::class);
        $this->store = Store::firstOrFail();
        $this->user = User::firstOrFail();
        Sanctum::actingAs($this->user);
    }

    private function phone(string $imei): InventoryItem
    {
        return app(InventoryService::class)->create($this->store, ['brand' => 'Apple', 'model' => 'iPhone', 'imei' => $imei, 'purchase_price' => 100, 'selling_price' => 150], $this->user);
    }

    public function test_sold_phone_can_return_with_five_incoming_phones_without_losing_sale(): void
    {
        $original = $this->phone('111');
        $sale = app(SalesService::class)->normalSale($this->store, ['inventory_item_id' => $original->id], $this->user);
        $outgoing = $this->phone('222');
        $phones = [];
        foreach (['111', '333', '444', '555', '666'] as $imei) {
            $phones[] = ['imei' => $imei, 'brand' => 'Apple', 'model' => 'iPhone', 'purchase_price' => 110];
        }
        $this->postJson('/api/v1/stores/'.$this->store->id.'/sales/exchange', [
            'outgoing_item_id' => $outgoing->id, 'incoming_items' => $phones, 'cash_direction' => 'customer_pays', 'cash_difference' => 30,
        ])->assertCreated();
        $this->assertSame('in_stock', $original->fresh()->status);
        $this->assertEquals(100, $sale->items()->first()->unit_cost);
        $this->assertEquals(150, $sale->fresh()->total);
        $this->assertDatabaseCount('inventory_items', 6);
        $this->assertDatabaseCount('exchange_incoming_items', 5);
        $this->assertDatabaseHas('cash_registers', ['store_id' => $this->store->id, 'current_balance' => 180]);
        $this->deleteJson('/api/v1/stores/'.$this->store->id.'/sales/'.$sale->id)->assertUnprocessable();
        $this->assertDatabaseCount('sales', 1);
    }

    public function test_duplicate_stock_imei_rejects_entire_exchange(): void
    {
        $incoming = $this->phone('111');
        $outgoing = $this->phone('222');
        $this->postJson('/api/v1/stores/'.$this->store->id.'/sales/exchange', [
            'outgoing_item_id' => $outgoing->id,
            'incoming_items' => [['imei' => $incoming->imei, 'brand' => 'Apple', 'model' => 'iPhone']],
        ])->assertUnprocessable();
        $this->assertSame('in_stock', $outgoing->fresh()->status);
        $this->assertDatabaseCount('exchanges', 0);
    }

    public function test_reports_export_real_pdf_and_excel_with_unicode_and_scoped_dates(): void
    {
        $this->phone('123456789012345');
        $service = app(ReportService::class);
        foreach (ReportService::TYPES as $type) {
            $path = '/api/v1/stores/'.$this->store->id.'/report-data/'.$type.'?from='.now()->subDay()->toDateString().'&to='.now()->addDay()->toDateString();
            $this->getJson($path)->assertOk()->assertJsonStructure(['headings', 'rows', 'summary', 'total']);
        }
        $report = $service->build($this->store, 'stock', '2026-01-01', '2026-12-31');
        $this->assertSame('Stoku aktual', $report['title']);
        $this->assertStringStartsWith('%PDF', $service->export($report, 'pdf'));
        $this->assertStringStartsWith('PK', $service->export($report, 'xlsx'));
        $other = Store::create(['name' => 'Tjetër', 'slug' => 'other', 'status' => 'active', 'currency' => 'EUR']);
        $this->assertSame(0, $service->build($other, 'stock', '2026-01-01', '2026-12-31')['summary']['count']);
        $this->assertSame(0, $service->build($this->store, 'inventory', '2000-01-01', '2000-01-02')['summary']['count']);
    }

    public function test_smtp_password_is_encrypted_and_not_returned(): void
    {
        $this->putJson('/api/v1/stores/'.$this->store->id.'/smtp', [
            'host' => 'smtp.example.com', 'port' => 587, 'encryption' => 'tls', 'username' => 'test',
            'password' => 'secret-for-test', 'from_address' => 'reports@example.com', 'from_name' => 'Shitjet dhe ndërrimet',
        ])->assertOk()->assertJsonMissing(['password' => 'secret-for-test']);
        $this->assertNotSame('secret-for-test', DB::table('store_mail_settings')->value('password'));
        $this->assertSame('secret-for-test', StoreMailSetting::first()->password);
    }

    public function test_automation_sends_both_formats_and_records_next_run(): void
    {
        $this->phone('111');
        $rule = ReportAutomation::create(['store_id' => $this->store->id, 'created_by' => $this->user->id,
            'name' => 'Test', 'recipients' => ['owner@example.com'], 'report_types' => ['stock'], 'formats' => ['pdf', 'xlsx'],
            'interval_minutes' => 60, 'period_days' => 7, 'enabled' => true, 'next_run_at' => now()->subMinute()]);
        $mailer = $this->mock(ReportMailer::class);
        $mailer->shouldReceive('send')->once()->withArgs(fn ($store, $recipients, $attachments) => count($attachments) === 2 && $recipients === ['owner@example.com']);
        (new SendScheduledReport($rule->id))->handle(app(ReportService::class), $mailer);
        $this->assertNotNull($rule->fresh()->last_sent_at);
        $this->assertTrue($rule->fresh()->next_run_at->isFuture());
    }

    public function test_failed_payout_rolls_back_returned_phone_and_exchange(): void
    {
        $original = $this->phone('111');
        app(SalesService::class)->normalSale($this->store, ['inventory_item_id' => $original->id], $this->user);
        $outgoing = $this->phone('222');
        $this->postJson('/api/v1/stores/'.$this->store->id.'/sales/exchange', [
            'outgoing_item_id' => $outgoing->id, 'cash_direction' => 'store_pays', 'cash_difference' => 999,
            'incoming_items' => [['imei' => '111', 'brand' => 'Apple', 'model' => 'iPhone', 'purchase_price' => 77]],
        ])->assertUnprocessable();
        $this->assertSame('sold', $original->fresh()->status);
        $this->assertEquals(100, $original->fresh()->purchase_price);
        $this->assertSame('in_stock', $outgoing->fresh()->status);
        $this->assertDatabaseCount('exchanges', 0);
        $this->assertDatabaseHas('cash_registers', ['current_balance' => 150]);
    }

    public function test_employee_cannot_export_reports_or_manage_smtp(): void
    {
        $employee = User::create(['name' => 'Staff', 'email' => 'staff@example.com', 'password' => 'test-password', 'status' => 'active']);
        $this->store->users()->attach($employee->id, ['status' => 'active']);
        $employee->roles()->attach(Role::where('name', 'employee')->first()->id, ['store_id' => $this->store->id]);
        Sanctum::actingAs($employee);
        $this->getJson('/api/v1/stores/'.$this->store->id.'/smtp')->assertForbidden();
        $this->getJson('/api/v1/stores/'.$this->store->id.'/report-data/stock?from=2026-01-01&to=2026-12-31')->assertForbidden();
        $this->postJson('/api/v1/stores/'.$this->store->id.'/sales/exchange', [])->assertForbidden();
    }

    public function test_new_migration_preserves_existing_business_rows(): void
    {
        $phone = $this->phone('111');
        $sale = app(SalesService::class)->normalSale($this->store, ['inventory_item_id' => $phone->id], $this->user);
        $migration = require database_path('migrations/2026_11_10_000001_create_report_automations.php');
        $migration->down();
        $migration->up();
        $this->assertSame('sold', $phone->fresh()->status);
        $this->assertEquals(150, $sale->fresh()->total);
        $this->assertDatabaseHas('cash_registers', ['current_balance' => 150]);
        $this->assertDatabaseCount('inventory_movements', 2);
    }

    public function test_report_dates_use_store_timezone_and_excel_text_is_not_a_formula(): void
    {
        $phone = $this->phone('000123456789012');
        $sale = app(SalesService::class)->normalSale($this->store, ['inventory_item_id' => $phone->id], $this->user);
        DB::table('sales')->where('id', $sale->id)->update(['created_at' => '2026-11-10 23:30:00']);
        $reports = app(ReportService::class);
        $this->assertSame(0, $reports->build($this->store, 'sales', '2026-11-10', '2026-11-10')['summary']['count']);
        $report = $reports->build($this->store, 'sales', '2026-11-11', '2026-11-11');
        $this->assertSame(1, $report['summary']['count']);
        $report['store'] = '=1+1';
        $report['rows'][0][2] = 'Shitje: ë ç 000123456789012';
        $file = tempnam(sys_get_temp_dir(), 'stoku-xlsx');
        try {
            file_put_contents($file, $reports->export($report, 'xlsx'));
            $sheet = IOFactory::load($file)->getActiveSheet();
            $this->assertSame('s', $sheet->getCell('B1')->getDataType());
            $this->assertSame('=1+1', $sheet->getCell('B1')->getValue());
            $this->assertSame('Shitje: ë ç 000123456789012', $sheet->getCell('C5')->getValue());
        } finally {
            unlink($file);
        }
    }

    public function test_resold_phone_can_edit_latest_sale_in_same_second_but_not_old_sale(): void
    {
        $this->freezeTime();
        $phone = $this->phone('111');
        $first = app(SalesService::class)->normalSale($this->store, ['inventory_item_id' => $phone->id], $this->user);
        $outgoing = $this->phone('222');
        app(SalesService::class)->exchange($this->store, ['outgoing_item_id' => $outgoing->id, 'incoming_items' => [
            ['imei' => '111', 'brand' => 'Apple', 'model' => 'iPhone'],
        ]], $this->user);
        $second = app(SalesService::class)->normalSale($this->store, ['inventory_item_id' => $phone->id, 'selling_price' => 180], $this->user);
        $this->putJson('/api/v1/stores/'.$this->store->id.'/sales/'.$second->id, ['selling_price' => 190, 'payment_method' => 'cash'])->assertOk();
        $this->deleteJson('/api/v1/stores/'.$this->store->id.'/sales/'.$first->id)->assertUnprocessable();
        $this->assertEquals(150, $first->fresh()->total);
        $this->assertEquals(190, $second->fresh()->total);
    }

    public function test_failed_email_does_not_advance_schedule_or_touch_stock(): void
    {
        $phone = $this->phone('111');
        $rule = ReportAutomation::create(['store_id' => $this->store->id, 'created_by' => $this->user->id,
            'name' => 'Test', 'recipients' => ['owner@example.com'], 'report_types' => ['stock'], 'formats' => ['xlsx'],
            'interval_minutes' => 60, 'period_days' => 1, 'enabled' => true, 'next_run_at' => now()->subMinute()]);
        $mailer = $this->mock(ReportMailer::class);
        $mailer->shouldReceive('send')->once()->andThrow(new \RuntimeException('SMTP unavailable'));
        try {
            (new SendScheduledReport($rule->id))->handle(app(ReportService::class), $mailer);
            $this->fail('Expected SMTP error');
        } catch (\RuntimeException $error) {
            $this->assertSame('SMTP unavailable', $error->getMessage());
        }
        $this->assertNull($rule->fresh()->last_sent_at);
        $this->assertNotNull($rule->fresh()->last_error);
        $this->assertTrue($rule->fresh()->next_run_at->isPast());
        $this->assertSame('in_stock', $phone->fresh()->status);
    }
}
