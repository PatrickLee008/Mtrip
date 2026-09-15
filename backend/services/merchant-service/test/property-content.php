<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\PropertyProfileService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;

$service = new PropertyProfileService();
$merchantIds = [];
$propertyIds = [];
$roomIds = [];

function contentActor(int $merchantId, int $siteId = 991): void
{
    MerchantContext::set([
        'admin_id' => 99101, 'admin_name' => 'Property Content Tester', 'site_id' => $siteId,
        'account_type' => 2, 'group_id' => 0, 'merchant_id' => $merchantId,
        'store_id' => 0, 'is_owner' => true,
        'permissions' => ['mch:properties:profile-edit', 'mch:properties:profile-submit', 'mch:properties:publish'],
    ]);
}

try {
    $merchantId = $merchantIds[] = merchantFixture(991);
    $foreignMerchantId = $merchantIds[] = merchantFixture(991);
    $propertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantId, 'store_name' => 'Property Draft',
        'address' => 'Yangon', 'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    $foreignPropertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $foreignMerchantId, 'store_name' => 'Foreign Property',
        'address' => 'Mandalay', 'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    $otherSitePropertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 992, 'merchant_id' => $merchantId, 'store_name' => 'Other Site Property',
        'address' => 'Bangkok', 'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    $hotelGoodsBefore = Db::table('goods_info')->where('goods_type', 1)->count();

    contentActor($merchantId);
    rejects(40302, fn () => $service->detail($foreignPropertyId), 'C other merchant property denied');
    rejects(40401, fn () => $service->detail($otherSitePropertyId), 'C cross-site property hidden');
    $submitted = $service->save([
        'propertyId' => $propertyId, 'propertyName' => 'Property Profile v1', 'location' => 'Yangon Downtown',
        'countryCode' => 'MM', 'cityKey' => 'yangon', 'description' => 'First submitted profile',
        'starLevel' => 4, 'facilities' => ['WiFi', 'Pool'], 'images' => ['/uploads/properties/hotel.jpg'],
        'website' => 'https://example.test', 'checkinTime' => '14:00', 'checkoutTime' => '12:00',
    ], true);
    check($submitted['version'] === 1 && $submitted['reviewStatus'] === 1, 'C property profile submits version 1');
    rejects(40901, fn () => $service->publish($propertyId, true), 'C property cannot publish before profile and room approval');

    AdminContext::set(['admin_id' => 99201, 'admin_name' => 'Wrong Site Reviewer', 'site_id' => 992, 'is_super' => false]);
    rejects(40302, fn () => $service->audit($submitted['revisionId'], 1, ''), 'C cross-site profile review denied');
    AdminContext::set(['admin_id' => 99101, 'admin_name' => 'Reviewer', 'site_id' => 991, 'is_super' => false]);
    $service->audit($submitted['revisionId'], 2, 'Improve description');
    check((int) Db::table('merchant_store')->where('id', $propertyId)->value('content_status') === 3,
        'C initial profile rejection is visible on property');

    contentActor($merchantId);
    $approvedSubmission = $service->save([
        'propertyId' => $propertyId, 'description' => 'Approved profile',
    ], true);
    check($approvedSubmission['version'] === 2, 'C rejected profile resubmits as a new version');
    AdminContext::set(['admin_id' => 99101, 'admin_name' => 'Reviewer', 'site_id' => 991, 'is_super' => false]);
    $service->audit($approvedSubmission['revisionId'], 1, 'Approved');
    check(Db::table('merchant_store')->where('id', $propertyId)->value('description') === 'Approved profile'
        && (int) Db::table('merchant_store')->where('id', $propertyId)->value('content_approved_version') === 2,
        'C approved property profile becomes live');
    check((int) Db::table('merchant_store')->where('id', $propertyId)->value('display_enabled') === 1,
        'S6 first profile approval enables the platform display gate');

    $roomIds[] = (int) Db::table('hotel_room_type')->insertGetId([
        'site_id' => 991, 'property_id' => $propertyId, 'room_name' => 'Approved Room',
        'bed_type' => 'King', 'area' => '30', 'status' => 1, 'publish_status' => 2, 'approved_version' => 0,
    ]);
    contentActor($merchantId);
    rejects(40901, fn () => $service->publish($propertyId, true),
        'S6 unapproved room placeholder cannot satisfy the property publish gate');
    Db::table('hotel_room_type')->where('id', $roomIds[0])->update(['approved_version' => 1]);
    $published = $service->publish($propertyId, true);
    check($published['publishStatus'] === 1, 'C approved property with approved room publishes');
    $liveProperty = (array) Db::table('merchant_store')->where('id', $propertyId)->first();
    check((int) $liveProperty['status'] === 1 && (int) $liveProperty['operating_status'] === 1,
        'S6 first publication opens the approved property for operation');

    $pendingUpdate = $service->save(['propertyId' => $propertyId, 'description' => 'Pending profile'], true);
    check(Db::table('merchant_store')->where('id', $propertyId)->value('description') === 'Approved profile',
        'C pending profile update preserves approved live profile');
    AdminContext::set(['admin_id' => 99101, 'admin_name' => 'Reviewer', 'site_id' => 991, 'is_super' => false]);
    $service->audit($pendingUpdate['revisionId'], 2, 'Keep approved profile');
    check(Db::table('merchant_store')->where('id', $propertyId)->value('description') === 'Approved profile'
        && (int) Db::table('merchant_store')->where('id', $propertyId)->value('publish_status') === 1,
        'C rejected update preserves live published profile');
    check(Db::table('goods_info')->where('goods_type', 1)->count() === $hotelGoodsBefore,
        'C property profile lifecycle creates no hotel goods row');
} finally {
    if ($roomIds) Db::table('hotel_room_type')->whereIn('id', $roomIds)->delete();
    if ($propertyIds) {
        Db::table('merchant_property_content_revision')->whereIn('property_id', $propertyIds)->delete();
        Db::table('merchant_store')->whereIn('id', $propertyIds)->delete();
    }
    if ($merchantIds) Db::table('merchant_info')->whereIn('id', $merchantIds)->delete();
}

echo "Property content integration complete\n";
