<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysSmsChannel;
use App\Model\SysSmsTemplate;
use App\Support\SecretField;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

use function Hyperf\Config\config;

/**
 * 模块9 国际短信:渠道(Twilio/MessageBird)/ 模板 / 发送日志
 */
class SmsController extends AbstractController
{
    /**
     * smspoh = SMSPoh Verify API V3(C端注册/验证码登录/重置密码的短信通道)
     * 它比另外两家多两段配置:第二段密钥 api_secret,以及 brand/pinLength/maxInvalidAttempts。
     * 字段与服务商参数的对应关系见 `database/system/11-sms-smspoh.sql` 头部注释。
     */
    private const PROVIDERS = ['twilio', 'messagebird', 'smspoh'];

    // ---------- 渠道 ----------

    public function channels(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysSmsChannel())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($providerCode = $this->strInput('providerCode')) !== '') {
            $query->where('provider_code', $providerCode);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function (SysSmsChannel $channel) {
                $row = $channel->toArray();
                // 两段密钥都只回脱敏值;前端留空提交即保留原密文(见 SecretField::keep)
                $row['api_key'] = SecretField::mask((string) $channel->api_key);
                $row['api_secret'] = SecretField::mask((string) ($channel->api_secret ?? ''));
                return $row;
            })->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('config:sms:add')]
    public function createChannel(): array
    {
        $channel = new SysSmsChannel();
        $channel->site_id = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $this->fillChannel($channel);
        $channel->save();
        return Result::success(['id' => (int) $channel->id], '短信渠道创建成功');
    }

    #[Permission('config:sms:edit')]
    public function updateChannel(): array
    {
        $channel = $this->findChannel($this->requireId());
        $this->fillChannel($channel);
        $channel->save();
        return Result::success(null, '短信渠道更新成功');
    }

    #[Permission('config:sms:delete')]
    public function deleteChannel(): array
    {
        $channel = $this->findChannel($this->requireId());
        $templateCount = SysSmsTemplate::query()->where('channel_id', $channel->id)->count();
        if ($templateCount > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "渠道下仍有 {$templateCount} 个模板,请先删除模板");
        }
        $channel->delete();
        return Result::success(null, '短信渠道已删除');
    }

    #[Permission('config:sms:edit')]
    public function toggleChannelStatus(): array
    {
        $channel = $this->findChannel($this->requireId());
        $channel->status = $channel->status === 1 ? 2 : 1;
        $channel->save();
        return Result::success(['status' => $channel->status], $channel->status === 1 ? '已启用' : '已禁用');
    }

    // ---------- 模板 ----------

    public function templates(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysSmsTemplate())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($channelId = $this->intInput('channelId')) > 0) {
            $query->where('channel_id', $channelId);
        }
        if (($templateType = $this->intInput('templateType')) > 0) {
            $query->where('template_type', $templateType);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('config:sms:template')]
    public function createTemplate(): array
    {
        $channel = $this->findChannel($this->requireId('channelId'));
        $template = new SysSmsTemplate();
        $template->site_id = (int) $channel->site_id;
        $template->channel_id = (int) $channel->id;
        $this->fillTemplate($template);
        $template->save();
        return Result::success(['id' => (int) $template->id], '短信模板创建成功');
    }

    #[Permission('config:sms:template')]
    public function updateTemplate(): array
    {
        $template = $this->findTemplate($this->requireId());
        $this->fillTemplate($template);
        $template->save();
        return Result::success(null, '短信模板更新成功');
    }

    #[Permission('config:sms:template')]
    public function deleteTemplate(): array
    {
        $template = $this->findTemplate($this->requireId());
        $template->delete();
        return Result::success(null, '短信模板已删除');
    }

    // ---------- 发送日志 ----------

    public function logs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('sys_sms_log');
        if (! AdminContext::isSuper()) {
            $query->where('site_id', AdminContext::siteId());
        } elseif (($siteId = $this->intInput('siteId')) > 0) {
            $query->where('site_id', $siteId);
        }
        if (($channelId = $this->intInput('channelId')) > 0) {
            $query->where('channel_id', $channelId);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $aesKey = (string) config('mtrip.aes_key');
        $list = array_map(static function ($row) use ($aesKey) {
            $row = (array) $row;
            try {
                $row['mobile'] = $row['mobile'] === '' ? '' : MaskHelper::mobile(CryptoHelper::decrypt((string) $row['mobile'], $aesKey));
            } catch (\Throwable) {
                $row['mobile'] = '******';
            }
            return $row;
        }, $query->orderByDesc('id')->forPage($page, $pageSize)->get()->toArray());
        return Result::page($list, $total, $page, $pageSize);
    }

    private function fillChannel(SysSmsChannel $channel): void
    {
        $code = $this->strInput('providerCode', (string) ($channel->provider_code ?? ''));
        if (! in_array($code, self::PROVIDERS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '短信服务商仅支持 twilio/messagebird');
        }
        $channel->provider_code = $code;
        $channel->provider_name = $this->strInput('providerName', (string) ($channel->provider_name ?? ucfirst($code)));
        $channel->api_key = SecretField::keep($this->strInput('apiKey'), (string) $channel->api_key);
        $channel->api_secret = SecretField::keep($this->strInput('apiSecret'), (string) ($channel->api_secret ?? ''));
        $channel->account_sid = $this->strInput('accountSid', (string) $channel->account_sid);
        $channel->sign_name = $this->strInput('signName', (string) $channel->sign_name);
        $channel->brand_name = $this->strInput('brandName', (string) ($channel->brand_name ?? ''));
        // 国家码只留数字(允许填 +95 / 0095 / 95,统一存 95)
        $channel->country_code = preg_replace('/\D/', '', $this->strInput('countryCode', (string) ($channel->country_code ?? '95'))) ?? '95';
        $whitelist = $this->input('regionWhitelist');
        if (is_array($whitelist)) {
            $channel->region_whitelist = array_values(array_map('strval', $whitelist));
        }
        // 三个数值上限按服务商约束夹取(SMSPoh:ttl 60~3600、pinLength 4~8、maxInvalidAttempts 1~10),
        // 越界值不落库,免得等到真发短信时才被服务商拒绝
        $channel->code_expire_sec = min(3600, max(60, $this->intInput('codeExpireSec', (int) ($channel->code_expire_sec ?? 300))));
        $channel->pin_length = min(8, max(4, $this->intInput('pinLength', (int) ($channel->pin_length ?? 6))));
        $channel->max_invalid_attempts = min(10, max(1, $this->intInput('maxInvalidAttempts', (int) ($channel->max_invalid_attempts ?? 5))));
        $channel->remark = $this->strInput('remark', (string) $channel->remark);

        // SMSPoh 的 accessToken 是 base64(apiKey:apiSecret),缺任一段都发不出短信;
        // 允许编辑时留空(留空 = 保留原密文),但不允许"从来没填过"
        if ($code === 'smspoh') {
            if ((string) $channel->api_key === '' || (string) $channel->api_secret === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'SMSPoh 渠道必须填写 API Key 与 API Secret');
            }
            if ((string) $channel->sign_name === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'SMSPoh 渠道必须填写 Sender ID(短信签名,大小写敏感)');
            }
        }
    }

    private function fillTemplate(SysSmsTemplate $template): void
    {
        $template->template_name = $this->strInput('templateName', (string) ($template->template_name ?? ''));
        if ($template->template_name === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 templateName 不能为空');
        }
        $type = $this->intInput('templateType', (int) ($template->template_type ?? 1));
        $template->template_type = in_array($type, [1, 2, 3, 4], true) ? $type : 1;
        $content = $this->strInput('content', (string) ($template->content ?? ''));
        if ($content === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 content 不能为空');
        }
        $template->content = $content;
        // 自动提取 ${var} 占位符
        preg_match_all('/\$\{(\w+)\}/', $content, $matches);
        $template->variables = array_values(array_unique($matches[1] ?? []));
        $status = $this->intInput('status', (int) ($template->status ?? 1));
        $template->status = in_array($status, [1, 2], true) ? $status : 1;
    }

    private function findChannel(int $id): SysSmsChannel
    {
        /** @var SysSmsChannel|null $channel */
        $channel = SysSmsChannel::query()->find($id);
        if ($channel === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '短信渠道不存在');
        }
        if (! AdminContext::isSuper() && (int) $channel->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $channel;
    }

    private function findTemplate(int $id): SysSmsTemplate
    {
        /** @var SysSmsTemplate|null $template */
        $template = SysSmsTemplate::query()->find($id);
        if ($template === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '短信模板不存在');
        }
        if (! AdminContext::isSuper() && (int) $template->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $template;
    }
}
