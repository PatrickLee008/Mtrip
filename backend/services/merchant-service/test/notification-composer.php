<?php

declare(strict_types=1);

require '/tmp/M12NotifyBootstrap.php';
require '/tmp/ComposerNotificationService.php';

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;

AdminContext::set(['admin_id' => 902, 'admin_name' => 'Notification tester', 'site_id' => 991, 'is_super' => true]);
$service = new App\Service\ComposerNotificationService();
$id = merchantFixture();
$foreign = merchantFixture(992);
$base = ['requestId' => 'composer-first', 'category' => 'booking', 'title' => 'Booking update', 'message' => 'The booking is ready.', 'channels' => ['inapp']];
foreach ([['title' => 'Booking {{booking_id}}'], ['message' => 'Refund {{ amount }}'], ['message' => 'Incomplete {{value'], ['message' => 'Unclosed value}}']] as $patch) {
    rejects(40001, fn () => $service->send($id, array_replace($base, $patch)), 'unresolved template text cannot be delivered');
}
check(Db::table('merchant_notify')->count() === 0 && Db::table('merchant_notify_delivery')->count() === 0 && Db::table('merchant_activity_log')->count() === 0, 'rejected drafts have no notification, delivery or audit side effects');
$receipt = $service->send($id, $base);
check($receipt['deliveries'][0]['status'] === 'delivered', 'completed in-app message is delivered');
check($service->send($id, $base)['id'] === $receipt['id'] && Db::table('merchant_notify')->count() === 1, 'safe retry creates one notification');
rejects(40901, fn () => $service->send($id, array_replace($base, ['message' => 'Changed'])), 'changed payload cannot reuse the old request');
foreach (['email', 'sms', 'push'] as $channel) {
    rejects(40901, fn () => $service->send($id, array_replace($base, ['channels' => ['inapp', $channel]])), 'unconfigured channel rejects the entire send');
}
rejects(40001, fn () => $service->send($id, array_replace($base, ['requestId' => 'composer-external', 'deepLinkType' => 'external_url', 'deepLinkValue' => 'https://example.test'])), 'external links remain unsupported');
rejects(40001, fn () => $service->send($id, array_replace($base, ['requestId' => 'composer-page-bad', 'deepLinkType' => 'page', 'deepLinkValue' => '//example.test'])), 'page target must be on the allowlist');
$linked = $service->send($id, array_replace($base, ['requestId' => 'composer-page-good', 'deepLinkType' => 'page', 'deepLinkValue' => '/notifications']));
check((int) $linked['id'] > 0, 'controlled merchant page can be linked');
rejects(40302, fn () => $service->send($id, array_replace($base, ['requestId' => 'composer-booking-bad', 'deepLinkType' => 'booking_detail', 'deepLinkValue' => '99999999'])), 'booking target must belong to the recipient');
$scheduled = $service->send($id, array_replace($base, ['requestId' => 'composer-schedule', 'sendType' => 2, 'sendAt' => '2099-01-02T08:15:00+06:30']));
check(Db::table('merchant_notify')->where('id', $scheduled['id'])->value('send_at') === '2099-01-02 01:45:00', 'Myanmar local schedule is stored in UTC');
check($scheduled['deliveries'][0]['status'] === 'scheduled', 'scheduled is not falsely presented as delivered');
foreach (['2020-01-01T00:00:00Z', '2099-02-30T10:00:00Z', '2099-01-01 10:00:00'] as $invalid) {
    rejects(40001, fn () => $service->send($id, array_replace($base, ['requestId' => 'composer-bad-date', 'sendType' => 2, 'sendAt' => $invalid])), 'past, invalid and unzoned times are rejected');
}
$template = (int) Db::table('notify_template')->insertGetId(['site_id' => 991, 'title' => 'Booking {{booking_id}}', 'message' => 'Hi {{merchant_name}}']);
$templated = $service->send($id, array_replace($base, ['requestId' => 'composer-template', 'templateId' => $template, 'title' => 'Booking 123', 'message' => 'Hi Synthetic merchant']));
check(Db::table('merchant_notify')->where('id', $templated['id'])->value('message') === 'Hi Synthetic merchant', 'manually completed template stores the actual edited content');
$otherTemplate = (int) Db::table('notify_template')->insertGetId(['site_id' => 992, 'title' => 'Other', 'message' => 'Other site']);
rejects(40302, fn () => $service->send($id, array_replace($base, ['requestId' => 'composer-foreign-template', 'templateId' => $otherTemplate])), 'cross-site templates remain forbidden');
AdminContext::set(['admin_id' => 903, 'site_id' => 992, 'is_super' => false, 'permissions' => ['merchant:list:notify']]);
rejects(40302, fn () => $service->send($id, array_replace($base, ['requestId' => 'composer-foreign'])), 'cross-site recipient is forbidden');
check(Db::table('merchant_notify')->where('merchant_id', $foreign)->count() === 0, 'other merchant receives nothing');
echo "Notification composer integration passed.\n";
