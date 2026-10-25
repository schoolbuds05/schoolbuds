<?php

namespace App\Http\Requests;

use App\Services\SectionDepartmentAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GenerateSectionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        if (! $this->user()) {
            return false;
        }
        SectionDepartmentAccess::authorize($this->user());

        return true;
    }

    public function rules(): array
    {
        return [
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'year_level' => ['required', Rule::in(['1', '2', '3', '4'])],
            'school_year' => ['required', 'regex:/^\d{4}-\d{4}$/'],
            'semester' => ['required', Rule::in(['1st', '2nd', 'summer'])],
            'expected_students' => ['required', 'integer', 'min:1', 'max:2000'],
            'max_students' => ['required', 'integer', 'min:1', 'max:200'],
            'days' => ['required', 'array', 'min:1', 'max:7'],
            'days.*' => ['required', 'distinct', Rule::in(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])],
            'time_start' => ['required', 'date_format:H:i'],
            'time_end' => ['required', 'date_format:H:i', 'after:time_start'],
            'rooms' => ['required', 'array', 'min:1', 'max:20'],
            'rooms.*' => ['required', 'string', 'max:50', 'distinct:ignore_case', 'not_regex:/^\s*$/'],
            'max_teacher_minutes' => ['required', 'integer', 'min:15', 'max:3600'],
            'subjects' => ['required', 'array', 'min:1', 'max:40'],
            'subjects.*.subject_id' => ['required', 'integer', 'distinct', 'exists:subjects,id'],
            'subjects.*.meetings' => ['required', 'integer', 'min:1', 'max:7'],
            'subjects.*.minutes' => ['required', 'integer', 'min:15', 'max:240', 'multiple_of:15'],
        ];
    }
}
