@extends('layouts.portal', ['title' => 'Subject Requests'])

@section('content')
<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Subjects</h1>
    <p class="mt-1 text-sm text-slate-500">Browse the catalog and review add/drop requests.</p>
</div>
@include('registrar.subject-requests._content', ['requestStats' => $stats])
@endsection
