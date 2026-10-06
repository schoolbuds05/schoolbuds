@extends('layouts.portal', ['title' => 'Subject Requests'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Subject Requests</h1>
    <p class="mt-1 text-sm text-slate-500">Review student requests to add or drop subjects.</p>
</div>

<div class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
    <div class="rounded-xl border border-amber-100 bg-amber-50 p-4">
        <p class="text-xs font-black uppercase tracking-wide text-amber-600">Pending</p>
        <p class="mt-1 text-2xl font-black text-amber-900">{{ $stats['pending'] }}</p>
    </div>
    <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <p class="text-xs font-black uppercase tracking-wide text-emerald-600">Approved</p>
        <p class="mt-1 text-2xl font-black text-emerald-900">{{ $stats['approved'] }}</p>
    </div>
    <div class="rounded-xl border border-red-100 bg-red-50 p-4">
        <p class="text-xs font-black uppercase tracking-wide text-red-600">Rejected</p>
        <p class="mt-1 text-2xl font-black text-red-900">{{ $stats['rejected'] }}</p>
    </div>
</div>

<form method="GET" action="{{ route('registrar.subject-requests.index') }}" class="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <label>
        <span class="text-xs font-bold uppercase text-slate-500">Status</span>
        <select name="status" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
            <option value="">All statuses</option>
            <option value="pending" @selected(request('status') === 'pending')>Pending</option>
            <option value="approved" @selected(request('status') === 'approved')>Approved</option>
            <option value="rejected" @selected(request('status') === 'rejected')>Rejected</option>
        </select>
    </label>
    <label>
        <span class="text-xs font-bold uppercase text-slate-500">Action</span>
        <select name="action" class="mt-1 w-full rounded-lg border-slate-300 text-sm text-slate-900">
            <option value="">Add and drop</option>
            <option value="add" @selected(request('action') === 'add')>Add subject</option>
            <option value="drop" @selected(request('action') === 'drop')>Drop subject</option>
        </select>
    </label>
    <button class="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">Filter</button>
    @if(request('status') || request('action'))
        <a href="{{ route('registrar.subject-requests.index') }}" class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Clear</a>
    @endif
</form>

<div class="space-y-3">
    @forelse($requests as $subjectRequest)
        @php
            $isAdd = $subjectRequest->action === 'add';
            $actionClass = $isAdd ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700';
            $statusClass = match ($subjectRequest->status) {
                'approved' => 'bg-emerald-100 text-emerald-700',
                'rejected' => 'bg-red-100 text-red-700',
                default => 'bg-amber-100 text-amber-700',
            };
            $totalUnits = (float) ($subjectRequest->subject?->units_lec ?? 0) + (float) ($subjectRequest->subject?->units_lab ?? 0);
        @endphp
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-request-card>
            <button
                type="button"
                class="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50"
                onclick="this.closest('[data-request-card]').querySelector('[data-request-details]').classList.toggle('hidden'); this.querySelector('[data-arrow]').classList.toggle('rotate-180');"
            >
                <div class="flex min-w-0 items-center gap-3">
                    <span class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black uppercase {{ $actionClass }}">{{ $subjectRequest->action }}</span>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-slate-900">
                            {{ $subjectRequest->subject?->code ?? 'Subject' }} - {{ $subjectRequest->subject?->name ?? 'Unavailable subject' }}
                        </p>
                        <p class="mt-0.5 text-xs text-slate-400">
                            {{ $subjectRequest->student?->name ?? 'Unknown student' }} · {{ optional($subjectRequest->created_at)->format('M d, Y h:i A') }}
                        </p>
                    </div>
                </div>
                <div class="flex shrink-0 items-center gap-3">
                    <span class="hidden rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 sm:inline-flex">{{ $totalUnits }} units</span>
                    <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold {{ $statusClass }}">{{ ucfirst($subjectRequest->status) }}</span>
                    <svg data-arrow class="h-4 w-4 text-slate-400 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
            </button>

            <div data-request-details class="hidden border-t border-slate-100">
                <div class="grid grid-cols-1 gap-3 bg-slate-50 p-4 text-sm md:grid-cols-4">
                    <div>
                        <p class="text-xs font-black uppercase text-slate-400">Student</p>
                        <p class="mt-1 font-bold text-slate-800">{{ $subjectRequest->student?->name ?? 'Unknown' }}</p>
                        <p class="text-xs text-slate-500">{{ $subjectRequest->student?->email }}</p>
                    </div>
                    <div>
                        <p class="text-xs font-black uppercase text-slate-400">Subject</p>
                        <p class="mt-1 font-bold text-slate-800">{{ $subjectRequest->subject?->code }} - {{ $subjectRequest->subject?->name }}</p>
                        <p class="text-xs text-slate-500">Lecture {{ $subjectRequest->subject?->units_lec ?? 0 }} · Lab {{ $subjectRequest->subject?->units_lab ?? 0 }}</p>
                    </div>
                    <div>
                        <p class="text-xs font-black uppercase text-slate-400">Section</p>
                        <p class="mt-1 font-bold text-slate-800">{{ $subjectRequest->section?->name ?? 'Direct enrollment' }}</p>
                        <p class="text-xs text-slate-500">{{ $subjectRequest->section?->course }} {{ $subjectRequest->section?->year_level ? 'Year '.$subjectRequest->section?->year_level : '' }}</p>
                    </div>
                    <div>
                        <p class="text-xs font-black uppercase text-slate-400">Review</p>
                        <p class="mt-1 font-bold text-slate-800">{{ $subjectRequest->reviewer?->name ?? 'Not reviewed' }}</p>
                        <p class="text-xs text-slate-500">{{ optional($subjectRequest->reviewed_at)->format('M d, Y h:i A') }}</p>
                    </div>
                </div>

                <div class="p-4">
                    <p class="text-xs font-black uppercase text-slate-400">Student reason</p>
                    <p class="mt-1 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">{{ $subjectRequest->reason }}</p>

                    @if($subjectRequest->registrar_remarks)
                        <p class="mt-4 text-xs font-black uppercase text-slate-400">Registrar remarks</p>
                        <p class="mt-1 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">{{ $subjectRequest->registrar_remarks }}</p>
                    @endif

                    @if($subjectRequest->status === 'pending')
                        <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <form method="POST" action="{{ route('registrar.subject-requests.approve', $subjectRequest) }}" class="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                                @csrf
                                <label class="text-xs font-bold uppercase text-emerald-700">
                                    Approval remarks
                                    <textarea name="registrar_remarks" rows="3" class="mt-1 w-full rounded-lg border-emerald-200 text-sm normal-case text-slate-900" placeholder="Optional remarks"></textarea>
                                </label>
                                <button class="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Approve request</button>
                            </form>
                            <form method="POST" action="{{ route('registrar.subject-requests.reject', $subjectRequest) }}" class="rounded-xl border border-red-100 bg-red-50 p-3">
                                @csrf
                                <label class="text-xs font-bold uppercase text-red-700">
                                    Rejection remarks
                                    <textarea name="registrar_remarks" rows="3" class="mt-1 w-full rounded-lg border-red-200 text-sm normal-case text-slate-900" placeholder="Reason for rejection" required></textarea>
                                </label>
                                <button class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">Reject request</button>
                            </form>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    @empty
        <div class="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p class="text-sm font-black text-slate-800">No subject requests found</p>
            <p class="mt-1 text-sm text-slate-500">Student add/drop requests will appear here.</p>
        </div>
    @endforelse

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{{ $requests->links() }}</div>
</div>
@endsection
