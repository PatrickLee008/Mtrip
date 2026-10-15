<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * App「使用指南 → 视频教程」内容(Consumer App PRD 模块 16.3),跨端共用控制器(同 ThemeController):
 * - C端 app:GET /api/v1/app/tutorial/list(无需登录)。返回已上架、语言为「通用」或当前语言的教程;
 *   当前语言取 ?lang=,没有就取请求头 X-Lang,都没有只返回通用的。
 * - 总平台 admin:/api/v1/admin/config/tutorial/*(列表 / 保存 / 删除),菜单在「内容管理 → 教程管理」。
 *
 * 本期不区分站点;视频由运营在后台上传到存储(video_url 存文件地址),也可填外部链接。
 */
class TutorialController extends AbstractController
{
    public const CATEGORIES = ['hotel', 'food', 'other'];

    /** 'all' = 所有语言通用 */
    public const LANGS = ['all', 'en-US', 'zh-CN', 'my-MM'];

    private const MAX_DURATION = 86400;

    /** App 列表:分类顺序按 CATEGORIES,同类按 sort、id */
    public function list(): array
    {
        $lang = $this->strInput('lang');
        if ($lang === '') {
            $lang = trim($this->request->getHeaderLine('x-lang'));
        }
        $langs = in_array($lang, self::LANGS, true) && $lang !== 'all' ? ['all', $lang] : ['all'];

        $rows = Db::table('app_tutorial')->whereNull('deleted_at')->where('status', 1)
            ->whereIn('lang', $langs)
            ->orderBy('sort')->orderBy('id')->limit(100)
            ->get(['id', 'category', 'lang', 'title', 'description', 'cover_url', 'video_url', 'duration_sec'])
            ->map(static fn ($row) => (array) $row)->all();
        $rank = array_flip(self::CATEGORIES);
        usort($rows, static fn (array $a, array $b) => ($rank[$a['category']] ?? 99) <=> ($rank[$b['category']] ?? 99));
        return Result::success($rows);
    }

    // ---------- 管理端 ----------

    #[Permission('config:tutorial:list')]
    public function adminList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('app_tutorial')->whereNull('deleted_at');
        if (($category = $this->strInput('category')) !== '') {
            $query->where('category', $category);
        }
        if (($lang = $this->strInput('lang')) !== '') {
            $query->where('lang', $lang);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where('title', 'like', '%' . $keyword . '%');
        }
        $total = (clone $query)->count();
        $list = $query->orderBy('sort')->orderByDesc('id')->forPage($page, $pageSize)
            ->get()->map(static function ($row) {
                $row = (array) $row;
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('config:tutorial:save')]
    public function save(): array
    {
        $category = $this->strInput('category', 'hotel');
        if (! in_array($category, self::CATEGORIES, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '分类不正确');
        }
        $lang = $this->strInput('lang', 'all');
        if (! in_array($lang, self::LANGS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '语言不正确');
        }
        $title = $this->requireStr('title');
        if (mb_strlen($title) > 150) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '标题不能超过 150 个字符');
        }
        $description = $this->strInput('description');
        if (mb_strlen($description) > 300) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '简介不能超过 300 个字符');
        }
        $videoUrl = $this->requireStr('videoUrl');
        $coverUrl = $this->strInput('coverUrl');
        foreach (['视频地址' => $videoUrl, '封面地址' => $coverUrl] as $label => $url) {
            if ($url !== '' && (! preg_match('#^(https?://|/)#i', $url) || mb_strlen($url) > 500)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, $label . '须是 http(s) 链接或站内路径,且不超过 500 个字符');
            }
        }
        $duration = $this->intInput('durationSec');
        if ($duration < 0 || $duration > self::MAX_DURATION) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '时长须在 0 到 86400 秒之间');
        }
        $data = [
            'category' => $category,
            'lang' => $lang,
            'title' => $title,
            'description' => $description,
            'cover_url' => $coverUrl,
            'video_url' => $videoUrl,
            'duration_sec' => $duration,
            'sort' => max(-9999, min(9999, $this->intInput('sort'))),
            'status' => $this->intInput('status', 2) === 1 ? 1 : 2,
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            if (! Db::table('app_tutorial')->where('id', $id)->whereNull('deleted_at')->exists()) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '教程不存在');
            }
            Db::table('app_tutorial')->where('id', $id)->update($data);
            return Result::success(['id' => $id], '已保存');
        }
        $data['created_by'] = AdminContext::adminId();
        return Result::success(['id' => (int) Db::table('app_tutorial')->insertGetId($data)], '已保存');
    }

    #[Permission('config:tutorial:delete')]
    public function delete(): array
    {
        $id = $this->requireId();
        if (! Db::table('app_tutorial')->where('id', $id)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '教程不存在');
        }
        Db::table('app_tutorial')->where('id', $id)->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }
}
