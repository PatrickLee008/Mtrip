<?php

declare(strict_types=1);

namespace App\Service;

use App\Payment\KbzMmqrChannel;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Pay\KbzPay\KbzAccountConfig;
use Mtrip\Shared\Pay\KbzPay\KbzPayClient;
use Mtrip\Shared\Pay\KbzPay\KbzPayException;

/**
 * 收款账户连通性测试(方案 22 §7;2026-10-27 起调三方只在 payment-service)
 *
 * 判定规则与 system-service 阶段 3 `PayAccountService::test` 一致:用随机不存在的单号 queryOrder,
 * KBZ 返回「订单不存在」类业务失败 = 签名 + 网络 + AppId/MerchCode 均通;配置缺失或 AppKey 解密失败
 * 直接返回 kind=config,不调 KBZ。权限与站点隔离由调用方(system-service)校验,这里不做。
 */
class ChannelTestService
{
    #[Inject]
    protected PayAccountResolver $resolver;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    /** @return array{ok: bool, kind: string, code: string, message: string} */
    public function test(int $accountId): array
    {
        $account = Db::connection('system')->table('sys_pay_account')
            ->where('id', $accountId)->whereNull('deleted_at')->first();
        if ($account === null || (string) $account->channel_code !== KbzMmqrChannel::CODE) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '收款账户不存在');
        }
        $appKey = $this->resolver->decrypt((string) $account->app_key);
        if ($appKey === '' || (string) $account->app_id === '' || (string) $account->merch_code === ''
            || ! in_array((string) $account->env, [KbzAccountConfig::ENV_UAT, KbzAccountConfig::ENV_PROD], true)) {
            return $this->result(false, KbzPayException::KIND_CONFIG, '',
                '账户配置不完整(AppId / MerchCode / AppKey / 环境),或 AppKey 解密失败,请重新保存');
        }
        // 仅字母数字下划线,≤40:前缀 + 时间 + 随机串,保证 KBZ 侧不存在
        $orderId = 'MTRIPTEST_' . gmdate('ymdHis') . '_' . bin2hex(random_bytes(6));
        try {
            $client = new KbzPayClient(new KbzAccountConfig(
                (string) $account->env,
                (string) $account->app_id,
                (string) $account->merch_code,
                $appKey,
            ));
            $client->queryOrder($orderId);
            // 正常返回(未抛异常)说明签名与网络都通,KBZ 仅返回了一个查询结果
            return $this->result(true, '', '', '连通成功:签名与网络正常');
        } catch (KbzPayException $e) {
            return $this->mapException($e);
        } catch (\Throwable $e) {
            // 仅记录异常类名,避免把请求体/密钥带进日志
            $this->loggerFactory->get('payment')->error('kbz_pay_account_test_failed', ['accountId' => $accountId, 'exception' => $e::class]);
            return $this->result(false, 'unknown', '', '连通性测试异常,请稍后重试或查看服务日志');
        } finally {
            unset($appKey);
        }
    }

    private function mapException(KbzPayException $e): array
    {
        $kind = (string) $e->kind();
        $code = (string) $e->kbzCode();
        $kbzMsg = mb_substr((string) $e->kbzMsg(), 0, 200);
        $suffix = $code !== '' ? "({$code}" . ($kbzMsg !== '' ? ": {$kbzMsg}" : '') . ')' : '';
        return match ($kind) {
            KbzPayException::KIND_BUSINESS => KbzPayException::isOrderNotFound($code)
                ? $this->result(true, $kind, $code, "连通成功:签名与网络正常,KBZ 返回测试单号不存在{$suffix}")
                : $this->result(false, $kind, $code, "KBZ 返回业务错误{$suffix},请核对 AppId / MerchCode 及环境"),
            KbzPayException::KIND_SIGN => $this->result(false, $kind, $code,
                "签名校验失败{$suffix},请检查 AppKey 是否正确、是否与环境(UAT/Prod)匹配"),
            KbzPayException::KIND_NETWORK => $this->result(false, $kind, $code,
                '无法连接 KBZ 网关(网络不通或超时),请检查服务器出网与所选环境'),
            KbzPayException::KIND_PROTOCOL => $this->result(false, $kind, $code,
                "KBZ 响应格式异常{$suffix},请确认所选环境与网关地址"),
            KbzPayException::KIND_CONFIG => $this->result(false, $kind, $code,
                '账户配置不完整或不合法,请检查 AppId / MerchCode / AppKey / 环境'),
            default => $this->result(false, $kind !== '' ? $kind : 'unknown', $code, "连通性测试失败{$suffix}"),
        };
    }

    private function result(bool $ok, string $kind, string $code, string $message): array
    {
        return ['ok' => $ok, 'kind' => $kind, 'code' => $code, 'message' => $message];
    }
}
