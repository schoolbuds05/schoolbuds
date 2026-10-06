@extends('layouts.portal', ['title' => 'Enrollment Review'])

@section('content')
@php
    $value = fn ($text) => filled($text) ? $text : '-';
    $label = fn ($text) => filled($text) ? ucwords(str_replace('_', ' ', $text)) : '-';
    $programName = $application->course ?: $application->strand;
@endphp

<a href="{{ route('registrar.enrollments.index') }}" class="text-sm font-bold text-emerald-700 hover:underline">Back to enrollments</a>

<div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="mb-6 flex items-start justify-between gap-4">
            <div>
                <h1 class="text-2xl font-black text-slate-900">{{ $application->full_name }}</h1>
                <p class="mt-1 text-sm text-slate-500">{{ $application->email }} &middot; {{ $value($application->contact_number) }}</p>
            </div>
            <span class="rounded-full px-3 py-1 text-xs font-bold {{ $application->status === 'approved' ? 'bg-emerald-100 text-emerald-700' : ($application->status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700') }}">
                {{ ucfirst($application->status) }}
            </span>
        </div>

        <div class="space-y-6 text-sm">
            <section>
                <h2 class="text-xs font-black uppercase text-slate-400">Personal Information</h2>
                <dl class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div><dt class="text-slate-500">First name</dt><dd class="font-bold text-slate-800">{{ $value($application->first_name) }}</dd></div>
                    <div><dt class="text-slate-500">Middle name</dt><dd class="font-bold text-slate-800">{{ $value($application->middle_name) }}</dd></div>
                    <div><dt class="text-slate-500">Last name</dt><dd class="font-bold text-slate-800">{{ $value($application->last_name) }}</dd></div>
                    <div><dt class="text-slate-500">Email</dt><dd class="font-bold text-slate-800">{{ $value($application->email) }}</dd></div>
                    <div><dt class="text-slate-500">Contact number</dt><dd class="font-bold text-slate-800">{{ $value($application->contact_number) }}</dd></div>
                    <div><dt class="text-slate-500">Birthdate</dt><dd class="font-bold text-slate-800">{{ optional($application->birthdate)->format('M d, Y') ?: '-' }}</dd></div>
                    <div><dt class="text-slate-500">Gender</dt><dd class="font-bold text-slate-800">{{ $label($application->gender) }}</dd></div>
                    <div><dt class="text-slate-500">Religion</dt><dd class="font-bold text-slate-800">{{ $value($application->religion) }}</dd></div>
                    <div><dt class="text-slate-500">Civil status</dt><dd class="font-bold text-slate-800">{{ $label($application->civil_status) }}</dd></div>
                    <div><dt class="text-slate-500">Citizenship</dt><dd class="font-bold text-slate-800">{{ $value($application->citizenship) }}</dd></div>
                    <div><dt class="text-slate-500">Place of birth</dt><dd class="font-bold text-slate-800">{{ $value($application->place_of_birth) }}</dd></div>
                    <div class="md:col-span-2"><dt class="text-slate-500">Address</dt><dd class="font-bold text-slate-800">{{ $value($application->address) }}</dd></div>
                </dl>
            </section>

            <section class="border-t border-slate-100 pt-6">
                <h2 class="text-xs font-black uppercase text-slate-400">Student Classification</h2>
                <dl class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div><dt class="text-slate-500">Student ID / LRN</dt><dd class="font-bold text-slate-800">{{ $value($application->id_no) }}</dd></div>
                    <div><dt class="text-slate-500">Student type</dt><dd class="font-bold text-slate-800">{{ $label($application->student_type) }}</dd></div>
                    <div><dt class="text-slate-500">Academic status</dt><dd class="font-bold text-slate-800">{{ $value($application->academic_status) }}</dd></div>
                    <div><dt class="text-slate-500">Shiftee from</dt><dd class="font-bold text-slate-800">{{ $value($application->shiftee_from) }}</dd></div>
                    <div><dt class="text-slate-500">Shiftee to</dt><dd class="font-bold text-slate-800">{{ $value($application->shiftee_to) }}</dd></div>
                </dl>
            </section>

            <section class="border-t border-slate-100 pt-6">
                <h2 class="text-xs font-black uppercase text-slate-400">Academic Program</h2>
                <dl class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div><dt class="text-slate-500">Program type</dt><dd class="font-bold text-slate-800">{{ strtoupper($application->program_type) }}</dd></div>
                    <div><dt class="text-slate-500">Program</dt><dd class="font-bold text-slate-800">{{ $value($programName) }}</dd></div>
                    <div><dt class="text-slate-500">Grade level</dt><dd class="font-bold text-slate-800">{{ $value($application->grade_level) }}</dd></div>
                    <div><dt class="text-slate-500">Year level</dt><dd class="font-bold text-slate-800">{{ $value($application->year_level) }}</dd></div>
                    <div><dt class="text-slate-500">School year</dt><dd class="font-bold text-slate-800">{{ $value($application->school_year) }}</dd></div>
                    <div><dt class="text-slate-500">Semester</dt><dd class="font-bold text-slate-800">{{ $label($application->semester) }}</dd></div>
                </dl>
            </section>

            <section class="border-t border-slate-100 pt-6">
                <h2 class="text-xs font-black uppercase text-slate-400">Previous School</h2>
                <dl class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div><dt class="text-slate-500">School name</dt><dd class="font-bold text-slate-800">{{ $value($application->prev_school) }}</dd></div>
                    <div><dt class="text-slate-500">School address</dt><dd class="font-bold text-slate-800">{{ $value($application->prev_school_address) }}</dd></div>
                </dl>
            </section>

            <section class="border-t border-slate-100 pt-6">
                <h2 class="text-xs font-black uppercase text-slate-400">Parents / Guardian</h2>
                <dl class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div><dt class="text-slate-500">Father's name</dt><dd class="font-bold text-slate-800">{{ $value($application->father_name) }}</dd></div>
                    <div><dt class="text-slate-500">Father's occupation</dt><dd class="font-bold text-slate-800">{{ $value($application->father_occupation) }}</dd></div>
                    <div><dt class="text-slate-500">Mother's name</dt><dd class="font-bold text-slate-800">{{ $value($application->mother_name) }}</dd></div>
                    <div><dt class="text-slate-500">Mother's occupation</dt><dd class="font-bold text-slate-800">{{ $value($application->mother_occupation) }}</dd></div>
                    <div class="md:col-span-2"><dt class="text-slate-500">Parent email</dt><dd class="font-bold text-slate-800">{{ $value($application->parent_email) }}</dd></div>
                </dl>
            </section>

            <section class="border-t border-slate-100 pt-6">
                <h2 class="text-xs font-black uppercase text-slate-400">Selected Subjects</h2>
                @if($selectedSubjects->isNotEmpty())
                    <div class="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                        @foreach($selectedSubjects as $subject)
                            <div class="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[120px_1fr_auto] md:items-center">
                                <p class="font-black text-slate-900">{{ $subject->code }}</p>
                                <p class="font-bold text-slate-700">{{ $subject->name }}</p>
                                <p class="text-xs font-semibold text-slate-500">{{ $subject->total_units }} units</p>
                            </div>
                        @endforeach
                    </div>
                @else
                    <p class="mt-3 text-sm font-semibold text-slate-500">No selected subjects recorded.</p>
                @endif
            </section>

            <section class="border-t border-slate-100 pt-6">
                <h2 class="text-xs font-black uppercase text-slate-400">Submitted Documents</h2>
                @if(!empty($application->document_urls))
                    <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        @foreach($application->document_urls as $index => $document)
                            @php
                                $documentPath = is_array($document) ? ($document['url'] ?? '') : $document;
                                $documentName = is_array($document) ? ($document['name'] ?? 'Document '.($index + 1)) : basename((string) $document);
                                $documentHref = str_starts_with((string) $documentPath, 'http')
                                    ? $documentPath
                                    : asset('storage/'.ltrim((string) $documentPath, '/'));
                            @endphp
                            <a href="{{ $documentHref }}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50">
                                {{ $documentName }}
                            </a>
                        @endforeach
                    </div>
                @else
                    <p class="mt-3 text-sm font-semibold text-slate-500">No documents uploaded.</p>
                @endif
            </section>
        </div>
    </section>

    <aside class="space-y-4">
        @if($application->status === 'pending')
            <form method="POST" action="{{ route('registrar.enrollments.approve', $application) }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                @csrf
                <h2 class="mb-2 font-black text-slate-800">Approve Application</h2>
                <p class="mb-4 text-sm text-slate-500">Creates or updates the student login and student record.</p>
                <button class="w-full rounded-lg bg-emerald-700 py-2 text-sm font-bold text-white">Approve enrollment</button>
            </form>

            <form method="POST" action="{{ route('registrar.enrollments.reject', $application) }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                @csrf
                <h2 class="mb-2 font-black text-slate-800">Reject Application</h2>
                <textarea name="remarks" rows="4" placeholder="Reason for rejection" class="mb-3 w-full rounded-lg border-slate-300 text-sm" required></textarea>
                <button class="w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white">Reject enrollment</button>
            </form>
        @endif

        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="mb-3 font-black text-slate-800">Review Details</h2>
            <p class="text-sm text-slate-500">Reviewed by: <span class="font-bold text-slate-800">{{ $application->reviewer?->name ?: '-' }}</span></p>
            <p class="text-sm text-slate-500">Reviewed at: <span class="font-bold text-slate-800">{{ optional($application->reviewed_at)->format('M d, Y g:i A') ?: '-' }}</span></p>
            <p class="mt-3 text-sm text-slate-500">Submitted at: <span class="font-bold text-slate-800">{{ optional($application->created_at)->format('M d, Y g:i A') ?: '-' }}</span></p>
            @if($application->remarks)
                <p class="mt-3 text-sm text-slate-700">{{ $application->remarks }}</p>
            @endif
        </section>
    </aside>
</div>
@endsection
