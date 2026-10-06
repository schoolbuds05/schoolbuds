<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\GradeController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\FeeController;
use App\Http\Controllers\Api\AiStudyController;
use App\Http\Controllers\Api\TeacherController;
use App\Http\Controllers\Api\MarketplaceController;
use App\Http\Controllers\Api\EnrollmentController;
use App\Http\Controllers\Api\CourseController;
use App\Http\Controllers\Api\SubjectSectionController;
use App\Http\Controllers\Api\SubjectChangeRequestController;
use App\Http\Controllers\Api\TeacherChatController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AdminStudentController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ParentController;
use App\Http\Controllers\Api\RewardController;
use App\Http\Controllers\Api\AssignmentController;
use App\Http\Controllers\Api\PropertyCustodianController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AcademicTermController;
use App\Http\Controllers\Api\AcademicLeadershipController;
use App\Http\Controllers\Api\CourseShiftRequestController;

// ── Public routes (no login required) ────────────────────────────
Route::post('/login',            [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/register',         [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/forgot-password',  [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/reset-password',   [AuthController::class, 'resetPassword']);
Route::get('/enrollment/status', [EnrollmentController::class, 'status']);
Route::get('/enrollment/lookup', [EnrollmentController::class, 'lookup']);
Route::get('/enrollment/settings', [AcademicTermController::class, 'current']);
Route::get('/sections',          [SubjectSectionController::class, 'sectionIndex']);
Route::get('/sections/{id}',     [SubjectSectionController::class, 'sectionShow']);
Route::get('/subjects',          [SubjectSectionController::class, 'subjectIndex']);
Route::get('/courses',           [CourseController::class, 'index']);
Route::post('/paymongo/webhook', [MarketplaceController::class, 'paymongoWebhook']);

// ── Protected routes (login required) ────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me',      [AuthController::class, 'me']);
    Route::post('/enrollment', [EnrollmentController::class, 'store']);
    Route::post('/enrollment/prerequisites', [EnrollmentController::class, 'prerequisiteStatus']);
    Route::get('/my-course-shift-requests', [CourseShiftRequestController::class, 'mine']);
    Route::post('/my-course-shift-requests', [CourseShiftRequestController::class, 'store']);
    Route::post('/me/profile-photo', [AuthController::class, 'updateProfilePhoto']);
    Route::put('/me/password', [AuthController::class, 'updatePassword']);

    // Admin-only (apiResources)
    Route::middleware('role:admin')->group(function () {
        Route::apiResource('students', StudentController::class);
        Route::apiResource('grades', GradeController::class);
        Route::apiResource('attendances', AttendanceController::class);
        Route::apiResource('fees', FeeController::class);
        Route::post('/students/{student}/rewards', [RewardController::class, 'award']);
    });

    // Shared/Student
    Route::post('/fees/{fee}/pay', [FeeController::class, 'pay']);
    Route::get('/my-fees', [FeeController::class, 'mine']);
    Route::get('/students/{student}/grades',     [GradeController::class, 'byStudent']);
    Route::get('/students/{student}/attendance', [AttendanceController::class, 'byStudent']);
    Route::get('/students/{student}/fees',       [FeeController::class, 'byStudent']);
    Route::get('/dashboard/student',             [StudentController::class, 'dashboard']);
    Route::get('/my-grades', [GradeController::class, 'mine']);
    Route::get('/dashboard/parent',              [ParentController::class, 'dashboard']);
    Route::get('/my-subjects', [SubjectSectionController::class, 'mySubjects']);
    Route::get('/my-subject-change-requests', [SubjectChangeRequestController::class, 'mine']);
    Route::post('/my-subject-change-requests', [SubjectChangeRequestController::class, 'store']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/preferences', [NotificationController::class, 'preferences']);
    Route::put('/notifications/preferences', [NotificationController::class, 'updatePreferences']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::get('/rewards/me', [RewardController::class, 'mine']);
    
    Route::get('/assignments', [AssignmentController::class, 'studentIndex']);
    Route::get('/assignments/{assignment}', [AssignmentController::class, 'show']);
    Route::post('/assignments/{assignment}/violation', [AssignmentController::class, 'recordViolation']);
    Route::post('/assignments/{assignment}/submit', [AssignmentController::class, 'submit']);

    // Registrar & Admin
    Route::middleware('role:admin,registrar')->group(function () {
        Route::post('/courses',        [CourseController::class, 'store']);
        Route::put('/courses/{id}',    [CourseController::class, 'update']);
        Route::delete('/courses/{id}', [CourseController::class, 'destroy']);

        Route::post('/subjects',           [SubjectSectionController::class, 'subjectStore']);
        Route::put('/subjects/{id}',       [SubjectSectionController::class, 'subjectUpdate']);
        Route::delete('/subjects/{id}',    [SubjectSectionController::class, 'subjectDestroy']);
        Route::get('/subjects/{id}/prerequisites',                          [SubjectSectionController::class, 'subjectPrerequisites']);
        Route::post('/subjects/{id}/prerequisites',                         [SubjectSectionController::class, 'addSubjectPrerequisite']);
        Route::delete('/subjects/{id}/prerequisites/{prerequisiteId}',      [SubjectSectionController::class, 'removeSubjectPrerequisite']);

        // Sections (registrar)
        Route::post('/sections',                             [SubjectSectionController::class, 'sectionStore']);
        Route::put('/sections/{id}',                         [SubjectSectionController::class, 'sectionUpdate']);
        Route::delete('/sections/{id}',                      [SubjectSectionController::class, 'sectionDestroy']);
        Route::post('/sections/{id}/subjects',               [SubjectSectionController::class, 'assignSubject']);
        Route::delete('/sections/{id}/subjects/{subjectId}', [SubjectSectionController::class, 'removeSubject']);
        Route::post('/sections/{id}/students',               [SubjectSectionController::class, 'enrollStudent']);
        Route::delete('/sections/{id}/students/{userId}',    [SubjectSectionController::class, 'removeStudent']);

        // Registrar
        Route::get('/registrar/teachers',                   [SubjectSectionController::class, 'teacherIndex']);
        Route::get('/registrar/section-students',           [SubjectSectionController::class, 'studentIndex']);
        Route::get('/registrar/enrollments',                [EnrollmentController::class, 'index']);
        Route::get('/registrar/course-shift-requests',     [CourseShiftRequestController::class, 'index']);
        Route::post('/registrar/course-shift-requests/{courseShiftRequest}/review', [CourseShiftRequestController::class, 'review']);
        Route::get('/registrar/subject-change-requests',    [SubjectChangeRequestController::class, 'index']);
        Route::post('/registrar/subject-change-requests/{subjectChangeRequest}/approve', [SubjectChangeRequestController::class, 'approve']);
        Route::post('/registrar/subject-change-requests/{subjectChangeRequest}/reject', [SubjectChangeRequestController::class, 'reject']);
        Route::get('/registrar/enrollments/{id}',           [EnrollmentController::class, 'show']);
        Route::post('/registrar/enrollments/{id}/approve',  [EnrollmentController::class, 'approve']);
        Route::post('/registrar/enrollments/{id}/reject',   [EnrollmentController::class, 'reject']);
        Route::post('/registrar/students',                  [EnrollmentController::class, 'storeStudent']);
        Route::get('/registrar/students',                   [AdminStudentController::class, 'index']);
        Route::put('/registrar/students/{student}',         [AdminStudentController::class, 'update']);
        Route::post('/registrar/students/{student}/reset-password', [AdminStudentController::class, 'resetPassword']);
        Route::post('/registrar/students/{student}/subjects/{subject}/drop', [AdminStudentController::class, 'dropSubject']);
        Route::post('/registrar/students/{student}/subjects/{subject}/restore', [AdminStudentController::class, 'restoreSubject']);
        Route::get('/registrar/event-participations',       [RewardController::class, 'eventIndex']);
        Route::post('/registrar/event-participations/{participation}/approve', [RewardController::class, 'approveEvent']);
        Route::post('/registrar/event-participations/{participation}/reject', [RewardController::class, 'rejectEvent']);
    });

    // AI
    Route::post('/ai/chat',       [AiStudyController::class, 'chat']);
    Route::post('/ai/quick-quiz', [AiStudyController::class, 'quickQuiz']);

    // Teacher & Admin
    Route::middleware('role:admin,faculty')->group(function () {
        Route::get('/teacher/dashboard',                 [TeacherController::class, 'dashboard']);
        Route::get('/teacher/classes',                   [TeacherController::class, 'classes']);
        Route::get('/teacher/class/{class}/students',    [TeacherController::class, 'classStudents']);
        Route::post('/teacher/class/{class}/grades',     [TeacherController::class, 'saveGrades']);
        Route::post('/teacher/class/{class}/attendance', [TeacherController::class, 'saveAttendance']);
        Route::get('/teacher/class/{class}/attendance',  [TeacherController::class, 'getAttendance']);
        Route::get('/teacher/class/{class}/performance', [TeacherController::class, 'classPerformance']);
        Route::get('/teacher/assignments', [AssignmentController::class, 'teacherIndex']);
        Route::post('/teacher/assignments/generate-quiz', [AssignmentController::class, 'generateQuiz']);
        Route::post('/teacher/assignments', [AssignmentController::class, 'store']);
        Route::put('/teacher/assignments/{assignment}', [AssignmentController::class, 'update']);
        Route::delete('/teacher/assignments/{assignment}', [AssignmentController::class, 'destroy']);
        Route::post('/teacher/assignments/{assignment}/submissions/{submission}/grade', [AssignmentController::class, 'grade']);

        Route::post('/teacher/event-participations', [RewardController::class, 'verifyEvent']);
    });

    // Dean & head teacher — school-wide academic oversight (read-only)
    Route::middleware('role:faculty')->group(function () {
        Route::get('/academic-leadership/dashboard', [AcademicLeadershipController::class, 'dashboard']);
    });

    // Shared teacher/student
    Route::get('/my-classes',                        [SubjectSectionController::class, 'myClasses']);

    // Teacher-student chat
    Route::get('/teacher-chat/contacts',              [TeacherChatController::class, 'contacts']);
    Route::get('/teacher-chat/{contact}/messages',    [TeacherChatController::class, 'messages']);
    Route::post('/teacher-chat/{contact}/messages',   [TeacherChatController::class, 'send']);

    // Marketplace
    Route::get('/marketplace/my-items',        [MarketplaceController::class, 'myItems']);
    Route::get('/marketplace/my-orders',       [MarketplaceController::class, 'myOrders']);
    Route::get('/marketplace/my-chats',        [MarketplaceController::class, 'myChats']);
    Route::get('/marketplace/sales',           [MarketplaceController::class, 'sales']);
    Route::get('/marketplace/payment-options', [MarketplaceController::class, 'paymentOptions']);
    Route::get('/marketplace/settings', [MarketplaceController::class, 'settings']);
    Route::put('/marketplace/settings', [MarketplaceController::class, 'updateSettings']);
    Route::post('/marketplace/{item}/approve', [MarketplaceController::class, 'approve']);
    Route::post('/marketplace/{item}/reject', [MarketplaceController::class, 'reject']);
    Route::post('/marketplace/orders/{order}/mark-paid', [MarketplaceController::class, 'markOrderPaid']);
    Route::post('/marketplace/orders/{order}/refund', [MarketplaceController::class, 'refundOrder']);
    Route::post('/marketplace/orders/{order}/refund/approve', [MarketplaceController::class, 'approveRefund']);
    Route::post('/marketplace/orders/{order}/refund/reject', [MarketplaceController::class, 'rejectRefund']);
    Route::post('/marketplace/orders/{order}/received', [MarketplaceController::class, 'markOrderReceived']);
    Route::post('/marketplace/orders/{order}/cancel', [MarketplaceController::class, 'cancelOrder']);
    Route::get('/marketplace/orders/{order}/receipt', [MarketplaceController::class, 'receipt']);
    Route::get('/marketplace',                 [MarketplaceController::class, 'index']);
    Route::post('/marketplace',                [MarketplaceController::class, 'store']);
    Route::get('/marketplace/{item}',          [MarketplaceController::class, 'show']);
    Route::post('/marketplace/{item}/buy',     [MarketplaceController::class, 'buy']);
    Route::post('/marketplace/{item}/paymongo-checkout', [MarketplaceController::class, 'paymongoCheckout']);
    Route::put('/marketplace/{item}',          [MarketplaceController::class, 'update']);
    Route::delete('/marketplace/{item}',       [MarketplaceController::class, 'destroy']);
    Route::post('/marketplace/{item}/message', [MarketplaceController::class, 'sendMessage']);
    Route::get('/marketplace/{item}/messages', [MarketplaceController::class, 'getMessages']);

    // Property custodian
    Route::get('/property-custodian/dashboard', [PropertyCustodianController::class, 'dashboard']);
    Route::post('/property-custodian/assets', [PropertyCustodianController::class, 'store']);
    Route::put('/property-custodian/assets/{asset}', [PropertyCustodianController::class, 'update']);
    Route::delete('/property-custodian/assets/{asset}', [PropertyCustodianController::class, 'destroy']);

    // Admin
    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/dashboard',      [AdminUserController::class, 'dashboard']);
        Route::get('/admin/activity-logs',  [ActivityLogController::class, 'index']);
        Route::get('/admin/users',          [AdminUserController::class, 'index']);
        Route::post('/admin/users',         [AdminUserController::class, 'store']);
        Route::put('/admin/users/{user}',   [AdminUserController::class, 'update']);
        Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
        Route::get('/admin/students',       [AdminStudentController::class, 'index']);
        Route::put('/admin/students/{student}', [AdminStudentController::class, 'update']);
        Route::post('/admin/students/{student}/reset-password', [AdminStudentController::class, 'resetPassword']);
        Route::delete('/admin/students/{student}', [AdminStudentController::class, 'destroy']);
        Route::get('/admin/academic-terms',             [AcademicTermController::class, 'index']);
        Route::post('/admin/academic-terms',            [AcademicTermController::class, 'upsert']);
    });
});
