<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\MarketplaceController;
use App\Http\Controllers\ArchiveController;
use App\Models\ArchivedRecord;
use App\Models\MarketplaceItem;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MarketplaceArchiveTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('actor_name')->nullable();
            $table->string('actor_email')->nullable();
            $table->string('actor_role')->nullable();
            $table->string('action');
            $table->string('description');
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('archived_records', function (Blueprint $table) {
            $table->id();
            $table->string('record_type');
            $table->unsignedBigInteger('record_id')->nullable();
            $table->string('label')->nullable();
            $table->json('payload');
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->unsignedBigInteger('restored_by')->nullable();
            $table->string('source')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('restored_at')->nullable();
            $table->timestamps();
        });

        Schema::create('marketplace_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->string('category')->nullable();
            $table->string('condition')->nullable();
            $table->string('status')->default('available');
            $table->string('image')->nullable();
            $table->string('location')->nullable();
            $table->timestamps();
        });

        Schema::create('marketplace_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('marketplace_item_id')->constrained('marketplace_items')->cascadeOnDelete();
            $table->unsignedBigInteger('buyer_id');
            $table->unsignedBigInteger('seller_id');
            $table->unsignedInteger('quantity')->default(1);
            $table->string('status');
            $table->timestamps();
        });

        Schema::create('marketplace_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('marketplace_items')->cascadeOnDelete();
            $table->unsignedBigInteger('sender_id');
            $table->unsignedBigInteger('receiver_id');
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('marketplace_messages');
        Schema::dropIfExists('marketplace_orders');
        Schema::dropIfExists('marketplace_items');
        Schema::dropIfExists('archived_records');
        Schema::dropIfExists('activity_logs');

        parent::tearDown();
    }

    public function test_deleting_a_marketplace_item_archives_it_and_allows_restoring_it(): void
    {
        $seller = (new User())->forceFill([
            'id' => 17,
            'name' => 'Marketplace Seller',
            'email' => 'seller@example.com',
            'role' => 'property_custodian',
        ]);
        $item = MarketplaceItem::create([
            'user_id' => $seller->id,
            'title' => 'School Uniform',
            'description' => 'Uniform listing',
            'price' => 350,
            'category' => 'uniforms',
            'condition' => 'good',
        ]);
        $order = \App\Models\MarketplaceOrder::create([
            'marketplace_item_id' => $item->id,
            'buyer_id' => 31,
            'seller_id' => $seller->id,
            'quantity' => 1,
            'status' => 'completed',
        ]);
        $message = \App\Models\MarketplaceMessage::create([
            'item_id' => $item->id,
            'sender_id' => 31,
            'receiver_id' => $seller->id,
            'message' => 'Order pickup confirmed',
        ]);

        $deleteRequest = Request::create('/api/marketplace/' . $item->id, 'DELETE');
        $deleteRequest->setUserResolver(fn () => $seller);

        $response = (new MarketplaceController())->destroy($deleteRequest, $item);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertDatabaseMissing('marketplace_items', ['id' => $item->id]);

        $archive = ArchivedRecord::query()->where('record_type', 'MarketplaceItem')->firstOrFail();
        $this->assertSame('School Uniform', $archive->label);
        $this->assertSame('api.marketplace', $archive->source);
        $this->assertSame('School Uniform', $archive->payload['attributes']['title']);
        $this->assertDatabaseMissing('marketplace_orders', ['id' => $order->id]);
        $this->assertDatabaseMissing('marketplace_messages', ['id' => $message->id]);

        $admin = (new User())->forceFill([
            'id' => 23,
            'name' => 'Administrator',
            'email' => 'admin@example.com',
            'role' => 'admin',
        ]);
        $restoreRequest = Request::create('/archive/' . $archive->id . '/restore', 'POST');
        $restoreRequest->setUserResolver(fn () => $admin);

        (new ArchiveController())->restore($restoreRequest, $archive);

        $this->assertDatabaseHas('marketplace_items', [
            'id' => $item->id,
            'title' => 'School Uniform',
            'user_id' => $seller->id,
        ]);
        $this->assertDatabaseHas('marketplace_orders', ['id' => $order->id, 'status' => 'completed']);
        $this->assertDatabaseHas('marketplace_messages', ['id' => $message->id, 'message' => 'Order pickup confirmed']);
        $this->assertNotNull($archive->fresh()->restored_at);
        $this->assertSame($admin->id, $archive->fresh()->restored_by);
    }
}
