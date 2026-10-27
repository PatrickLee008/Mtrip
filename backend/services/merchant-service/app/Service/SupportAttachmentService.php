<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\SupportAccess;
use Mtrip\Shared\Support\SupportTicketPolicy as Policy;
use Psr\Http\Message\UploadedFileInterface;

class SupportAttachmentService
{
    public function __construct(private ConfigInterface $config)
    {
    }

    private function root(): string
    {
        return rtrim((string) $this->config->get('storage.support_private_root', '/opt/support-private'), '/');
    }

    public function upload(string $type, array $input, ?UploadedFileInterface $file): array
    {
        $service = new SupportTicketService();
        $ticket = isset($input['ticketId']) ? $service->detail($type, Policy::integer($input, 'ticketId')) : null;
        if ($type === 'merchant') {
            $a = SupportAccess::requireMerchant('mch:support:' . ($ticket ? 'reply' : 'create'));
            $actor = (int) $a['id'];
            $scope = $ticket ? array_intersect_key($ticket, array_flip(['site_id', 'merchant_id', 'property_id']))
                : $service->creationScope($input, ['account' => $a, 'site_id' => (int) $a['site_id']]);
        } else {
            if (! $ticket) throw new BusinessException(ErrorCode::PARAM_ERROR);
            $actor = AdminContext::adminId(); SupportAccess::admin($actor, 'help:ticket:reply', (int) $ticket['site_id']);
            $scope = array_intersect_key($ticket, array_flip(['site_id', 'merchant_id', 'property_id']));
        }
        if ($ticket && ! in_array($ticket['status'], Policy::ACTIVE, true)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先重开工单');
        if (! $file || $file->getError() !== UPLOAD_ERR_OK || ($file->getSize() ?? 0) < 1 || $file->getSize() > Policy::MAX_FILE_BYTES) throw new BusinessException(ErrorCode::PARAM_ERROR, '附件上传失败或超过10MB');
        $name = basename(str_replace('\\', '/', str_replace(["\r", "\n", "\0"], '', $file->getClientFilename() ?? '')));
        if ($name === '' || mb_strlen($name) > 255) throw new BusinessException(ErrorCode::PARAM_ERROR, '文件名无效');
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $allowed = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (! isset($allowed[$extension])) throw new BusinessException(ErrorCode::PARAM_ERROR, '不支持的附件类型');
        $root = $this->root();
        if (! is_dir($root) && ! mkdir($root, 0700, true) && ! is_dir($root)) throw new BusinessException(ErrorCode::SERVER_ERROR);
        $key = bin2hex(random_bytes(24)); $path = $root . '/' . $key;
        $file->moveTo($path);
        try {
            chmod($path, 0600);
            $size = filesize($path); $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
            $valid = $mime === $allowed[$extension];
            if ($extension === 'xlsx') {
                $zip = new \ZipArchive();
                $opened = $zip->open($path) === true;
                $valid = $opened && $zip->locateName('[Content_Types].xml') !== false && $zip->locateName('xl/workbook.xml') !== false && $zip->locateName('_rels/.rels') !== false;
                if ($opened) $zip->close();
            }
            if (! $valid || $size < 1 || $size > Policy::MAX_FILE_BYTES) throw new BusinessException(ErrorCode::PARAM_ERROR, '文件内容与允许类型不符');
            $id = (int) Db::table('merchant_support_attachment')->insertGetId($scope + ['ticket_id' => $ticket['id'] ?? null, 'actor_type' => $type,
                'actor_id' => $actor, 'storage_key' => $key, 'filename' => $name, 'mime' => $allowed[$extension], 'size' => $size]);
            return ['id' => $id, 'filename' => $name, 'mime' => $allowed[$extension], 'size' => $size];
        } catch (\Throwable $e) {
            if (is_file($path)) unlink($path);
            throw $e;
        }
    }

    public function download(string $type, int $id): array
    {
        $row = Db::table('merchant_support_attachment')->where('id', $id)->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
        if ($row->bound_at !== null) (new SupportTicketService())->detail($type, (int) $row->ticket_id);
        else {
            if ($row->actor_type !== $type || (int) $row->actor_id !== ($type === 'merchant' ? MerchantContext::adminId() : AdminContext::adminId())
                || $row->created_at < gmdate('Y-m-d H:i:s', time() - 86400)) throw new BusinessException(ErrorCode::NOT_FOUND);
            if ($row->ticket_id) {
                (new SupportTicketService())->detail($type, (int) $row->ticket_id);
                if ($type === 'merchant') SupportAccess::requireMerchant('mch:support:reply');
                else SupportAccess::admin(AdminContext::adminId(), 'help:ticket:reply', (int) $row->site_id);
            } else {
                $a = SupportAccess::requireMerchant('mch:support:create');
                (new SupportTicketService())->creationScope(['merchantId' => $row->merchant_id, 'propertyId' => $row->property_id], ['account' => $a, 'site_id' => (int) $a['site_id']]);
            }
        }
        $path = $this->root() . '/' . $row->storage_key;
        if (! preg_match('/^[a-f0-9]{48}$/D', $row->storage_key) || ! is_file($path)) throw new BusinessException(ErrorCode::NOT_FOUND);
        return ['path' => $path, 'filename' => $row->filename, 'mime' => $row->mime];
    }

    public function expireUnbound(): int
    {
        $count = 0;
        foreach (Db::table('merchant_support_attachment')->whereNull('bound_at')->where('created_at', '<', gmdate('Y-m-d H:i:s', time() - 86400))->orderBy('id')->limit(200)->pluck('id') as $id) {
            $count += Db::transaction(function () use ($id) {
                $row = Db::table('merchant_support_attachment')->where('id', $id)->whereNull('bound_at')->lockForUpdate()->first();
                if (! $row || $row->created_at >= gmdate('Y-m-d H:i:s', time() - 86400)) return 0;
                if (preg_match('/^[a-f0-9]{48}$/D', $row->storage_key)) {
                    $path = $this->root() . '/' . $row->storage_key;
                    if (is_file($path) && ! unlink($path)) throw new BusinessException(ErrorCode::SERVER_ERROR);
                }
                return Db::table('merchant_support_attachment')->where('id', $id)->delete();
            });
        }
        return $count;
    }
}
