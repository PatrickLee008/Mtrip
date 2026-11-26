<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\LongStayOffer;
use App\Service\PropertyKycService;
use App\Service\PropertyProfileService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class PropertyController extends AbstractController
{
    #[Inject]
    protected PropertyKycService $properties;

    #[Inject]
    protected PropertyProfileService $profiles;

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $data = $this->properties->properties($page, $pageSize);
        return Result::page($data['list'], $data['total'], $data['page'], $data['pageSize']);
    }

    public function kyc(): array
    {
        return Result::success($this->properties->requirements($this->requireId('propertyId')));
    }

    public function profile(): array
    {
        return Result::success($this->profiles->detail($this->requireId('propertyId')));
    }

    public function longStayProposals(): array
    {
        $propertyId = $this->requireId('propertyId');
        MerchantContext::assertPropertyAccess($propertyId);
        [$page, $size] = $this->pageParams();
        $query = Db::table('marketing_longstay_proposal')->where('site_id', MerchantContext::siteId())->where('property_id', $propertyId);
        $total = (clone $query)->count();
        return Result::page($query->orderByDesc('id')->forPage($page, $size)->get()->all(), $total, $page, $size);
    }

    #[Permission('mch:properties:profile-submit')]
    public function proposeLongStay(): array
    {
        $propertyId = $this->requireId('propertyId');
        MerchantContext::assertPropertyAccess($propertyId, true);
        $min = $this->intInput('minNights');
        $max = $this->intInput('maxNights');
        $rate = round((float) $this->input('discountRate'), 2);
        $details = $this->strInput('details');
        $starts = $this->proposalDate('startsAt');
        $ends = $this->proposalDate('endsAt');
        if ($min < 1 || $max < $min || $rate <= 0 || $rate >= 100 || mb_strlen($details) > 500 || ($starts && $ends && $starts >= $ends)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Check nights, discount and schedule');
        }
        return Db::transaction(function () use ($propertyId, $min, $max, $rate, $details, $starts, $ends) {
            $site = MerchantContext::siteId();
            $property = Db::table('merchant_store')->where('id', $propertyId)->where('site_id', $site)
                ->where('business_type', 'hotel')->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $property) throw new BusinessException(ErrorCode::NOT_FOUND);
            $conflict = LongStayOffer::conflictingTier($site, $propertyId, 'merchant', $min, $max, $starts, $ends);
            if ($conflict) throw new BusinessException(ErrorCode::DATA_CONFLICT, "Conflicting Long Stay tier #{$conflict}");
            $previous = $this->intInput('previousId');
            $queue = Db::table('marketing_longstay_proposal')->where('site_id', $site)->where('property_id', $propertyId);
            if ($previous && ! (clone $queue)->where('id', $previous)->where('state', 'returned')->exists()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Only a returned proposal can be revised');
            }
            $draft = ['site_id' => $site, 'property_id' => $propertyId, 'merchant_id' => $property->merchant_id,
                'min_nights' => $min, 'max_nights' => $max, 'discount_rate' => $rate, 'details' => $details,
                'starts_at' => $starts, 'ends_at' => $ends, 'previous_id' => $previous ?: null, 'submitted_by' => MerchantContext::adminId()];
            $existing = (clone $queue)->where($draft)->whereIn('state', ['submitted','reviewing'])->value('id');
            if ($existing) return Result::success(['id' => (int) $existing]);
            if ($previous && (clone $queue)->where('previous_id', $previous)->exists()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'A newer revision already exists');
            }
            return Result::success(['id' => Db::table('marketing_longstay_proposal')->insertGetId($draft)]);
        });
    }

    private function proposalDate(string $key): ?string
    {
        $value = $this->strInput($key);
        if ($value === '') return null;
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new \DateTimeZone('UTC'));
        if (! $date || $date->format('Y-m-d H:i:s') !== $value) throw new BusinessException(ErrorCode::PARAM_ERROR, 'Invalid UTC date');
        return $value;
    }

    #[Permission('mch:properties:add')]
    public function save(): array
    {
        return Result::success($this->properties->save($this->request->all()), '物业草稿已保存');
    }

    #[Permission('mch:properties:kyc-upload')]
    public function upload(): array
    {
        return Result::success($this->properties->upload(
            $this->requireId('propertyId'),
            $this->requireStr('docType'),
            $this->request->file('file')
        ), '文件上传成功');
    }

    #[Permission('mch:properties:kyc-submit')]
    public function submit(): array
    {
        return Result::success($this->properties->submit($this->requireId('propertyId')), '物业 KYC 已提交审核');
    }

    #[Permission(['mch:properties:profile-edit', 'mch:properties:profile-submit'])]
    public function saveProfile(): array
    {
        $submit = $this->intInput('submit') === 1;
        $required = $submit ? 'mch:properties:profile-submit' : 'mch:properties:profile-edit';
        if (! MerchantContext::hasPermission($required)) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
        return Result::success($this->profiles->save($this->request->all(), $submit),
            $submit ? '物业资料已提交审核' : '物业资料草稿已保存');
    }

    #[Permission('mch:properties:profile-edit')]
    public function uploadProfileImage(): array
    {
        return Result::success($this->profiles->uploadImage(
            $this->requireId('propertyId'),
            $this->request->file('file')
        ), '图片上传成功');
    }

    #[Permission('mch:properties:publish')]
    public function publish(): array
    {
        return Result::success($this->profiles->publish($this->requireId('propertyId'), $this->intInput('enabled') === 1));
    }
}
