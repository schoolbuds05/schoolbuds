<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Grade;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiStudyController extends Controller
{
    private function callGroq(string $systemPrompt, string $userMessage): string
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.groq.key'),
            'Content-Type'  => 'application/json',
        ])->post('https://api.groq.com/openai/v1/chat/completions', [
            'model'       => 'openai/gpt-oss-20b',
            'max_tokens'  => 1024,
            'temperature' => 0.7,
            'messages'    => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user',   'content' => $userMessage],
            ],
        ]);

        if (!$response->successful()) {
            throw new \Exception('Groq API error: ' . $response->body());
        }

        return $response->json('choices.0.message.content');
    }

    public function chat(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:1000',
            'subject' => 'nullable|string',
        ]);

        $user    = $request->user();
        $student = Student::where('user_id', $user->id)->first();

        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        $grades = Grade::where('student_id', $student->id)
            ->with('schoolClass')
            ->get();

        $gradeContext = $grades->map(function ($g) {
            $scale = $g->schoolClass?->is_college ? '/5 (1 is highest)' : '/100';
            return "{$g->schoolClass->subject}: Q{$g->quarter} = {$g->score}{$scale} ({$g->remarks})";
        })->join("\n");

        $weakSubjects = $grades
            ->filter(fn($g) => $g->schoolClass?->is_college ? $g->score > 3 : $g->score < 80)
            ->map(fn($g) => $g->schoolClass->subject)
            ->unique()
            ->join(', ');

        $systemPrompt = "You are a friendly and encouraging AI study companion for a Filipino Grade {$student->grade_level} student named {$student->first_name}.

Here are their current grades:
{$gradeContext}

Weak subjects (below passing threshold: above 3.00 for college or below 80/100 otherwise): " . ($weakSubjects ?: 'none') . "

Your role:
- Answer questions clearly and simply, using examples a Grade {$student->grade_level} student would understand
- Give extra attention and encouragement to weak subjects
- If asked to generate a quiz, create 3-5 multiple choice questions with answers
- Keep responses concise and friendly
- Use Filipino context where appropriate (Philippine history, culture, etc.)
- Always end with an encouraging message";

        try {
            $reply = $this->callGroq($systemPrompt, $request->message);
            return response()->json([
                'reply'   => $reply,
                'student' => $student->first_name,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Groq study chat request failed.', ['exception' => $e]);
            return response()->json(['message' => 'AI service unavailable'], 503);
        }
    }

    public function quickQuiz(Request $request)
    {
        $request->validate(['subject' => 'required|string']);

        $user    = $request->user();
        $student = Student::where('user_id', $user->id)->first();

        $grade = Grade::where('student_id', $student->id)
            ->whereHas('schoolClass', fn($q) =>
                $q->where('subject', 'like', "%{$request->subject}%")
            )
            ->with('schoolClass')
            ->latest()
            ->first();

        $score   = $grade?->score ?? 'unknown';
        $quarter = $grade?->quarter ?? 'latest';

        $systemPrompt = "You are a quiz generator. Return ONLY a valid JSON array, no other text, no markdown, no explanation.";

        $gradeScale = $grade?->schoolClass?->is_college ? '/5 (1 is highest)' : '/100';
        $userMessage = "Generate a 5-question multiple choice quiz for a Grade {$student->grade_level} Filipino student on: {$request->subject}. Their score is {$score}{$gradeScale} in Q{$quarter}. Return ONLY a JSON array where each item has: question, choices (array of 4 strings), answer (the correct choice string), explanation.";

        try {
            $raw   = $this->callGroq($systemPrompt, $userMessage);
            $clean = preg_replace('/```json|```/', '', $raw);
            $quiz  = json_decode(trim($clean), true);

            if (!$quiz) {
                return response()->json(['message' => 'Could not parse quiz'], 500);
            }

            return response()->json([
                'quiz'    => $quiz,
                'subject' => $request->subject,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Groq quick quiz request failed.', ['exception' => $e]);
            return response()->json(['message' => 'AI service unavailable'], 503);
        }
    }
}