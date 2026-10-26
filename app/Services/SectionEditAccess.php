<?php

namespace App\Services;

use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SectionEditAccess
{
    public function prepareChairEdit(User $user, Section $section): void
    {
        if (! SectionDepartmentAccess::isChair($user)) {
            return;
        }

        if (in_array($section->workflow_status, ['draft', 'rejected'], true)) {
            return;
        }

        DB::transaction(function () use ($user, $section): void {
            $lockedSection = Section::query()->lockForUpdate()->findOrFail($section->id);
            abort_unless((int) $lockedSection->department_id === (int) $user->department_id, 403);

            if (in_array($lockedSection->workflow_status, ['draft', 'rejected'], true)) {
                return;
            }

            $approvedRequest = $lockedSection->editRequests()
                ->where('status', 'approved')
                ->lockForUpdate()
                ->latest('id')
                ->first();
            abort_unless($approvedRequest, 403, 'Request and receive Registrar approval before editing an approved section.');

            $approvedRequest->update(['status' => 'completed']);
            $lockedSection->update([
                'workflow_status' => 'draft',
                'workflow_remarks' => null,
                'reviewed_by' => null,
                'reviewed_at' => null,
                'submitted_at' => null,
                'is_active' => false,
            ]);
        });

        $section->refresh();
    }
}
