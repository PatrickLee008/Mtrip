<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Service\PayAccountService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

/**
 * 模块8 收款账户(方案22 §5/§7):KBZPay MMQR 直连/服务商凭据,站点渠道通过 account_id 绑定。
 * 敏感字段只写不读;平台共享账户(site_id=0)对站点管理员只读。逻辑见 PayAccountService。
 */
class PayAccountController extends AbstractController
{
    /** 写接口接受的入参(驼峰) */
    private const INPUT_KEYS = [
        'siteId', 'channelCode', 'accountName', 'mode', 'env', 'appId', 'merchCode', 'appKey',
        'certPem', 'keyPem', 'keyPwd', 'caPem', 'notifyBaseUrl', 'remark', 'status',
    ];

    #[Inject]
    protected PayAccountService $service;

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        [$list, $total] = $this->service->paginate([
            'siteId' => $this->intInput('siteId'),
            'mode' => $this->intInput('mode'),
            'env' => $this->strInput('env'),
            'status' => $this->intInput('status'),
            'keyword' => $this->strInput('keyword'),
        ], $page, $pageSize);
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 绑定下拉:能看支付配置即可,不加写权限 */
    public function options(): array
    {
        return Result::success($this->service->options($this->intInput('siteId')));
    }

    #[Permission('config:payAccount:add')]
    public function create(): array
    {
        $id = $this->service->create($this->collectInput());
        return Result::success(['id' => $id], '收款账户创建成功');
    }

    #[Permission('config:payAccount:edit')]
    public function update(): array
    {
        $this->service->update($this->requireId(), $this->collectInput());
        return Result::success(null, '收款账户更新成功');
    }

    #[Permission('config:payAccount:delete')]
    public function delete(): array
    {
        $this->service->delete($this->requireId());
        return Result::success(null, '收款账户已删除');
    }

    #[Permission('config:payAccount:status')]
    public function toggleStatus(): array
    {
        $status = $this->service->toggleStatus($this->requireId());
        return Result::success(['status' => $status], $status === 1 ? '已启用' : '已停用');
    }

    #[Permission('config:payAccount:test')]
    public function test(): array
    {
        $result = $this->service->test($this->requireId());
        return Result::success($result, $result['message']);
    }

    private function collectInput(): array
    {
        $input = [];
        foreach (self::INPUT_KEYS as $key) {
            $value = $this->input($key);
            if ($value !== null && ! is_array($value)) {
                $input[$key] = $value;
            }
        }
        return $input;
    }
}
