<?php

declare(strict_types=1);

namespace App\Controller;

use App\Model\SysPayChannel;
use App\Support\SecretField;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Model\BaseModel;
use Mtrip\Shared\Support\Result;

/**
 * 模块8 支付渠道配置:Stripe/PayPal 分站点配置,密钥AES加密、批量复制到其他站点
 */
class PayChannelController extends AbstractController
{
    private const CHANNELS = ['stripe', 'paypal'];

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysPayChannel())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($channelCode = $this->strInput('channelCode')) !== '') {
            $query->where('channel_code', $channelCode);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function (SysPayChannel $channel) {
                $row = $channel->toArray();
                $row['api_key'] = SecretField::mask((string) $channel->api_key);
                return $row;
            })->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('config:pay:add')]
    public function create(): array
    {
        $channel = new SysPayChannel();
        $channel->site_id = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $this->fill($channel);
        $channel->save();
        return Result::success(['id' => (int) $channel->id], '支付渠道创建成功');
    }

    #[Permission('config:pay:edit')]
    public function update(): array
    {
        $channel = $this->findScoped($this->requireId());
        $this->fill($channel);
        $channel->save();
        return Result::success(null, '支付渠道更新成功');
    }

    #[Permission('config:pay:delete')]
    public function delete(): array
    {
        $channel = $this->findScoped($this->requireId());
        if ($channel->status === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '渠道启用中,请先停用再删除');
        }
        $channel->delete();
        return Result::success(null, '支付渠道已删除');
    }

    #[Permission('config:pay:status')]
    public function toggleStatus(): array
    {
        $channel = $this->findScoped($this->requireId());
        $channel->status = $channel->status === 1 ? 2 : 1;
        $channel->save();
        return Result::success(['status' => $channel->status], $channel->status === 1 ? '已启用' : '已停用');
    }

    /** 批量复制渠道配置到其他站点(含密钥密文),已存在同渠道的站点跳过 */
    #[Permission('config:pay:add')]
    public function copy(): array
    {
        if (! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅超级管理员可跨站点复制');
        }
        $channel = $this->findScoped($this->requireId());
        $siteIds = $this->input('siteIds');
        if (! is_array($siteIds) || $siteIds === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 siteIds 不能为空');
        }
        $copied = [];
        $skipped = [];
        foreach (array_unique(array_map('intval', $siteIds)) as $siteId) {
            if ($siteId === (int) $channel->site_id) {
                continue;
            }
            $exists = SysPayChannel::query()->where('site_id', $siteId)
                ->where('channel_code', $channel->channel_code)->exists();
            if ($exists) {
                $skipped[] = $siteId;
                continue;
            }
            $clone = $channel->replicate();
            $clone->site_id = $siteId;
            $clone->save();
            $copied[] = $siteId;
        }
        return Result::success(['copied' => $copied, 'skipped' => $skipped], '渠道复制完成');
    }

    private function fill(SysPayChannel $channel): void
    {
        $code = $this->strInput('channelCode', (string) ($channel->channel_code ?? ''));
        if (! in_array($code, self::CHANNELS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '支付渠道仅支持 stripe/paypal');
        }
        $channel->channel_code = $code;
        $channel->channel_name = $this->strInput('channelName', (string) ($channel->channel_name ?? ucfirst($code)));
        $channel->api_key = SecretField::keep($this->strInput('apiKey'), (string) $channel->api_key);
        $channel->merchant_no = $this->strInput('merchantNo', (string) $channel->merchant_no);
        $channel->webhook_url = $this->strInput('webhookUrl', (string) $channel->webhook_url);
        $channel->fee_rate = BaseModel::money((string) $this->input('feeRate', (string) ($channel->fee_rate ?? '0')));
        $channel->min_amount = BaseModel::money((string) $this->input('minAmount', (string) ($channel->min_amount ?? '0')));
        $channel->max_amount = BaseModel::money((string) $this->input('maxAmount', (string) ($channel->max_amount ?? '0')));
        $currencies = $this->input('currencies');
        if (is_array($currencies)) {
            $channel->currencies = array_values(array_map('strtoupper', array_map('strval', $currencies)));
        }
        $channel->split_enabled = $this->intInput('splitEnabled', (int) $channel->split_enabled) === 1 ? 1 : 0;
        $channel->remark = $this->strInput('remark', (string) $channel->remark);
    }

    private function findScoped(int $id): SysPayChannel
    {
        /** @var SysPayChannel|null $channel */
        $channel = SysPayChannel::query()->find($id);
        if ($channel === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '支付渠道不存在');
        }
        if (! AdminContext::isSuper() && (int) $channel->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $channel;
    }
}
