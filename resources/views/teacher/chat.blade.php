@extends('layouts.portal', ['title' => 'Chat'])

@section('content')
@php
    $selectedId = (int) request('contact');
    $selectedContact = $contacts->firstWhere('id', $selectedId) ?? $contacts->first();
    $thread = $selectedContact
        ? $messages->filter(fn ($message) =>
            ((int) $message->sender_id === (int) auth()->id() && (int) $message->receiver_id === (int) $selectedContact->id)
            || ((int) $message->receiver_id === (int) auth()->id() && (int) $message->sender_id === (int) $selectedContact->id)
        )
        : collect();
@endphp

<div class="mb-6">
    <h1 class="text-2xl font-black text-slate-900">Chat</h1>
    <p class="mt-1 text-sm text-slate-500">Message students from your assigned classes.</p>
</div>

<section class="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm shadow-violet-900/5">
    <div class="grid h-[calc(100vh-13rem)] min-h-[640px] lg:grid-cols-[340px_1fr]">
    <aside class="flex min-h-0 flex-col border-b border-violet-100 bg-white lg:border-b-0 lg:border-r">
        <div class="border-b border-violet-100 p-4">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <p class="text-xl font-black text-slate-950">Messages</p>
                    <p class="mt-1 text-xs font-bold text-slate-400">{{ $contacts->count() }} student contacts</p>
                </div>
                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white">
                    {{ strtoupper(substr(auth()->user()->name, 0, 2)) }}
                </span>
            </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
            @forelse($contacts as $contact)
                @php
                    $last = $messages->filter(fn ($message) =>
                        ((int) $message->sender_id === (int) auth()->id() && (int) $message->receiver_id === (int) $contact->id)
                        || ((int) $message->receiver_id === (int) auth()->id() && (int) $message->sender_id === (int) $contact->id)
                    )->last();
                    $active = $selectedContact && (int) $selectedContact->id === (int) $contact->id;
                @endphp
                <a href="{{ route('teacher.chat', ['contact' => $contact->id]) }}"
                    class="mb-1 flex items-center gap-3 rounded-2xl px-3 py-3 transition {{ $active ? 'bg-violet-50 text-slate-950' : 'text-slate-700 hover:bg-slate-50' }}">
                    <span class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black {{ $active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500' }}">
                        {{ strtoupper(substr($contact->name, 0, 2)) }}
                        <span class="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400"></span>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-black">{{ $contact->name }}</span>
                        <span class="mt-0.5 block truncate text-xs font-semibold text-slate-400">
                            {{ $last?->message ?? $contact->email }}
                        </span>
                    </span>
                </a>
            @empty
                <div class="px-4 py-12 text-center">
                    <p class="text-sm font-bold text-slate-700">No students yet</p>
                    <p class="mt-1 text-xs text-slate-500">Students appear here after they are assigned to your classes.</p>
                </div>
            @endforelse
        </div>
    </aside>

    <div class="flex min-h-0 flex-col bg-slate-50">
        @if($selectedContact)
            <header class="flex items-center justify-between border-b border-violet-100 bg-white px-5 py-3">
                <div class="flex items-center gap-3">
                    <span class="relative flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white">
                        {{ strtoupper(substr($selectedContact->name, 0, 2)) }}
                        <span class="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400"></span>
                    </span>
                    <div>
                        <p class="font-black text-slate-900">{{ $selectedContact->name }}</p>
                        <p class="text-xs font-semibold text-emerald-600">Active now</p>
                    </div>
                </div>
                <span class="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 sm:inline-flex">{{ $selectedContact->email }}</span>
            </header>

            <div class="portal-chat-canvas flex-1 space-y-2 overflow-y-auto p-5">
                @forelse($thread as $message)
                    @php($mine = (int) $message->sender_id === (int) auth()->id())
                    <div class="flex items-end gap-2 {{ $mine ? 'justify-end' : 'justify-start' }}">
                        @unless($mine)
                            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-black text-violet-700">
                                {{ strtoupper(substr($selectedContact->name, 0, 2)) }}
                            </span>
                        @endunless
                        <div class="max-w-[72%] rounded-[1.35rem] px-4 py-2.5 shadow-sm {{ $mine ? 'rounded-br-md portal-chat-bubble-mine' : 'rounded-bl-md portal-chat-bubble-theirs' }}">
                            @unless($mine)
                                <p class="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{{ $message->sender?->name }}</p>
                            @endunless
                            <p class="whitespace-pre-wrap text-sm font-semibold leading-5">{{ $message->message }}</p>
                            <p class="mt-1.5 text-right text-[10px] font-bold {{ $mine ? 'text-white/60' : 'text-slate-400' }}">
                                {{ $message->created_at->format('M d, h:i A') }}
                            </p>
                        </div>
                    </div>
                @empty
                    <div class="flex h-full min-h-[360px] items-center justify-center text-center">
                        <div>
                            <p class="text-lg font-black text-slate-800">No messages yet</p>
                            <p class="mt-1 text-sm text-slate-500">Start the conversation with {{ $selectedContact->name }}.</p>
                        </div>
                    </div>
                @endforelse
            </div>

            <form method="POST" action="{{ route('teacher.chat.send') }}" class="border-t border-violet-100 bg-white p-3">
                @csrf
                <input type="hidden" name="receiver_id" value="{{ $selectedContact->id }}">
                <div class="flex items-end gap-2 rounded-3xl bg-slate-100 p-2">
                    <textarea name="message" rows="1" class="min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:ring-0" placeholder="Aa" required></textarea>
                    <button class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700" title="Send">→</button>
                </div>
            </form>
        @else
            <div class="flex flex-1 items-center justify-center p-8 text-center">
                <div>
                    <p class="text-lg font-black text-slate-800">Choose a student</p>
                    <p class="mt-1 text-sm text-slate-500">Select a contact to start chatting.</p>
                </div>
            </div>
        @endif
    </div>
    </div>
</section>
@endsection
