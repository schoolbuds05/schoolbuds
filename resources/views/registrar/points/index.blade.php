@extends('layouts.portal', ['title' => 'Points Verification'])

@section('content')
<div class="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
    <section class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-fit">
        <h1 class="text-xl font-black text-slate-900 mb-1">Verify Points</h1>
        <p class="text-sm text-slate-500 mb-4">Record verified donation, event, early enrollment, or early payment points.</p>
        <form method="POST" action="{{ route('registrar.points.store') }}" class="space-y-3">
            @csrf
            <select name="student_id" class="w-full rounded-lg border-slate-300 text-sm" required>
                <option value="">Select student</option>
                @foreach($students as $student)
                    <option value="{{ $student->id }}">{{ $student->last_name }}, {{ $student->first_name }} · {{ $student->student_id }}</option>
                @endforeach
            </select>
            <select name="source" class="w-full rounded-lg border-slate-300 text-sm" required>
                @foreach(['donations' => 'Donation', 'events' => 'School event', 'early_enrollment' => 'Early enrollment', 'early_payment' => 'Early payment', 'manual_adjustment' => 'Verified adjustment'] as $value => $label)
                    <option value="{{ $value }}">{{ $label }}</option>
                @endforeach
            </select>
            <input name="points" type="number" min="1" max="100" value="10" class="w-full rounded-lg border-slate-300 text-sm" required>
            <input name="title" placeholder="Title" class="w-full rounded-lg border-slate-300 text-sm" required>
            <input name="reference_no" placeholder="Reference no. optional" class="w-full rounded-lg border-slate-300 text-sm">
            <textarea name="description" rows="3" placeholder="Verification notes" class="w-full rounded-lg border-slate-300 text-sm"></textarea>
            <button class="w-full rounded-lg bg-emerald-700 text-white py-2 text-sm font-bold">Record verified points</button>
        </form>
    </section>

    <section>
        <div class="mb-4">
            <h1 class="text-2xl font-black text-slate-900">Points Ledger</h1>
            <p class="text-sm text-slate-500 mt-1">Audit trail of earned and verified student points.</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            @forelse($rewards as $reward)
                <div class="p-4 flex items-center justify-between gap-4">
                    <div>
                        <p class="font-bold text-slate-800">{{ $reward->student?->first_name }} {{ $reward->student?->last_name }}</p>
                        <p class="text-sm text-slate-600">{{ $reward->title }}</p>
                        <p class="text-xs text-slate-500">{{ str_replace('_', ' ', ucfirst($reward->source)) }} · {{ $reward->created_at->format('M d, Y') }} · {{ $reward->awardedBy?->name ?: 'System' }}</p>
                    </div>
                    <p class="text-xl font-black text-emerald-700">+{{ $reward->points }}</p>
                </div>
            @empty
                <p class="p-8 text-center text-slate-500">No points recorded yet.</p>
            @endforelse
            <div class="p-4">{{ $rewards->links() }}</div>
        </div>
    </section>
</div>
@endsection
