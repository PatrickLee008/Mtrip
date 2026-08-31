<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysConfig;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 模块5 全局系统配置:分组读取 / 批量保存 / 一键恢复默认(变更经操作日志留痕)
 */
class GlobalConfigController extends AbstractController
{
    public function index(): array
    {
        $query = SysConfig::query()->orderBy('id');
        if (($group = $this->strInput('group')) !== '') {
            $query->where('config_group', $group);
        }
        $rows = $query->get()->toArray();
        $grouped = [];
        foreach ($rows as $row) {
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
        $updated = 0;
        foreach ($configs as $item) {
            $key = trim((string) ($item['key'] ?? ''));
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
            $config->config_value = $value;
            $config->save();
            ++$updated;
        }
        return Result::success(['updated' => $updated], '配置保存成功');
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
        $count = 0;
        foreach ($query->get() as $config) {
            $config->config_value = $config->default_value;
            $config->save();
            ++$count;
        }
        return Result::success(['reset' => $count], '已恢复系统默认值');
    }
}
