<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class GlobalSearchController extends AbstractController
{
    // The first two searchable fields supply the result title and subtitle.
    private const SOURCES = [
        'merchant' => ['merchant:list:list', 'merchant_info', ['merchant_name', 'merchant_code', 'merchant_short_name'], []],
        'booking' => ['order:all:list', 'order_main', ['order_no', 'contact_name'], []],
        'affiliate' => ['affiliate:partner:list', 'affiliate_partner', ['name', 'handle'], ['platform', 'followers', 'country']],
        'campaign' => ['marketing:campaign:list', 'marketing_campaign', ['title', 'subtitle'], ['start_time', 'end_time']],
        'user' => ['sys:admin:list', 'sys_admin', ['username', 'real_name'], ['last_login_at']],
    ];

    public function index(): array
    {
        $category = $this->requireStr('category');
        $keyword = $this->requireStr('keyword');
        if (! isset(self::SOURCES[$category]) || mb_strlen($keyword) > 100) {
            throw new BusinessException(ErrorCode::PARAM_ERROR);
        }
        [$permission, $table, $fields, $details] = self::SOURCES[$category];
        if (! AdminContext::hasPermission($permission)) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }

        $query = Db::connection($category === 'user' ? 'default' : 'business')->table($table)->whereNull('deleted_at');
        $this->applySiteScope($query);
        $like = '%' . addcslashes($keyword, '\\%_') . '%';
        $query->where(function ($matches) use ($fields, $keyword, $like) {
            foreach ($fields as $field) {
                $matches->orWhereRaw("LOWER(`{$field}`) LIKE LOWER(?)", [$like]);
            }
            // Bind IDs as strings to preserve long booking numbers and leading zeroes.
            if (ctype_digit($keyword) && strlen($keyword) <= 18) {
                $matches->orWhere('id', $keyword);
            }
        });
        [$title, $subtitle] = $fields;
        $rows = $query->orderByRaw("CASE WHEN `{$title}` = ? OR `{$subtitle}` = ? THEN 0 ELSE 1 END", [$keyword, $keyword])
            ->orderByDesc('id')->limit(8)->get(array_merge(['id', 'site_id', $title, $subtitle], $details));
        return Result::success($rows->map(static function ($row) use ($title, $subtitle, $details) {
            return [
                'id' => (string) $row->id, 'siteId' => (int) $row->site_id,
                'title' => (string) $row->{$title}, 'subtitle' => (string) $row->{$subtitle},
                'details' => array_intersect_key((array) $row, array_flip($details)),
            ];
        })->all());
    }
}
