@extends('layouts.portal', ['title' => 'Course-Shift Requests'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Course-Shift Requests</h1>
    <p class="mt-1 text-sm text-slate-500">Review students requesting to move from one college course to another.</p>
</div>

@if(session('status'))
    <div class="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{{ session('status') }}</div>
@endif

<form method="GET" class="mb-5 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <select name="status" class="rounded-lg border-slate-300 text-sm">
        <option value="">All statuses</option>
        @foreach(['pending', 'approved', 'rejected'] as $status)
            <option value="{{ $status }}" @selected(request('status') === $status)>{{ ucfirst($status) }}</option>
        @endforeach
    </select>
    <button class="rounded-lg bg-portal-accent px-5 py-2 text-sm font-bold text-white hover:bg-portal-accent-hover">Filter</button>
</form>

<div class="space-y-4">
    @forelse($requests as $shiftRequest)
        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 class="font-black text-slate-900">{{ $shiftRequest->student?->name ?: 'Student account unavailable' }}</h2>
                    <p class="mt-1 text-sm text-slate-500">{{ $shiftRequest->student?->email ?: '-' }} · {{ $shiftRequest->school_year }} · {{ ucfirst($shiftRequest->semester) }} semester</p>
                </div>
                <span class="rounded-full px-3 py-1 text-xs font-bold {{ $shiftRequest->status === 'approved' ? 'bg-emerald-100 text-emerald-700' : ($shiftRequest->status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700') }}">{{ ucfirst($shiftRequest->status) }}</span>
            </div>

            <dl class="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div><dt class="text-slate-500">Current course</dt><dd class="font-bold text-slate-800">{{ $shiftRequest->currentCourse?->name ?: 'Not recorded' }}</dd></div>
                <div><dt class="text-slate-500">Requested course</dt><dd class="font-bold text-slate-800">{{ $shiftRequest->requestedCourse?->name ?: 'Course unavailable' }}</dd></div>
                <div class="md:col-span-2"><dt class="text-slate-500">Reason</dt><dd class="font-bold text-slate-800">{{ $shiftRequest->reason }}</dd></div>
            </dl>

            @if($shiftRequest->remarks)
                <p class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><span class="font-bold">Review remarks:</span> {{ $shiftRequest->remarks }}</p>
            @endif

            <div class="mt-4 border-t border-slate-100 pt-4">
                <h3 class="text-sm font-black text-slate-800">Subject credit evaluation</h3>
                @forelse($shiftRequest->creditEvaluations as $evaluation)
                    <p class="mt-2 text-sm text-slate-600">
                        <span class="font-bold">{{ $evaluation->source_subject_code }} · {{ $evaluation->source_subject_name }}</span>
                        → {{ $evaluation->decision === 'credited' ? 'Credited as ' . ($evaluation->targetSubject?->code ?: 'equivalent subject') : 'Not credited' }}
                        @if($evaluation->remarks) · {{ $evaluation->remarks }} @endif
                    </p>
                @empty
                    <p class="mt-2 text-sm text-slate-500">No subject equivalencies recorded yet.</p>
                @endforelse
                @if($shiftRequest->status === 'pending')
                    <form method="POST" action="{{ route('registrar.course-shift-requests.credits.store', $shiftRequest) }}" class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        @csrf
                        <input name="source_subject_code" required maxlength="50" placeholder="Previous subject code" class="rounded-lg border-slate-300 text-sm">
                        <input name="source_subject_name" required maxlength="255" placeholder="Previous subject name" class="rounded-lg border-slate-300 text-sm">
                        <select name="target_subject_id" class="rounded-lg border-slate-300 text-sm">
                            <option value="">No equivalent subject</option>
                            @foreach($subjects as $subject)
                                <option value="{{ $subject->id }}">{{ $subject->code }} · {{ $subject->name }}</option>
                            @endforeach
                        </select>
                        <select name="decision" required class="rounded-lg border-slate-300 text-sm">
                            <option value="credited">Credit subject</option>
                            <option value="not_credited">Do not credit</option>
                        </select>
                        <input name="remarks" maxlength="2000" placeholder="Equivalency remarks" class="rounded-lg border-slate-300 text-sm md:col-span-2">
                        <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 md:col-span-2">Record subject evaluation</button>
                    </form>
                @endif
            </div>

            @if($shiftRequest->status === 'pending')
                <form method="POST" action="{{ route('registrar.course-shift-requests.review', $shiftRequest) }}" class="mt-4 border-t border-slate-100 pt-4">
                    @csrf
                    <textarea name="remarks" rows="2" maxlength="2000" placeholder="Remarks (required when rejecting)" class="w-full rounded-lg border-slate-300 text-sm"></textarea>
                    <div class="mt-3 flex flex-wrap justify-end gap-2">
                        <button name="decision" value="reject" class="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Reject</button>
                        <button name="decision" value="approve" class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">Approve course shift</button>
                    </div>
                </form>
            @endif
        </section>
    @empty
        <section class="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">No course-shift requests found.</section>
    @endforelse
</div>

<div class="mt-5">{{ $requests->links() }}</div>
@endsection