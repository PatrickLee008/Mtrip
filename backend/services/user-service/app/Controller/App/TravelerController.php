<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * C端常旅客(Frequent Traveler):增删改查
 * PRD 模块 5/7:证件号 AES 加密存储、列表脱敏;下单可从此带入住客
 * 护照扫描(OCR)在客户端/第三方完成,解析后的字段经 add/update 落库,后端不单设 OCR 接口
 */
class TravelerController extends AbstractController
{
    #[Inject]
    protected ConfigInterface $config;

    /** 常旅客列表(证件号脱敏) */
    public function list(): array
    {
        $rows = Db::table('user_traveler')
            ->where('user_id', UserContext::userId())
            ->whereNull('deleted_at')
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['id_no'] = MaskHelper::idCard($this->decryptSafe((string) $row['id_no']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::success($rows);
    }

    /** 新增常旅客 */
    public function add(): array
    {
        $data = $this->collect();
        $id = Db::transaction(function () use ($data) {
            if ($data['is_default'] === 1) {
                $this->clearDefault();
            }
            return (int) Db::table('user_traveler')->insertGetId(array_merge($data, [
                'site_id' => $this->requireSiteId(),
                'user_id' => UserContext::userId(),
            ]));
        });
        return Result::success(['id' => $id], '已保存');
    }

    /** 编辑常旅客(仅本人) */
    public function update(): array
    {
        $id = $this->requireId();
        $this->ownTraveler($id);
        $data = $this->collect(true);
        Db::transaction(function () use ($id, $data) {
            if ($data['is_default'] === 1) {
                $this->clearDefault();
            }
            Db::table('user_traveler')->where('id', $id)->update($data);
        });
        return Result::success(null, '已更新');
    }

    /** 删除常旅客(软删,仅本人) */
    public function delete(): array
    {
        $id = $this->requireId();
        $this->ownTraveler($id);
        Db::table('user_traveler')->where('id', $id)->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }

    /**
     * 归集并校验入参 → 落库字段(证件号加密)
     *
     * @param bool $isUpdate 编辑场景:证件号留空表示保持原值,不写 id_no 列。
     *                       list 接口返回的是 MaskHelper 脱敏值(如 12****3456),前端无法回填原文;
     *                       若编辑时仍强制必填,用户不重输就会把掩码当成真证件号存回去。
     */
    private function collect(bool $isUpdate = false): array
    {
        $idType = $this->intInput('idType', 2);
        if (! in_array($idType, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '证件类型不正确');
        }
        $data = [
            'nationality' => mb_substr($this->strInput('nationality'), 0, 50),
            'first_name' => mb_substr($this->requireStr('firstName'), 0, 50),
            'last_name' => mb_substr($this->requireStr('lastName'), 0, 50),
            'id_type' => $idType,
            'id_expire_date' => ($d = $this->strInput('idExpireDate')) !== '' ? $d : null,
            'is_default' => $this->intInput('isDefault', 0) === 1 ? 1 : 0,
        ];
        $idNo = $isUpdate ? $this->strInput('idNo') : $this->requireStr('idNo');
        if ($idNo !== '') {
            $data['id_no'] = CryptoHelper::encrypt($idNo, $this->aesKey());
        }
        return $data;
    }

    /** 取本人常旅客,不存在/非本人抛404 */
    private function ownTraveler(int $id): void
    {
        $exists = Db::table('user_traveler')
            ->where('id', $id)
            ->where('user_id', UserContext::userId())
            ->whereNull('deleted_at')
            ->exists();
        if (! $exists) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '常旅客不存在');
        }
    }

    /** 清除本人其它默认标记 */
    private function clearDefault(): void
    {
        Db::table('user_traveler')
            ->where('user_id', UserContext::userId())
            ->where('is_default', 1)
            ->update(['is_default' => 0]);
    }

    private function aesKey(): string
    {
        return (string) $this->config->get('mtrip.aes_key', '');
    }

    private function decryptSafe(string $ciphertext): string
    {
        if ($ciphertext === '') {
            return '';
        }
        try {
            return CryptoHelper::decrypt($ciphertext, $this->aesKey());
        } catch (\Throwable) {
            return '';
        }
    }
}
