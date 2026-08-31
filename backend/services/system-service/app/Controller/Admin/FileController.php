<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysFile;
use App\Model\SysStorage;
use App\Support\SecretField;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

use function Hyperf\Config\config;

/**
 * 模块7 文件库:公共资源查询 / 上传 / 删除。
 * 本地存储写共享 uploads 卷;阿里云 OSS 走轻量 REST PUT,其它对象存储配置先只做配置管理。
 */
class FileController extends AbstractController
{
    private const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
    private const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
    private const DOCUMENT_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
    private const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v'];
    private const AUDIO_EXT = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('sys_file as f')
            ->leftJoin('sys_admin as a', 'a.id', '=', 'f.uploader_id')
            ->whereNull('f.deleted_at');
        $this->applyFileScope($query, $this->intInput('siteId') ?: null);
        if (($fileName = $this->strInput('fileName')) !== '') {
            $query->where('f.file_name', 'like', "%{$fileName}%");
        }
        $fileTypes = $this->fileTypesInput();
        if ($fileTypes !== []) {
            $query->whereIn('f.file_type', $fileTypes);
        }
        if (($bizType = $this->strInput('bizType')) !== '') {
            $query->where('f.biz_type', $bizType);
        }
        if (($dir = $this->strInput('dir')) !== '') {
            $dir = $this->normalizeDir($dir);
            $query->where('f.file_path', 'like', $dir . '/%');
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('f.id')->forPage($page, $pageSize)
            ->get([
                'f.id', 'f.site_id', 'f.storage_id', 'f.file_name', 'f.file_path', 'f.file_url', 'f.file_type',
                'f.mime_type', 'f.file_size', 'f.biz_type', 'f.uploader_id', 'f.created_at', 'f.updated_at',
                Db::raw("COALESCE(NULLIF(a.real_name, ''), a.username, '') as creator_name"),
            ])->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function tree(): array
    {
        $query = Db::table('sys_file as f')->whereNull('f.deleted_at');
        $this->applyFileScope($query, $this->intInput('siteId') ?: null);
        $fileTypes = $this->fileTypesInput();
        if ($fileTypes !== []) {
            $query->whereIn('f.file_type', $fileTypes);
        }
        if (($bizType = $this->strInput('bizType')) !== '') {
            $query->where('f.biz_type', $bizType);
        }
        $paths = $query->pluck('f.file_path')->all();
        $dirQuery = Db::table('sys_file_dir as d')->whereNull('d.deleted_at');
        $this->applyFileScope($dirQuery, $this->intInput('siteId') ?: null, 'd');
        if ($bizType !== '') {
            $dirQuery->where('d.biz_type', $bizType);
        }
        $dirs = $dirQuery->orderBy('d.dir_path')->pluck('d.dir_path')->all();
        $tree = [[
            'title' => '全部文件',
            'key' => '',
            'managed' => false,
            'children' => [],
        ]];
        foreach ($dirs as $dir) {
            $dir = $this->normalizeDir((string) $dir);
            if ($dir !== '') {
                $this->appendDirNode($tree[0]['children'], explode('/', $dir), '', true);
            }
        }
        foreach ($paths as $path) {
            $dir = trim(str_replace('\\', '/', dirname((string) $path)), './ ');
            if ($dir === '' || $dir === '.') {
                continue;
            }
            $this->appendDirNode($tree[0]['children'], explode('/', $dir), '', false);
        }
        $this->sortDirTree($tree[0]['children']);
        return Result::success($tree);
    }

    #[Permission('config:storage:upload')]
    public function saveDir(): array
    {
        $parentDir = $this->normalizeDir($this->strInput('parentDir'));
        $dirName = $this->normalizeDir($this->requireStr('dirName'));
        if ($dirName === '' || str_contains($dirName, '/')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '目录名称不能包含斜杠');
        }
        $dirPath = $this->normalizeDir(implode('/', array_filter([$parentDir, $dirName], static fn ($part) => $part !== '')));
        if ($dirPath === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '目录不能为空');
        }
        $siteId = $this->writeSiteId();
        $bizType = $this->strInput('bizType', 'public_resource') ?: 'public_resource';
        $now = date('Y-m-d H:i:s');
        $exists = Db::table('sys_file_dir')->whereNull('deleted_at')
            ->where('site_id', $siteId)->where('biz_type', $bizType)->where('dir_path', $dirPath)->exists();
        if ($exists) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '目录已存在');
        }
        $id = Db::table('sys_file_dir')->insertGetId([
            'site_id' => $siteId,
            'biz_type' => mb_substr($bizType, 0, 50),
            'dir_name' => mb_substr($dirName, 0, 100),
            'dir_path' => mb_substr($dirPath, 0, 500),
            'parent_path' => mb_substr($parentDir, 0, 500),
            'created_by' => AdminContext::adminId(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        return Result::success(['id' => $id, 'dirPath' => $dirPath], '目录已创建');
    }

    #[Permission('config:storage:delete')]
    public function deleteDir(): array
    {
        $dir = $this->normalizeDir($this->requireStr('dir'));
        if ($dir === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '目录不能为空');
        }
        $siteId = $this->writeSiteId();
        $bizType = $this->strInput('bizType', 'public_resource') ?: 'public_resource';
        $dirRow = Db::table('sys_file_dir')->whereNull('deleted_at')
            ->where('site_id', $siteId)->where('biz_type', $bizType)->where('dir_path', $dir)->first();
        if ($dirRow === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '只能删除手动维护的空目录');
        }
        $hasChild = Db::table('sys_file_dir')->whereNull('deleted_at')
            ->where('site_id', $siteId)->where('biz_type', $bizType)->where('parent_path', $dir)->exists();
        if ($hasChild) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先删除子目录');
        }
        $hasFile = Db::table('sys_file')->whereNull('deleted_at')
            ->where('site_id', $siteId)->where('biz_type', $bizType)->where('file_path', 'like', $dir . '/%')->exists();
        if ($hasFile) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '目录下存在文件,不可删除');
        }
        $now = date('Y-m-d H:i:s');
        Db::table('sys_file_dir')->where('id', (int) $dirRow->id)->update([
            'deleted_at' => $now,
            'updated_at' => $now,
        ]);
        return Result::success(null, '目录已删除');
    }

    #[Permission(['config:storage:upload', 'config:theme:save'])]
    public function upload(): array
    {
        /** @var UploadedFile|null $file */
        $file = $this->request->file('file');
        if (! $file || ! $file->isValid()) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '未接收到有效的上传文件');
        }
        $clientName = (string) ($file->getClientFilename() ?? '');
        $ext = strtolower((string) pathinfo($clientName, PATHINFO_EXTENSION));
        if (! $this->isAllowedExt($ext)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持图片、文档、视频、音频资源文件');
        }
        $fileSize = (int) $file->getSize();
        if ($fileSize > self::MAX_UPLOAD_SIZE) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '文件大小不能超过 100MB');
        }

        $siteId = AdminContext::isSuper() ? max(0, $this->intInput('siteId')) : AdminContext::siteId();
        $storage = $this->resolveStorage($siteId);
        $dir = $this->normalizeDir($this->strInput('dir', 'resources'));
        if ($dir === '') {
            $dir = 'resources';
        }
        $bizType = $this->strInput('bizType', 'public_resource') ?: 'public_resource';
        $basePrefix = $this->normalizeDir(($storage !== null ? (string) $storage->path_prefix : ''));
        if (strtolower($basePrefix) === 'uploads') {
            $basePrefix = '';
        }
        $relativeDir = implode('/', array_filter([$basePrefix, $dir, date('Ym')], static fn ($part) => $part !== ''));
        $unique = date('His') . '-' . bin2hex(random_bytes(8));
        $objectKey = $relativeDir . '/' . $unique . '.' . $ext;
        $mime = (string) ($file->getMimeType() ?? 'application/octet-stream');

        if ($storage === null || (string) $storage->driver === 'local') {
            $fileUrl = $this->saveLocal($file, $objectKey);
        } elseif ((string) $storage->driver === 'aliyun') {
            $fileUrl = $this->saveAliyun($file, $storage, $objectKey, $mime);
        } else {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '公共上传接口当前仅支持 local/aliyun 存储');
        }

        $now = date('Y-m-d H:i:s');
        $id = Db::table('sys_file')->insertGetId([
            'site_id' => $siteId,
            'storage_id' => ($storage !== null ? (int) $storage->id : 0),
            'file_name' => mb_substr($clientName, 0, 255),
            'file_path' => mb_substr($objectKey, 0, 500),
            'file_url' => mb_substr($fileUrl, 0, 500),
            'file_type' => $this->detectFileType($ext),
            'mime_type' => mb_substr($mime, 0, 100),
            'file_size' => $fileSize,
            'biz_type' => mb_substr($bizType, 0, 50),
            'uploader_id' => AdminContext::adminId(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $row = Db::table('sys_file')->where('id', $id)->first();
        return Result::success((array) $row, '上传成功');
    }

    #[Permission('config:storage:delete')]
    public function delete(): array
    {
        /** @var SysFile|null $file */
        $file = SysFile::query()->find($this->requireId());
        if ($file === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '文件不存在');
        }
        if (! AdminContext::isSuper() && (int) $file->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        $this->deletePhysicalFile($file);
        $file->delete();
        return Result::success(null, '文件已删除');
    }

    private function applyFileScope($query, ?int $querySiteId, string $alias = 'f'): void
    {
        $siteId = AdminContext::scopeSiteId($querySiteId);
        if ($siteId !== null && $siteId > 0) {
            $query->where($alias . '.site_id', $siteId);
        }
    }

    private function writeSiteId(): int
    {
        return AdminContext::isSuper() ? max(0, $this->intInput('siteId')) : AdminContext::siteId();
    }

    private function normalizeDir(string $dir): string
    {
        $dir = preg_replace('#/+#', '/', str_replace('\\', '/', trim($dir))) ?? '';
        $dir = trim($dir, '/ ');
        if ($dir === '') {
            return '';
        }
        foreach (explode('/', $dir) as $part) {
            if ($part === '' || $part === '.' || $part === '..' || ! preg_match('/^[A-Za-z0-9._-]+$/', $part)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '目录只能包含字母、数字、点、下划线、中划线和斜杠');
            }
        }
        return $dir;
    }

    private function appendDirNode(array &$nodes, array $parts, string $prefix, bool $managed): void
    {
        $name = array_shift($parts);
        if ($name === null || $name === '') {
            return;
        }
        $key = $prefix === '' ? $name : $prefix . '/' . $name;
        foreach ($nodes as &$node) {
            if ($node['key'] === $key) {
                if ($managed && $parts === []) {
                    $node['managed'] = true;
                }
                $this->appendDirNode($node['children'], $parts, $key, $managed);
                return;
            }
        }
        $nodes[] = ['title' => $name, 'key' => $key, 'managed' => $managed && $parts === [], 'children' => []];
        $index = array_key_last($nodes);
        $this->appendDirNode($nodes[$index]['children'], $parts, $key, $managed);
    }

    private function sortDirTree(array &$nodes): void
    {
        usort($nodes, static fn ($a, $b) => strcmp((string) $a['title'], (string) $b['title']));
        foreach ($nodes as &$node) {
            if (! empty($node['children'])) {
                $this->sortDirTree($node['children']);
            }
        }
    }

    private function fileTypesInput(): array
    {
        $raw = $this->input('fileTypes', '');
        if (is_array($raw)) {
            $parts = $raw;
        } else {
            $parts = preg_split('/[,\s]+/', (string) $raw) ?: [];
        }
        if ($parts === [] && $this->intInput('fileType') > 0) {
            $parts = [$this->intInput('fileType')];
        }
        $allowed = [1, 2, 3, 4, 5];
        $types = [];
        foreach ($parts as $part) {
            $type = (int) $part;
            if (in_array($type, $allowed, true) && ! in_array($type, $types, true)) {
                $types[] = $type;
            }
        }
        if ($types === [] && $this->intInput('fileType') > 0) {
            $types[] = $this->intInput('fileType');
        }
        return $types;
    }

    private function isAllowedExt(string $ext): bool
    {
        return in_array($ext, array_merge(self::IMAGE_EXT, self::DOCUMENT_EXT, self::VIDEO_EXT, self::AUDIO_EXT), true);
    }

    private function detectFileType(string $ext): int
    {
        if (in_array($ext, self::IMAGE_EXT, true)) {
            return 1;
        }
        if (in_array($ext, self::DOCUMENT_EXT, true)) {
            return 2;
        }
        if (in_array($ext, self::VIDEO_EXT, true)) {
            return 3;
        }
        if (in_array($ext, self::AUDIO_EXT, true)) {
            return 5;
        }
        return 4;
    }

    private function resolveStorage(int $siteId): ?SysStorage
    {
        $storageId = $this->intInput('storageId');
        if ($storageId > 0) {
            /** @var SysStorage|null $storage */
            $storage = SysStorage::query()->where('id', $storageId)->where('status', 1)->first();
            if ($storage === null) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '存储配置不存在或未启用');
            }
            if (! AdminContext::isSuper() && (int) $storage->site_id !== AdminContext::siteId()) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            }
            return $storage;
        }

        /** @var SysStorage|null $storage */
        $storage = SysStorage::query()
            ->whereIn('site_id', array_values(array_unique([$siteId, 0])))
            ->where('status', 1)
            ->where('is_default', 1)
            ->orderByDesc('site_id')
            ->orderByDesc('id')
            ->first();
        return $storage;
    }

    private function saveLocal(UploadedFile $file, string $objectKey): string
    {
        $uploadRoot = rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\');
        $urlPrefix = rtrim((string) config('storage.url_prefix', '/uploads'), '/');
        $realPath = $uploadRoot . '/' . $objectKey;
        $realDir = dirname($realPath);
        if (! is_dir($realDir) && ! @mkdir($realDir, 0775, true) && ! is_dir($realDir)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败,请联系管理员');
        }
        $file->moveTo($realPath);
        if (! is_file($realPath)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '文件保存失败,请联系管理员');
        }
        @chmod($realPath, 0664);
        return $urlPrefix . '/' . $objectKey;
    }

    private function saveAliyun(UploadedFile $file, SysStorage $storage, string $objectKey, string $mime): string
    {
        $bucket = trim((string) $storage->bucket);
        $endpoint = trim((string) ($storage->endpoint ?? ''));
        $accessKey = SecretField::plain((string) $storage->access_key);
        $secretKey = SecretField::plain((string) $storage->secret_key);
        if ($bucket === '' || $endpoint === '' || $accessKey === '' || $secretKey === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '阿里云 OSS 需配置 Bucket、Endpoint、AccessKey 与 SecretKey');
        }
        $endpoint = preg_replace('#^https?://#', '', rtrim($endpoint, '/')) ?? $endpoint;
        $host = $bucket . '.' . $endpoint;
        $path = '/' . implode('/', array_map('rawurlencode', explode('/', $objectKey)));
        $date = gmdate('D, d M Y H:i:s') . ' GMT';
        $contentType = $mime !== '' ? $mime : 'application/octet-stream';
        $stringToSign = "PUT\n\n{$contentType}\n{$date}\n/{$bucket}/{$objectKey}";
        $signature = base64_encode(hash_hmac('sha1', $stringToSign, $secretKey, true));
        $content = (string) $file->getStream()->getContents();
        $headers = [
            'Date: ' . $date,
            'Content-Type: ' . $contentType,
            'Authorization: OSS ' . $accessKey . ':' . $signature,
            'Content-Length: ' . strlen($content),
        ];
        $context = stream_context_create([
            'http' => [
                'method' => 'PUT',
                'header' => implode("\r\n", $headers),
                'content' => $content,
                'ignore_errors' => true,
                'timeout' => 60,
            ],
        ]);
        $result = @file_get_contents('https://' . $host . $path, false, $context);
        $statusLine = $http_response_header[0] ?? '';
        if ($result === false || ! preg_match('/\s2\d\d\s/', $statusLine)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '阿里云 OSS 上传失败');
        }
        $domain = trim((string) $storage->cdn_domain) !== '' ? rtrim((string) $storage->cdn_domain, '/') : 'https://' . $host;
        return $domain . $path;
    }

    private function deletePhysicalFile(SysFile $file): void
    {
        $storage = (int) $file->storage_id > 0 ? SysStorage::query()->find((int) $file->storage_id) : null;
        $relative = $this->normalizeDir((string) $file->file_path);
        if ($relative === '') {
            return;
        }
        if ($storage !== null && (string) $storage->driver === 'aliyun') {
            $this->deleteAliyun($storage, $relative);
            return;
        }
        if ($storage !== null && (string) $storage->driver !== 'local') {
            return;
        }
        $root = realpath(rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\'));
        $path = realpath(($root ?: '') . '/' . $relative);
        if ($root && $path && str_starts_with($path, $root) && is_file($path)) {
            @unlink($path);
        }
    }

    private function deleteAliyun(SysStorage $storage, string $objectKey): void
    {
        $bucket = trim((string) $storage->bucket);
        $endpoint = trim((string) ($storage->endpoint ?? ''));
        $accessKey = SecretField::plain((string) $storage->access_key);
        $secretKey = SecretField::plain((string) $storage->secret_key);
        if ($bucket === '' || $endpoint === '' || $accessKey === '' || $secretKey === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '阿里云 OSS 需配置 Bucket、Endpoint、AccessKey 与 SecretKey');
        }
        $endpoint = preg_replace('#^https?://#', '', rtrim($endpoint, '/')) ?? $endpoint;
        $host = $bucket . '.' . $endpoint;
        $path = '/' . implode('/', array_map('rawurlencode', explode('/', $objectKey)));
        $date = gmdate('D, d M Y H:i:s') . ' GMT';
        $stringToSign = "DELETE\n\n\n{$date}\n/{$bucket}/{$objectKey}";
        $signature = base64_encode(hash_hmac('sha1', $stringToSign, $secretKey, true));
        $context = stream_context_create([
            'http' => [
                'method' => 'DELETE',
                'header' => implode("\r\n", [
                    'Date: ' . $date,
                    'Authorization: OSS ' . $accessKey . ':' . $signature,
                ]),
                'ignore_errors' => true,
                'timeout' => 30,
            ],
        ]);
        $result = @file_get_contents('https://' . $host . $path, false, $context);
        $statusLine = $http_response_header[0] ?? '';
        if ($result === false || (! preg_match('/\s2\d\d\s/', $statusLine) && ! preg_match('/\s404\s/', $statusLine))) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '阿里云 OSS 删除失败');
        }
    }
}
