<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        foreach (User::ROLES as $role) {
            Role::findOrCreate($role, 'web');
        }

        $users = [
            [
                'name' => 'Admin',
                'email' => 'admin@school.com',
                'role' => User::ROLE_ADMIN,
                'position' => null,
            ],
            [
                'name' => 'Registrar',
                'email' => 'registrar@school.com',
                'role' => User::ROLE_REGISTRAR,
                'position' => null,
            ],
            [
                'name' => 'Faculty',
                'email' => 'faculty@school.com',
                'role' => User::ROLE_FACULTY,
                'position' => null,
            ],
            [
                'name' => 'Student',
                'email' => 'student@school.com',
                'role' => User::ROLE_STUDENT,
                'position' => null,
            ],
            [
                'name' => 'Parent',
                'email' => 'parent@school.com',
                'role' => User::ROLE_PARENT,
                'position' => null,
            ],
            [
                'name' => 'Staff',
                'email' => 'staff@school.com',
                'role' => User::ROLE_STAFF,
                'position' => null,
            ],
        ];

        foreach ($users as $userData) {
            $user = User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    'name' => $userData['name'],
                    'password' => Hash::make('password'),
                    'role' => $userData['role'],
                    'position' => $userData['position'],
                ]
            );

            $user->syncRoles([$userData['role']]);
        }
    }
}
