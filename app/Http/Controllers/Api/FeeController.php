<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Fee;
use App\Models\SchoolNotification;
use App\Models\Student;
use App\Services\PointsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\DB;

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
            $fee->update([
                'paid_date' => now(),
                'paid_amount' => $fee->amount,
                'pending_payment_amount' => null,
                'payment_verification_status' => 'verified',
                'verified_by' => $request->user()->id,
                'payment_verified_at' => now(),
            ]);
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
        if (!$isManager) {
            if ($fee->payment_verification_status === 'pending') {
                return response()->json(['message' => 'A payment is already awaiting school verification.'], 409);
            }

            $fee->update([
                'pending_payment_amount' => $paidAmount,
                'payment_verification_status' => 'pending',
                'payment_method' => $data['payment_method'],
                'payment_reference' => $data['payment_reference'] ?? null,
                'paid_by' => $request->user()->id,
                'verified_by' => null,
                'payment_verified_at' => null,
            ]);

            SchoolNotification::create([
                'user_id' => $fee->student?->user_id,
                'type' => 'tuition_payment_pending',
                'title' => 'Payment submitted for verification',
                'body' => "Your payment of PHP " . number_format($paidAmount, 2) . " for {$fee->type} is awaiting school verification.",
                'channels' => ['in_app'],
                'data' => ['fee_id' => $fee->id, 'status' => 'pending_verification'],
            ]);

            return response()->json([
                'message' => 'Payment submitted and is awaiting school verification.',
                'fee' => $fee->fresh()->load('student'),
            ], 202);
        }

        $newPaidAmount = (float) $fee->paid_amount + $paidAmount;
        $status = $newPaidAmount >= (float) $fee->amount ? 'paid' : 'partial';
        $fee->update([
            'paid_amount' => $newPaidAmount,
            'pending_payment_amount' => null,
            'payment_verification_status' => 'verified',
            'status' => $status,
            'paid_date' => $status === 'paid' ? now() : $fee->paid_date,
            'payment_method' => $data['payment_method'],
            'payment_reference' => $data['payment_reference'] ?? null,
            'paid_by' => $request->user()->id,
            'verified_by' => $request->user()->id,
            'payment_verified_at' => now(),
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

    public function verifyPayment(Request $request, Fee $fee, PointsService $points)
    {
        $this->authorizeFeeManager($request);
        $data = $request->validate(['approved' => ['required', 'boolean']]);

        $fee = DB::transaction(function () use ($fee, $data, $request) {
            $lockedFee = Fee::query()->lockForUpdate()->findOrFail($fee->id);
            if ($lockedFee->payment_verification_status !== 'pending' || (float) $lockedFee->pending_payment_amount <= 0) {
                abort(422, 'There is no pending payment to review.');
            }

            $changes = [
                'pending_payment_amount' => null,
                'payment_verification_status' => $data['approved'] ? 'verified' : 'rejected',
                'verified_by' => $request->user()->id,
                'payment_verified_at' => now(),
            ];

            if ($data['approved']) {
                $newPaidAmount = min(
                    (float) $lockedFee->amount,
                    (float) $lockedFee->paid_amount + (float) $lockedFee->pending_payment_amount
                );
                $changes['paid_amount'] = $newPaidAmount;
                $changes['status'] = $newPaidAmount >= (float) $lockedFee->amount ? 'paid' : 'partial';
                if ($changes['status'] === 'paid') {
                    $changes['paid_date'] = now();
                }
            }

            $lockedFee->update($changes);
            return $lockedFee->fresh()->load('student');
        });

        if ($data['approved'] && $fee->status === 'paid') {
            $this->awardEarlyPaymentIfEligible($fee, $points, $request->user());
        }

        SchoolNotification::create([
            'user_id' => $fee->student?->user_id,
            'type' => $data['approved'] ? 'tuition_paid' : 'tuition_payment_rejected',
            'title' => $data['approved'] ? 'Payment verified' : 'Payment not verified',
            'body' => $data['approved']
                ? "Your payment for {$fee->type} was verified by the school."
                : "Your payment for {$fee->type} could not be verified. Please contact the school office.",
            'channels' => ['in_app'],
            'data' => ['fee_id' => $fee->id, 'status' => $fee->status],
        ]);

        if (!$request->expectsJson()) {
            return redirect()
                ->route('admin.fees.index', ['type' => 'pending'])
                ->with('status', $data['approved'] ? 'Payment verified and applied to the student balance.' : 'Payment marked as not verified.');
        }

        return response()->json(['message' => 'Payment review saved.', 'fee' => $fee]);
    }

    public function destroy(Fee $fee)
    {
        $this->authorizeFeeManager(request());

        $fee->delete();
        return response()->json(['message' => 'Fee deleted']);
    }

    public function byStudent(Student $student)
    {
        Gate::authorize('viewRecords', $student);

        $fees = Fee::where('student_id', $student->id)
            ->orderBy('due_date')
            ->get();

        return response()->json([
            'fees'          => $fees,
            'total_due'     => $fees->where('status', '!=', 'paid')->sum(fn ($fee) => max(0, (float) $fee->amount - (float) $fee->paid_amount)),
            'total_paid'    => $fees->sum('paid_amount'),
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
            'points' => (int) $points->rule('early_payment_early_points'),
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
