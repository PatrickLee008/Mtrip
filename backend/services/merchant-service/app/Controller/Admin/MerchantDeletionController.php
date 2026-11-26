<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Service\MerchantDeletionService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class MerchantDeletionController extends AbstractController
{
    #[Inject]
    protected MerchantDeletionService $deletions;

    #[Permission('merchant:deletion:list')]
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = $this->deletions->adminQuery($this->intInput('siteId'));
        $status = $this->strInput('status');
        if ($status !== '') {
            if (! in_array($status, MerchantDeletionService::STATUSES, true)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '注销申请状态无效');
            }
            $query->where('status', $status);
        }
        $keyword = $this->strInput('keyword');
        if ($keyword !== '') {
            $query->where(static fn ($q) => $q->where('merchant_name', 'like', "%{$keyword}%")->orWhere('merchant_code', 'like', "%{$keyword}%"));
        }
        $total = $query->count();
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'site_id', 'merchant_id', 'merchant_name', 'merchant_code', 'applicant_name', 'status', 'submitted_at'])->all();
        return Result::page($rows, $total, $page, $pageSize);
    }

    #[Permission('merchant:deletion:list')]
    public function detail(): array
    {
        return Result::success($this->deletions->detail($this->requireId()));
    }

    #[Permission('merchant:deletion:review')]
    public function review(): array
    {
        return Result::success($this->deletions->review($this->requireId(), $this->requireStr('decision'), $this->requireStr('note'), $this->clientIp()));
    }
}
