<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Service\StoreInvestigationService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class StoreInvestigationController extends AbstractController
{
    #[Inject]
    protected StoreInvestigationService $service;

    #[Permission('merchant:investigation:list')]
    public function index(): array
    {
        [$page, $size] = $this->pageParams();
        $query = $this->service->query($this->intInput('siteId'));
        foreach (['storeId' => 'store_id', 'merchantId' => 'merchant_id'] as $input => $column) {
            if ($this->intInput($input) > 0) $query->where($column, $this->intInput($input));
        }
        $status = $this->strInput('status');
        if ($status !== '') {
            if (! in_array($status, StoreInvestigationService::STATUSES, true)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '调查状态无效');
            }
            $query->where('status', $status);
        }
        $keyword = $this->strInput('keyword');
        if ($keyword !== '') {
            $query->where(static fn ($q) => $q->where('store_name', 'like', "%{$keyword}%")->orWhere('merchant_name', 'like', "%{$keyword}%"));
        }
        $total = $query->count();
        $rows = $query->orderByDesc('id')->forPage($page, $size)->get([
            'id', 'site_id', 'merchant_id', 'store_id', 'merchant_name', 'store_name', 'category', 'status', 'decision', 'updated_at',
        ])->all();
        return Result::page($rows, $total, $page, $size);
    }

    #[Permission('merchant:investigation:list')]
    public function detail(): array
    {
        return Result::success($this->service->detail($this->requireId()));
    }

    #[Permission('merchant:store:flag')]
    public function flag(): array
    {
        return Result::success(['id' => $this->service->flag($this->requireId('storeId'), [
            'category' => $this->input('category'), 'reason' => $this->input('reason'), 'evidence' => $this->input('evidence'),
        ], $this->clientIp())]);
    }

    #[Permission('merchant:investigation:escalate')]
    public function escalate(): array
    {
        $this->service->transition($this->requireId(), 'escalate', [
            'reason' => $this->input('reason'), 'evidence' => $this->input('evidence'),
        ], $this->clientIp());
        return Result::success();
    }

    #[Permission('merchant:investigation:review')]
    public function resolve(): array
    {
        $this->service->transition($this->requireId(), 'resolve', [
            'reason' => $this->input('reason'), 'evidence' => $this->input('evidence'),
            'decision' => $this->input('decision'), 'expectedVersion' => $this->input('expectedVersion'),
        ], $this->clientIp());
        return Result::success();
    }
}
