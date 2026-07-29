<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\MaskHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 系统操作日志中间件(文档模块4、9.3 审计日志强制规范)
 * 记录后台所有写操作(POST/PUT/DELETE)到 sys_operation_log,永久留存不可删改
 * sys_* 表统一位于 mtrip_system 库,各服务经 databases.php 中 system 连接访问
 * 修改前后数据对比由业务层在关键操作(编辑/审核)时补充写入 content 字段
 */
class OperationLogMiddleware implements MiddlewareInterface
{
    /** 路径第一段 → 操作模块名映射 */
    private const MODULE_MAP = [
        'sys' => '系统管理',
        'site' => '站点管理',
        'client' => '客户端管理',
        'merchant' => '商户管理',
        'supplier' => '供应商管理',
        'user' => '用户管理',
        'goods' => '商品管理',
        'order' => '订单管理',
        'finance' => '财务管理',
        'marketing' => '营销管理',
        'verify' => '核销管理',
    ];

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $method = strtoupper($request->getMethod());
        $response = $handler->handle($request);

        // 仅记录写操作;GET 查询不落审计日志
        if (! in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
            return $response;
        }

        try {
            $path = $request->getUri()->getPath();
            $params = array_merge(
                (array) $request->getQueryParams(),
                (array) $request->getParsedBody()
            );
            Db::connection('system')->table('sys_operation_log')->insert([
                'admin_id' => AdminContext::adminId(),
                'admin_name' => AdminContext::adminName(),
                'site_id' => AdminContext::siteId(),
                'module' => $this->resolveModule($path),
                'action' => $this->resolveAction($method, $path),
                'content' => json_encode(MaskHelper::maskParams($params), JSON_UNESCAPED_UNICODE),
                'request_url' => $path,
                'request_method' => $method,
                'client_ip' => $this->clientIp($request),
                'user_agent' => mb_substr($request->getHeaderLine('User-Agent'), 0, 255),
                'status_code' => $response->getStatusCode(),
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable) {
            // 日志写入失败不影响业务响应
        }

        return $response;
    }

    private function resolveModule(string $path): string
    {
        // /api/v1/admin/{module}/...
        $segments = array_values(array_filter(explode('/', $path)));
        $module = $segments[3] ?? '';
        return self::MODULE_MAP[$module] ?? $module;
    }

    private function resolveAction(string $method, string $path): string
    {
        $last = basename($path);
        $actionMap = [
            'add' => '新增', 'create' => '新增', 'update' => '编辑', 'delete' => '删除',
            'audit' => '审核', 'export' => '导出', 'login' => '登录', 'reset-password' => '重置密码',
            'toggle-status' => '启停', 'reset-secret' => '重置密钥',
        ];
        return $actionMap[$last] ?? ($method === 'DELETE' ? '删除' : '操作');
    }

    private function clientIp(ServerRequestInterface $request): string
    {
        $xff = $request->getHeaderLine('X-Forwarded-For');
        if ($xff !== '') {
            return trim(explode(',', $xff)[0]);
        }
        return (string) ($request->getServerParams()['remote_addr'] ?? '');
    }
}
