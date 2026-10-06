@extends('layouts.portal', ['title' => 'Marketplace Reports'])

@section('content')
<div class="mb-6">
    <h2 class="text-xl font-black text-slate-900">Marketplace Reports</h2>
    <p class="mt-1 text-sm text-slate-500">Review marketplace sales, income, discounts, and refunds by year or month.</p>
</div>

<section class="portal-card mb-8 overflow-hidden">
    <div class="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <h3 class="font-bold text-slate-800">Sales and income report</h3>
            <p class="mt-1 text-sm text-slate-500">Generate marketplace income totals by year or by a selected month.</p>
        </div>
        <form method="GET" action="{{ route('property-custodian.reports') }}" class="grid gap-3 sm:grid-cols-[140px_180px_auto]">
            <select name="report_year" class="portal-field w-full">
                @foreach($reportYears as $year)
                    <option value="{{ $year }}" @selected((int) $salesReport['year'] === (int) $year)>{{ $year }}</option>
                @endforeach
            </select>
            <select name="report_month" class="portal-field w-full">
                <option value="">Whole year</option>
                @foreach(range(1, 12) as $month)
                    <option value="{{ $month }}" @selected((int) ($salesReport['month'] ?? 0) === $month)>
                        {{ \Carbon\Carbon::create()->month($month)->format('F') }}
                    </option>
                @endforeach
            </select>
            <button class="portal-button-primary" type="submit">Generate</button>
        </form>
    </div>

    <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-7">
        <div class="rounded-xl bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Period</p>
            <p class="mt-2 text-lg font-black text-slate-900">
                {{ $salesReport['month'] ? \Carbon\Carbon::create()->month($salesReport['month'])->format('F') . ' ' : '' }}{{ $salesReport['year'] }}
            </p>
        </div>
        <div class="rounded-xl bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Paid orders</p>
            <p class="mt-2 text-lg font-black text-slate-900">{{ $salesReport['orders'] }}</p>
        </div>
        <div class="rounded-xl bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Items sold</p>
            <p class="mt-2 text-lg font-black text-slate-900">{{ $salesReport['items_sold'] }}</p>
        </div>
        <div class="rounded-xl bg-emerald-50 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-emerald-600">Net income</p>
            <p class="mt-2 text-lg font-black text-emerald-700">PHP {{ number_format((float) $salesReport['income'], 2) }}</p>
        </div>
        <div class="rounded-xl bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Gross sales</p>
            <p class="mt-2 text-lg font-black text-slate-900">PHP {{ number_format((float) $salesReport['gross'], 2) }}</p>
        </div>
        <div class="rounded-xl bg-amber-50 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-amber-600">Points discount</p>
            <p class="mt-2 text-lg font-black text-amber-700">PHP {{ number_format((float) $salesReport['discounts'], 2) }}</p>
        </div>
        <div class="rounded-xl bg-red-50 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-red-600">Refunded</p>
            <p class="mt-2 text-lg font-black text-red-700">PHP {{ number_format((float) $salesReport['refunded_amount'], 2) }}</p>
            <p class="mt-1 text-xs font-bold text-red-500">{{ $salesReport['refunded_orders'] }} order(s), {{ $salesReport['refunded_items'] }} item(s)</p>
        </div>
    </div>

    <div class="grid gap-5 border-t border-slate-100 p-5 lg:grid-cols-[280px_1fr]">
        <div class="space-y-3">
            <div class="rounded-xl border border-slate-200 p-4">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Cash</p>
                <p class="mt-2 font-black text-slate-900">PHP {{ number_format((float) $salesReport['cash'], 2) }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">GCash</p>
                <p class="mt-2 font-black text-slate-900">PHP {{ number_format((float) $salesReport['gcash'], 2) }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">QRPH</p>
                <p class="mt-2 font-black text-slate-900">PHP {{ number_format((float) $salesReport['qrph'], 2) }}</p>
            </div>
            <div class="rounded-xl border border-red-200 bg-red-50 p-4">
                <p class="text-xs font-bold uppercase tracking-wider text-red-500">Refunded orders</p>
                <p class="mt-2 font-black text-red-700">{{ $salesReport['refunded_orders'] }} / PHP {{ number_format((float) $salesReport['refunded_amount'], 2) }}</p>
            </div>
        </div>

        <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                        <th class="px-4 py-3">{{ $salesReport['month'] ? 'Item' : 'Month' }}</th>
                        <th class="px-4 py-3">Orders</th>
                        <th class="px-4 py-3">Items sold</th>
                        <th class="px-4 py-3">Income</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                    @forelse($reportBreakdown as $row)
                        <tr>
                            <td class="px-4 py-3 font-bold text-slate-900">{{ $row['label'] }}</td>
                            <td class="px-4 py-3 text-slate-600">{{ $row['orders'] }}</td>
                            <td class="px-4 py-3 text-slate-600">{{ $row['items_sold'] }}</td>
                            <td class="px-4 py-3 font-black text-slate-900">PHP {{ number_format((float) $row['income'], 2) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">No paid sales for this period.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    <div class="border-t border-slate-100 px-5 pb-5">
        <h4 class="mb-3 text-sm font-black text-slate-800">Refunded orders in this period</h4>
        <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                        <th class="px-4 py-3">Order</th>
                        <th class="px-4 py-3">Buyer</th>
                        <th class="px-4 py-3">Qty</th>
                        <th class="px-4 py-3">Amount</th>
                        <th class="px-4 py-3">Reason</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                    @forelse($reportOrders->where('status', 'refunded') as $order)
                        <tr>
                            <td class="px-4 py-3">
                                <p class="font-bold text-slate-900">{{ $order->item?->title ?? 'Marketplace item' }}</p>
                                <p class="mt-0.5 text-xs text-slate-500">#{{ str_pad((string) $order->id, 6, '0', STR_PAD_LEFT) }}</p>
                            </td>
                            <td class="px-4 py-3 text-slate-600">{{ $order->buyer?->name ?? 'Buyer' }}</td>
                            <td class="px-4 py-3 text-slate-600">{{ $order->quantity }}</td>
                            <td class="px-4 py-3 font-black text-red-700">PHP {{ number_format((float) $order->total_amount, 2) }}</td>
                            <td class="px-4 py-3 text-slate-600">{{ $order->notes ?: $order->refund_reason ?: 'Refund approved' }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">No refunded orders for this period.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</section>
@endsection

