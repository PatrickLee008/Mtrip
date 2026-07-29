<?php

declare(strict_types=1);

namespace App\Controller;

use App\Model\SysFile;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 模块7 文件库:全部上传文件查询 / 删除(实际上传由业务服务走存储驱动完成)
 */
class FileController extends AbstractController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysFile())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($fileName = $this->strInput('fileName')) !== '') {
            $query->where('file_name', 'like', "%{$fileName}%");
        }
        if (($fileType = $this->intInput('fileType')) > 0) {
            $query->where('file_type', $fileType);
        }
        if (($bizType = $this->strInput('bizType')) !== '') {
            $query->where('biz_type', $bizType);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function delete(): array
    {
        /** @var SysFile|null $file */
        $file = SysFile::query()->find($this->requireId());
        if ($file === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '文件不存在');
        }
        if (! AdminContext::isSuper() && (int) $file->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        // 软删记录;对象存储物理清理由定时任务按 expire_days 统一回收
        $file->delete();
        return Result::success(null, '文件已删除');
    }
}
