<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Wallet\WalletLedger;

/**
 * 钱包人工调账:经办 + 复核(Super Admin PRD v1.0.14 客户 360「客户钱包人工结算」/ 模块 25「手动钱包结算控制」)
 *
 * - 经办人提交申请(0 待复核),不动余额;
 * - **另一位**管理员复核:通过即记账(1 已入账,扣减时余额不足则 3 记账失败、余额不变),驳回为 2;
 * - 已入账的申请可发起冲正(反向金额的新申请,reversal_of 指向原单),同样走复核;每笔只能有一个未失效的冲正;
 * - request_no 唯一 + 复核时行锁 + 只处理待复核状态,保证同一申请只记一次账;钱包余额不会被扣成负数。
 * 积分调整与本流程无关(积分走 user_points_log),绝不记成钱包金额。
 */
class WalletAdjustService
{
    public const PENDING = 0;
    public const POSTED = 1;
    public const REJECTED = 2;
    public const FAILED = 3;

    /** 提交申请;$cents 为整数分(正增负减) */
    public function submit(array $user, int $cents, string $reason, string $relatedNo, int $adminId, string $adminName, int $reversalOf = 0): array
    {
        if ($cents === 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '调整金额不能为0');
        }
        $requestNo = self::newRequestNo();
        $id = (int) Db::table('user_wallet_adjust_request')->insertGetId([
            'request_no' => $requestNo,
            'site_id' => (int) $user['site_id'],
            'user_id' => (int) $user['id'],
            'amount' => WalletLedger::money($cents),
            'reason' => mb_substr($reason, 0, 200),
            'related_no' => mb_substr($relatedNo, 0, 40),
            'reversal_of' => $reversalOf,
            'status' => self::PENDING,
            'requested_by' => $adminId,
            'requested_name' => mb_substr($adminName, 0, 50),
        ]);
        return ['id' => $id, 'requestNo' => $requestNo, 'status' => self::PENDING];
    }

    /**
     * 复核:通过即记账,驳回只改状态。$assertScope 由控制器传入,校验申请所属站点在管理员数据范围内。
     *
     * @return array{status:int, balance:?string, message:string}
     */
    public function review(int $id, bool $approve, string $remark, int $adminId, string $adminName, callable $assertScope): array
    {
        return Db::transaction(function () use ($id, $approve, $remark, $adminId, $adminName, $assertScope): array {
            $req = Db::table('user_wallet_adjust_request')->where('id', $id)->lockForUpdate()->first();
            if (! $req) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '调账申请不存在');
            }
            $req = (array) $req;
            $assertScope((int) $req['site_id']);
            if ((int) $req['status'] !== self::PENDING) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申请已处理');
            }
            if ((int) $req['requested_by'] === $adminId) {
                throw new BusinessException(ErrorCode::FORBIDDEN, '经办人不能复核自己提交的调账申请');
            }
            $stamp = [
                'reviewed_by' => $adminId,
                'reviewed_name' => mb_substr($adminName, 0, 50),
                'review_remark' => mb_substr($remark, 0, 255),
                'reviewed_at' => date('Y-m-d H:i:s'),
            ];
            if (! $approve) {
                Db::table('user_wallet_adjust_request')->where('id', $id)->update(['status' => self::REJECTED] + $stamp);
                return ['status' => self::REJECTED, 'balance' => null, 'message' => '已驳回'];
            }

            $userId = (int) $req['user_id'];
            $cents = WalletLedger::cents($req['amount']);
            $remarkText = "人工调账 {$req['request_no']}:{$req['reason']}";
            $available = WalletLedger::cents(WalletLedger::availableLocked($userId));
            if ($available + $cents < 0) {
                Db::table('user_wallet_adjust_request')->where('id', $id)
                    ->update(['status' => self::FAILED] + array_merge($stamp, ['review_remark' => mb_substr('记账失败:扣减金额超过当前可用余额' . ($remark !== '' ? ';' . $remark : ''), 0, 255)]));
                return ['status' => self::FAILED, 'balance' => WalletLedger::money($available), 'message' => '记账失败:扣减金额超过当前可用余额'];
            }
            if ($cents > 0) {
                $res = WalletLedger::credit((int) $req['site_id'], $userId, $cents / 100, WalletLedger::TYPE_ADJUST, 0, $adminId, $remarkText);
                $balance = $res['balance'];
                $logId = $res['logId'];
            } else {
                $balance = WalletLedger::debit((int) $req['site_id'], $userId, -$cents / 100, WalletLedger::TYPE_ADJUST, 0, $remarkText, $adminId);
                $logId = (int) Db::table('user_balance_log')->where('user_id', $userId)->max('id');
            }
            Db::table('user_wallet_adjust_request')->where('id', $id)
                ->update(['status' => self::POSTED, 'posted_log_id' => $logId] + $stamp);
            return ['status' => self::POSTED, 'balance' => WalletLedger::money(WalletLedger::cents($balance)), 'message' => '复核通过,已入账'];
        });
    }

    /** 冲正:对已入账申请发起反向申请(待复核) */
    public function reverse(int $id, string $reason, int $adminId, string $adminName, callable $assertScope): array
    {
        return Db::transaction(function () use ($id, $reason, $adminId, $adminName, $assertScope): array {
            $req = Db::table('user_wallet_adjust_request')->where('id', $id)->lockForUpdate()->first();
            if (! $req) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '调账申请不存在');
            }
            $req = (array) $req;
            $assertScope((int) $req['site_id']);
            if ((int) $req['status'] !== self::POSTED) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '只有已入账的申请可以冲正');
            }
            if ((int) $req['reversal_of'] > 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '冲正单不能再冲正');
            }
            $exists = Db::table('user_wallet_adjust_request')->where('reversal_of', $id)
                ->whereIn('status', [self::PENDING, self::POSTED])->exists();
            if ($exists) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申请已有冲正单');
            }
            $user = ['id' => (int) $req['user_id'], 'site_id' => (int) $req['site_id']];
            return $this->submit($user, -WalletLedger::cents($req['amount']), "冲正 {$req['request_no']}:{$reason}",
                (string) $req['related_no'], $adminId, $adminName, $id);
        });
    }

    public static function newRequestNo(): string
    {
        return 'WA' . date('YmdHis') . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}
