<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\MarketplaceItem;
use App\Models\User;

class MarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        $student = User::where('email', 'student@school.com')->first();
        $teacher = User::where('email', 'teacher@school.com')->first();

        $items = [
            [
                'user_id'     => $student->id,
                'title'       => 'Science 10 Textbook',
                'description' => 'Lightly used Science 10 textbook. No missing pages, minimal highlights.',
                'price'       => 150,
                'category'    => 'books',
                'condition'   => 'good',
                'location'    => 'Cebu City',
            ],
            [
                'user_id'     => $student->id,
                'title'       => 'School Uniform (Medium)',
                'description' => 'Complete uniform set, medium size. Worn for only one semester.',
                'price'       => 350,
                'category'    => 'uniforms',
                'condition'   => 'like_new',
                'location'    => 'Cebu City',
            ],
            [
                'user_id'     => $teacher->id,
                'title'       => 'Scientific Calculator',
                'description' => 'Casio fx-991ES Plus. Works perfectly. Selling because I got a new one.',
                'price'       => 400,
                'category'    => 'electronics',
                'condition'   => 'good',
                'location'    => 'Cebu City',
            ],
            [
                'user_id'     => $teacher->id,
                'title'       => 'Graphing Paper (50 sheets)',
                'description' => 'Brand new pack of graphing paper, unused.',
                'price'       => 50,
                'category'    => 'supplies',
                'condition'   => 'new',
                'location'    => 'Cebu City',
            ],
            [
                'user_id'     => $student->id,
                'title'       => 'Filipino 10 Workbook',
                'description' => 'Filipino 10 workbook with some answers filled in pencil. Easy to erase.',
                'price'       => 80,
                'category'    => 'books',
                'condition'   => 'fair',
                'location'    => 'Cebu City',
            ],
        ];

        foreach ($items as $item) {
            MarketplaceItem::firstOrCreate(
                ['title' => $item['title'], 'user_id' => $item['user_id']],
                $item
            );
        }
    }
}