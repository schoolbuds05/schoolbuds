<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\AssignmentController;
use App\Models\User;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class QuizQuestionGenerationTest extends TestCase
{
    public function test_ai_generation_returns_exactly_fifty_questions_in_separate_batches(): void
    {
        Config::set('services.groq.key', 'test-key');
        $batchCount = 0;
        Http::fake(function (ClientRequest $request) use (&$batchCount) {
            $batchCount++;
            preg_match('/Generate exactly (\d+) multiple-choice questions/', $request['messages'][1]['content'], $match);
            $count = (int) ($match[1] ?? 0);
            $questions = array_map(fn ($index) => [
                'question' => "Question {$index}",
                'choices' => ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
                'answer' => 'A',
            ], range(1, $count));

            return Http::response([
                'choices' => [['message' => ['content' => json_encode($questions)]]],
            ]);
        });

        $teacher = User::factory()->make([
            'role' => User::ROLE_FACULTY,
            'position' => User::POSITION_TEACHER,
        ]);
        $request = Request::create('/api/teacher/assignments/generate-quiz', 'POST', [
            'module_text' => 'A module containing source material.',
            'question_count' => 50,
        ]);
        $request->setUserResolver(fn () => $teacher);

        $response = (new AssignmentController)->generateQuiz($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertCount(50, $response->getData(true)['questions']);
        $this->assertSame('Choice A', $response->getData(true)['questions'][0]['answer']);
        $this->assertSame(5, $batchCount);
        Http::assertSentCount(5);
    }
}
