<?php

declare(strict_types=1);

namespace {
    require __DIR__ . '/../../../shared/tests/bootstrap.php';
    require __DIR__ . '/../app/Service/SmsChannelTestService.php';
    require __DIR__ . '/../app/Controller/AbstractController.php';
    require __DIR__ . '/../app/Controller/Admin/SmsController.php';
}

namespace Hyperf\HttpServer\Contract {
    interface RequestInterface {}
}

namespace Hyperf\Config {
    function config(string $key): string { return 'test-key'; }
}

namespace App\Model {
    class SysSmsChannel
    {
        public function __construct(public int $id, public int $site_id, public string $provider_code = 'smspoh') {}
        public function toArray(): array { return get_object_vars($this); }
        public static function query(): object
        {
            return new class {
                public function find(int $id): ?SysSmsChannel { return $id === 1 ? new SysSmsChannel(1, 7) : null; }
            };
        }
    }
}

namespace {
    use App\Controller\Admin\SmsController;
    use App\Service\SmsChannelTestService;
    use Hyperf\DbConnection\Db;
    use Hyperf\Redis\Redis;
    use Mtrip\Shared\Annotation\Permission;
    use Mtrip\Shared\Constants\ErrorCode;
    use Mtrip\Shared\Context\AdminContext;
    use Mtrip\Shared\Exception\BusinessException;
    use Mtrip\Shared\Support\CryptoHelper;

    final class TestSmsRequest implements \Hyperf\HttpServer\Contract\RequestInterface
    {
        public array $params = [];
        public function input(string $key, mixed $default = null): mixed { return $this->params[$key] ?? $default; }
    }

    final class TestSmsLogQuery
    {
        public array $rows = [];
        private int $id = 0;
        public function insertGetId(array $row): int { $this->rows[] = $row; return count($this->rows); }
        public function where(string $key, int $id): self { $this->id = $id; return $this; }
        public function update(array $row): void { $this->rows[$this->id - 1] = array_merge($this->rows[$this->id - 1], $row); }
    }

    final class TestSmsSender extends SmsChannelTestService
    {
        public int $calls = 0;
        public bool $ok = true;
        public function send(array $channel, string $aesKey, string $mobile, string $content): array
        {
            ++$this->calls;
            return ['ok' => $this->ok, 'requestId' => $this->ok ? 'otp123' : '', 'message' => $this->ok ? '' : 'HTTP 401'];
        }
    }

    final class TestSmsController extends SmsController
    {
        public function __construct(TestSmsRequest $request, TestSmsSender $sender)
        {
            $this->request = $request;
            $this->testSender = $sender;
            $this->redis = new Redis();
        }
    }

    MiniTest::add('SMS controller: site isolation, validation, log encryption and cooldown', static function (): void {
        $request = new TestSmsRequest();
        $sender = new TestSmsSender();
        $controller = new TestSmsController($request, $sender);
        $logs = new TestSmsLogQuery();
        Db::$tableResolver = static fn (string $table): object => $logs;
        $request->params = ['id' => 1, 'mobile' => '+959771234567'];
        AdminContext::set(['admin_id' => 11, 'site_id' => 8, 'is_super' => false]);
        MiniTest::assertThrows(BusinessException::class, fn () => $controller->testSend(), ErrorCode::NO_DATA_PERMISSION);
        MiniTest::assertSame(0, $sender->calls);
        MiniTest::assertSame([], $logs->rows);

        AdminContext::set(['admin_id' => 11, 'site_id' => 7, 'is_super' => false]);
        $request->params['id'] = 999;
        MiniTest::assertThrows(BusinessException::class, fn () => $controller->testSend(), ErrorCode::NOT_FOUND);
        $request->params['id'] = 1;
        $request->params['mobile'] = 'invalid';
        MiniTest::assertThrows(BusinessException::class, fn () => $controller->testSend(), ErrorCode::PARAM_ERROR);
        MiniTest::assertSame(0, $sender->calls);
        $request->params['mobile'] = '+959771234567';
        $result = $controller->testSend();
        MiniTest::assertSame(0, $result['code']);
        MiniTest::assertSame('otp123', $result['data']['requestId']);
        MiniTest::assertSame(7, $logs->rows[0]['site_id']);
        MiniTest::assertSame(1, $logs->rows[0]['status']);
        MiniTest::assertSame('+959771234567', CryptoHelper::decrypt($logs->rows[0]['mobile'], 'test-key'));
        MiniTest::assertThrows(BusinessException::class, fn () => $controller->testSend(), ErrorCode::DATA_CONFLICT);
        MiniTest::assertSame(1, $sender->calls);
        MiniTest::assertSame(1, count($logs->rows));

        AdminContext::set(['admin_id' => 1, 'site_id' => 0, 'is_super' => true]);
        $request->params['mobile'] = '+959771234568';
        $sender->ok = false;
        MiniTest::assertThrows(BusinessException::class, fn () => $controller->testSend(), ErrorCode::SMS_CHANNEL_UNAVAILABLE);
        MiniTest::assertSame(2, $logs->rows[1]['status']);
        MiniTest::assertSame('HTTP 401', $logs->rows[1]['fail_reason']);
    });

    MiniTest::add('SMS controller: permission key matches seed and registered aspect', static function (): void {
        $method = new ReflectionMethod(SmsController::class, 'testSend');
        MiniTest::assertSame(['config:sms:test'], $method->getAttributes(Permission::class)[0]->newInstance()->keys());
        $root = dirname(__DIR__, 4);
        MiniTest::assertTrue(str_contains(file_get_contents($root . '/database/seed/02-menu.sql'), "'config:sms:test'"));
        MiniTest::assertTrue(str_contains(file_get_contents(__DIR__ . '/../config/autoload/aspects.php'), 'PermissionAspect::class'));
    });

    exit(MiniTest::run() === 0 ? 0 : 1);
}
