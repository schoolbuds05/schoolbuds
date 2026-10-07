<?php

namespace Tests\Unit;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Grammars\MySqlGrammar;
use Tests\TestCase;

class MySqlGrammarCompatibilityTest extends TestCase
{
    public function test_it_uses_information_schema_processlist_for_thread_count_on_mariadb(): void
    {
        $grammar = new MySqlGrammar($this->createMock(Connection::class));

        $this->assertSame(
            'select count(*) as `Value` from information_schema.processlist',
            $grammar->compileThreadCount()
        );
    }
}
