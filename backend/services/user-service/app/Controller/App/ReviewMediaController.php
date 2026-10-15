<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 订单评价的图片 / 视频上传(Consumer App「Hotel Review」页,Figma 797:1600)。
 *
 * 文件落在 user-service 已挂载的上传目录:/uploads/user/{userId}/review-{img|vid}-{随机}.{ext},
 * goods-service 提交评价时按这个前缀校验地址确实是本人上传的(不能拿别人的或外链充数)。
 * 数量上限(图片 20 / 视频 3)由 goods-service 的 review/add 强制,这里只管单文件大小与真实类型。
 */
class ReviewMediaController extends AbstractController
{
    public const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

    public const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

    private const IMAGE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    private const VIDEO_TYPES = ['video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm'];

    #[Inject]
    protected ConfigInterface $config;

    public function upload(): array
    {
        $kind = $this->strInput('kind', 'image');
        if (! in_array($kind, ['image', 'video'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'kind 仅支持 image / video');
        }
        $file = $this->request->file('file');
        $max = $kind === 'video' ? self::MAX_VIDEO_BYTES : self::MAX_IMAGE_BYTES;
        if (! $file || ! $file->isValid() || $file->getSize() <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '未接收到有效文件');
        }
        if ($file->getSize() > $max) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, $kind === 'video' ? '视频不能超过 50MB' : '图片不能超过 10MB');
        }
        // 按文件内容嗅探 MIME,不信客户端声明的类型 / 扩展名
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file((string) $file->getRealPath());
        $types = $kind === 'video' ? self::VIDEO_TYPES : self::IMAGE_TYPES;
        $ext = $types[$mime] ?? null;
        if ($ext === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, $kind === 'video' ? '仅支持 MP4 / MOV / WebM 视频' : '仅支持 JPEG / PNG / WebP 图片');
        }

        $userId = UserContext::userId();
        $root = rtrim((string) $this->config->get('storage.upload_root', '/opt/www/uploads'), '/\\');
        $dir = '/user/' . $userId;
        if (! is_dir($root . $dir) && ! @mkdir($root . $dir, 0775, true) && ! is_dir($root . $dir)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败');
        }
        $path = $dir . '/review-' . ($kind === 'video' ? 'vid' : 'img') . '-' . bin2hex(random_bytes(16)) . '.' . $ext;
        $file->moveTo($root . $path);
        if (! is_file($root . $path)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '文件保存失败');
        }
        @chmod($root . $path, 0664);
        return Result::success([
            'url' => rtrim((string) $this->config->get('storage.url_prefix', '/uploads'), '/') . $path,
            'kind' => $kind,
        ], '上传成功');
    }
}
