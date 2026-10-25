@extends('layouts.portal', ['title' => 'Teaching Eligibility'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">{{ $mode === 'ownership' ? 'Subject Departments' : 'Teaching Eligibility' }}</h1>
    <p class="mt-2 text-sm text-slate-500">
        @if($mode === 'ownership')
            Choose the department responsible for each subject and its teacher approvals. Course and general subject applicability stays separate.
            Changing ownership requires new teaching approvals.
        @elseif($mode === 'chair')
            {{ $department->name }}: review teacher qualifications or approve a teacher directly. Eligibility does not assign a class.
        @else
            Request subjects you want to teach. The managing department chair reviews your qualifications. Approval does not guarantee a class assignment.
        @endif
    </p>
</div>

@if($mode !== 'ownership')
<section class="portal-card mb-6 p-5">
    <h2 class="mb-4 font-bold">{{ $mode === 'chair' ? 'Approve a teacher directly' : 'Request a subject' }}</h2>
    <form method="POST" action="{{ route($mode === 'chair' ? 'teaching-eligibility.grant' : 'teaching-eligibility.store') }}" class="grid gap-4 md:grid-cols-2">
        @csrf
        <label class="text-sm font-bold">Subject
            <select name="subject_id" required class="mt-1 w-full rounded-lg border-slate-300">
                <option value="">Select a subject</option>
                @foreach($subjects as $subject)
                    <option value="{{ $subject->id }}" @selected((string) old('subject_id') === (string) $subject->id)>{{ $subject->code }} — {{ $subject->name }} · {{ $subject->department->name }} · {{ $subject->course ?: ($subject->strand ?: 'General') }}</option>
                @endforeach
            </select>
        </label>
        @if($mode === 'chair')
        <label class="text-sm font-bold">Teacher
            <select name="teacher_id" required class="mt-1 w-full rounded-lg border-slate-300">
                <option value="">Select a teacher</option>
                @foreach($teachers as $teacher)
                    <option value="{{ $teacher->id }}" @selected((string) old('teacher_id') === (string) $teacher->id)>{{ $teacher->name }} · {{ $teacher->email }}</option>
                @endforeach
            </select>
        </label>
        @endif
        <label class="text-sm font-bold md:col-span-2">{{ $mode === 'chair' ? 'Basis for approval' : 'Qualifications and teaching experience' }}
            <textarea name="{{ $mode === 'chair' ? 'remarks' : 'qualification' }}" required maxlength="{{ $mode === 'chair' ? 2000 : 4000 }}" rows="3" class="mt-1 w-full rounded-lg border-slate-300">{{ old($mode === 'chair' ? 'remarks' : 'qualification') }}</textarea>
        </label>
        <div><button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white">{{ $mode === 'chair' ? 'Approve eligibility' : 'Send request' }}</button></div>
    </form>
    @if($subjects->isEmpty())
        <p class="mt-3 text-sm text-slate-500">No subjects available. Subjects need an active managing department; pending or approved requests cannot be submitted again.</p>
    @endif
</section>
@endif

<div class="space-y-4">
@forelse($rows as $row)
    <article class="portal-card p-5">
        @if($mode === 'ownership')
            <h2 class="font-bold">{{ $row->code }} — {{ $row->name }}</h2>
            <p class="mt-1 text-sm text-slate-500">{{ $row->course ?: ($row->strand ?: 'General subject') }} · Current department: {{ $row->department?->name ?? 'Unassigned' }}</p>
            <form method="POST" action="{{ route('teaching-eligibility.assign-owner', $row) }}" class="mt-3 flex flex-wrap items-center gap-3">
                @csrf
                @method('PUT')
                <label class="text-sm font-bold">Managing department
                    <select name="department_id" class="ml-2 rounded-lg border-slate-300">
                        <option value="">Unassigned</option>
                        @foreach($departments as $department)
                            <option value="{{ $department->id }}" @selected((int) $row->department_id === (int) $department->id)>{{ $department->name }}{{ $department->is_active ? '' : ' (inactive)' }}</option>
                        @endforeach
                    </select>
                </label>
                <button class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white">Save department</button>
            </form>
        @else
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="font-bold">{{ $row->subject->code }} — {{ $row->subject->name }}</h2>
                <span class="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{{ $row->status }}</span>
            </div>
            <p class="mt-1 text-sm text-slate-500">{{ $row->subject->department?->name ?? 'No managing department' }} · {{ $row->source === 'chair_assignment' ? 'Chair assignment' : 'Teacher request' }}</p>
            @if($mode === 'chair')<p class="mt-2 text-sm font-bold">{{ $row->teacher->name }} · {{ $row->teacher->email }}</p>@endif
            @if($row->qualification)<p class="mt-3 whitespace-pre-wrap text-sm text-slate-700">Qualifications: {{ $row->qualification }}</p>@endif
            @if($row->remarks)<p class="mt-2 whitespace-pre-wrap text-sm text-slate-700">Remarks: {{ $row->remarks }}</p>@endif
            @if($row->reviewer)<p class="mt-2 text-xs text-slate-500">Reviewed by {{ $row->reviewer->name }} · {{ $row->reviewed_at?->format('M j, Y H:i') }}</p>@endif
            @if($mode === 'chair' && in_array($row->status, ['pending', 'approved']) && $row->teacher_id !== auth()->id())
                <form method="POST" action="{{ route($row->status === 'pending' ? 'teaching-eligibility.review' : 'teaching-eligibility.revoke', $row) }}" class="mt-4 grid gap-3">
                    @csrf
                    <label class="text-sm font-bold">Decision remarks {{ $row->status === 'pending' ? '(required for rejection)' : '(required)' }}
                        <textarea name="remarks" maxlength="2000" rows="2" @required($row->status === 'approved') class="mt-1 w-full rounded-lg border-slate-300"></textarea>
                    </label>
                    <div class="flex gap-3">
                        @if($row->status === 'pending')
                            <button name="decision" value="approve" class="rounded-lg bg-portal-accent px-4 py-2 text-sm font-bold text-white">Approve</button>
                            <button name="decision" value="reject" class="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Reject</button>
                        @else
                            <button class="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Revoke eligibility</button>
                        @endif
                    </div>
                </form>
            @endif
        @endif
    </article>
@empty
    <p class="portal-card p-6 text-sm text-slate-500">{{ $mode === 'ownership' ? 'No subjects found.' : 'No teaching eligibility records yet.' }}</p>
@endforelse
</div>
<div class="mt-5">{{ $rows->links() }}</div>
@endsection
