<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysConfig;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

use function Hyperf\Config\config;

/**
 * 模块5 全局系统配置:分组读取 / 批量保存 / 一键恢复默认(变更经操作日志留痕)
 */
class GlobalConfigController extends AbstractController
{
    private const MERCHANT_AUTH_TEST_MODE = 'merchant_auth_test_mode';

    public function index(): array
    {
        $query = SysConfig::query()->orderBy('id');
        if (($group = $this->strInput('group')) !== '') {
            $query->where('config_group', $group);
        }
        $rows = $query->get()->toArray();
        $grouped = [];
        foreach ($rows as $row) {
            if ($row['config_key'] === self::MERCHANT_AUTH_TEST_MODE) {
                $allowed = $this->merchantAuthTestAllowed();
                $row['environment_allowed'] = $allowed;
                $row['effective'] = $allowed && (string) $row['config_value'] === '1';
            }
            $grouped[$row['config_group']][] = $row;
        }
        return Result::success($grouped);
    }

    /** 批量保存:入参 configs = [{key, value}, ...] */
    #[Permission('config:global:edit')]
    public function save(): array
    {
        $configs = $this->input('configs');
        if (! is_array($configs) || $configs === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 configs 不能为空');
        }
        $updates = [];
        foreach ($configs as $item) {
            $key = trim((string) ($item['key'] ?? ''));
            if ($key === self::MERCHANT_AUTH_TEST_MODE) {
                $this->validateMerchantAuthTestMode((string) ($item['value'] ?? ''));
            }
            if ($key === '' || ! array_key_exists('value', (array) $item)) {
                continue;
            }
            /** @var SysConfig|null $config */
            $config = SysConfig::query()->where('config_key', $key)->first();
            if ($config === null) {
                throw new BusinessException(ErrorCode::NOT_FOUND, "配置项 {$key} 不存在");
            }
            $value = (string) $item['value'];
            if ($config->value_type === 2 && ! is_numeric($value)) {
                throw new BusinessException(ErrorCode::PARAM_VALIDATE_FAIL, "配置项 {$key} 须为数字");
            }
            if ($config->value_type === 4 && json_decode($value, true) === null && $value !== 'null') {
                throw new BusinessException(ErrorCode::PARAM_VALIDATE_FAIL, "配置项 {$key} 须为合法JSON");
            }
            $updates[] = ['id' => (int) $config->id, 'value' => $value];
        }
        $updated = Db::transaction(function () use ($updates): int {
            $count = 0;
            foreach ($updates as $update) {
                Db::table('sys_config')->where('id', $update['id'])->whereNull('deleted_at')
                    ->update(['config_value' => $update['value']]);
                ++$count;
            }
            return $count;
        });
        return Result::success(['updated' => $updated], '配置保存成功');
    }

    private function validateMerchantAuthTestMode(string $value): void
    {
        if (! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅超级管理员可修改商户认证测试模式');
        }
        if (! in_array($value, ['0', '1'], true)) {
            throw new BusinessException(ErrorCode::PARAM_VALIDATE_FAIL, '商户认证测试模式仅支持开启或关闭');
        }
        if ($value === '1' && ! $this->merchantAuthTestAllowed()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前部署环境不允许开启商户认证测试模式');
        }
    }

    private function merchantAuthTestAllowed(): bool
    {
        $environment = strtolower((string) config('app_env', ''));
        if (in_array($environment, ['prod', 'production'], true)) {
            return false;
        }
        return filter_var(config('mtrip.merchant_auth_test_allowed', false), FILTER_VALIDATE_BOOLEAN);
    }

    /** 一键恢复默认:按 keys 或整组恢复 default_value */
    #[Permission('config:global:reset')]
    public function reset(): array
    {
        $keys = $this->input('keys');
        $group = $this->strInput('group');
        $query = SysConfig::query();
        if (is_array($keys) && $keys !== []) {
            $query->whereIn('config_key', array_map('strval', $keys));
        } elseif ($group !== '') {
            $query->where('config_group', $group);
        } else {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请指定要恢复的 keys 或 group');
        }
        $configs = $query->get();
        if (! AdminContext::isSuper() && $configs->contains('config_key', self::MERCHANT_AUTH_TEST_MODE)) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅超级管理员可修改商户认证测试模式');
        }
        $count = 0;
        foreach ($configs as $config) {
            $config->config_value = $config->default_value;
            $config->save();
            ++$count;
        }
        return Result::success(['reset' => $count], '已恢复系统默认值');
    }
}
