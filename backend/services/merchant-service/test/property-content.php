<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\MerchantPropertyController;
use App\Service\PropertyProfileService;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Support\CryptoHelper;

use function Hyperf\Config\config;

$service = new PropertyProfileService();
$merchantIds = [];
$propertyIds = [];
$roomIds = [];
$reviewIds = [];
$sourceFiles = [];
$fixtureRoot = sys_get_temp_dir() . '/property-profile-' . bin2hex(random_bytes(8));
mkdir($fixtureRoot, 0700);
$config->set('storage.upload_root', $fixtureRoot);

function contentActor(int $merchantId, int $siteId = 991): void
{
    MerchantContext::set([
        'admin_id' => 99101, 'admin_name' => 'Property Content Tester', 'site_id' => $siteId,
        'account_type' => 2, 'group_id' => 0, 'merchant_id' => $merchantId,
        'store_id' => 0, 'is_owner' => true,
        'permissions' => ['mch:properties:profile-edit', 'mch:properties:profile-submit', 'mch:properties:publish'],
    ]);
}

function profileImage(int $width, int $height): UploadedFile
{
    global $sourceFiles;
    $chunk = static function (string $type, string $data): string {
        return pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
    };
    $scanline = "\0" . str_repeat("\x45\x72\x9d", $width);
    $png = "\x89PNG\r\n\x1a\n"
        . $chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0))
        . $chunk('IDAT', gzcompress(str_repeat($scanline, $height), 9))
        . $chunk('IEND', '');
    $path = tempnam(sys_get_temp_dir(), 'property-profile-image-');
    $sourceFiles[] = $path;
    file_put_contents($path, $png);
    return new UploadedFile($path, strlen($png), UPLOAD_ERR_OK, 'hotel.png', 'image/png');
}

try {
    $merchantId = $merchantIds[] = merchantFixture(991);
    $foreignMerchantId = $merchantIds[] = merchantFixture(991);
    $propertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantId, 'store_name' => 'Property Draft',
        'address' => 'Yangon', 'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
        'facilities' => json_encode(['Legacy WiFi']),
    ]);
    $foreignPropertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $foreignMerchantId, 'store_name' => 'Foreign Property',
        'address' => 'Mandalay', 'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    $otherSitePropertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 992, 'merchant_id' => $merchantId, 'store_name' => 'Other Site Property',
        'address' => 'Bangkok', 'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    Db::table('merchant_property_content_revision')->insert([
        'site_id' => 992, 'merchant_id' => $merchantId, 'property_id' => $otherSitePropertyId,
        'version' => 1, 'status' => 0, 'payload_json' => '{}',
    ]);
    $hotelGoodsBefore = Db::table('goods_info')->where('goods_type', 1)->count();

    contentActor($merchantId);
    rejects(40302, fn () => $service->detail($foreignPropertyId), 'C other merchant property denied');
    rejects(40401, fn () => $service->detail($otherSitePropertyId), 'C cross-site property hidden');
    $legacyAmenities = $service->detail($propertyId)['editable']['amenities'];
    check(count($legacyAmenities) === 1 && $legacyAmenities[0]['name'] === 'Legacy WiFi'
        && $legacyAmenities[0]['category'] === 'essential' && $legacyAmenities[0]['enabled'] === true,
        'F legacy facilities remain editable as structured amenities');
    rejects(40001, fn () => $service->save([
        'propertyId' => $propertyId,
        'amenities' => array_map(static fn (int $index) => [
            'id' => 'limit-' . $index, 'category' => 'essential', 'name' => 'Amenity ' . $index,
            'icon' => 'sparkles', 'enabled' => true, 'highlighted' => false,
        ], range(1, 6)),
    ], false), 'F amenity category active limit is enforced');
    rejects(40001, fn () => $service->uploadImage($propertyId, profileImage(200, 200)),
        'F undersized property image is rejected');
    $uploaded = $service->uploadImage($propertyId, profileImage(800, 600));
    check(str_starts_with($uploaded['url'], '/uploads/properties/' . $propertyId . '/')
        && is_file($fixtureRoot . substr($uploaded['url'], strlen('/uploads'))),
        'F valid property image is stored in the property-scoped directory');
    rejects(40001, fn () => $service->save(['propertyId' => $propertyId, 'emailAddress' => 'invalid-email'], false),
        'F invalid property email is rejected');
    rejects(40001, fn () => $service->save(['propertyId' => $propertyId, 'latitude' => '91'], false),
        'F out-of-range property coordinates are rejected');
    $submitted = $service->save([
        'propertyId' => $propertyId, 'propertyName' => 'Property Profile v1', 'location' => 'Yangon Downtown',
        'countryCode' => 'MM', 'cityKey' => 'yangon', 'description' => 'First submitted profile',
        'starLevel' => 4, 'phoneNumber1' => '+959 111 222 333', 'phoneNumber2' => '+959 444 555 666',
        'emailAddress' => 'hotel@example.test', 'longitude' => '96.156611', 'latitude' => '16.805278',
        'amenities' => [
            ['id' => 'wifi', 'category' => 'essential', 'name' => 'Free WiFi', 'icon' => 'wifi',
                'description' => '', 'enabled' => true, 'highlighted' => true],
            ['id' => 'pool', 'category' => 'reception', 'name' => 'Infinity Pool', 'icon' => 'pool',
                'description' => '', 'enabled' => false, 'highlighted' => true],
            ['id' => 'location', 'category' => 'tags', 'name' => 'Best Location', 'icon' => 'location',
                'description' => 'Minutes from the temples', 'enabled' => true, 'highlighted' => true],
        ], 'imageGallery' => [
            ['url' => '/uploads/properties/active.jpg', 'enabled' => true],
            ['url' => '/uploads/properties/disabled.jpg', 'enabled' => false],
        ],
        'website' => 'https://example.test', 'checkinTime' => '14:00', 'checkoutTime' => '12:00',
    ], true);
    check($submitted['version'] === 1 && $submitted['reviewStatus'] === 1, 'C property profile submits version 1');
    AdminContext::set(['admin_id' => 99101, 'admin_name' => 'Reviewer', 'site_id' => 991, 'is_super' => false]);
    $reviewQueue = $service->reviewList(1, 20, null, '');
    check($reviewQueue['total'] === 1 && $reviewQueue['stats'] === [
        'total' => 1, 'draft' => 0, 'pending' => 1, 'approved' => 0, 'rejected' => 0,
    ], 'C profile review list and stats are isolated to the admin site');
    $reviewController = $container->get(MerchantPropertyController::class);
    AdminContext::set(['admin_id' => 99101, 'admin_name' => 'Reviewer', 'site_id' => 991,
        'is_super' => false, 'permissions' => []]);
    setRequest(['page' => 1, 'pageSize' => 20]);
    rejects(40301, fn () => $reviewController->contentList(), 'C profile review list requires read permission');
    AdminContext::set(['admin_id' => 99101, 'admin_name' => 'Reviewer', 'site_id' => 991,
        'is_super' => false, 'permissions' => ['merchant:property:content-list']]);
    setRequest(['page' => 1, 'pageSize' => 20]);
    $controllerQueue = $reviewController->contentList();
    check(($controllerQueue['data']['total'] ?? 0) === 1 && isset($controllerQueue['data']['stats']),
        'C read permission can access profile review list and stats');
    setRequest(['id' => $submitted['revisionId']]);
    check(($reviewController->contentDetail()['data']['revision']['id'] ?? 0) === $submitted['revisionId'],
        'C read permission can access profile review detail');
    contentActor($merchantId);
    rejects(40901, fn () => $service->uploadImage($propertyId, null),
        'F property image upload is locked during profile review');
    $storedRevision = (string) Db::table('merchant_property_content_revision')->where('id', $submitted['revisionId'])->value('payload_json');
    check(! str_contains($storedRevision, '+959 111 222 333') && ! str_contains($storedRevision, '+959 444 555 666'),
        'F property phone numbers are encrypted in revision storage');
    $detail = $service->detail($propertyId);
    check($detail['editable']['contact_phone'] === '+959 111 222 333'
        && $detail['editable']['contact_phone2'] === '+959 444 555 666', 'F encrypted draft phones are decrypted for editing');
    check($detail['editable']['contact_email'] === 'hotel@example.test'
        && (float) $detail['editable']['longitude'] === 96.156611
        && (float) $detail['editable']['latitude'] === 16.805278, 'F contact and coordinates round-trip through draft');
    check(count($detail['editable']['image_gallery']) === 2
        && $detail['editable']['image_gallery'][1]['enabled'] === false
        && $detail['editable']['images'] === ['/uploads/properties/active.jpg'],
        'F disabled property images remain editable while active projection excludes them');
    check(count($detail['editable']['amenities']) === 3
        && $detail['editable']['amenities'][1]['enabled'] === false
        && $detail['editable']['amenities'][1]['highlighted'] === false
        && $detail['editable']['facilities'] === ['Free WiFi'],
        'F amenity groups and states round-trip while facilities keep the active consumer projection');
    rejects(40901, fn () => $service->publish($propertyId, true), 'C property cannot publish before profile and room approval');

    AdminContext::set(['admin_id' => 99201, 'admin_name' => 'Wrong Site Reviewer', 'site_id' => 992, 'is_super' => false]);
    rejects(40302, fn () => $service->audit($submitted['revisionId'], 1, ''), 'C cross-site profile review denied');
    AdminContext::set(['admin_id' => 99101, 'admin_name' => 'Reviewer', 'site_id' => 991,
        'is_super' => false, 'permissions' => ['merchant:property:content-list']]);
    setRequest(['id' => $submitted['revisionId'], 'auditStatus' => 2, 'auditRemark' => 'Improve description']);
    rejects(40301, fn () => $reviewController->contentAudit(), 'C read permission cannot audit a profile revision');
    AdminContext::set(['admin_id' => 99101, 'admin_name' => 'Reviewer', 'site_id' => 991,
        'is_super' => false, 'permissions' => ['merchant:property:content-audit']]);
    setRequest(['id' => $submitted['revisionId'], 'auditStatus' => 2, 'auditRemark' => 'Improve description']);
    $reviewController->contentAudit();
    check((int) Db::table('merchant_store')->where('id', $propertyId)->value('content_status') === 3,
        'C initial profile rejection is visible on property');
    rejects(40901, fn () => $service->audit($submitted['revisionId'], 1, ''),
        'C completed profile revision cannot be reviewed twice');

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
    $storedProperty = (array) Db::table('merchant_store')->where('id', $propertyId)->first();
    check($storedProperty['contact_phone'] !== '+959 111 222 333'
        && CryptoHelper::decrypt((string) $storedProperty['contact_phone'], (string) config('mtrip.aes_key')) === '+959 111 222 333'
        && CryptoHelper::decrypt((string) $storedProperty['contact_phone2'], (string) config('mtrip.aes_key')) === '+959 444 555 666',
        'F approved property phone numbers remain encrypted at rest');
    check(json_decode((string) $storedProperty['images'], true) === ['/uploads/properties/active.jpg']
        && count(json_decode((string) $storedProperty['image_gallery'], true)) === 2,
        'F approved property stores active consumer images and the full editable gallery');
    check(json_decode((string) $storedProperty['facilities'], true) === ['Free WiFi']
        && count(json_decode((string) $storedProperty['amenities'], true)) === 3,
        'F approved property stores structured amenities and the legacy consumer projection');

    $roomIds[] = (int) Db::table('hotel_room_type')->insertGetId([
        'site_id' => 991, 'property_id' => $propertyId, 'room_name' => 'Approved Room',
        'bed_type' => 'King', 'area' => '30', 'base_stock' => 18,
        'status' => 1, 'publish_status' => 2, 'approved_version' => 0,
    ]);
    contentActor($merchantId);
    rejects(40901, fn () => $service->publish($propertyId, true),
        'S6 unapproved room placeholder cannot satisfy the property publish gate');
    Db::table('hotel_room_type')->where('id', $roomIds[0])->update(['approved_version' => 1]);
    $reviewIds[] = (int) Db::table('goods_review')->insertGetId([
        'site_id' => 991, 'property_id' => $propertyId, 'goods_id' => 0, 'user_id' => 99101,
        'order_id' => 9910001, 'rating' => 4, 'content' => 'Visible review', 'status' => 1,
    ]);
    $reviewIds[] = (int) Db::table('goods_review')->insertGetId([
        'site_id' => 991, 'property_id' => $propertyId, 'goods_id' => 0, 'user_id' => 99102,
        'order_id' => 9910002, 'rating' => 1, 'content' => 'Hidden review', 'status' => 2,
    ]);
    $metrics = $service->detail($propertyId)['metrics'];
    check($metrics['roomTypes'] === ['Approved Room'] && $metrics['totalRooms'] === 18,
        'F profile metrics use approved room names and inventory');
    check($metrics['guestRating'] === 4.0 && $metrics['guestReviewCount'] === 1,
        'F profile metrics use visible property review scores only');
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
    if ($reviewIds) Db::table('goods_review')->whereIn('id', $reviewIds)->delete();
    if ($roomIds) Db::table('hotel_room_type')->whereIn('id', $roomIds)->delete();
    if ($propertyIds) {
        Db::table('merchant_property_content_revision')->whereIn('property_id', $propertyIds)->delete();
        Db::table('merchant_store')->whereIn('id', $propertyIds)->delete();
    }
    if ($merchantIds) Db::table('merchant_info')->whereIn('id', $merchantIds)->delete();
    foreach ($sourceFiles as $source) if (is_file($source)) unlink($source);
    if (is_dir($fixtureRoot)) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fixtureRoot, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($fixtureRoot);
    }
}

echo "Property content integration complete\n";
