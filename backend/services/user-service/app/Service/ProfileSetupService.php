<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Psr\Http\Message\UploadedFileInterface;

/**
 * App「Set Up Profile」两步向导(Figma Onboarding 2516:14427 / 2485:8211 / 2485:8355)
 *
 * - 第 1 步 saveProfile():头像 / 姓名 / 生日 / 性别 / 常住城市 / 家庭住址,提交即记 profile_setup_at
 * - 第 2 步 submitIdentity():国籍 / 证件姓名 / NRC 或护照号 / 证件正反面(护照只要资料页)/ 自拍,
 *   提交后 real_name_status=3 审核中;已认证(1)或审核中(3)不接受重复提交,认证失败(2)可重交
 *
 * 姓名、证件号、住址按 PII 与手机号同级 AES 加密落库;图片走 upload() 落本地共享卷,
 * 提交时校验图片 URL 必须是**本人目录**下的文件,防止拿别人的上传冒充。
 */
class ProfileSetupService
{
    /** 性别:1男 2女 3其他(0=未填,不接受提交 0) */
    public const GENDERS = [1, 2, 3];

    /** 上传场景(文件名前缀) */
    public const UPLOAD_SCENES = ['avatar', 'id_front', 'id_back', 'selfie'];

    private const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

    #[Inject]
    protected UserAuthService $authService;

    #[Inject]
    protected ConfigInterface $config;

    /** 向导回填:本人可见的明文资料(不走 profile() 的脱敏口径) */
    public function detail(int $userId): array
    {
        $user = $this->user($userId);
        return [
            'avatar' => (string) $user['avatar'],
            'fullName' => $this->authService->decryptSafe((string) $user['real_name']),
            'birthday' => $user['birthday'] ?: null,
            'gender' => (int) $user['gender'],
            'city' => (string) $user['city'],
            'homeAddress' => $this->authService->decryptSafe((string) $user['home_address']),
            'nationality' => (string) $user['nationality'],
            'realNameStatus' => (int) $user['real_name_status'],
            'profileCompleted' => ! empty($user['profile_setup_at']),
        ];
    }

    public function saveProfile(int $userId, array $input): array
    {
        $this->user($userId);
        $fullName = mb_substr(trim((string) ($input['fullName'] ?? '')), 0, 100);
        if ($fullName === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写姓名');
        }
        $birthday = $this->parseBirthday((string) ($input['birthday'] ?? ''));
        $gender = (int) ($input['gender'] ?? 0);
        if (! in_array($gender, self::GENDERS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择性别');
        }
        $avatar = trim((string) ($input['avatar'] ?? ''));
        if ($avatar !== '') {
            $this->assertOwnUpload($userId, $avatar);
        }
        $address = mb_substr(trim((string) ($input['homeAddress'] ?? '')), 0, 300);
        $data = [
            'real_name' => CryptoHelper::encrypt($fullName, $this->authService->aesKey()),
            'birthday' => $birthday,
            'gender' => $gender,
            'city' => mb_substr(trim((string) ($input['city'] ?? '')), 0, 100),
            'home_address' => $address !== '' ? CryptoHelper::encrypt($address, $this->authService->aesKey()) : '',
            'profile_setup_at' => date('Y-m-d H:i:s'),
        ];
        if ($avatar !== '') {
            $data['avatar'] = $avatar;
        }
        Db::table('user_info')->where('id', $userId)->update($data);
        return $this->authService->profile($userId);
    }

    public function submitIdentity(int $userId, array $input): array
    {
        $user = $this->user($userId);
        $status = (int) $user['real_name_status'];
        if ($status === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已通过实名认证,无需重复提交');
        }
        if ($status === 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '实名资料审核中,请耐心等待');
        }
        $nationality = strtoupper(trim((string) ($input['nationality'] ?? '')));
        if (! preg_match('/^[A-Z]{2}$/', $nationality)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择国籍');
        }
        $name = mb_substr(trim((string) ($input['name'] ?? '')), 0, 100);
        if ($name === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写证件姓名');
        }
        $idNumber = mb_substr(trim((string) ($input['idNumber'] ?? '')), 0, 60);
        if ($idNumber === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写证件号码');
        }
        $images = [];
        foreach (['idCardFront' => '证件正面', 'idCardBack' => '证件背面', 'selfieImage' => '自拍'] as $key => $label) {
            $url = trim((string) ($input[$key] ?? ''));
            // 缅甸国籍是 NRC(正反两面);其余国籍是护照,只有资料页,背面可空
            if ($url === '' && $key === 'idCardBack' && $nationality !== 'MM') {
                $images[$key] = '';
                continue;
            }
            if ($url === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '请上传' . $label . '照片');
            }
            $this->assertOwnUpload($userId, $url);
            $images[$key] = $url;
        }
        Db::table('user_info')->where('id', $userId)->update([
            'nationality' => $nationality,
            'real_name' => CryptoHelper::encrypt($name, $this->authService->aesKey()),
            'id_card' => CryptoHelper::encrypt($idNumber, $this->authService->aesKey()),
            'id_card_front' => $images['idCardFront'],
            'id_card_back' => $images['idCardBack'],
            'selfie_image' => $images['selfieImage'],
            'real_name_status' => 3,
            'real_name_submit_at' => date('Y-m-d H:i:s'),
            // 驳回后重交:清掉上一轮的审核留痕,后台按新一轮审核
            'real_name_audit_by' => '',
            'real_name_audit_at' => null,
            'real_name_reject_reason' => '',
        ]);
        return $this->authService->profile($userId);
    }

    /** 图片上传(头像 / 证件正反面 / 自拍),仅 JPEG/PNG/WebP,≤10MB;返回 /uploads/... 相对 URL */
    public function upload(int $userId, string $scene, ?UploadedFileInterface $file): array
    {
        if (! in_array($scene, self::UPLOAD_SCENES, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'scene 仅支持 ' . implode('/', self::UPLOAD_SCENES));
        }
        if (! $file || $file->getError() !== UPLOAD_ERR_OK || $file->getSize() <= 0 || $file->getSize() > self::MAX_UPLOAD_BYTES) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择不超过 10MB 的图片');
        }
        // 按文件内容嗅探 MIME,不信客户端声明的类型/扩展名
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer((string) $file->getStream());
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        if ($ext === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持 JPEG/PNG/WebP 图片');
        }
        $root = rtrim((string) $this->config->get('storage.upload_root', '/opt/www/uploads'), '/\\');
        $dir = $this->userDir($userId);
        if (! is_dir($root . $dir) && ! @mkdir($root . $dir, 0775, true) && ! is_dir($root . $dir)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败');
        }
        // 随机文件名:证件照经网关静态目录对外可读,不能被枚举
        $path = $dir . '/' . $scene . '-' . bin2hex(random_bytes(16)) . '.' . $ext;
        $file->moveTo($root . $path);
        if (! is_file($root . $path)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '文件保存失败');
        }
        @chmod($root . $path, 0664);
        return ['url' => rtrim((string) $this->config->get('storage.url_prefix', '/uploads'), '/') . $path];
    }

    private function userDir(int $userId): string
    {
        return '/user/' . $userId;
    }

    private function assertOwnUpload(int $userId, string $url): void
    {
        $prefix = rtrim((string) $this->config->get('storage.url_prefix', '/uploads'), '/') . $this->userDir($userId) . '/';
        if (! str_starts_with($url, $prefix) || str_contains($url, '..')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '图片地址无效,请重新上传');
        }
    }

    /** 生日:Y-m-d,不得晚于今天,不早于 120 年前 */
    private function parseBirthday(string $value): string
    {
        $value = trim($value);
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $today = new \DateTimeImmutable('today');
        if (! $date || $date->format('Y-m-d') !== $value || $date > $today || $date < $today->modify('-120 years')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写正确的出生日期');
        }
        return $value;
    }

    private function user(int $userId): array
    {
        $user = Db::table('user_info')->where('id', $userId)->whereNull('deleted_at')->first();
        if (! $user) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '用户不存在');
        }
        return (array) $user;
    }
}
