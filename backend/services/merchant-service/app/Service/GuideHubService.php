<?php

declare(strict_types=1);

namespace App\Service;

use GuzzleHttp\Client;
use Hyperf\Contract\ConfigInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\SupportAccess;
use Mtrip\Shared\Support\SupportTicketPolicy as Policy;

/** Guide Hub Client API 1.0.0; app secrets remain in this server adapter. */
class GuideHubService
{
    public function __construct(private ConfigInterface $config)
    {
    }

    public function read(string $kind, array $input): array
    {
        SupportAccess::requireMerchant('mch:support:guides');
        $cfg = (array) $this->config->get('guide_hub', []);
        if (empty($cfg['app_id']) || empty($cfg['app_secret']) || empty($cfg['merchant_app_slug'])) return ['status' => 'not_configured', 'list' => []];
        if (! str_starts_with((string) $cfg['base_url'], 'https://')) throw new BusinessException(ErrorCode::SERVER_ERROR, '指南服务配置无效');
        $client = new Client(['base_uri' => rtrim($cfg['base_url'], '/') . '/', 'timeout' => 8, 'connect_timeout' => 3, 'http_errors' => false,
            'allow_redirects' => false, 'headers' => ['Accept' => 'application/json', 'X-App-ID' => $cfg['app_id'], 'X-App-Secret' => $cfg['app_secret']]]);
        try {
            $app = $client->get('v1/app');
            if ($app->getStatusCode() !== 200) return $this->failure($app->getStatusCode());
            $context = json_decode((string) $app->getBody(), true, 512, JSON_THROW_ON_ERROR);
            if ((string) ($context['data']['id'] ?? '') !== (string) $cfg['app_id'] || ($context['data']['slug'] ?? '') !== $cfg['merchant_app_slug']) return ['status' => 'app_mismatch', 'list' => []];
            $page = max(1, (int) ($input['page'] ?? 1)); $size = min(100, max(1, (int) ($input['pageSize'] ?? 20)));
            $params = ['page' => $page, 'per_page' => $size];
            foreach (['keyword' => 'q', 'category' => 'category'] as $from => $to) {
                $value = Policy::text($input, $from, 200, false);
                if ($value !== '') $params[$to] = $value;
            }
            $path = $kind === 'categories' ? 'v1/categories' : 'v1/video-guides';
            if ($kind === 'detail') {
                $id = Policy::text($input, 'id', 100);
                if (! preg_match('/^[a-zA-Z0-9_-]+$/D', $id)) throw new BusinessException(ErrorCode::PARAM_ERROR);
                $path .= '/' . $id;
            }
            $response = $client->get($path, ['query' => $params]);
            if ($response->getStatusCode() !== 200) return $this->failure($response->getStatusCode());
            $body = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($body['data'] ?? null)) return ['status' => 'unavailable', 'list' => []];
            if ($kind === 'detail') return ['status' => 'ready', 'guide' => $this->guide($body['data'])];
            $list = array_map(fn ($row) => $kind === 'categories' ? array_intersect_key($row, array_flip(['id', 'name', 'slug', 'description'])) : $this->guide($row), $body['data']);
            return ['status' => 'ready', 'list' => $list, 'page' => $page, 'hasMore' => isset($body['meta']['last_page']) ? $page < (int) $body['meta']['last_page'] : count($list) === $size];
        } catch (BusinessException $e) { throw $e; }
        catch (\Throwable) { return ['status' => 'unavailable', 'list' => []]; }
    }

    private function guide(array $row): array
    {
        $url = (string) ($row['video']['url'] ?? '');
        if (! filter_var($url, FILTER_VALIDATE_URL) || ! str_starts_with($url, 'https://')) $url = '';
        $videoId = (string) ($row['video']['video_id'] ?? '');
        if (($row['video']['provider'] ?? '') !== 'youtube' || ! preg_match('/^[a-zA-Z0-9_-]{11}$/D', $videoId)) $videoId = '';
        return ['id' => $row['id'] ?? '', 'title' => $row['title'] ?? '', 'description' => $row['description'] ?? '',
            'category' => $row['category'] ?? null, 'screen' => $row['screen'] ?? null, 'video_url' => $url, 'provider' => $row['video']['provider'] ?? '', 'video_id' => $videoId];
    }

    private function failure(int $status): array
    {
        return ['status' => in_array($status, [401, 403], true) ? 'authentication_failed' : ($status === 429 ? 'rate_limited' : 'unavailable'), 'list' => []];
    }
}
