<?php

declare(strict_types=1);

namespace App\Controller;

use App\Model\SysStorage;
use App\Support\SecretField;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 模块7 文件存储配置:多驱动(s3/r2/local/aliyun),AK/SK AES加密存储、返回脱敏
 */
class StorageController extends AbstractController
{
    private const DRIVERS = ['s3', 'r2', 'local', 'aliyun'];

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysStorage())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($storageName = $this->strInput('storageName')) !== '') {
            $query->where('storage_name', 'like', "%{$storageName}%");
        }
        if (($driver = $this->strInput('driver')) !== '') {
            $query->where('driver', $driver);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function (SysStorage $storage) {
                $row = $storage->toArray();
                $row['access_key'] = SecretField::mask((string) $storage->access_key);
                $row['secret_key'] = SecretField::mask((string) $storage->secret_key);
                return $row;
            })->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('config:storage:add')]
    public function create(): array
    {
        $storage = new SysStorage();
        $storage->site_id = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $storage->storage_name = $this->requireStr('storageName');
        $this->fill($storage);
        $storage->save();
        $this->applyDefault($storage);
        return Result::success(['id' => (int) $storage->id], '存储配置创建成功');
    }

    #[Permission('config:storage:edit')]
    public function update(): array
    {
        $storage = $this->findScoped($this->requireId());
        $storage->storage_name = $this->strInput('storageName', (string) $storage->storage_name);
        $this->fill($storage);
        $storage->save();
        $this->applyDefault($storage);
        return Result::success(null, '存储配置更新成功');
    }

    #[Permission('config:storage:delete')]
    public function delete(): array
    {
        $storage = $this->findScoped($this->requireId());
        if ($storage->is_default === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '默认存储不可删除,请先切换默认存储');
        }
        $storage->delete();
        return Result::success(null, '存储配置已删除');
    }

    #[Permission('config:storage:status')]
    public function toggleStatus(): array
    {
        $storage = $this->findScoped($this->requireId());
        if ($storage->is_default === 1 && $storage->status === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '默认存储不可停用');
        }
        $storage->status = $storage->status === 1 ? 2 : 1;
        $storage->save();
        return Result::success(['status' => $storage->status], $storage->status === 1 ? '已启用' : '已禁用');
    }

    private function fill(SysStorage $storage): void
    {
        $driver = $this->strInput('driver', (string) ($storage->driver ?? 's3'));
        if (! in_array($driver, self::DRIVERS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '存储驱动仅支持 s3/r2/local/aliyun');
        }
        $storage->driver = $driver;
        $storage->bucket = $this->strInput('bucket', (string) $storage->bucket);
        $storage->region = $this->strInput('region', (string) $storage->region);
        $storage->endpoint = $this->strInput('endpoint', (string) ($storage->endpoint ?? ''));
        $storage->access_key = SecretField::keep($this->strInput('accessKey'), (string) $storage->access_key);
        $storage->secret_key = SecretField::keep($this->strInput('secretKey'), (string) $storage->secret_key);
        $storage->cdn_domain = $this->strInput('cdnDomain', (string) $storage->cdn_domain);
        $storage->path_prefix = $this->strInput('pathPrefix', (string) $storage->path_prefix);
        $storage->expire_days = max(0, $this->intInput('expireDays', (int) $storage->expire_days));
        $storage->is_default = $this->intInput('isDefault', (int) $storage->is_default) === 1 ? 1 : 0;
        $storage->remark = $this->strInput('remark', (string) $storage->remark);
    }

    /** 同站点默认存储互斥 */
    private function applyDefault(SysStorage $storage): void
    {
        if ($storage->is_default === 1) {
            SysStorage::query()->where('site_id', $storage->site_id)
                ->whereKeyNot($storage->id)->update(['is_default' => 0]);
        }
    }

    private function findScoped(int $id): SysStorage
    {
        /** @var SysStorage|null $storage */
        $storage = SysStorage::query()->find($id);
        if ($storage === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '存储配置不存在');
        }
        if (! AdminContext::isSuper() && (int) $storage->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $storage;
    }
}
