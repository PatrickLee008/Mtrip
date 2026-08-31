<?php
declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/** S2：显式关联KYC业务与酒店物业，不发布展示、不赋予门店订单权限。 */
class MerchantPropertyController extends AbstractController
{
    public function history(): array
    {
        $merchant = Db::table('merchant_info')->where('id', $this->requireId('merchantId'))->whereNull('deleted_at')->first();
        if (! $merchant) throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        $this->assertSiteScope((int) $merchant->site_id);
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_property_history')->where('merchant_id', $merchant->id)->where('site_id', $merchant->site_id);
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()->map(static function ($row) {
            $row = (array) $row;
            $row['before_json'] = json_decode($row['before_json'] ?? 'null', true);
            $row['after_json'] = json_decode($row['after_json'], true);
            return $row;
        })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('merchant:property:bind')]
    public function bind(): array
    {
        if (! AdminContext::hasPermission('merchant:property:bind')) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
        $merchantId = $this->requireId('merchantId');
        $businessId = $this->requireId('businessId');
        $storeId = $this->intInput('storeId'); // 0=显式创建新物业，不猜测已有主门店
        $note = $this->requireStr('note');
        $country = strtoupper($this->requireStr('countryCode'));
        $city = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $this->requireStr('cityKey'))));
        $version = filter_var($this->input('expectedVersion'), FILTER_VALIDATE_INT);
        if ($version === false || $version < 0 || $storeId < 0 || mb_strlen($note) > 500
            || ! preg_match('/^[A-Z]{2}$/D', $country) || mb_strlen($city) > 80) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '物业版本、国家代码、城市或备注无效');
        }
        return Db::transaction(function () use ($merchantId, $businessId, $storeId, $note, $country, $city, $version) {
            $merchant = Db::table('merchant_info')->where('id', $merchantId)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $merchant) throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
            $this->assertSiteScope((int) $merchant->site_id);
            if (! in_array((int) $merchant->status, [3, 4], true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已批准商户可关联物业');
            }
            $business = Db::table('merchant_application_business as b')
                ->join('merchant_application as a', 'a.id', '=', 'b.application_id')
                ->where('b.id', $businessId)->where('a.merchant_id', $merchantId)
                ->where('a.site_id', $merchant->site_id)->where('b.site_id', $merchant->site_id)
                ->whereNull('a.deleted_at')->select('b.*')->lockForUpdate()->first();
            if (! $business || $business->business_type !== 'hotel' || (int) $business->kyc_status !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '请选择本商户已验证的酒店业务');
            }
            $linked = Db::table('merchant_store')->where('source_business_id', $businessId)->lockForUpdate()->first();
            if ($linked && ((int) $linked->id !== $storeId || $linked->deleted_at !== null)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该注册业务已有物业关联（含历史已删除物业），不得重复创建');
            }
            $before = null;
            if ($storeId > 0) {
                $store = Db::table('merchant_store')->where('id', $storeId)->where('merchant_id', $merchantId)
                    ->where('site_id', $merchant->site_id)->whereNull('deleted_at')->lockForUpdate()->first();
                if (! $store) throw new BusinessException(ErrorCode::NOT_FOUND, '物业不存在或不属于该商户');
                if ((int) $store->mapping_version !== $version || ($store->source_business_id !== null && (int) $store->source_business_id !== $businessId)) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业版本已变化或已关联其他业务，请刷新');
                }
                $before = array_intersect_key((array) $store, array_flip(['source_business_id', 'business_type', 'country_code', 'city_key', 'mapping_version']));
            } elseif ($version !== 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '新物业版本必须为0');
            }
            $data = [
                'source_business_id' => $businessId, 'business_type' => 'hotel',
                'country_code' => $country, 'city_key' => $city, 'mapping_version' => $version + 1,
            ];
            if ($storeId > 0) {
                Db::table('merchant_store')->where('id', $storeId)->update($data);
            } else {
                $hasStore = Db::table('merchant_store')->where('merchant_id', $merchantId)->whereNull('deleted_at')->exists();
                $storeId = (int) Db::table('merchant_store')->insertGetId($data + [
                    'site_id' => $merchant->site_id, 'merchant_id' => $merchantId,
                    'store_name' => $business->business_name, 'is_main' => $hasStore ? 0 : 1,
                    'contact_name' => $business->contact_name, 'contact_phone' => $business->contact_phone,
                    'status' => 1, 'display_enabled' => 0,
                ]);
            }
            Db::table('merchant_property_history')->insert([
                'site_id' => $merchant->site_id, 'merchant_id' => $merchantId, 'store_id' => $storeId,
                'source_business_id' => $businessId, 'version' => $version + 1,
                'before_json' => $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
                'after_json' => json_encode($data, JSON_UNESCAPED_UNICODE), 'note' => $note,
                'actor_id' => AdminContext::adminId(), 'actor_name' => AdminContext::adminName(),
            ]);
            Db::table('merchant_activity_log')->insert([
                'site_id' => $merchant->site_id, 'merchant_id' => $merchantId, 'activity_type' => 'profile_update',
                'description' => "Hotel property {$storeId} linked to business {$businessId}; version " . ($version + 1),
                'performed_by' => AdminContext::adminName(), 'performed_by_id' => AdminContext::adminId(),
                'ip_address' => $this->clientIp(), 'status' => 1,
            ]);
            return Result::success(['store_id' => $storeId, 'mapping_version' => $version + 1]);
        });
    }
}
