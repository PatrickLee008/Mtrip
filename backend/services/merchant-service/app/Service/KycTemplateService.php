<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

/** Public template management; application/property requirements remain bound to immutable IDs. */
class KycTemplateService
{
    private const BUSINESS_TYPES = ['hotel', 'restaurant', 'airline', 'car_rental', 'attraction'];

    public function listing(array $input): array
    {
        $this->permit('list');
        $query = Db::table('merchant_kyc_template')->where('application_business_id', 0)->where('is_current', 1);
        if (! AdminContext::isSuper()) $query->whereIn('site_id', [0, AdminContext::siteId()]);
        if (isset($input['siteId']) && $input['siteId'] !== '') $query->where('site_id', (int) $input['siteId']);
        foreach (['scopeType' => 'scope_type', 'businessType' => 'business_type', 'status' => 'status'] as $key => $column) {
            if (isset($input[$key]) && $input[$key] !== '') $query->where($column, $input[$key]);
        }
        if (trim((string) ($input['keyword'] ?? '')) !== '') $query->where('name', 'like', '%' . trim($input['keyword']) . '%');
        return $this->page($query->orderBy('sort')->orderBy('template_group_id')->orderBy('id'), $input);
    }

    public function history(array $input): array
    {
        $this->permit('list');
        $row = $this->find((int) ($input['id'] ?? 0));
        return $this->page(Db::table('merchant_kyc_template')->where('application_business_id', 0)
            ->where('template_group_id', $row['template_group_id'])->orderByDesc('template_version'), $input);
    }

    public function create(array $input): array
    {
        $this->permit('add');
        $site = (int) ($input['siteId'] ?? AdminContext::siteId());
        if ($site < 0) throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择有效站点');
        $this->assertWritableSite($site);
        $scope = (string) ($input['scopeType'] ?? '');
        $type = (string) ($input['businessType'] ?? '');
        if (! $this->modern($scope, $type)) throw new BusinessException(ErrorCode::PARAM_ERROR, '主体模板须使用统一清单，物业模板须指定有效业务类型');
        $copyId = (int) ($input['copyFromId'] ?? 0);
        if ($copyId > 0) $this->find($copyId);
        $status = (int) ($input['status'] ?? 1);
        if (! in_array($status, [1, 2], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, '模板状态无效');
        $fields = $this->fields($input);
        $reason = trim((string) ($input['reason'] ?? ''));
        if (mb_strlen($reason) > 300) throw new BusinessException(ErrorCode::PARAM_ERROR, '变更原因不能超过 300 字');
        return Db::transaction(function () use ($site, $scope, $type, $copyId, $status, $fields, $reason): array {
            $id = (int) Db::table('merchant_kyc_template')->insertGetId($fields + $this->actor($copyId > 0 ? 'copy' : 'create', $reason) + [
                'site_id' => $site, 'scope_type' => $scope, 'business_type' => $type, 'status' => $status,
                'source_template_id' => $copyId, 'application_business_id' => 0, 'template_version' => 1, 'is_current' => 1,
            ]);
            Db::table('merchant_kyc_template')->where('id', $id)->update(['template_group_id' => $id]);
            return $this->present($this->find($id));
        });
    }

    public function update(array $input): array
    {
        $this->permit('edit');
        return $this->revise($input, false);
    }

    public function status(array $input): array
    {
        $this->permit('status');
        return $this->revise($input, true);
    }

    private function revise(array $input, bool $statusOnly): array
    {
        return Db::transaction(function () use ($input, $statusOnly): array {
            $row = $this->find((int) ($input['id'] ?? 0), true);
            $this->assertWritableSite((int) $row['site_id']);
            if (! $this->modern($row['scope_type'], $row['business_type'])) {
                throw new BusinessException(ErrorCode::FORBIDDEN, '历史配置仅供查看，可复制为当前规则的新模板');
            }
            if ((int) $row['is_current'] !== 1 || (int) ($input['expectedVersion'] ?? 0) !== (int) $row['template_version']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '模板已有新版本，请刷新后重试');
            }
            foreach (['siteId' => 'site_id', 'scopeType' => 'scope_type', 'businessType' => 'business_type'] as $key => $column) {
                if (isset($input[$key]) && (string) $input[$key] !== (string) $row[$column]) {
                    throw new BusinessException(ErrorCode::PARAM_ERROR, '模板归属、范围及业务类型不可更改，请复制为新模板');
                }
            }
            $reason = trim((string) ($input['reason'] ?? ''));
            if (mb_strlen($reason) > 300) throw new BusinessException(ErrorCode::PARAM_ERROR, '变更原因不能超过 300 字');
            $status = $statusOnly ? (int) ($input['status'] ?? 0) : (int) $row['status'];
            if (! in_array($status, [1, 2], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, '模板状态无效');
            if ($statusOnly && $status === (int) $row['status']) throw new BusinessException(ErrorCode::DATA_CONFLICT, '模板状态已变更，请刷新');
            $fields = $statusOnly ? array_intersect_key($row, array_flip(['name', 'docs', 'sort'])) : $this->fields($input + ['sort' => $row['sort']]);
            Db::table('merchant_kyc_template')->where('id', $row['id'])->update(['is_current' => 0]);
            $id = (int) Db::table('merchant_kyc_template')->insertGetId($fields + $this->actor($statusOnly ? ($status === 1 ? 'enable' : 'disable') : 'edit', $reason) + [
                'site_id' => $row['site_id'], 'scope_type' => $row['scope_type'], 'business_type' => $row['business_type'],
                'status' => $status, 'source_template_id' => $row['source_template_id'], 'application_business_id' => 0,
                'template_group_id' => $row['template_group_id'], 'template_version' => (int) $row['template_version'] + 1, 'is_current' => 1,
            ]);
            return $this->present($this->find($id));
        });
    }

    private function fields(array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 100) throw new BusinessException(ErrorCode::PARAM_ERROR, '模板名称必填且不能超过 100 字');
        $items = $input['documents'] ?? null;
        if (! is_array($items) || $items === [] || count($items) > 50) throw new BusinessException(ErrorCode::PARAM_ERROR, '请配置 1 至 50 项文件要求');
        $docs = [];
        foreach ($items as $item) {
            if (! is_array($item)) throw new BusinessException(ErrorCode::PARAM_ERROR, '文件要求格式不正确');
            $type = trim((string) ($item['docType'] ?? ''));
            $label = trim((string) ($item['name'] ?? ''));
            if (! preg_match('/^[a-z][a-z0-9_]{0,49}$/D', $type) || isset($docs[$type]) || $label === ''
                || mb_strlen($label) > 100 || ! is_bool($item['required'] ?? null)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '文件名称必填，类型须为唯一的小写字母、数字或下划线标识，并指定是否必填');
            }
            $docs[$type] = ['doc_type' => $type, 'name' => $label, 'required' => $item['required']];
        }
        if (! array_filter($docs, static fn ($doc) => $doc['required'])) throw new BusinessException(ErrorCode::PARAM_ERROR, '至少需要一项必填文件');
        $sort = filter_var($input['sort'] ?? 0, FILTER_VALIDATE_INT);
        if ($sort === false || $sort < 0 || $sort > 9999) throw new BusinessException(ErrorCode::PARAM_ERROR, '排序须为 0 至 9999 的整数');
        return ['name' => $name, 'docs' => json_encode(array_values($docs), JSON_UNESCAPED_UNICODE), 'sort' => $sort];
    }

    private function find(int $id, bool $lock = false): array
    {
        $query = Db::table('merchant_kyc_template')->where('id', $id)->where('application_business_id', 0);
        if ($lock) $query->lockForUpdate();
        $row = $query->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND, '公共 KYC 模板不存在');
        if (! AdminContext::isSuper() && ! in_array((int) $row->site_id, [0, AdminContext::siteId()], true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '无权访问其他站点模板');
        }
        return (array) $row;
    }

    private function assertWritableSite(int $site): void
    {
        if (! AdminContext::isSuper() && ($site <= 0 || $site !== AdminContext::siteId())) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '仅可维护本站点模板，公共模板由超级管理员维护');
        }
    }

    private function modern(string $scope, string $type): bool
    {
        return ($scope === 'merchant' && $type === 'unified') || ($scope === 'property' && in_array($type, self::BUSINESS_TYPES, true));
    }

    private function permit(string $action): void
    {
        if (! AdminContext::hasPermission('config:kyc:' . $action)) throw new BusinessException(ErrorCode::FORBIDDEN);
    }

    private function actor(string $action, string $reason): array
    {
        return ['created_by' => AdminContext::adminId(), 'created_by_name' => mb_substr(AdminContext::adminName(), 0, 100),
            'change_action' => $action, 'change_reason' => $reason];
    }

    private function present(array $row): array
    {
        foreach (['id', 'site_id', 'status', 'sort', 'template_group_id', 'template_version', 'created_by', 'is_current'] as $key) $row[$key] = (int) $row[$key];
        $row['documents'] = array_map(static fn ($doc) => ['docType' => (string) ($doc['doc_type'] ?? ''), 'name' => (string) ($doc['name'] ?? ''),
            'required' => ($doc['required'] ?? true) !== false], json_decode($row['docs'] ?? '[]', true) ?: []);
        $row['is_current'] = (bool) $row['is_current'];
        $row['is_legacy'] = ! $this->modern($row['scope_type'], $row['business_type']);
        $row['can_manage'] = ! $row['is_legacy'] && (AdminContext::isSuper() || ($row['site_id'] > 0 && $row['site_id'] === AdminContext::siteId()));
        unset($row['docs']);
        return $row;
    }

    private function page($query, array $input): array
    {
        $page = max(1, (int) ($input['page'] ?? 1));
        $size = min(200, max(1, (int) ($input['pageSize'] ?? 20)));
        $total = (clone $query)->count();
        return ['list' => $query->forPage($page, $size)->get()->map(fn ($row) => $this->present((array) $row))->all(),
            'total' => $total, 'page' => $page, 'pageSize' => $size];
    }
}
