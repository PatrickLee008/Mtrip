<?php

declare(strict_types=1);

namespace App\Controller;

use App\Model\SysMenu;
use App\Support\TreeHelper;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 模块3 菜单&按钮权限管理:完整菜单树 / CRUD(动态菜单接口见 AuthController::menus)
 */
class MenuController extends AbstractController
{
    public function tree(): array
    {
        $rows = SysMenu::query()->orderBy('sort')->orderBy('id')->get()->toArray();
        return Result::success(TreeHelper::build($rows));
    }

    #[Permission('sys:menu:add')]
    public function create(): array
    {
        $permKey = $this->strInput('permKey');
        if ($permKey !== '' && SysMenu::query()->where('perm_key', $permKey)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '权限标识已存在');
        }
        $parentId = $this->intInput('parentId');
        if ($parentId > 0 && ! SysMenu::query()->whereKey($parentId)->exists()) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '父级菜单不存在');
        }

        $menu = new SysMenu();
        $menu->parent_id = $parentId;
        $menu->menu_name = $this->requireStr('menuName');
        $menu->perm_key = $permKey;
        $menu->menu_type = min(3, max(1, $this->intInput('menuType', 1)));
        $this->fill($menu);
        $menu->save();
        return Result::success(['id' => (int) $menu->id], '菜单创建成功');
    }

    #[Permission('sys:menu:edit')]
    public function update(): array
    {
        $menu = $this->find($this->requireId());
        $permKey = $this->strInput('permKey', (string) $menu->perm_key);
        if ($permKey !== '' && SysMenu::query()->where('perm_key', $permKey)->whereKeyNot($menu->id)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '权限标识已存在');
        }
        $menu->menu_name = $this->strInput('menuName', (string) $menu->menu_name);
        $menu->perm_key = $permKey;
        $this->fill($menu);
        $menu->save();
        return Result::success(null, '菜单更新成功');
    }

    #[Permission('sys:menu:delete')]
    public function delete(): array
    {
        $menu = $this->find($this->requireId());
        if (SysMenu::query()->where('parent_id', $menu->id)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '存在子菜单/按钮,请先删除子级');
        }
        Db::transaction(static function () use ($menu) {
            $menu->delete();
            Db::table('sys_role_menu')->where('menu_id', $menu->id)->delete();
        });
        return Result::success(null, '菜单已删除');
    }

    private function fill(SysMenu $menu): void
    {
        $menu->menu_name_en = $this->strInput('menuNameEn', (string) $menu->menu_name_en);
        $menu->i18n_key = $this->strInput('i18nKey', (string) $menu->i18n_key);
        $menu->route_path = $this->strInput('routePath', (string) $menu->route_path);
        $menu->component = $this->strInput('component', (string) $menu->component);
        $menu->icon = $this->strInput('icon', (string) $menu->icon);
        $menu->sort = $this->intInput('sort', (int) $menu->sort);
        $status = $this->intInput('status', (int) ($menu->status ?? 1));
        $menu->status = in_array($status, [1, 2], true) ? $status : 1;
        $isCache = $this->intInput('isCache', (int) ($menu->is_cache ?? 1));
        $menu->is_cache = in_array($isCache, [1, 2], true) ? $isCache : 1;
        $menu->remark = $this->strInput('remark', (string) $menu->remark);
    }

    private function find(int $id): SysMenu
    {
        /** @var SysMenu|null $menu */
        $menu = SysMenu::query()->find($id);
        if ($menu === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '菜单不存在');
        }
        return $menu;
    }
}
