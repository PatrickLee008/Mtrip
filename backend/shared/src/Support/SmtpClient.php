<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

/**
 * Small SMTP client kept dependency-free for the services that already use
 * stream based provider clients. It supports authenticated SMTP over TLS.
 */
class SmtpClient
{
    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $encryption,
        private readonly string $username,
        private readonly string $password,
        private readonly int $timeout = 15,
    ) {
    }

    /** @return array{ok:bool,message:string} */
    public function send(string $fromEmail, string $fromName, string $to, string $subject, string $body): array
    {
        if (! filter_var($fromEmail, FILTER_VALIDATE_EMAIL) || ! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'message' => 'invalid email address'];
        }
        if ($this->host === '' || $this->port < 1 || $this->port > 65535 || ! in_array($this->encryption, ['tls', 'ssl', 'none'], true)) {
            return ['ok' => false, 'message' => 'invalid SMTP channel configuration'];
        }

        try {
            $socket = $this->connect();
            $this->expect($socket, [220]);
            $this->command($socket, 'EHLO mtrip.local', [250]);
            if ($this->encryption === 'tls') {
                $this->command($socket, 'STARTTLS', [220]);
                if (! stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new \RuntimeException('STARTTLS negotiation failed');
                }
                $this->command($socket, 'EHLO mtrip.local', [250]);
            }
            if ($this->username !== '') {
                $this->command($socket, 'AUTH PLAIN ' . base64_encode("\0{$this->username}\0{$this->password}"), [235]);
            }
            $this->command($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
            $this->command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
            $this->command($socket, 'DATA', [354]);
            fwrite($socket, self::message($fromEmail, $fromName, $to, $subject, $body) . "\r\n.\r\n");
            $this->expect($socket, [250]);
            fwrite($socket, "QUIT\r\n");
            fclose($socket);
            return ['ok' => true, 'message' => 'accepted'];
        } catch (\Throwable $e) {
            if (isset($socket) && is_resource($socket)) {
                fclose($socket);
            }
            // Provider details can contain host/user data; callers persist only this bounded message.
            return ['ok' => false, 'message' => mb_substr($e->getMessage(), 0, 200)];
        }
    }

    public static function message(string $fromEmail, string $fromName, string $to, string $subject, string $body): string
    {
        $safeName = self::header($fromName);
        $safeSubject = self::header($subject);
        $body = str_replace(["\r\n", "\r"], "\n", $body);
        $lines = array_map(static fn (string $line): string => str_starts_with($line, '.') ? '.' . $line : $line, explode("\n", $body));
        return implode("\r\n", [
            'From: =?UTF-8?B?' . base64_encode($safeName) . '?= <' . $fromEmail . '>',
            'To: <' . $to . '>',
            'Subject: =?UTF-8?B?' . base64_encode($safeSubject) . '?=',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            implode("\r\n", $lines),
        ]);
    }

    /** @return resource */
    private function connect()
    {
        $target = ($this->encryption === 'ssl' ? 'ssl://' : 'tcp://') . $this->host . ':' . $this->port;
        $context = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $this->host]]);
        $socket = @stream_socket_client($target, $errno, $error, $this->timeout, STREAM_CLIENT_CONNECT, $context);
        if (! is_resource($socket)) {
            throw new \RuntimeException('SMTP connection failed');
        }
        stream_set_timeout($socket, $this->timeout);
        return $socket;
    }

    /** @param resource $socket @param list<int> $allowed */
    private function command($socket, string $command, array $allowed): void
    {
        if (fwrite($socket, $command . "\r\n") === false) {
            throw new \RuntimeException('SMTP command failed');
        }
        $this->expect($socket, $allowed);
    }

    /** @param resource $socket @param list<int> $allowed */
    private function expect($socket, array $allowed): void
    {
        $last = '';
        do {
            $line = fgets($socket, 1024);
            if ($line === false) {
                throw new \RuntimeException('SMTP response timeout');
            }
            $last = trim($line);
        } while (preg_match('/^\d{3}-/', $last) === 1);
        $status = (int) substr($last, 0, 3);
        if (! in_array($status, $allowed, true)) {
            throw new \RuntimeException('SMTP rejected request (' . $status . ')');
        }
    }

    private static function header(string $value): string
    {
        return str_replace(["\r", "\n"], '', $value);
    }
}
