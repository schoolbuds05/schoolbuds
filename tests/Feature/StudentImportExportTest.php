<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class StudentImportExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_download_full_student_template_without_login_credentials(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
        ]);
        $admin->assignRole(User::ROLE_ADMIN);

        $response = $this->actingAs($admin, 'web')
            ->get('/admin/students/template');

        $response->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $this->assertStringContainsString('student_id', $response->getContent());
        $this->assertStringContainsString('first_name', $response->getContent());
        $this->assertStringContainsString('parent_email', $response->getContent());
        $this->assertStringContainsString('section_subject_ids', $response->getContent());
        $headers = str_getcsv(strtok($response->getContent(), "\r\n"));
        $this->assertNotContains('email', $headers);
        $this->assertNotContains('password', $headers);
    }

    public function test_admin_can_import_legacy_student_and_enrollment_data_without_creating_an_account(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
        ]);
        $admin->assignRole(User::ROLE_ADMIN);

        $csv = <<<'CSV'
student_id,first_name,last_name,middle_name,birthdate,gender,religion,civil_status,citizenship,place_of_birth,contact_number,address,father_name,father_occupation,mother_name,mother_occupation,parent_email,prev_school,prev_school_address,student_type,academic_status,shiftee_from,shiftee_to,id_no,program_type,course_id,course,year_level,grade_level,strand,school_year,semester,subject_ids,section_subject_ids,document_urls,section,status,application_status,remarks
ST-001,Jane,Doe,Marie,12/15/2003,female,Christian,single,Filipino,Manila,09123456789,"Sample Address, Block 2",Juan Doe,Engineer,Maria Doe,Teacher,parent@example.com,Old School,Old Address,old_student,Regular,,,ST-001,shs,,,,11,STEM,2026-2027,1st,[],[],[],Section A,active,approved,Imported legacy record
CSV;

        $response = $this->actingAs($admin, 'web')
            ->post('/admin/students/import', [
                'file' => UploadedFile::fake()->createWithContent('students.csv', $csv),
            ]);

        $response->assertRedirect(route('admin.students.index'));
        $this->assertDatabaseHas('students', [
            'student_id' => 'ST-001',
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => null,
            'user_id' => null,
            'birthdate' => '2003-12-15',
            'school_year' => '2026-2027',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('enrollment_applications', [
            'id_no' => 'ST-001',
            'email' => null,
            'password' => null,
            'middle_name' => 'Marie',
            'parent_email' => 'parent@example.com',
            'program_type' => 'shs',
            'semester' => '1st',
            'status' => 'approved',
        ]);

        $this->assertSame(0, User::query()->where('role', User::ROLE_STUDENT)->count());

        $export = $this->get('/admin/students/export');
        $export->assertOk();
        $this->assertStringContainsString('Sample Address, Block 2', $export->getContent());
        $this->assertStringContainsString('parent@example.com', $export->getContent());
    }

    public function test_student_export_includes_enrollment_fields_but_never_account_credentials(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $admin->assignRole(User::ROLE_ADMIN);

        $response = $this->actingAs($admin, 'web')->get('/admin/students/export');

        $response->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('parent_email', $response->getContent());
        $this->assertStringContainsString('section_subject_ids', $response->getContent());
        $headers = str_getcsv(strtok($response->getContent(), "\r\n"));
        $this->assertNotContains('email', $headers);
        $this->assertNotContains('password', $headers);
    }
}
