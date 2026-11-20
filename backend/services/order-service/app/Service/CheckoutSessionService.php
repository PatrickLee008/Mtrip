<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** Server-authoritative multi-hotel payment window, Consumer 1.0.8 M1.1. */
final class CheckoutSessionService
{
    public const SECONDS = 600;

    public static function fingerprint(array $items): string
    {
        $normalized = [];
        foreach ($items as $item) {
            $addons = array_values(array_unique(array_map('strval', (array) ($item['addons'] ?? []))));
            sort($addons);
            $normalized[] = ['propertyId' => (int) ($item['propertyId'] ?? 0), 'roomTypeId' => (int) ($item['roomTypeId'] ?? 0),
                'quantity' => (int) ($item['quantity'] ?? 1), 'useDate' => (string) ($item['useDate'] ?? ''),
                'endDate' => (string) ($item['endDate'] ?? ''), 'isCitizen' => (int) ($item['isCitizen'] ?? 0),
                'addons' => $addons, 'guestCount' => (int) ($item['guestCount'] ?? 0)];
        }
        return hash('sha256', json_encode($normalized, JSON_THROW_ON_ERROR));
    }

    public function open(int $site, int $user, string $key, array $items, bool $review, int $enteredAt, callable $quote): array
    {
        self::key($key);
        return Db::transaction(function () use ($site, $user, $key, $items, $review, $enteredAt, $quote): array {
            // Unique insertion and the session row serialize duplicate opens, including two tabs.
            Db::table('order_checkout_session')->insertOrIgnore(['site_id' => $site, 'user_id' => $user,
                'checkout_key' => $key, 'items_hash' => self::fingerprint($items),
                'started_at' => gmdate('Y-m-d H:i:s', $enteredAt), 'expires_at' => gmdate('Y-m-d H:i:s', $enteredAt + self::SECONDS)]);
            $row = Db::table('order_checkout_session')->where('site_id', $site)->where('user_id', $user)
                ->where('checkout_key', $key)->lockForUpdate()->first();
            $hash = self::fingerprint($items);
            if ($row->items_hash !== $hash && (! $review || $row->trip_id)) {
                self::expired('Cart changed; review the current price and availability');
            }
            // An existing order or expired window must remain recoverable even if the room is now sold out.
            if ($row->trip_id || (! $review && $row->expires_at <= gmdate('Y-m-d H:i:s'))) {
                BookingConsumerGuard::lockActive($site, $user);
                return self::present((array) $row) + ['quote' => null];
            }
            $currentQuote = $quote();
            if (! $row->trip_id && $review && ($row->expires_at <= gmdate('Y-m-d H:i:s') || $row->items_hash !== $hash)) {
                // Only an explicit fresh price/stock review creates a new revision.
                Db::table('order_checkout_session')->where('id', $row->id)->update(['items_hash' => $hash,
                    'revision' => (int) $row->revision + 1, 'started_at' => gmdate('Y-m-d H:i:s', $enteredAt),
                    'expires_at' => gmdate('Y-m-d H:i:s', $enteredAt + self::SECONDS)]);
                $row = Db::table('order_checkout_session')->where('id', $row->id)->first();
            } elseif ($row->items_hash !== $hash) {
                self::expired('Cart changed; review the current price and availability');
            }
            BookingConsumerGuard::lockActive($site, $user);
            return self::present((array) $row) + ['quote' => $currentQuote];
        });
    }

    /** Called inside Trip creation's transaction, before any inventory is locked. */
    public function lock(int $site, int $user, string $key, int $revision, array $items): array
    {
        self::key($key);
        $row = Db::table('order_checkout_session')->where('site_id', $site)->where('user_id', $user)
            ->where('checkout_key', $key)->lockForUpdate()->first();
        if (! $row || (int) $row->revision !== $revision || $row->items_hash !== self::fingerprint($items)) {
            self::expired('Review the current price and availability before paying');
        }
        $row = (array) $row;
        if (! $row['trip_id']) self::assertOpen($row);
        return $row;
    }

    public static function assertOpen(array $row): void
    {
        if ($row['expires_at'] <= gmdate('Y-m-d H:i:s')) self::expired('Payment time has expired; review the current price and availability');
    }

    private static function key(string $key): void
    {
        if (! preg_match('/^[A-Za-z0-9_-]{16,64}$/D', $key)) self::expired('A checkout session is required');
    }

    private static function expired(string $message): never
    {
        throw new BusinessException(ErrorCode::CHECKOUT_EXPIRED, $message, ['checkoutExpired' => true]);
    }

    private static function present(array $row): array
    {
        return ['checkoutKey' => $row['checkout_key'], 'revision' => (int) $row['revision'],
            'expiresAtMs' => strtotime($row['expires_at'] . ' UTC') * 1000, 'serverNowMs' => (int) floor(microtime(true) * 1000),
            'expired' => $row['expires_at'] <= gmdate('Y-m-d H:i:s'), 'tripId' => (int) $row['trip_id']];
    }
}
