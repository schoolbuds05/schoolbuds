<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Mail;

// Adjust recipient if provided as CLI arg
$recipient = $argv[1] ?? 'rcjiez@gmail.com';

Mail::raw("This is a test email from School System (dev). If you received this, SMTP is working.", function ($message) use ($recipient) {
    $message->to($recipient)->subject('School System - Test email');
});

echo "Mail send command executed for: {$recipient}\n";
