<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ClassAssignment;
use App\Models\MarketplaceItem;
use App\Models\MarketplaceMessage;
use App\Models\MarketplaceOrder;
use App\Models\SchoolClass;
use App\Models\SchoolNotification;
use App\Models\SectionSubject;
use App\Models\Student;
use App\Models\Grade;
use App\Models\Attendance;
use App\Models\TeacherMessage;
use App\Models\User;
use App\Services\GradeWorkflowService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    public function index()
    {
        $teacher = auth()->user();

        if ($teacher?->position === User::POSITION_HEAD_DEPARTMENT) {
            return redirect()->route('department-chair.teachers');
        }

        $classes = $this->teacherClasses();

        $totalStudents = $this->teacherStudents()->count();

        $recentGrades = Grade::whereHas('schoolClass', fn($q) =>
            $q->where('teacher_id', $teacher->id)
        )->with(['student', 'schoolClass'])->latest()->take(5)->get();

        $todayAttendance = Attendance::whereHas('schoolClass', fn($q) =>
            $q->where('teacher_id', $teacher->id)
        )->whereDate('date', today())->count();

        return view('teacher.dashboard', compact(
            'classes', 'totalStudents', 'recentGrades', 'todayAttendance'
        ));
    }

    public function classes()
    {
        $classes = $this->teacherClasses();
        $rosters = $classes->mapWithKeys(fn (SchoolClass $class) => [
            $class->id => Student::query()
                ->where('grade_level', $class->grade_level)
                ->where('section', $class->section)
                ->where('school_year', $class->school_year)
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get(),
        ]);

        return view('teacher.classes', compact('classes', 'rosters'));
    }

    public function assignments()
    {
        $teacher = auth()->user();
        $assignments = ClassAssignment::query()
            ->where('teacher_id', $teacher->id)
            ->with(['sectionSubject.section', 'sectionSubject.subject'])
            ->withCount('submissions')
            ->latest()
            ->get();

        $sectionSubjects = SectionSubject::query()
            ->where('teacher_id', $teacher->id)
            ->with(['section', 'subject'])
            ->orderByDesc('id')
            ->get();

        return view('teacher.assignments', compact('assignments', 'sectionSubjects'));
    }

    public function storeAssignment(Request $request)
    {
        $data = $request->validate([
            'section_subject_id' => ['required', 'integer', Rule::exists('section_subjects', 'id')->where('teacher_id', $request->user()->id)],
            'type' => ['required', Rule::in(['assignment', 'quiz'])],
            'title' => ['required', 'string', 'max:160'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'points_possible' => ['required', 'numeric', 'min:1', 'max:1000'],
            'due_at' => ['nullable', 'date'],
            'status' => ['required', Rule::in(['draft', 'published', 'closed'])],
        ]);

        ClassAssignment::create([
            ...$data,
            'teacher_id' => $request->user()->id,
            'allow_file_upload' => $request->boolean('allow_file_upload'),
        ]);

        return back()->with('status', 'Class work created.');
    }

    public function market()
    {
        $items = MarketplaceItem::query()
            ->with('seller:id,name')
            ->where('approval_status', 'approved')
            ->where('status', 'available')
            ->latest()
            ->paginate(12);

        return view('teacher.market', compact('items'));
    }

    public function buyMarketItem(Request $request, MarketplaceItem $item)
    {
        $data = $request->validate([
            'payment_method' => ['required', Rule::in(['cash', 'gcash', 'qrph'])],
            'gcash_reference' => ['required_if:payment_method,gcash|required_if:payment_method,qrph', 'nullable', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'min:1'],
            'size' => ['nullable', 'string', 'max:30'],
        ]);

        if ($item->user_id === $request->user()->id) {
            return back()->withErrors(['marketplace' => 'You cannot buy your own listing.']);
        }

        if ($item->approval_status !== 'approved' || $item->status !== 'available' || $item->stock < 1) {
            return back()->withErrors(['marketplace' => 'This item is no longer available.']);
        }

        if ((int) $data['quantity'] > (int) $item->stock) {
            return back()->withErrors(['marketplace' => "Only {$item->stock} item(s) are available."]);
        }

        if ($data['payment_method'] === 'cash' && !$item->accepts_cash) {
            return back()->withErrors(['marketplace' => 'This seller does not accept cash for this item.']);
        }

        if ($data['payment_method'] === 'gcash' && !$item->accepts_gcash) {
            return back()->withErrors(['marketplace' => 'This seller does not accept GCash for this item.']);
        }

        if ($data['payment_method'] === 'qrph' && !$item->accepts_qrph) {
            return back()->withErrors(['marketplace' => 'This seller does not accept QRPH for this item.']);
        }

        $size = $this->validatedMarketplaceSize($item, $data['size'] ?? null);
        if ($size === false) {
            return back()->withErrors(['marketplace' => 'Please choose an available size for this uniform.']);
        }

        $quantity = (int) $data['quantity'];
        $subtotal = (float) $item->price * $quantity;
        $newStock = max(0, (int) $item->stock - $quantity);

        $item->update([
            'stock' => $newStock,
            'status' => $newStock === 0 ? 'reserved' : 'available',
        ]);

        $order = MarketplaceOrder::create([
            'marketplace_item_id' => $item->id,
            'buyer_id' => $request->user()->id,
            'seller_id' => $item->user_id,
            'quantity' => $quantity,
            'size' => $size,
            'unit_price' => $item->price,
            'original_amount' => $subtotal,
            'total_amount' => $subtotal,
            'points_redeemed' => 0,
            'points_discount' => 0,
            'payment_method' => $data['payment_method'],
            'gcash_reference' => in_array($data['payment_method'], ['gcash', 'qrph'], true) ? $data['gcash_reference'] : null,
            'status' => in_array($data['payment_method'], ['gcash', 'qrph'], true) ? 'pending_verification' : 'reserved',
        ]);

        $paymentText = match ($data['payment_method']) {
            'gcash' => 'GCash' . (!empty($data['gcash_reference']) ? " (reference: {$data['gcash_reference']})" : ''),
            'qrph' => 'QRPH' . (!empty($data['gcash_reference']) ? " (reference: {$data['gcash_reference']})" : ''),
            default => 'Cash on meetup',
        };

        MarketplaceMessage::create([
            'item_id' => $item->id,
            'sender_id' => $request->user()->id,
            'receiver_id' => $item->user_id,
            'message' => "I want to buy {$quantity} x {$item->title}" . ($size ? " (size {$size})" : '') . ". Payment method: {$paymentText}. Please let me know how we can complete the transaction.",
        ]);

        return back()->with('status', "Checkout started for {$item->title}. Order #{$order->id}.");
    }

    private function validatedMarketplaceSize(MarketplaceItem $item, ?string $requestedSize): string|false|null
    {
        $options = collect($item->size_options ?? [])
            ->map(fn ($size) => trim((string) $size))
            ->filter()
            ->values();

        if ($options->isEmpty()) {
            return null;
        }

        $requestedSize = trim((string) $requestedSize);
        if ($requestedSize === '') {
            return false;
        }

        return $options->first(fn ($size) => mb_strtolower($size) === mb_strtolower($requestedSize)) ?: false;
    }

    public function chat()
    {
        $teacher = auth()->user();
        $contacts = $this->teacherStudents()
            ->map(fn (Student $student) => $student->user)
            ->filter()
            ->unique('id')
            ->values();

        $messages = TeacherMessage::query()
            ->where('sender_id', $teacher->id)
            ->orWhere('receiver_id', $teacher->id)
            ->with(['sender:id,name', 'receiver:id,name'])
            ->latest()
            ->take(50)
            ->get()
            ->reverse()
            ->values();

        return view('teacher.chat', compact('contacts', 'messages'));
    }

    public function sendChat(Request $request)
    {
        $data = $request->validate([
            'receiver_id' => ['required', 'integer', 'exists:users,id'],
            'message' => ['required', 'string', 'max:1000'],
        ]);

        $allowedContactIds = $this->teacherStudents()
            ->pluck('user_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->all();

        abort_unless(in_array((int) $data['receiver_id'], $allowedContactIds, true), 403);

        $message = TeacherMessage::create([
            'sender_id' => $request->user()->id,
            'receiver_id' => $data['receiver_id'],
            'message' => $data['message'],
        ]);

        SchoolNotification::create([
            'user_id' => $data['receiver_id'],
            'type' => 'new_message',
            'title' => 'New message',
            'body' => "{$request->user()->name}: {$data['message']}",
            'channels' => ['in_app'],
            'data' => [
                'sender_id' => $request->user()->id,
                'message_id' => $message->id,
            ],
        ]);

        return back()->with('status', 'Message sent.');
    }

    public function profile()
    {
        $teacher = auth()->user();
        $classes = $this->teacherClasses();
        $assignmentsCount = ClassAssignment::where('teacher_id', $teacher->id)->count();

        return view('teacher.profile', compact('teacher', 'classes', 'assignmentsCount'));
    }

    public function myClass(SchoolClass $class, GradeWorkflowService $workflow)
    {
        $students = $workflow->classStudents($class);
        $isCollege = $workflow->isCollegeClass($class);

        $grades = Grade::where('school_class_id', $class->id)
            ->with('student')
            ->get()
            ->keyBy('student_id');

        return view('teacher.class', compact('class', 'students', 'grades', 'isCollege'));
    }

    private function teacherClasses()
    {
        SectionSubject::query()
            ->where('teacher_id', auth()->id())
            ->with(['section', 'subject'])
            ->get()
            ->each(fn (SectionSubject $sectionSubject) => $this->schoolClassForSectionSubject($sectionSubject));

        return SchoolClass::where('teacher_id', auth()->id())
            ->orderBy('grade_level')
            ->orderBy('section')
            ->orderBy('subject')
            ->get();
    }

    private function schoolClassForSectionSubject(SectionSubject $sectionSubject): SchoolClass
    {
        $section = $sectionSubject->section;
        $subject = $sectionSubject->subject;

        $schoolClass = SchoolClass::query()
            ->where('teacher_id', $sectionSubject->teacher_id)
            ->where('subject', $subject?->name ?? 'Subject')
            ->where('grade_level', $section?->year_level ?? '')
            ->where('section', $section?->name ?? '')
            ->where('school_year', $section?->school_year ?? '')
            ->first() ?? new SchoolClass();

        $schoolClass->name = "{$section?->name} - {$subject?->code}";
        $schoolClass->subject = $subject?->name ?? 'Subject';
        $schoolClass->grade_level = $section?->year_level ?? '';
        $schoolClass->section = $section?->name ?? '';
        $schoolClass->school_year = $section?->school_year ?? '';
        $schoolClass->teacher_id = $sectionSubject->teacher_id;
        $schoolClass->room = $sectionSubject->room;
        $schoolClass->schedule = trim(implode(' ', array_filter([
            $sectionSubject->day,
            ($sectionSubject->time_start && $sectionSubject->time_end)
                ? "{$sectionSubject->time_start}-{$sectionSubject->time_end}"
                : null,
        ])));
        $schoolClass->save();

        return $schoolClass;
    }

    private function teacherStudents()
    {
        $classes = $this->teacherClasses();

        if ($classes->isEmpty()) {
            return collect();
        }

        return Student::query()
            ->with('user:id,name,email')
            ->where(function ($query) use ($classes) {
                foreach ($classes as $class) {
                    $query->orWhere(function ($inner) use ($class) {
                        $inner->where('grade_level', $class->grade_level)
                            ->where('section', $class->section)
                            ->where('school_year', $class->school_year);
                    });
                }
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();
    }
}
