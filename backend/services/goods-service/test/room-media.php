<?php

declare(strict_types=1);
require __DIR__ . '/RoomReviewBootstrap.php';

use App\Service\RoomMediaService;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Upload\UploadedFile;

$property = (array) Db::table('merchant_store')->where('site_id', 992)->first();
$service = new RoomMediaService(); $files = []; $urls = [];
function fileFixture(string $path, string $name, ?int $size = null): UploadedFile { return new UploadedFile($path, $size ?? filesize($path), UPLOAD_ERR_OK, $name); }
function imageFixture(int $width, int $height): string {
    global $files; $path = tempnam('/tmp', 'room-media-'); $files[] = $path;
    $image = imagecreatetruecolor($width, $height); imagepng($image, $path); imagedestroy($image); return $path;
}
try {
    $path = imageFixture(800, 600);
    rejects(40001, fn () => $service->upload(fileFixture($path, 'image.png'), 'invalid', $property), 'unsupported media kind rejected');
    rejects(40001, fn () => $service->upload(fileFixture($path, 'image.jpg'), 'image', $property), 'forged image extension rejected');
    rejects(40001, fn () => $service->upload(fileFixture($path, 'image.png', 11 * 1024 * 1024), 'image', $property), 'oversized image rejected');
    rejects(40001, fn () => $service->upload(fileFixture(imageFixture(799, 600), 'image.png'), 'image', $property), 'undersized room image rejected');
    rejects(40001, fn () => $service->upload(fileFixture($path, 'image.png'), 'panorama', $property), 'ordinary image cannot be panorama');
    rejects(40001, fn () => $service->upload(fileFixture(imageFixture(800, 800), 'image.png'), 'vr_cover', $property), 'VR cover requires 4:3');
    foreach (['image' => [800, 600], 'panorama' => [1600, 800], 'floorplan' => [500, 400], 'vr_cover' => [800, 600]] as $kind => [$w, $h]) {
        $uploaded = $service->upload(fileFixture(imageFixture($w, $h), 'image.png'), $kind, $property); $urls[] = $uploaded['url'];
        check(Db::table('hotel_room_media')->where('url', $uploaded['url'])->where('kind', $kind)->where('property_id', $property['id'])->exists(), 'registered owned ' . $kind);
    }
    foreach ([1, 301] as $seconds) {
        $path = tempnam('/tmp', 'room-video-'); $files[] = $path;
        $pipes = []; $process = proc_open(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=16x16:r=1', '-t', (string) $seconds, '-c:v', 'libx264', '-f', 'mp4', '-y', $path], [1 => ['file', '/dev/null', 'a'], 2 => ['file', '/dev/null', 'a']], $pipes); proc_close($process);
        if ($seconds > 300) rejects(40001, fn () => $service->upload(fileFixture($path, 'video.mp4'), 'video', $property), 'server rejects video longer than 300 seconds');
        else { $uploaded = $service->upload(fileFixture($path, 'video.mp4'), 'video', $property); $urls[] = $uploaded['url']; check($uploaded['kind'] === 'video', 'server accepts real video and validates duration'); }
    }
} finally {
    foreach ($files as $path) if (is_file($path)) unlink($path);
    foreach ($urls as $url) if (is_file('/opt/www' . $url)) unlink('/opt/www' . $url);
}
echo "Room media validation passed\n";
