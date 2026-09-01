<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Service\RoomReviewService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/** 平台端房型版本审核队列。 */
class AdminRoomReviewController extends AbstractAdminController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('hotel_room_type_revision as v')
            ->join('hotel_room_type as r', 'r.id', '=', 'v.room_id')
            ->join('goods_info as g', 'g.id', '=', 'v.goods_id')
            ->leftJoin('merchant_info as m', 'm.id', '=', 'v.merchant_id')
            ->whereNull('r.deleted_at');
        $this->applySiteScope($query, 'v.site_id');
        $status = $this->input('status', 1);
        if ($status !== null && $status !== '') $query->where('v.status', (int) $status);
        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function ($q) use ($keyword) {
                $q->where('r.room_name', 'like', "%{$keyword}%")
                    ->orWhere('g.goods_name', 'like', "%{$keyword}%")
                    ->orWhere('m.merchant_name', 'like', "%{$keyword}%");
            });
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('v.submitted_at')->orderByDesc('v.id')->forPage($page, $pageSize)
            ->get(['v.id', 'v.site_id', 'v.room_id', 'v.version', 'v.action', 'v.status', 'v.reject_reason',
                'v.submitted_at', 'v.reviewed_at', 'r.room_name', 'r.approved_version', 'g.goods_name',
                'm.merchant_name'])->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function detail(): array
    {
        $revision = Db::table('hotel_room_type_revision as v')
            ->join('hotel_room_type as r', 'r.id', '=', 'v.room_id')
            ->join('goods_info as g', 'g.id', '=', 'v.goods_id')
            ->leftJoin('merchant_info as m', 'm.id', '=', 'v.merchant_id')
            ->where('v.id', $this->requireId())->whereNull('r.deleted_at')
            ->first(['v.*', 'g.goods_name', 'm.merchant_name']);
        if (! $revision) throw new BusinessException(ErrorCode::NOT_FOUND, '审核版本不存在');
        $this->assertSiteScope((int) $revision->site_id);
        $room = Db::table('hotel_room_type')->where('id', $revision->room_id)->first();
        $history = Db::table('hotel_room_type_revision')->where('room_id', $revision->room_id)
            ->orderByDesc('version')->get(['id', 'version', 'action', 'status', 'reject_reason', 'submitted_at', 'reviewed_at', 'review_remark'])
            ->map(static fn ($row) => (array) $row)->all();
        $service = new RoomReviewService();
        $submitted = (array) $revision;
        $submitted['payload'] = $service->decode((string) $submitted['payload_json']);
        unset($submitted['payload_json']);
        $effective = $room ? (array) $room : [];
        foreach (['images', 'facilities'] as $field) {
            $effective[$field] = isset($effective[$field]) ? $service->decode((string) $effective[$field]) : [];
            $submitted['payload'][$field] = isset($submitted['payload'][$field]) && is_string($submitted['payload'][$field])
                ? $service->decode($submitted['payload'][$field]) : ($submitted['payload'][$field] ?? []);
        }
        return Result::success(['revision' => $submitted, 'effective' => $effective, 'history' => $history]);
    }

    #[Permission('goods:audit:audit')]
    public function audit(): array
    {
        (new RoomReviewService())->audit($this->requireId(), $this->intInput('auditStatus'), $this->strInput('auditRemark'));
        return Result::success(null, $this->intInput('auditStatus') === 1 ? '房型审核通过' : '房型已驳回');
    }
}
