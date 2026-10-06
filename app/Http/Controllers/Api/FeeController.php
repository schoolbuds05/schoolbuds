<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Fee;
use App\Models\SchoolNotification;
use App\Models\Student;
use App\Services\PointsService;
use Illuminate\Http\Request;

class FeeController extends Controller
{
    public function index()
    {
        $this->authorizeFeeManager(request());

        return response()->json(Fee::with('student')->get());
    }

    public function store(Request $request)
    {
        $this->authorizeFeeManager($request);

        $request->validate([
            'student_id'  => 'required|exists:students,id',
            'type'        => 'required',
            'amount'      => 'required|numeric',
            'due_date'    => 'required|date',
            'school_year' => 'required',
            'semester'    => 'nullable|string|max:20',
        ]);

        $fee = Fee::create($request->all());
        return response()->json($fee, 201);
    }

    public function show(Fee $fee)
    {
        return response()->json($fee->load('student'));
    }

    public function update(Request $request, Fee $fee, PointsService $points)
    {
        $this->authorizeFeeManager($request);

        $fee->update($request->all());
        if ($request->status === 'paid') {
            $fee->update(['paid_date' => now(), 'paid_amount' => $fee->amount]);
            $this->awardEarlyPaymentIfEligible($fee->fresh(), $points, $request->user());
        }
        return response()->json($fee);
    }

    public function pay(Request $request, Fee $fee, PointsService $points)
    {
        $student = Student::where('user_id', $request->user()->id)->first();
        $isManager = $request->user()->hasAnyRole(['admin', 'registrar', 'school_management']);

        if (!$isManager && (!$student || (int) $student->id !== (int) $fee->student_id)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'payment_method' => ['required', 'in:cash,gcash,qrph,bank_transfer'],
            'payment_reference' => ['nullable', 'string', 'max:100'],
        ]);

        $remaining = max(0, (float) $fee->amount - (float) $fee->paid_amount);
        if ($remaining <= 0) {
            return response()->json(['message' => 'This fee is already paid.'], 422);
        }

        $paidAmount = min((float) $data['amount'], $remaining);
        $newPaidAmount = (float) $fee->paid_amount + $paidAmount;
        $status = $newPaidAmount >= (float) $fee->amount ? 'paid' : 'partial';

        $fee->update([
            'paid_amount' => $newPaidAmount,
            'status' => $status,
            'paid_date' => $status === 'paid' ? now() : $fee->paid_date,
            'payment_method' => $data['payment_method'],
            'payment_reference' => $data['payment_reference'] ?? $fee->payment_reference,
            'paid_by' => $request->user()->id,
            'verified_by' => $isManager ? $request->user()->id : null,
            'payment_verified_at' => $isManager ? now() : null,
        ]);

        if ($status === 'paid') {
            $this->awardEarlyPaymentIfEligible($fee->fresh(), $points, $request->user());
        }

        SchoolNotification::create([
            'user_id' => $fee->student?->user_id,
            'type' => $status === 'paid' ? 'tuition_paid' : 'tuition_partial_payment',
            'title' => $status === 'paid' ? 'Tuition paid' : 'Tuition payment recorded',
            'body' => "Payment of PHP " . number_format($paidAmount, 2) . " was recorded for {$fee->type}.",
            'channels' => ['in_app'],
            'data' => ['fee_id' => $fee->id, 'status' => $status],
        ]);

        return response()->json($fee->fresh()->load('student'));
    }

    public function destroy(Fee $fee)
    {
        $this->authorizeFeeManager(request());

        $fee->delete();
        return response()->json(['message' => 'Fee deleted']);
    }

    public function byStudent(Student $student)
    {
        $fees = Fee::where('student_id', $student->id)
            ->orderBy('due_date')
            ->get();

        return response()->json([
            'fees'          => $fees,
            'total_due'     => $fees->where('status', '!=', 'paid')->sum(fn ($fee) => max(0, (float) $fee->amount - (float) $fee->paid_amount)),
            'total_paid'    => $fees->where('status', 'paid')->sum('paid_amount'),
        ]);
    }

    public function mine(Request $request)
    {
        $student = Student::where('user_id', $request->user()->id)->first();

        if (!$student) {
            return response()->json([
                'fees' => [],
                'total_due' => 0,
                'total_paid' => 0,
            ]);
        }

        return $this->byStudent($student);
    }

    private function awardEarlyPaymentIfEligible(Fee $fee, PointsService $points, $awardedBy = null): void
    {
        if (!$fee->student || !$fee->paid_date || !$fee->due_date || $fee->paid_date->gt($fee->due_date)) {
            return;
        }

        $points->awardVerifiedPoints($fee->student, [
            'source' => 'early_payment',
            'source_key' => "early-payment:fee:{$fee->id}",
            'title' => 'Early tuition payment bonus',
            'description' => "Paid {$fee->type} on or before the due date.",
            'points' => 40,
            'school_year' => $fee->school_year,
            'semester' => $fee->semester,
            'meta' => ['fee_id' => $fee->id],
        ], $awardedBy);
    }

    private function authorizeFeeManager(Request $request): void
    {
        $user = $request->user();

        if (!$user || (
            !in_array($user->role, ['admin', 'registrar', 'school_management'], true)
            && !$user->hasAnyRole(['admin', 'registrar', 'school_management'])
        )) {
            abort(response()->json(['message' => 'Admin or registrar access is required.'], 403));
        }
    }
}
