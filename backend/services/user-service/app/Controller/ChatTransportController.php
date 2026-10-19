<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Chat\ChatAccess;
use Mtrip\Shared\Chat\ChatService;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/** Authenticated chat transport shared by consumer and merchant endpoints. */
class ChatTransportController extends AbstractController
{
    #[Inject]
    protected Redis $redis;

    #[Inject]
    protected ResponseInterface $response;

    private function identity(bool $write = false): array
    {
        if (str_contains($this->request->getUri()->getPath(), '/merchant/')) {
            $a = ChatAccess::employee(MerchantContext::adminId());
            if (! ChatAccess::permission($a, 'mch:chat:list') || ($write && ! ChatAccess::permission($a, 'mch:chat:reply'))) throw new BusinessException(ErrorCode::FORBIDDEN);
            return ['role' => 'merchant', 'actorId' => (int) $a['id'], 'siteId' => (int) $a['site_id'],
                'selected' => MerchantContext::selectedPropertyId(), 'authVersion' => (int) $a['auth_version'], 'propertyIds' => ChatAccess::properties($a)];
        }
        return ['role' => 'user', 'actorId' => UserContext::userId(), 'siteId' => UserContext::siteId(), 'selected' => 0];
    }

    public function ticket(): array
    {
        $i = $this->identity();
        $i['expires'] = time() + 3600;
        $token = bin2hex(random_bytes(24));
        $this->redis->setex('mtrip:chat:ticket:' . $token, 30, json_encode($i));
        return Result::success(['ticket' => $token, 'expiresIn' => 30]);
    }

    public function upload(): array
    {
        $i = $this->identity(true);
        $c = (new ChatService())->conversation($this->requireId('conversationId'), $i['role'], $i['actorId'], $i['siteId'], $i['selected'], 'mch:chat:reply');
        $file = $this->request->file('file');
        if (! $file || ! $file->isValid() || $file->getSize() <= 0) throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择有效文件');
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file((string) $file->getRealPath());
        $types = ['image/jpeg' => ['jpg', 'jpeg'], 'image/png' => ['png'], 'image/webp' => ['webp'], 'application/pdf' => ['pdf']];
        $name = basename(str_replace('\\', '/', $file->getClientFilename()));
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $max = $mime === 'application/pdf' ? 20 : 10;
        if (! isset($types[$mime]) || ! in_array($extension, $types[$mime], true) || $file->getSize() > $max * 1024 * 1024) throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持 JPG/PNG/WebP（10MB）或 PDF（20MB）');
        if (str_starts_with($mime, 'image/') && ! @getimagesize((string) $file->getRealPath())) throw new BusinessException(ErrorCode::PARAM_ERROR, '图片内容无效');
        $key = bin2hex(random_bytes(24));
        $root = '/opt/chat-private';
        if (! is_dir($root) && ! mkdir($root, 0700, true)) throw new BusinessException(ErrorCode::SERVER_ERROR);
        $size = (int) $file->getSize();
        $file->moveTo($root . '/' . $key);
        chmod($root . '/' . $key, 0600);
        $id = Db::table('chat_attachment')->insertGetId(['conversation_id' => $c['id'], 'actor_role' => $i['role'], 'actor_id' => $i['actorId'],
            'storage_key' => $key, 'filename' => mb_substr(preg_replace('/[\x00-\x1f\x7f]/', '', $name), 0, 255), 'mime' => $mime, 'size' => $size]);
        return Result::success(['id' => (int) $id, 'filename' => $name, 'mime' => $mime, 'size' => $size]);
    }

    public function fileTicket(): array
    {
        $i = $this->identity();
        $a = $this->attachment($this->requireId('attachmentId'), $i);
        $token = bin2hex(random_bytes(24));
        $this->redis->setex('mtrip:chat:file:' . $token, 30, json_encode(['identity' => $i, 'attachmentId' => (int) $a['id']]));
        return Result::success(['ticket' => $token]);
    }

    private function attachment(int $id, array $i): array
    {
        if ($i['role'] === 'merchant') {
            $employee = ChatAccess::employee((int) $i['actorId']);
            if ((int) $employee['auth_version'] !== (int) $i['authVersion']) throw new BusinessException(ErrorCode::UNAUTHORIZED);
        } elseif (! Db::table('user_info')->where('id', $i['actorId'])->where('site_id', $i['siteId'])->where('user_status', 1)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        $a = Db::table('chat_attachment')->where('id', $id)->first();
        if (! $a) throw new BusinessException(ErrorCode::NOT_FOUND);
        (new ChatService())->conversation((int) $a->conversation_id, $i['role'], $i['actorId'], $i['siteId'], $i['selected']);
        if (! $a->message_id && ($a->actor_role !== $i['role'] || (int) $a->actor_id !== $i['actorId'])) throw new BusinessException(ErrorCode::FORBIDDEN);
        return (array) $a;
    }

    /** Short-lived single-use ticket, checked against current conversation authorization at download. */
    public function file(): \Psr\Http\Message\ResponseInterface
    {
        $key = $this->strInput('ticket');
        if (! preg_match('/^[a-f0-9]{48}$/D', $key)) throw new BusinessException(ErrorCode::UNAUTHORIZED);
        $data = $this->redis->getDel('mtrip:chat:file:' . $key);
        if (! $data) throw new BusinessException(ErrorCode::UNAUTHORIZED);
        $data = json_decode($data, true);
        $a = $this->attachment((int) $data['attachmentId'], $data['identity']);
        return $this->response->download('/opt/chat-private/' . $a['storage_key'], $a['filename'])
            ->withHeader('Content-Type', $a['mime'])->withHeader('X-Content-Type-Options', 'nosniff')->withHeader('Cache-Control', 'no-store');
    }
}
