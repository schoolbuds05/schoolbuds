@extends('layouts.portal', ['title' => $title])

@php
    $isAdmin = $scope === 'admin';
    $formatLabel = fn ($value) => ucwords(str_replace('_', ' ', (string) $value));
    $money = fn ($value) => 'PHP ' . number_format((float) $value, 2);
    $cards = [
        ['label' => 'Students', 'value' => number_format($summary['students']), 'tone' => 'emerald'],
        ['label' => 'Active Students', 'value' => number_format($summary['active_students']), 'tone' => 'blue'],
        ['label' => 'Enrollments', 'value' => number_format($summary['enrollments']), 'tone' => 'rose'],
        ['label' => 'Courses', 'value' => number_format($summary['courses']), 'tone' => 'amber'],
        ['label' => 'Subjects', 'value' => number_format($summary['subjects']), 'tone' => 'violet'],
        ['label' => 'Sections', 'value' => number_format($summary['sections']), 'tone' => 'slate'],
        ['label' => 'Points Issued', 'value' => number_format($summary['points']), 'tone' => 'purple'],
        ['label' => 'Fees Collected', 'value' => $money($summary['collected_fees']), 'tone' => 'green'],
        ['label' => 'Fees Receivable', 'value' => $money($summary['unpaid_fees']), 'tone' => 'orange'],
    ];
    if ($isAdmin) {
        array_unshift($cards, ['label' => 'Users', 'value' => number_format($summary['users']), 'tone' => 'indigo']);
    }
@endphp

@section('content')
    <div class="print:hidden mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <h1 class="text-2xl font-black text-slate-900">{{ $title }}</h1>
            <p class="mt-1 text-sm text-slate-500">
                Generate a system snapshot from the latest school records.
            </p>
        </div>
        <button type="button" onclick="window.print()" class="rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700">
            Print / Save PDF
        </button>
    </div>

    <div class="hidden print:block mb-6">
        <h1 class="text-2xl font-black text-slate-950">{{ $title }}</h1>
        <p class="mt-1 text-sm text-slate-500">Generated {{ $generatedAt->format('F d, Y h:i A') }}</p>
    </div>

    <div class="mb-5 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm print:border-slate-200 print:shadow-none">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p class="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Report Period</p>
                <h2 class="mt-1 text-lg font-black text-slate-900">Current System Totals</h2>
            </div>
            <p class="text-sm font-bold text-slate-500">Generated {{ $generatedAt->format('M d, Y h:i A') }}</p>
        </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @foreach($cards as $card)
            <div class="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm print:border-slate-200 print:shadow-none">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-[11px] font-black uppercase tracking-wider text-slate-400">{{ $card['label'] }}</p>
                        <p class="mt-4 text-2xl font-black text-slate-900">{{ $card['value'] }}</p>
                    </div>
                    <span class="h-3 w-3 rounded-full bg-violet-500"></span>
                </div>
            </div>
        @endforeach
    </div>

    <div class="mt-6 grid gap-5 lg:grid-cols-2">
        <x-report-table title="Student Status" :rows="$studentStatus" />
        <x-report-table title="Enrollment Status" :rows="$enrollmentStatus" />
        <x-report-table title="Course Programs" :rows="$programTypes" />
        <x-report-table title="Subject Programs" :rows="$subjectPrograms" />
        <x-report-table title="Section Programs" :rows="$sectionPrograms" />

        @if($isAdmin)
            <x-report-table title="User Roles" :rows="$userRoles" />
        @endif
    </div>

    @if($isAdmin)
        <div class="mt-5 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm print:border-slate-200 print:shadow-none">
            <h2 class="text-base font-black text-slate-900">Recent Activity</h2>
            <div class="mt-3 divide-y divide-slate-100">
                @forelse($recentActivity as $activity)
                    <div class="py-3">
                        <p class="text-sm font-black text-slate-800">{{ $activity->description ?? $formatLabel($activity->action) }}</p>
                        <p class="mt-1 text-xs font-semibold text-slate-500">{{ optional($activity->created_at)->format('M d, Y h:i A') }}</p>
                    </div>
                @empty
                    <p class="py-4 text-sm font-semibold text-slate-500">No activity logs available.</p>
                @endforelse
            </div>
        </div>
    @endif
@endsection
