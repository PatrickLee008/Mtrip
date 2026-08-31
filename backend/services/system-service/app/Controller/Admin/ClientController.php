<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysClient;
use App\Model\SysClientPermTemplate;
use App\Support\SecretField;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\Result;

use function Hyperf\Config\config;

/**
 * 模块12 客户端密钥管理:ClientId/Secret 生成、重置、绑定权限模板、调用统计
 * Secret AES加密存储;明文仅在创建/重置时返回一次,列表回显脱敏
 */
class ClientController extends AbstractController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysClient())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($clientName = $this->strInput('clientName')) !== '') {
            $query->where('client_name', 'like', "%{$clientName}%");
        }
        if (($clientType = $this->intInput('clientType')) > 0) {
            $query->where('client_type', $clientType);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn (SysClient $client) => self::format($client))->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function detail(): array
    {
        $client = $this->findScoped($this->requireId());
        $row = self::format($client);
        if ($client->perm_template_id > 0) {
            $template = SysClientPermTemplate::query()->find($client->perm_template_id);
            $row['perm_template_name'] = $template?->template_name ?? '';
        }
        return Result::success($row);
    }

    #[Permission('config:client:add')]
    public function create(): array
    {
        $client = new SysClient();
        $client->site_id = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $client->client_name = $this->requireStr('clientName');
        $client->client_id = 'mtc_' . bin2hex(random_bytes(12));
        $plainSecret = bin2hex(random_bytes(24));
        $client->client_secret = CryptoHelper::encrypt($plainSecret, (string) config('mtrip.aes_key'));
        $this->fill($client);
        $client->save();
        // 明文 Secret 仅此一次返回,请立即保存
        return Result::success([
            'id' => (int) $client->id,
            'clientId' => $client->client_id,
            'clientSecret' => $plainSecret,
        ], '客户端创建成功,Secret 仅本次展示');
    }

    #[Permission('config:client:edit')]
    public function update(): array
    {
        $client = $this->findScoped($this->requireId());
        $client->client_name = $this->strInput('clientName', (string) $client->client_name);
        // client_id 生成后禁止修改
        $this->fill($client);
        $client->save();
        return Result::success(null, '客户端更新成功');
    }

    #[Permission('config:client:delete')]
    public function delete(): array
    {
        $client = $this->findScoped($this->requireId());
        if ($client->status === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '客户端启用中,请先禁用再删除');
        }
        $client->delete();
        return Result::success(null, '客户端已删除');
    }

    #[Permission('config:client:status')]
    public function toggleStatus(): array
    {
        $client = $this->findScoped($this->requireId());
        $client->status = $client->status === 1 ? 2 : 1;
        $client->save();
        return Result::success(['status' => $client->status], $client->status === 1 ? '已启用' : '已禁用');
    }

    #[Permission('config:client:reset-secret')]
    public function resetSecret(): array
    {
        $client = $this->findScoped($this->requireId());
        $plainSecret = bin2hex(random_bytes(24));
        $client->client_secret = CryptoHelper::encrypt($plainSecret, (string) config('mtrip.aes_key'));
        $client->save();
        return Result::success([
            'clientId' => $client->client_id,
            'clientSecret' => $plainSecret,
        ], 'Secret 已重置,旧密钥立即失效,仅本次展示');
    }

    /** 调用统计:总量/成功失败/平均耗时 + 近7天趋势 */
    public function stats(): array
    {
        $client = $this->findScoped($this->requireId());
        $base = Db::table('sys_api_access_log')->where('client_pk_id', $client->id);
        $summary = (clone $base)->selectRaw(
            'count(*) as total,'
            . 'sum(case when response_code between 200 and 299 then 1 else 0 end) as success_count,'
            . 'sum(case when response_code >= 400 then 1 else 0 end) as fail_count,'
            . 'ifnull(avg(cost_ms), 0) as avg_cost_ms'
        )->first();
        $daily = (clone $base)->where('created_at', '>=', date('Y-m-d 00:00:00', strtotime('-6 days')))
            ->selectRaw("date_format(created_at, '%Y-%m-%d') as day, count(*) as cnt")
            ->groupBy('day')->orderBy('day')->get()->toArray();
        return Result::success([
            'total' => (int) ($summary->total ?? 0),
            'successCount' => (int) ($summary->success_count ?? 0),
            'failCount' => (int) ($summary->fail_count ?? 0),
            'avgCostMs' => round((float) ($summary->avg_cost_ms ?? 0), 1),
            'daily' => $daily,
        ]);
    }

    private function fill(SysClient $client): void
    {
        $type = $this->intInput('clientType', (int) ($client->client_type ?? 1));
        $client->client_type = in_array($type, [1, 2, 3], true) ? $type : 1;
        $templateId = $this->intInput('permTemplateId', (int) $client->perm_template_id);
        if ($templateId > 0 && ! SysClientPermTemplate::query()->whereKey($templateId)->exists()) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '接口权限模板不存在');
        }
        $client->perm_template_id = max(0, $templateId);
        $client->qps_limit = max(0, $this->intInput('qpsLimit', (int) ($client->qps_limit ?? 50)));
        $client->ip_whitelist = $this->strInput('ipWhitelist', (string) $client->ip_whitelist);
        $expireAt = $this->strInput('expireAt');
        if ($expireAt !== '') {
            $client->expire_at = $expireAt;
        }
        $client->remark = $this->strInput('remark', (string) $client->remark);
    }

    private function findScoped(int $id): SysClient
    {
        /** @var SysClient|null $client */
        $client = SysClient::query()->find($id);
        if ($client === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '客户端不存在');
        }
        if (! AdminContext::isSuper() && (int) $client->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $client;
    }

    private static function format(SysClient $client): array
    {
        $row = $client->toArray();
        $row['client_secret'] = SecretField::mask((string) $client->client_secret);
        return $row;
    }
}
