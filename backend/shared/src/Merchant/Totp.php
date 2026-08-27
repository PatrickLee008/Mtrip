<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

/** RFC 6238 / Google Authenticator: SHA1, six digits, 30 seconds. No remote QR service. */
final class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function secret(): string
    {
        $bits = '';
        foreach (str_split(random_bytes(20)) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }
        return implode('', array_map(static fn ($part) => self::ALPHABET[bindec($part)], str_split($bits, 5)));
    }

    public static function code(string $secret, int $step, int $digits = 6): string
    {
        if (! preg_match('/^[A-Z2-7]+$/D', $secret) || $step < 0 || ! in_array($digits, [6, 8], true)) {
            throw new \InvalidArgumentException('Invalid TOTP parameters');
        }
        $bits = '';
        foreach (str_split($secret) as $char) {
            $bits .= str_pad(decbin(strpos(self::ALPHABET, $char)), 5, '0', STR_PAD_LEFT);
        }
        $key = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) $key .= chr(bindec($byte));
        }
        $hash = hash_hmac('sha1', pack('N2', intdiv($step, 4294967296), $step % 4294967296), $key, true);
        $offset = ord($hash[19]) & 15;
        $number = unpack('N', substr($hash, $offset, 4))[1] & 0x7fffffff;
        return str_pad((string) ($number % (10 ** $digits)), $digits, '0', STR_PAD_LEFT);
    }

    public static function matchStep(string $secret, string $code, int $lastStep, ?int $now = null): ?int
    {
        if (! preg_match('/^[0-9]{6}$/D', $code)) return null;
        $step = intdiv($now ?? time(), 30);
        foreach ([$step, $step - 1, $step + 1] as $candidate) {
            if ($candidate > $lastStep && hash_equals(self::code($secret, $candidate), $code)) return $candidate;
        }
        return null;
    }
}
