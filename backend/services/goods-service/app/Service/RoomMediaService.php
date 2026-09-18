<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Mtrip\Shared\Context\MerchantContext;

final class RoomMediaService
{
    public function upload(UploadedFile $file, string $kind, array $property): array
    {
        if (! in_array($kind, ['image', 'video', 'panorama', 'vr_cover', 'floorplan', 'closeup'], true)) RoomContentService::invalid('媒体类型不支持');
        $path = (string) $file->getRealPath();
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        $size = (int) $file->getSize();
        $max = $kind === 'video' ? 500 : (in_array($kind, ['panorama', 'vr_cover'], true) ? 25 : 10);
        if ($size < 1 || $size > $max * 1024 * 1024) RoomContentService::invalid("文件大小不能超过 {$max}MB");
        $ext = strtolower(pathinfo($file->getClientFilename(), PATHINFO_EXTENSION));
        $width = $height = 0;
        $duration = 0;
        if ($kind === 'video') {
            if (! in_array($mime, ['video/mp4', 'video/quicktime'], true) || ! in_array($ext, ['mp4', 'mov'], true)) RoomContentService::invalid('仅支持有效的 MP4/MOV 视频');
            $pipes = [];
            $process = proc_open(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', $path], [1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'a']], $pipes);
            if (! is_resource($process)) RoomContentService::invalid('视频校验服务暂不可用');
            stream_set_blocking($pipes[1], false);
            $output = '';
            $start = microtime(true);
            do {
                $output .= stream_get_contents($pipes[1]);
                $running = proc_get_status($process)['running'];
                if (! $running) break;
                usleep(10000);
            } while (microtime(true) - $start < 15);
            if ($running) proc_terminate($process, 9);
            $output .= stream_get_contents($pipes[1]);
            fclose($pipes[1]);
            proc_close($process);
            $probe = json_decode($output, true);
            $duration = (float) ($probe['format']['duration'] ?? 0);
            if ($running || empty($probe['streams'][0]['codec_name']) || $duration <= 0 || $duration > 300) RoomContentService::invalid('视频须可解码且时长不超过 300 秒');
        } else {
            $extensions = ['image/jpeg' => ['jpg', 'jpeg'], 'image/png' => ['png'], 'image/webp' => ['webp']];
            $dimensions = @getimagesize($path);
            if (! isset($extensions[$mime]) || ! in_array($ext, $extensions[$mime], true) || ! $dimensions || ($dimensions['mime'] ?? '') !== $mime) RoomContentService::invalid('仅支持真实的 JPG/PNG/WEBP 图片');
            [$width, $height] = $dimensions;
            if ($width > 16000 || $height > 16000) RoomContentService::invalid('图片边长不能超过 16000 像素');
            if (in_array($kind, ['image', 'closeup'], true) && ($width < 800 || $height < 600)) RoomContentService::invalid('图片分辨率不能低于 800×600');
            if ($kind === 'panorama' && ($width < 1600 || $height < 800 || abs($width / $height - 2) > 0.01)) RoomContentService::invalid('360 全景须为 2:1 等距柱状投影图片，至少 1600×800');
            if ($kind === 'vr_cover' && abs($width / $height - 4 / 3) > 0.01) RoomContentService::invalid('VR 封面比例须为 4:3');
        }
        $relative = '/uploads/rooms/' . $property['id'] . '/' . date('Ym');
        $dir = '/opt/www' . $relative;
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) RoomContentService::invalid('上传目录创建失败');
        $url = $relative . '/' . bin2hex(random_bytes(16)) . '.' . $ext;
        $file->moveTo('/opt/www' . $url);
        chmod('/opt/www' . $url, 0644);
        $id = Db::table('hotel_room_media')->insertGetId([
            'site_id' => $property['site_id'], 'property_id' => $property['id'], 'uploaded_by' => MerchantContext::adminId(),
            'kind' => $kind, 'url' => $url, 'mime' => $mime, 'size_bytes' => $size,
            'width' => $width, 'height' => $height, 'duration' => $duration,
        ]);
        return ['id' => $id, 'url' => $url, 'kind' => $kind, 'name' => $file->getClientFilename()];
    }
}
