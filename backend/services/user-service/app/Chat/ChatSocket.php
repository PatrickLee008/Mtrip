<?php

declare(strict_types=1);

namespace App\Chat;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Chat\ChatAccess;
use Mtrip\Shared\Chat\ChatService;
use Swoole\Coroutine;
use Swoole\Timer;
use Swoole\WebSocket\Server;

/** One Redis subscriber per worker, shared by its authenticated WebSocket connections. */
final class ChatSocket
{
    private array $clients = [];
    private bool $subscribing = false;

    public function __construct(private Redis $redis, private ConfigInterface $config)
    {
    }

    public function onOpen(Server $server, \Swoole\Http\Request $request): void
    {
        try {
            if (! in_array(($request->server['request_uri'] ?? ''), ['/api/v1/app/chat/socket','/api/v1/merchant/chat/socket'], true)) throw new \RuntimeException();
            $ticket = (string) ($request->get['ticket'] ?? '');
            if (! preg_match('/^[a-f0-9]{48}$/D', $ticket)) throw new \RuntimeException();
            $raw = $this->redis->getDel('mtrip:chat:ticket:' . $ticket);
            if (! $raw) throw new \RuntimeException();
            $i = json_decode($raw, true);
            if (str_contains($request->server['request_uri'], '/merchant/') !== ($i['role'] === 'merchant')) throw new \RuntimeException();
            $this->validate($i);
            $fd = $request->fd;
            $timer = Timer::tick(15000, function () use ($server, $fd) {
                Coroutine::create(function () use ($server, $fd) {
                    try { $this->validate($this->clients[$fd]['identity']); }
                    catch (\Throwable) { $server->disconnect($fd, 4003, 'Authorization expired'); }
                });
            });
            $this->clients[$fd] = ['identity' => $i, 'timer' => $timer];
            $this->subscribe($server);
            $server->push($fd, json_encode(['kind' => 'ready']));
        } catch (\Throwable) {
            $server->disconnect($request->fd, 4003, 'Invalid chat ticket');
        }
    }

    private function validate(array $i): void
    {
        if (($i['expires'] ?? 0) < time()) throw new \RuntimeException();
        if ($i['role'] === 'merchant') {
            $a = ChatAccess::employee((int) $i['actorId']);
            if ((int) $a['auth_version'] !== (int) $i['authVersion'] || ! ChatAccess::permission($a, 'mch:chat:list')) throw new \RuntimeException();
            $current = ChatAccess::properties($a);
            $original = $i['propertyIds'];
            sort($current); sort($original);
            if ($current !== $original || ($i['selected'] > 0 && ! in_array((int) $i['selected'], $current, true))) throw new \RuntimeException();
        } elseif (! Db::table('user_info')->where('id', $i['actorId'])->where('site_id', $i['siteId'])->where('user_status', 1)->whereNull('deleted_at')->exists()) {
            throw new \RuntimeException();
        }
    }

    private function subscribe(Server $server): void
    {
        if ($this->subscribing) return;
        $this->subscribing = true;
        Coroutine::create(function () use ($server) {
            while (true) {
                try {
                    // A dedicated connection avoids exhausting the HTTP Redis pool with a blocking subscription.
                    $cfg = $this->config->get('redis.default');
                    $r = new \Redis();
                    $r->connect($cfg['host'], (int) $cfg['port'], 3);
                    if ($cfg['auth']) $r->auth($cfg['auth']);
                    $r->select((int) $cfg['db']);
                    $r->setOption(\Redis::OPT_READ_TIMEOUT, -1);
                    $r->subscribe(['mtrip:chat:events'], function ($r, $channel, $raw) use ($server) {
                        $event = json_decode($raw, true);
                        foreach ($this->clients as $fd => $client) {
                            $i = $client['identity'];
                            if ($i['role'] === 'user' && $event['kind'] === 'internal') continue;
                            try {
                                $this->validate($i);
                                (new ChatService())->conversation((int) $event['conversationId'], $i['role'], (int) $i['actorId'], (int) $i['siteId'], (int) $i['selected']);
                                if ($server->isEstablished($fd)) $server->push($fd, $raw);
                            } catch (\Throwable) {
                                // An out-of-scope event is never sent; periodic validation closes revoked sessions.
                            }
                        }
                    });
                } catch (\Throwable $e) {
                    error_log('chat_subscriber_reconnect ' . $e::class);
                    foreach ($this->clients as $fd => $client) if ($server->isEstablished($fd)) $server->disconnect($fd, 1012, 'Realtime reconnect');
                    Coroutine::sleep(2);
                }
            }
        });
    }

    public function onMessage(Server $server, \Swoole\WebSocket\Frame $frame): void
    {
        if (! isset($this->clients[$frame->fd])) { $server->disconnect($frame->fd); return; }
        if ($frame->data === 'ping') $server->push($frame->fd, '{"kind":"pong"}');
    }

    public function onClose(Server $server, int $fd): void
    {
        if (isset($this->clients[$fd])) Timer::clear($this->clients[$fd]['timer']);
        unset($this->clients[$fd]);
    }
}
