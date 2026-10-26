<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TeachingEligibilityController;
use App\Http\Controllers\SectionGenerationController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ActivityLogController;
use App\Http\Controllers\Admin\StudentManageController;
use App\Http\Controllers\Admin\SystemControlController;
use App\Http\Controllers\Admin\UserManageController;
use App\Http\Controllers\Admin\DepartmentController;
use App\Http\Controllers\Admin\RoomController;
use App\Http\Controllers\Registrar\GradeApprovalController;
use App\Http\Controllers\Registrar\TuitionFeeController;
use App\Http\Controllers\Registrar\GradeChangeRequestController as RegistrarGradeChangeRequestController;
use App\Http\Controllers\Registrar\DashboardController as RegistrarDashboardController;
use App\Http\Controllers\Registrar\EnrollmentReviewController;
use App\Http\Controllers\Registrar\CourseController as RegistrarCourseController;
use App\Http\Controllers\Registrar\PointsController;
use App\Http\Controllers\Registrar\ProfileController as RegistrarProfileController;
use App\Http\Controllers\Registrar\SectionController as RegistrarSectionController;
use App\Http\Controllers\Registrar\SubjectController as RegistrarSubjectController;
use App\Http\Controllers\Registrar\SubjectChangeRequestController as RegistrarSubjectChangeRequestController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\ArchiveController;
use App\Http\Controllers\PropertyCustodian\DashboardController as PropertyCustodianDashboardController;
use App\Http\Controllers\Teacher\DashboardController as TeacherDashboard;
use App\Http\Controllers\Teacher\GradeEntryController;
use App\Http\Controllers\Teacher\GradeChangeRequestController as TeacherGradeChangeRequestController;
use App\Http\Controllers\Teacher\AttendanceController as TeacherAttendance;
use App\Http\Controllers\Api\AssignmentController;
use App\Http\Controllers\Api\FeeController;
use App\Http\Controllers\DepartmentChairController;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

$webPortalRoles = [
    User::ROLE_ADMIN,
    User::ROLE_REGISTRAR,
    User::ROLE_FACULTY,
    User::POSITION_TEACHER,
    User::POSITION_HEAD_DEPARTMENT,
    User::POSITION_HEAD_TEACHER,
    User::POSITION_DEAN,
    User::POSITION_PROPERTY_CUSTODIAN,
];

$redirectToPortalDashboard = function ($user) {
    $isPropertyCustodian = (
        $user->role === User::ROLE_STAFF
        && $user->position === User::POSITION_PROPERTY_CUSTODIAN
    ) || $user->role === User::POSITION_PROPERTY_CUSTODIAN;

    return match (true) {
        $user->role === User::ROLE_ADMIN => redirect('/admin/dashboard'),
        $user->role === User::ROLE_REGISTRAR => redirect('/registrar/dashboard'),
        $user->role === User::ROLE_FACULTY || in_array($user->position, User::POSITIONS[User::ROLE_FACULTY], true) => redirect('/teacher/dashboard'),
        $isPropertyCustodian => redirect('/property-custodian/dashboard'),
        default => redirect('/login'),
    };
};

Route::get('/', function () use ($redirectToPortalDashboard) {
    if (!auth()->check()) {
        return redirect('/login');
    }

    $user = auth()->user();
    $isPropertyCustodian = (
        $user->role === User::ROLE_STAFF
        && $user->position === User::POSITION_PROPERTY_CUSTODIAN
    ) || $user->role === User::POSITION_PROPERTY_CUSTODIAN;
    $isAllowedWebUser = in_array($user->role, [
        User::ROLE_ADMIN,
        User::ROLE_REGISTRAR,
        User::ROLE_FACULTY,
    ], true) || $isPropertyCustodian;

    if (!$isAllowedWebUser) {
        Auth::guard('web')->logout();
        request()->session()->invalidate();
        request()->session()->regenerateToken();

        return redirect('/login');
    }

    return $redirectToPortalDashboard($user);
});

Route::get('/dashboard', function () use ($redirectToPortalDashboard) {
    $user = auth()->user();
    $isPropertyCustodian = (
        $user->role === User::ROLE_STAFF
        && $user->position === User::POSITION_PROPERTY_CUSTODIAN
    ) || $user->role === User::POSITION_PROPERTY_CUSTODIAN;
    $isAllowedWebUser = in_array($user->role, [
        User::ROLE_ADMIN,
        User::ROLE_REGISTRAR,
        User::ROLE_FACULTY,
    ], true) || $isPropertyCustodian;

    if (!$isAllowedWebUser) {
        Auth::guard('web')->logout();
        request()->session()->invalidate();
        request()->session()->regenerateToken();

        return redirect('/login');
    }

    return $redirectToPortalDashboard($user);
})->middleware(['auth', 'web.roles:' . implode(',', $webPortalRoles)])->name('dashboard');

Route::middleware(['auth', 'web.roles:admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/fees', [DashboardController::class, 'fees'])->name('fees.index');
    Route::post('/fees/{fee}/verify-payment', [FeeController::class, 'verifyPayment'])->name('fees.verify-payment');
    Route::get('/students', [StudentManageController::class, 'index'])->name('students.index');
    Route::get('/students/template', [StudentManageController::class, 'template'])->name('students.template');
    Route::get('/students/export', [StudentManageController::class, 'export'])->name('students.export');
    Route::post('/students/import', [StudentManageController::class, 'import'])->name('students.import');
    Route::get('/students/{student}', [StudentManageController::class, 'show'])->name('students.show');
    Route::put('/students/{student}', [StudentManageController::class, 'update'])->name('students.update');
    Route::put('/students/{student}/parent', [StudentManageController::class, 'updateParent'])->name('students.parent.update');
    Route::post('/students/{student}/fees', [StudentManageController::class, 'storeFee'])->name('students.fees.store');
    Route::post('/students/{student}/fees/{fee}/pay', [StudentManageController::class, 'markFeePaid'])->name('students.fees.pay');
    Route::get('/controls', [SystemControlController::class, 'index'])->name('controls.index');
    Route::post('/controls', [SystemControlController::class, 'store'])->name('controls.store');
    Route::post('/points-configuration', [SystemControlController::class, 'storePoints'])->name('points-configuration.store');
    Route::get('/activity', [ActivityLogController::class, 'index'])->name('activity.index');
    Route::get('/reports', [ReportsController::class, 'admin'])->name('reports.index');
    Route::get('/archive', [ArchiveController::class, 'index'])->name('archive.index');
    Route::post('/archive/{archive}/restore', [ArchiveController::class, 'restore'])->name('archive.restore');
    Route::get('/users', [UserManageController::class, 'index'])->name('users.index');
    Route::post('/users', [UserManageController::class, 'store'])->name('users.store');
    Route::put('/users/{user}', [UserManageController::class, 'update'])->name('users.update');
    Route::delete('/users/{user}', [UserManageController::class, 'destroy'])->name('users.destroy');
    Route::get('/departments', [DepartmentController::class, 'index'])->name('departments.index');
    Route::post('/departments', [DepartmentController::class, 'store'])->name('departments.store');
    Route::put('/departments/{department}', [DepartmentController::class, 'update'])->name('departments.update');
    Route::post('/departments/{department}/teachers/{user}/remove', [DepartmentController::class, 'removeTeacher'])->name('departments.teachers.remove');
    Route::get('/rooms', [RoomController::class, 'index'])->name('rooms.index');
    Route::post('/rooms', [RoomController::class, 'store'])->name('rooms.store');
    Route::put('/rooms/{room}', [RoomController::class, 'update'])->name('rooms.update');
    Route::get('/courses', [RegistrarCourseController::class, 'index'])->name('courses.index');
    Route::post('/courses', [RegistrarCourseController::class, 'store'])->name('courses.store');
    Route::put('/courses/{course}', [RegistrarCourseController::class, 'update'])->name('courses.update');
    Route::delete('/courses/{course}', [RegistrarCourseController::class, 'destroy'])->name('courses.destroy');
});

Route::middleware(['auth', 'web.roles:registrar,head_department'])->prefix('registrar')->name('registrar.')->group(function () {
    Route::get('/dashboard', [RegistrarDashboardController::class, 'index'])->name('dashboard');
    Route::get('/tuition', [TuitionFeeController::class, 'index'])->middleware('web.roles:registrar')->name('tuition.index');
    Route::post('/tuition', [TuitionFeeController::class, 'store'])->middleware('web.roles:registrar')->name('tuition.store');
    Route::get('/enrollments', [EnrollmentReviewController::class, 'index'])->name('enrollments.index');
    Route::get('/enrollments/{enrollment}', [EnrollmentReviewController::class, 'show'])->name('enrollments.show');
    Route::get('/enrollments/{enrollment}/approve', [EnrollmentReviewController::class, 'approveRequiresPost'])->name('enrollments.approve.get');
    Route::post('/enrollments/{enrollment}/approve', [EnrollmentReviewController::class, 'approve'])->name('enrollments.approve');
    Route::get('/enrollments/{enrollment}/reject', [EnrollmentReviewController::class, 'rejectRequiresPost'])->name('enrollments.reject.get');
    Route::post('/enrollments/{enrollment}/reject', [EnrollmentReviewController::class, 'reject'])->name('enrollments.reject');
    Route::get('/students', [StudentManageController::class, 'index'])->name('students.index');
    Route::get('/students/template', [StudentManageController::class, 'template'])->name('students.template');
    Route::get('/students/export', [StudentManageController::class, 'export'])->name('students.export');
    Route::post('/students/import', [StudentManageController::class, 'import'])->name('students.import');
    Route::get('/students/{student}', [StudentManageController::class, 'show'])->name('students.show');
    Route::put('/students/{student}', [StudentManageController::class, 'update'])->name('students.update');
    Route::put('/students/{student}/parent', [StudentManageController::class, 'updateParent'])->name('students.parent.update');
    Route::post('/students/{student}/fees', [StudentManageController::class, 'storeFee'])->name('students.fees.store');
    Route::post('/students/{student}/fees/{fee}/pay', [StudentManageController::class, 'markFeePaid'])->name('students.fees.pay');
    Route::get('/rooms', [RoomController::class, 'index'])->middleware('web.roles:registrar')->name('rooms.index');
    Route::post('/rooms', [RoomController::class, 'store'])->middleware('web.roles:registrar')->name('rooms.store');
    Route::put('/rooms/{room}', [RoomController::class, 'update'])->middleware('web.roles:registrar')->name('rooms.update');
    Route::get('/subjects', [RegistrarSubjectController::class, 'index'])->name('subjects.index');
    Route::post('/subjects', [RegistrarSubjectController::class, 'store'])->name('subjects.store');
    Route::put('/subjects/bulk', [RegistrarSubjectController::class, 'bulkUpdate'])->name('subjects.bulk-update');
    Route::put('/subjects/{subject}', [RegistrarSubjectController::class, 'update'])->name('subjects.update');
    Route::delete('/subjects/{subject}', [RegistrarSubjectController::class, 'destroy'])->name('subjects.destroy');
    Route::get('/subject-requests', [RegistrarSubjectChangeRequestController::class, 'index'])->name('subject-requests.index');
    Route::post('/subject-requests/{subjectRequest}/approve', [RegistrarSubjectChangeRequestController::class, 'approve'])->name('subject-requests.approve');
    Route::post('/subject-requests/{subjectRequest}/reject', [RegistrarSubjectChangeRequestController::class, 'reject'])->name('subject-requests.reject');
    Route::get('/course-shift-requests', [EnrollmentReviewController::class, 'courseShiftRequests'])->name('course-shift-requests.index');
    Route::post('/course-shift-requests/{courseShiftRequest}/credits', [EnrollmentReviewController::class, 'storeCourseShiftCredit'])->name('course-shift-requests.credits.store');
    Route::post('/course-shift-requests/{courseShiftRequest}/review', [EnrollmentReviewController::class, 'reviewCourseShiftRequest'])->name('course-shift-requests.review');
    Route::get('/sections/generate', [SectionGenerationController::class, 'options'])->name('sections.generate');
    Route::post('/sections/generate/preview', [SectionGenerationController::class, 'preview'])->name('sections.generate.preview')->middleware('throttle:20,1');
    Route::post('/sections/generate', [SectionGenerationController::class, 'store'])->name('sections.generate.store')->middleware('throttle:20,1');
    Route::get('/sections', [RegistrarSectionController::class, 'index'])->name('sections.index');
    Route::post('/sections', [RegistrarSectionController::class, 'store'])->name('sections.store');
    Route::post('/sections/{section}/submit', [RegistrarSectionController::class, 'submit'])->name('sections.submit');
    Route::post('/sections/{section}/edit-requests', [RegistrarSectionController::class, 'requestEdit'])->name('sections.edit-requests.store')->middleware('web.roles:head_department');
    Route::post('/sections/{section}/transfer-requests', [RegistrarSectionController::class, 'requestTransfer'])->name('sections.transfer-requests.store')->middleware('web.roles:head_department');
    Route::post('/section-transfer-requests/{transferRequest}/review', [RegistrarSectionController::class, 'reviewTransfer'])->name('section-transfer-requests.review')->middleware('web.roles:registrar,admin');
    Route::post('/section-edit-requests/{editRequest}/review', [RegistrarSectionController::class, 'reviewEditRequest'])->name('section-edit-requests.review')->middleware('web.roles:admin,registrar');
    Route::post('/sections/{section}/review', [RegistrarSectionController::class, 'review'])->name('sections.review');
    Route::post('/sections/{section}/close', [RegistrarSectionController::class, 'close'])->name('sections.close');
    Route::post('/sections/{section}/reopen', [RegistrarSectionController::class, 'reopen'])->name('sections.reopen');
    Route::put('/sections/{section}', [RegistrarSectionController::class, 'update'])->name('sections.update');
    Route::delete('/sections/{section}', [RegistrarSectionController::class, 'destroy'])->name('sections.destroy');
    Route::post('/sections/{section}/subjects', [RegistrarSectionController::class, 'assignSubject'])->name('sections.subjects.store');
    Route::delete('/sections/{section}/subjects/{sectionSubject}', [RegistrarSectionController::class, 'removeSubject'])->name('sections.subjects.destroy');
    Route::post('/sections/{section}/students', [RegistrarSectionController::class, 'enrollStudent'])->name('sections.students.store');
    Route::delete('/sections/{section}/students/{student}', [RegistrarSectionController::class, 'removeStudent'])->name('sections.students.destroy');
    Route::get('/points', [PointsController::class, 'index'])->name('points.index');
    Route::post('/points', [PointsController::class, 'store'])->name('points.store');
    Route::get('/grades', [GradeApprovalController::class, 'index'])->name('grades.index');
    Route::post('/grades/import', [GradeApprovalController::class, 'import'])->name('grades.import');
    Route::get('/grades/export', [GradeApprovalController::class, 'export'])->name('grades.export');
    Route::post('/grades/{submission}/review', [GradeApprovalController::class, 'review'])->name('grades.review');
    Route::post('/grade-change-requests/{changeRequest}/review', [RegistrarGradeChangeRequestController::class, 'review'])->name('grade-change-requests.review');
    Route::get('/reports', [ReportsController::class, 'registrar'])->name('reports.index');
    Route::get('/profile', [RegistrarProfileController::class, 'show'])->name('profile.show');
    Route::post('/profile/photo', [RegistrarProfileController::class, 'updatePhoto'])->name('profile.photo.update');
});

Route::middleware(['auth', 'web.roles:admin,faculty,teacher,head_department,head_teacher,dean'])->prefix('teacher')->name('teacher.')->group(function () {
    Route::get('/dashboard',                    [TeacherDashboard::class, 'index'])->name('dashboard');
    Route::get('/classes',                      [TeacherDashboard::class, 'classes'])->name('classes');
    Route::get('/assignments',                  [TeacherDashboard::class, 'assignments'])->name('assignments');
    Route::post('/assignments/generate-quiz', [AssignmentController::class, 'generateQuiz'])->name('assignments.generate-quiz');
    Route::post('/assignments',                 [TeacherDashboard::class, 'storeAssignment'])->name('assignments.store');
    Route::post('/assignments/{assignment}/publish', [TeacherDashboard::class, 'publishAssignment'])->name('assignments.publish');
    Route::post('/assignments/{assignment}/archive', [TeacherDashboard::class, 'archiveAssignment'])->name('assignments.archive');
    Route::put('/assignments/{assignment}/draft', [TeacherDashboard::class, 'updateDraftAssignment'])->name('assignments.draft.update');
    Route::get('/market',                       [TeacherDashboard::class, 'market'])->middleware('marketplace.access')->name('market');
    Route::post('/market/{item}/buy',           [TeacherDashboard::class, 'buyMarketItem'])->name('market.buy');
    Route::get('/chat',                         [TeacherDashboard::class, 'chat'])->name('chat');
    Route::post('/chat',                        [TeacherDashboard::class, 'sendChat'])->name('chat.send');
    Route::get('/profile',                      [TeacherDashboard::class, 'profile'])->name('profile');
    Route::get('/class/{class}',                [TeacherDashboard::class, 'myClass'])->name('class');
    Route::get('/class/{class}/grades',         [GradeEntryController::class, 'index'])->name('grades');
    Route::post('/class/{class}/grades',        [GradeEntryController::class, 'store'])->name('grades.store');
    Route::post('/class/{class}/grades/{submission}/change-request', [TeacherGradeChangeRequestController::class, 'store'])->name('grades.change-request');
    Route::get('/class/{class}/attendance',     [TeacherAttendance::class, 'index'])->name('attendance');
    Route::post('/class/{class}/attendance',    [TeacherAttendance::class, 'store'])->name('attendance.store');
});

Route::middleware(['auth', 'web.roles:faculty,head_department'])->prefix('department-chair')->name('department-chair.')->group(function () {
    Route::get('/sections/generate', [SectionGenerationController::class, 'options'])->name('sections.generate');
    Route::post('/sections/generate/preview', [SectionGenerationController::class, 'preview'])->name('sections.generate.preview')->middleware('throttle:20,1');
    Route::post('/sections/generate', [SectionGenerationController::class, 'store'])->name('sections.generate.store')->middleware('throttle:20,1');
    Route::get('/sections', [RegistrarSectionController::class, 'index'])->name('sections.index');
    Route::post('/sections', [RegistrarSectionController::class, 'store'])->name('sections.store');
    Route::post('/sections/{section}/submit', [RegistrarSectionController::class, 'submit'])->name('sections.submit');
    Route::post('/sections/{section}/edit-requests', [RegistrarSectionController::class, 'requestEdit'])->name('sections.edit-requests.store');
    Route::post('/sections/{section}/transfer-requests', [RegistrarSectionController::class, 'requestTransfer'])->name('sections.transfer-requests.store');
    Route::put('/sections/{section}', [RegistrarSectionController::class, 'update'])->name('sections.update');
    Route::delete('/sections/{section}', [RegistrarSectionController::class, 'destroy'])->name('sections.destroy');
    Route::post('/sections/{section}/subjects', [RegistrarSectionController::class, 'assignSubject'])->name('sections.subjects.store');
    Route::delete('/sections/{section}/subjects/{sectionSubject}', [RegistrarSectionController::class, 'removeSubject'])->name('sections.subjects.destroy');
    Route::post('/sections/{section}/students', [RegistrarSectionController::class, 'enrollStudent'])->name('sections.students.store');
    Route::delete('/sections/{section}/students/{student}', [RegistrarSectionController::class, 'removeStudent'])->name('sections.students.destroy');
    Route::get('/teachers', [DepartmentChairController::class, 'teachers'])->name('teachers');
    Route::get('/grades', [DepartmentChairController::class, 'grades'])->name('grades');
    Route::get('/grades/{submission}/review', [DepartmentChairController::class, 'reviewPage'])->name('grades.review.page');
    Route::post('/grades/{submission}/review', [DepartmentChairController::class, 'reviewGrades'])->name('grades.review');
    Route::post('/grade-change-requests/{changeRequest}/review', [DepartmentChairController::class, 'reviewGradeChangeRequest'])->name('grade-change-requests.review');
    Route::get('/students', [DepartmentChairController::class, 'students'])->name('students');
    Route::get('/reports', [DepartmentChairController::class, 'reports'])->name('reports');
});

Route::middleware(['auth', 'web.roles:admin,property_custodian'])->prefix('property-custodian')->name('property-custodian.')->group(function () {
    Route::get('/dashboard', [PropertyCustodianDashboardController::class, 'index'])->name('dashboard');
    Route::get('/market', [PropertyCustodianDashboardController::class, 'market'])->middleware('marketplace.access')->name('market');
    Route::get('/reports', [PropertyCustodianDashboardController::class, 'reports'])->name('reports');
    Route::post('/marketplace', [PropertyCustodianDashboardController::class, 'storeMarketplaceItem'])->middleware('marketplace.access')->name('marketplace.store');
    Route::put('/marketplace/{item}', [PropertyCustodianDashboardController::class, 'updateMarketplaceItem'])->middleware('marketplace.access')->name('marketplace.update');
    Route::delete('/marketplace/{item}', [PropertyCustodianDashboardController::class, 'destroyMarketplaceItem'])->middleware('marketplace.access')->name('marketplace.destroy');
    Route::post('/marketplace/orders/{order}/mark-paid', [PropertyCustodianDashboardController::class, 'markOrderPaid'])->middleware('marketplace.access')->name('marketplace.orders.mark-paid');
    Route::post('/marketplace/orders/{order}/refund/approve', [PropertyCustodianDashboardController::class, 'approveRefund'])->middleware('marketplace.access')->name('marketplace.orders.refund.approve');
    Route::post('/marketplace/orders/{order}/refund/reject', [PropertyCustodianDashboardController::class, 'rejectRefund'])->middleware('marketplace.access')->name('marketplace.orders.refund.reject');
});

require __DIR__.'/auth.php';

Route::middleware('auth')->group(function () {

    Route::get('/teaching-eligibility/mine', [TeachingEligibilityController::class, 'mine'])->name('teaching-eligibility.mine');
    Route::post('/teaching-eligibility/requests', [TeachingEligibilityController::class, 'store'])->name('teaching-eligibility.store');
    Route::get('/teaching-eligibility/department', [TeachingEligibilityController::class, 'chairIndex'])->name('teaching-eligibility.chair');
    Route::get('/registrar/teaching-eligibility', [TeachingEligibilityController::class, 'registrarIndex'])
        ->middleware('web.roles:registrar')->name('registrar.teaching-eligibility.index');
    Route::post('/registrar/teaching-eligibility/{eligibility}/review', [TeachingEligibilityController::class, 'reviewChairRequest'])
        ->middleware('web.roles:registrar')->name('registrar.teaching-eligibility.review');
    Route::post('/teaching-eligibility/grants', [TeachingEligibilityController::class, 'grant'])->name('teaching-eligibility.grant');
    Route::post('/teaching-eligibility/{eligibility}/review', [TeachingEligibilityController::class, 'review'])->name('teaching-eligibility.review');
    Route::post('/teaching-eligibility/{eligibility}/revoke', [TeachingEligibilityController::class, 'revoke'])->name('teaching-eligibility.revoke');
    Route::get('/teaching-eligibility/subject-departments', [TeachingEligibilityController::class, 'owners'])->name('teaching-eligibility.owners');
    Route::put('/teaching-eligibility/subject-departments/bulk', [TeachingEligibilityController::class, 'updateOwners'])->name('teaching-eligibility.update-owners');
    Route::put('/teaching-eligibility/subject-departments/{subject}', [TeachingEligibilityController::class, 'assignOwner'])->name('teaching-eligibility.assign-owner');
});
