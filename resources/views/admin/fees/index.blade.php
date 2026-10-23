@php
    $titles = ['paid' => 'Fees Paid', 'due' => 'Fees Still Due', 'pending' => 'Payments to Verify'];
    $descriptions = [
        'paid' => 'These student fee payments make up the paid total.',
        'due' => 'These unpaid balances make up the amount still due.',
        'pending' => 'Review student-submitted payments before applying them to balances.',
    ];
    $totalLabels = ['paid' => 'Total paid', 'due' => 'Total still due', 'pending' => 'Submitted for verification'];
    $amountLabels = ['paid' => 'Paid amount', 'due' => 'Remaining balance', 'pending' => 'Claimed payment'];
    $pageTitle = $titles[$type];
@endphp
@extends('layouts.portal', ['title' => $pageTitle])

@section('content')
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">School fee breakdown</p>
            <h1 class="mt-1 text-2xl font-black text-slate-900">{{ $pageTitle }}</h1>
            <p class="mt-1 text-sm text-slate-500">{{ $descriptions[$type] }}</p>
        </div>
        <a href="{{ route('admin.dashboard') }}" class="text-sm font-bold text-portal-accent hover:underline">Back to dashboard</a>
    </div>

    <section class="portal-card mb-5 p-5">
        @if(session('status'))
            <p class="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{{ session('status') }}</p>
        @endif
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ $totalLabels[$type] }}</p>
        <p class="mt-2 text-2xl font-black {{ $type === 'paid' ? 'text-portal-accent' : 'text-rose-600' }}">PHP {{ number_format((float) $total, 2) }}</p>
    </section>

    <section class="portal-card overflow-hidden">
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                        <th class="px-5 py-3 font-bold">Student</th>
                        <th class="px-5 py-3 font-bold">Fee</th>
                        <th class="px-5 py-3 font-bold">School year / term</th>
                        <th class="px-5 py-3 font-bold">Status</th>
                        <th class="px-5 py-3 text-right font-bold">Fee amount</th>
                        <th class="px-5 py-3 text-right font-bold">{{ $amountLabels[$type] }}</th>
                        <th class="px-5 py-3 font-bold">{{ $type === 'paid' ? 'Paid date' : 'Due date' }}</th>
                        @if($type === 'pending')<th class="px-5 py-3 font-bold">Review</th>@endif
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    @forelse($fees as $fee)
                        <tr>
                            <td class="px-5 py-4">
                                <p class="font-bold text-slate-800">{{ $fee->student?->first_name }} {{ $fee->student?->last_name }}</p>
                                <p class="mt-1 text-xs text-slate-500">{{ $fee->student?->student_id ?? 'Student record unavailable' }}</p>
                            </td>
                            <td class="px-5 py-4 text-slate-700">
                                {{ $fee->type }}
                                @if($type === 'pending')
                                    <p class="mt-1 text-xs text-slate-500">{{ strtoupper(str_replace('_', ' ', $fee->payment_method ?: '')) }}{{ $fee->payment_reference ? ' · ' . $fee->payment_reference : '' }}</p>
                                @endif
                            </td>
                            <td class="px-5 py-4 text-slate-600">{{ $fee->school_year ?: '—' }}{{ $fee->semester ? ' / ' . ucfirst($fee->semester) : '' }}</td>
                            <td class="px-5 py-4 text-slate-600">{{ ucfirst($fee->status) }}{{ $type === 'pending' ? ' · Awaiting verification' : '' }}</td>
                            <td class="px-5 py-4 text-right text-slate-600">PHP {{ number_format((float) $fee->amount, 2) }}</td>
                            <td class="px-5 py-4 text-right font-black {{ $type === 'paid' ? 'text-emerald-700' : 'text-rose-600' }}">
                                PHP {{ number_format(match ($type) {
                                    'paid' => (float) $fee->paid_amount,
                                    'due' => max(0, (float) $fee->amount - (float) $fee->paid_amount),
                                    default => (float) $fee->pending_payment_amount,
                                }, 2) }}
                            </td>
                            <td class="px-5 py-4 text-slate-600">{{ optional($type === 'paid' ? $fee->paid_date : $fee->due_date)->format('M d, Y') ?? '—' }}</td>
                            @if($type === 'pending')
                                <td class="px-5 py-4">
                                    <div class="flex flex-wrap gap-2">
                                        <form method="POST" action="{{ route('admin.fees.verify-payment', $fee) }}">
                                            @csrf
                                            <input type="hidden" name="approved" value="1">
                                            <button class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Verify</button>
                                        </form>
                                        <form method="POST" action="{{ route('admin.fees.verify-payment', $fee) }}">
                                            @csrf
                                            <input type="hidden" name="approved" value="0">
                                            <button class="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">Reject</button>
                                        </form>
                                    </div>
                                </td>
                            @endif
                        </tr>
                    @empty
                        <tr><td colspan="{{ $type === 'pending' ? 8 : 7 }}" class="px-5 py-10 text-center text-slate-500">No fee records to show.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        @if($fees->hasPages())
            <div class="border-t border-slate-100 px-5 py-4">{{ $fees->links() }}</div>
        @endif
    </section>
@endsection
