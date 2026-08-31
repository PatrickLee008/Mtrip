<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysClient;
use App\Model\SysClientPermTemplate;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 模块13 接口权限模板:白/黑名单规则集合,绑定客户端后生效(ClientSignMiddleware 校验)
 */
class PermTemplateController extends AbstractController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysClientPermTemplate())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($templateName = $this->strInput('templateName')) !== '') {
            $query->where('template_name', 'like', "%{$templateName}%");
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = (clone $query)->orderByDesc('id')->forPage($page, $pageSize)->get();

        // 补充绑定客户端数量
        $clientCounts = SysClient::query()
            ->whereIn('perm_template_id', $list->pluck('id')->toArray() ?: [0])
            ->selectRaw('perm_template_id, count(*) as cnt')->groupBy('perm_template_id')
            ->pluck('cnt', 'perm_template_id')->toArray();
        $rows = $list->map(static fn (SysClientPermTemplate $template) => $template->toArray()
            + ['client_count' => (int) ($clientCounts[$template->id] ?? 0)])->toArray();
        return Result::page($rows, $total, $page, $pageSize);
    }

    /** 启用模板下拉(客户端绑定用) */
    public function all(): array
    {
        $list = (new SysClientPermTemplate())->newSiteQuery()->where('status', 1)
            ->orderBy('id')->get(['id', 'site_id', 'template_name', 'template_type', 'rule_mode'])->toArray();
        return Result::success($list);
    }

    #[Permission('config:permtpl:add')]
    public function create(): array
    {
        $template = new SysClientPermTemplate();
        $template->site_id = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $template->template_type = $template->site_id === 0 ? 1 : 2;
        $template->template_name = $this->requireStr('templateName');
        $this->fill($template);
        $template->save();
        return Result::success(['id' => (int) $template->id], '权限模板创建成功');
    }

    #[Permission('config:permtpl:edit')]
    public function update(): array
    {
        $template = $this->findScoped($this->requireId());
        $template->template_name = $this->strInput('templateName', (string) $template->template_name);
        $this->fill($template);
        $template->save();
        return Result::success(null, '权限模板更新成功');
    }

    #[Permission('config:permtpl:delete')]
    public function delete(): array
    {
        $template = $this->findScoped($this->requireId());
        $bound = SysClient::query()->where('perm_template_id', $template->id)->count();
        if ($bound > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "仍有 {$bound} 个客户端绑定该模板,请先解绑");
        }
        $template->delete();
        return Result::success(null, '权限模板已删除');
    }

    #[Permission('config:permtpl:edit')]
    public function toggleStatus(): array
    {
        $template = $this->findScoped($this->requireId());
        $template->status = $template->status === 1 ? 2 : 1;
        $template->save();
        return Result::success(['status' => $template->status], $template->status === 1 ? '已启用' : '已禁用');
    }

    /** 模板绑定的客户端列表 */
    public function clients(): array
    {
        $template = $this->findScoped($this->requireId('templateId'));
        $list = SysClient::query()->where('perm_template_id', $template->id)
            ->get(['id', 'site_id', 'client_name', 'client_id', 'client_type', 'status'])->toArray();
        return Result::success($list);
    }

    private function fill(SysClientPermTemplate $template): void
    {
        $template->description = $this->strInput('description', (string) $template->description);
        $ruleMode = $this->intInput('ruleMode', (int) ($template->rule_mode ?? 1));
        $template->rule_mode = in_array($ruleMode, [1, 2], true) ? $ruleMode : 1;
        $apiList = $this->input('apiList');
        if (is_array($apiList)) {
            $paths = array_values(array_filter(array_map('trim', array_map('strval', $apiList))));
            foreach ($paths as $path) {
                if (! str_starts_with($path, '/')) {
                    throw new BusinessException(ErrorCode::PARAM_VALIDATE_FAIL, "接口标识 {$path} 须以 / 开头");
                }
            }
            $template->api_list = $paths;
        }
    }

    private function findScoped(int $id): SysClientPermTemplate
    {
        /** @var SysClientPermTemplate|null $template */
        $template = SysClientPermTemplate::query()->find($id);
        if ($template === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '权限模板不存在');
        }
        if (! AdminContext::isSuper() && (int) $template->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $template;
    }
}
