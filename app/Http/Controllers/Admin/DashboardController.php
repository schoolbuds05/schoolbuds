<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Student;
use App\Models\Fee;
use App\Models\Attendance;
use App\Models\Grade;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $stats = [
            'total_students'  => Student::count(),
            'active_students' => Student::where('status', 'active')->count(),
            'total_fees_due'  => Fee::whereRaw('amount > paid_amount')->sum(DB::raw('amount - paid_amount')),
            'total_collected' => Fee::where('paid_amount', '>', 0)->sum('paid_amount'),
            'pending_payments' => Fee::where('payment_verification_status', 'pending')->sum('pending_payment_amount'),
            'total_teachers'  => User::whereIn('role', User::FACULTY_ROLES)
                ->orWhereHas('roles', fn ($query) => $query->whereIn('name', User::FACULTY_ROLES))
                ->count(),
        ];

        $recentStudents = Student::latest()->take(5)->get();

        $unpaidFees = Fee::with('student')
            ->where('status', '!=', 'paid')
            ->latest()
            ->take(5)
            ->get();

        return view('admin.dashboard', compact('stats', 'recentStudents', 'unpaidFees'));
    }

    public function fees(Request $request)
    {
        $type = $request->query('type', 'paid');
        abort_unless(in_array($type, ['paid', 'due', 'pending'], true), 404);

        $feesQuery = Fee::with('student')->latest();
        if ($type === 'paid') {
            $feesQuery->where('paid_amount', '>', 0);
        } elseif ($type === 'due') {
            $feesQuery->whereRaw('amount > paid_amount');
        } else {
            $feesQuery->where('payment_verification_status', 'pending');
        }

        $total = $type === 'paid'
            ? (clone $feesQuery)->sum('paid_amount')
            : ($type === 'due'
                ? (clone $feesQuery)->sum(DB::raw('amount - paid_amount'))
                : (clone $feesQuery)->sum('pending_payment_amount'));
        $fees = $feesQuery->paginate(25)->withQueryString();

        return view('admin.fees.index', compact('fees', 'type', 'total'));
    }
}
