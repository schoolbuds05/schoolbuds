<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\SchoolNotification;
use App\Models\Student;
use App\Models\TeacherMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TeacherChatController extends Controller
{
    public function contacts(Request $request)
    {
        $user = $request->user();
        $contactIds = $this->contactIdsFor($user);

        $contacts = User::whereIn('id', $contactIds)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'profile_photo_path'])
            ->map(fn($contact) => $this->formatContact($user, $contact));

        return response()->json($contacts);
    }

    public function messages(Request $request, User $contact)
    {
        $user = $request->user();
        if (!$this->canChat($user, $contact->id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        TeacherMessage::where('sender_id', $contact->id)
            ->where('receiver_id', $user->id)
            ->update(['is_read' => true]);

        $messages = $this->conversationQuery($user->id, $contact->id)
            ->with('sender:id,name')
            ->orderBy('created_at')
            ->get();

        return response()->json($messages);
    }

    public function send(Request $request, User $contact)
    {
        $user = $request->user();
        if (!$this->canChat($user, $contact->id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'message' => 'required|string|max:1000',
        ]);

        $message = TeacherMessage::create([
            'sender_id' => $user->id,
            'receiver_id' => $contact->id,
            'message' => $data['message'],
        ]);

        SchoolNotification::create([
            'user_id' => $contact->id,
            'type' => 'new_message',
            'title' => 'New message',
            'body' => "{$user->name}: {$data['message']}",
            'channels' => ['in_app'],
            'data' => ['sender_id' => $user->id],
        ]);

        ActivityLog::record($request, 'teacher_chat_message_sent', "{$user->name} sent a teacher chat message to {$contact->name}.", [
            'subject_type' => TeacherMessage::class,
            'subject_id' => $message->id,
            'meta' => [
                'sender_id' => $user->id,
                'receiver_id' => $contact->id,
            ],
        ]);

        return response()->json($message->load('sender:id,name'), 201);
    }

    private function formatContact(User $user, User $contact): array
    {
        $last = $this->conversationQuery($user->id, $contact->id)
            ->latest()
            ->first();

        $unread = TeacherMessage::where('sender_id', $contact->id)
            ->where('receiver_id', $user->id)
            ->where('is_read', false)
            ->count();

        return [
            'id' => $contact->id,
            'name' => $contact->name,
            'email' => $contact->email,
            'role' => $contact->role,
            'profile_photo_url' => $contact->profile_photo_url,
            'student_info' => $this->studentInfoFor($user, $contact),
            'last_message' => $last?->message,
            'last_message_at' => $last?->created_at,
            'unread' => $unread,
        ];
    }

    private function canChat(User $user, int $contactId): bool
    {
        $contact = User::find($contactId);

        if (!$contact) {
            return false;
        }

        if ($this->hasRole($user, 'student') && !$this->hasAnyRole($contact, User::FACULTY_ROLES)) {
            return false;
        }

        if ($this->hasAnyRole($user, User::FACULTY_ROLES) && !$this->hasRole($contact, 'student')) {
            return false;
        }

        return in_array($contactId, $this->contactIdsFor($user), true);
    }

    private function conversationQuery(int $userId, int $contactId)
    {
        return TeacherMessage::query()
            ->where(function ($query) use ($userId, $contactId) {
                $query->where('sender_id', $userId)
                    ->where('receiver_id', $contactId);
            })
            ->orWhere(function ($query) use ($userId, $contactId) {
                $query->where('sender_id', $contactId)
                    ->where('receiver_id', $userId);
            });
    }

    private function contactIdsFor(User $user): array
    {
        if ($this->hasAnyRole($user, User::FACULTY_ROLES)) {
            $sectionStudentIds = DB::table('section_students')
                ->join('section_subjects', 'section_students.section_id', '=', 'section_subjects.section_id')
                ->where('section_subjects.teacher_id', $user->id)
                ->where('section_students.status', 'enrolled')
                ->pluck('section_students.user_id');

            $individualStudentIds = DB::table('student_subjects')
                ->join('section_subjects', function ($join) {
                    $join->on('student_subjects.subject_id', '=', 'section_subjects.subject_id')
                        ->where(function ($section) {
                            $section->whereColumn('student_subjects.section_id', 'section_subjects.section_id')
                                ->orWhereNull('student_subjects.section_id');
                        });
                })
                ->where('section_subjects.teacher_id', $user->id)
                ->where('student_subjects.status', 'enrolled')
                ->whereNotExists(function ($dropped) {
                    $dropped->selectRaw('1')
                        ->from('student_subjects as dropped_subjects')
                        ->whereColumn('dropped_subjects.user_id', 'student_subjects.user_id')
                        ->whereColumn('dropped_subjects.subject_id', 'student_subjects.subject_id')
                        ->where('dropped_subjects.status', 'dropped')
                        ->where(function ($section) {
                            $section->whereColumn('dropped_subjects.section_id', 'section_subjects.section_id')
                                ->orWhereNull('dropped_subjects.section_id');
                        });
                })
                ->pluck('student_subjects.user_id');

            $legacyStudentIds = DB::table('students')
                ->join('school_classes', function ($join) use ($user) {
                    $join->on('students.grade_level', '=', 'school_classes.grade_level')
                        ->on('students.section', '=', 'school_classes.section')
                        ->where('school_classes.teacher_id', '=', $user->id);
                })
                ->whereNotNull('students.user_id')
                ->pluck('students.user_id');

            return $sectionStudentIds
                ->merge($individualStudentIds)
                ->merge($legacyStudentIds)
                ->unique()
                ->values()
                ->map(fn($id) => (int) $id)
                ->all();
        }

        if ($this->hasRole($user, 'student')) {
            $sectionTeacherIds = DB::table('section_students')
                ->join('section_subjects', 'section_students.section_id', '=', 'section_subjects.section_id')
                ->where('section_students.user_id', $user->id)
                ->where('section_students.status', 'enrolled')
                ->whereNotNull('section_subjects.teacher_id')
                ->pluck('section_subjects.teacher_id');

            $individualTeacherIds = DB::table('student_subjects')
                ->join('section_subjects', function ($join) {
                    $join->on('student_subjects.subject_id', '=', 'section_subjects.subject_id')
                        ->where(function ($section) {
                            $section->whereColumn('student_subjects.section_id', 'section_subjects.section_id')
                                ->orWhereNull('student_subjects.section_id');
                        });
                })
                ->where('student_subjects.user_id', $user->id)
                ->where('student_subjects.status', 'enrolled')
                ->whereNotNull('section_subjects.teacher_id')
                ->whereNotExists(function ($dropped) use ($user) {
                    $dropped->selectRaw('1')
                        ->from('student_subjects as dropped_subjects')
                        ->where('dropped_subjects.user_id', $user->id)
                        ->whereColumn('dropped_subjects.subject_id', 'student_subjects.subject_id')
                        ->where('dropped_subjects.status', 'dropped')
                        ->where(function ($section) {
                            $section->whereColumn('dropped_subjects.section_id', 'section_subjects.section_id')
                                ->orWhereNull('dropped_subjects.section_id');
                        });
                })
                ->pluck('section_subjects.teacher_id');

            $student = Student::where('user_id', $user->id)->first();
            $legacyTeacherIds = collect();

            if ($student && $student->section && $student->section !== 'TBA') {
                $legacyTeacherIds = DB::table('school_classes')
                    ->where('grade_level', $student->grade_level)
                    ->where('section', $student->section)
                    ->where('school_year', $student->school_year)
                    ->whereNotNull('teacher_id')
                    ->pluck('teacher_id');
            }

            return $sectionTeacherIds
                ->merge($individualTeacherIds)
                ->merge($legacyTeacherIds)
                ->unique()
                ->values()
                ->map(fn($id) => (int) $id)
                ->all();
        }

        return [];
    }

    private function studentInfoFor(User $user, User $contact): ?array
    {
        if (!$this->hasAnyRole($user, User::FACULTY_ROLES) || !$this->hasRole($contact, 'student')) {
            return null;
        }

        $section = DB::table('section_students')
            ->join('section_subjects', 'section_students.section_id', '=', 'section_subjects.section_id')
            ->join('sections', 'sections.id', '=', 'section_students.section_id')
            ->where('section_subjects.teacher_id', $user->id)
            ->where('section_students.user_id', $contact->id)
            ->where('section_students.status', 'enrolled')
            ->select(
                'sections.name',
                'sections.course',
                'sections.year_level',
                'sections.program_type',
                'sections.strand',
                'sections.school_year'
            )
            ->first();

        $profile = Student::where('user_id', $contact->id)->first();

        $sectionSubjects = DB::table('section_students')
            ->join('section_subjects', 'section_students.section_id', '=', 'section_subjects.section_id')
            ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
            ->where('section_subjects.teacher_id', $user->id)
            ->where('section_students.user_id', $contact->id)
            ->where('section_students.status', 'enrolled')
            ->orderBy('subjects.code')
            ->get(['subjects.id', 'subjects.code', 'subjects.name'])
            ->map(fn ($subject) => [
                'id' => $subject->id,
                'code' => $subject->code,
                'name' => $subject->name,
                'is_irregular' => false,
            ])
            ->values();

        $individualSubjects = DB::table('student_subjects')
            ->join('section_subjects', function ($join) {
                $join->on('student_subjects.subject_id', '=', 'section_subjects.subject_id')
                    ->where(function ($section) {
                        $section->whereColumn('student_subjects.section_id', 'section_subjects.section_id')
                            ->orWhereNull('student_subjects.section_id');
                    });
            })
            ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
            ->where('section_subjects.teacher_id', $user->id)
            ->where('student_subjects.user_id', $contact->id)
            ->where('student_subjects.status', 'enrolled')
            ->whereNotExists(function ($dropped) use ($contact) {
                $dropped->selectRaw('1')
                    ->from('student_subjects as dropped_subjects')
                    ->where('dropped_subjects.user_id', $contact->id)
                    ->whereColumn('dropped_subjects.subject_id', 'student_subjects.subject_id')
                    ->where('dropped_subjects.status', 'dropped')
                    ->where(function ($section) {
                        $section->whereColumn('dropped_subjects.section_id', 'section_subjects.section_id')
                            ->orWhereNull('dropped_subjects.section_id');
                    });
            })
            ->orderBy('subjects.code')
            ->get(['subjects.id', 'subjects.code', 'subjects.name'])
            ->map(fn ($subject) => [
                'id' => $subject->id,
                'code' => $subject->code,
                'name' => $subject->name,
                'is_irregular' => true,
            ])
            ->values();
        $subjects = $sectionSubjects
            ->concat($individualSubjects)
            ->unique('id')
            ->values();

        $profileFallback = DB::table('students')
            ->where('user_id', $contact->id)
            ->select('grade_level', 'section', 'school_year')
            ->first();

        $year = $section?->year_level
            ? 'Year ' . $section->year_level
            : ($profileFallback?->grade_level ? 'Grade ' . $profileFallback->grade_level : null);

        return [
            'full_name' => $contact->name,
            'student_id' => $profile?->student_id,
            'course' => $section?->course,
            'section' => $section?->name ?? $profileFallback?->section,
            'year' => $year,
            'program' => $section?->course ?? $section?->strand,
            'school_year' => $section?->school_year ?? $profileFallback?->school_year,
            'is_irregular' => strcasecmp((string) $profile?->academic_status, 'Irregular') === 0
                || ($section === null && $individualSubjects->isNotEmpty()),
            'subjects' => $subjects,
        ];
    }

    private function hasRole(User $user, string $role): bool
    {
        return $user->role === $role || $user->hasRole($role);
    }

    private function hasAnyRole(User $user, array $roles): bool
    {
        return in_array($user->role, $roles, true) || $user->hasAnyRole($roles);
    }
}
