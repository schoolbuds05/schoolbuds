@extends('layouts.portal', ['title' => 'Enrollment Reviews'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Enrollment Reviews</h1>
    <p class="text-sm text-slate-500 mt-1">Review submitted enrollment applications and approve student access.</p>
</div>

<form method="GET" class="bg-white rounded-xl border border-slate-200 p-4 mb-5 grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
    <input name="search" value="{{ request('search') }}" placeholder="Search name, email, or ID" class="rounded-lg border-slate-300 text-sm">
    <select name="status" class="rounded-lg border-slate-300 text-sm">
        <option value="">All statuses</option>
        @foreach(['pending', 'approved', 'rejected'] as $status)
            <option value="{{ $status }}" @selected(request('status') === $status)>{{ ucfirst($status) }}</option>
        @endforeach
    </select>
    <button class="rounded-lg bg-emerald-700 text-white px-5 py-2 text-sm font-bold">Filter</button>
</form>

<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
                <th class="px-5 py-3 text-left">Applicant</th>
                <th class="px-5 py-3 text-left">Program</th>
                <th class="px-5 py-3 text-left">Period</th>
                <th class="px-5 py-3 text-left">Status</th>
                <th class="px-5 py-3"></th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
            @forelse($applications as $application)
                <tr>
                    <td class="px-5 py-4">
                        <p class="font-bold text-slate-800">{{ $application->full_name }}</p>
                        <p class="text-xs text-slate-500">{{ $application->email }} · {{ $application->id_no ?: 'No ID yet' }}</p>
                    </td>
                    <td class="px-5 py-4 text-slate-600">{{ strtoupper($application->program_type) }} · {{ $application->course ?: $application->strand }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ $application->school_year }} · {{ ucfirst($application->semester) }}</td>
                    <td class="px-5 py-4">
                        <span class="rounded-full px-2 py-1 text-xs font-bold {{ $application->status === 'approved' ? 'bg-emerald-100 text-emerald-700' : ($application->status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700') }}">{{ ucfirst($application->status) }}</span>
                    </td>
                    <td class="px-5 py-4 text-right"><a href="{{ route('registrar.enrollments.show', $application) }}" class="text-emerald-700 font-bold hover:underline">Review</a></td>
                </tr>
            @empty
                <tr><td colspan="5" class="px-5 py-10 text-center text-slate-500">No applications found.</td></tr>
            @endforelse
        </tbody>
    </table>
    <div class="px-5 py-4 border-t border-slate-100">{{ $applications->links() }}</div>
</div>
@endsection
