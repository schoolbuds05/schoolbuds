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
    'ca_bundle' => env('GROQ_CA_BUNDLE'),
],

    'qrph' => [
        'account_name' => env('QRPH_ACCOUNT_NAME', 'School Marketplace'),
        'account_number' => env('QRPH_ACCOUNT_NUMBER'),
        'image_url' => env('QRPH_IMAGE_URL'),
        'instructions' => env('QRPH_INSTRUCTIONS', 'Scan the QRPH code with GCash, Maya, or your banking app, then enter the payment reference number.'),
    ],

];
