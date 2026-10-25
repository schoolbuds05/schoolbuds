@extends('layouts.portal', ['title' => 'Generation preview'])
@section('content')
@php($prefix = request()->routeIs('department-chair.*') ? 'department-chair.sections' : 'registrar.sections')
<h1 class="text-2xl font-black">Generation preview</h1>
<p class="my-3">{{ count($plan['sections']) }} sections for {{ $plan['course'] }}. No sections have been saved. This preview expires in 30 minutes.</p>
@foreach($plan['sections'] as $section)
<section class="my-4 overflow-x-auto rounded-xl bg-white p-4">
    <h2 class="mb-3 text-lg font-bold">{{ $section['name'] }} · {{ $section['expected_students'] }} expected students</h2>
    <table class="w-full text-left text-sm"><thead><tr><th class="p-2">Subject</th><th class="p-2">Approved teacher</th><th class="p-2">Weekly meetings</th></tr></thead><tbody>
    @foreach($section['assignments'] as $assignment)<tr class="border-t border-slate-200"><td class="p-2">{{ $assignment['subject_code'] }} — {{ $assignment['subject_name'] }}</td><td class="p-2">{{ $assignment['teacher_name'] }}</td><td class="p-2">@foreach($assignment['meetings'] as $meeting)<div>{{ $meeting['day'] }} {{ $meeting['time_start'] }}–{{ $meeting['time_end'] }} · {{ $meeting['room'] }}</div>@endforeach</td></tr>@endforeach
    </tbody></table>
</section>
@endforeach
<form method="POST" action="{{ route($prefix.'.generate.store') }}" class="flex flex-wrap gap-3">
    @csrf<input type="hidden" name="batch_id" value="{{ $batch_id }}">
    <button class="rounded-lg bg-portal-accent px-4 py-3 font-bold text-white">Save section drafts</button>
    <a href="{{ route($prefix.'.generate') }}" class="rounded-lg border border-slate-300 px-4 py-3">Start new preview</a>
</form>
<p class="mt-3 text-sm text-slate-600">Saving checks current availability again. Draft sections remain closed to enrollment until the existing review process approves them.</p>
@endsection
