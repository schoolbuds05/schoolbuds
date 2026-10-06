<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

'groq' => [
    'key' => env('GROQ_API_KEY'),
],

    'paymongo' => [
        'secret_key' => env('PAYMONGO_SECRET_KEY'),
        'public_key' => env('PAYMONGO_PUBLIC_KEY'),
        'webhook_secret' => env('PAYMONGO_WEBHOOK_SECRET'),
        'success_url' => env('PAYMONGO_SUCCESS_URL', env('APP_URL') . '/payment/success'),
        'cancel_url' => env('PAYMONGO_CANCEL_URL', env('APP_URL') . '/payment/cancelled'),
    ],

    'qrph' => [
        'account_name' => env('QRPH_ACCOUNT_NAME', 'School Marketplace'),
        'account_number' => env('QRPH_ACCOUNT_NUMBER'),
        'image_url' => env('QRPH_IMAGE_URL'),
        'instructions' => env('QRPH_INSTRUCTIONS', 'Scan the QRPH code with GCash, Maya, or your banking app, then enter the payment reference number.'),
    ],

];
