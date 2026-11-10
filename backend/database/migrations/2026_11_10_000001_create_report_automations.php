<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_mail_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('host');
            $table->unsignedInteger('port')->default(587);
            $table->string('encryption')->default('tls');
            $table->string('username')->nullable();
            $table->text('password')->nullable();
            $table->string('from_address');
            $table->string('from_name');
            $table->timestamps();
        });
        Schema::create('report_automations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->json('recipients');
            $table->json('report_types');
            $table->json('formats');
            $table->unsignedInteger('interval_minutes');
            $table->unsignedInteger('period_days')->default(1);
            $table->boolean('enabled')->default(true);
            $table->timestamp('next_run_at')->index();
            $table->timestamp('last_sent_at')->nullable();
            $table->string('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_automations');
        Schema::dropIfExists('store_mail_settings');
    }
};
