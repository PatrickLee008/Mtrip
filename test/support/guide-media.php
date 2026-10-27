<?php

declare(strict_types=1);

require __DIR__ . '/../../backend/shared/tests/bootstrap.php';
require __DIR__ . '/../../backend/services/merchant-service/app/Service/GuideHubService.php';

$service = (new ReflectionClass(App\Service\GuideHubService::class))->newInstanceWithoutConstructor();
$project = new ReflectionMethod($service, 'guide');
$valid = ['provider' => 'youtube', 'video_id' => 'abcdefgh_-1', 'url' => 'https://www.youtube.com/watch?v=abcdefgh_-1'];

MiniTest::add('Guide media preserves published workflow and validated YouTube identifier', static function () use ($service, $project, $valid): void {
    $row = $project->invoke($service, ['id' => 'guide_1', 'title' => 'Manage bookings', 'category' => ['name' => 'Bookings'], 'screen' => ['name' => 'Booking details'], 'video' => $valid]);
    MiniTest::assertSame('abcdefgh_-1', $row['video_id'] ?? '');
    MiniTest::assertSame('Booking details', $row['screen']['name']);
    MiniTest::assertSame($valid['url'], $row['video_url']);
});

foreach (['path traversal' => '../abcdefgh', 'query injection' => 'abcdefghi?1', 'short ID' => 'abc', 'unknown provider' => 'abcdefgh_-1'] as $case => $id) {
    MiniTest::add('Guide media rejects ' . $case, static function () use ($service, $project, $valid, $case, $id): void {
        $video = array_replace($valid, ['video_id' => $id, 'provider' => $case === 'unknown provider' ? 'other' : 'youtube']);
        MiniTest::assertSame('', $project->invoke($service, ['video' => $video])['video_id'] ?? '');
    });
}

MiniTest::add('Guide media rejects unsafe external links and tolerates missing media', static function () use ($service, $project): void {
    foreach (['javascript:alert(1)', 'http://example.com/video', ''] as $url) {
        MiniTest::assertSame('', $project->invoke($service, ['video' => ['url' => $url]])['video_url']);
    }
    MiniTest::assertSame('', $project->invoke($service, [])['video_id'] ?? '');
});

exit(MiniTest::run() > 0 ? 1 : 0);
