@extends('layouts.portal', ['title' => 'Subject Requests'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Subjects</h1>
    <p class="mt-1 text-sm text-slate-500">Browse the catalog and review add/drop requests.</p>
</div>
<div class="mb-5 flex gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
    <a href="{{ route('registrar.subjects.index') }}" class="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-bold text-slate-600 hover:bg-slate-50">Catalog</a>
    <a href="{{ route('registrar.subjects.index', ['tab' => 'requests', 'status' => request('status'), 'action' => request('action')]) }}" class="flex-1 rounded-lg bg-portal-accent px-4 py-2.5 text-center text-sm font-bold text-white">Requests</a>
</div>
@include('registrar.subject-requests._content', ['requestStats' => $stats])
@endsection
