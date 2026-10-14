SET NAMES utf8mb4;

-- App「使用指南 → 视频教程」内容管理(Consumer App PRD 模块 16.3 Tutorials & Video Guide,QA CA_TC_104/105)。
--
--   app_tutorial   教程视频:分类(酒店 hotel / 餐饮 food / 其他 other)、标题与简介、封面、视频、时长、排序、上下架。
--                  lang='all' 表示所有语言通用;否则只在该语言(en-US / zh-CN / my-MM)下显示。
--                  本期不区分站点。视频由运营在后台上传到存储(video_url 存文件地址),也可填外部链接。
--   种子数据       把 App 里原先写死的三条教程(酒店预订 / 注册账号 / 取消订单)按三种语言各写一份(共 9 行),
--                  视频地址先统一用 pexels 示例视频,上线前由运营在后台换成自己的。
--   后台菜单       「内容管理 → 教程管理」及保存 / 删除按钮权限,与 ThemeController 同一套(config:tutorial:*)。
--
-- 幂等:建表 IF NOT EXISTS;种子与菜单都用固定主键 INSERT IGNORE(重复执行不会覆盖运营已改的内容)。

USE `mtrip_system`;

CREATE TABLE IF NOT EXISTS `app_tutorial` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category`     VARCHAR(20)  NOT NULL DEFAULT 'hotel' COMMENT '分类:hotel酒店 food餐饮 other其他',
  `lang`         VARCHAR(10)  NOT NULL DEFAULT 'all' COMMENT '语言:all=所有语言通用;en-US / zh-CN / my-MM',
  `title`        VARCHAR(150) NOT NULL COMMENT '标题',
  `description`  VARCHAR(300) NOT NULL DEFAULT '' COMMENT '简介',
  `cover_url`    VARCHAR(500) NOT NULL DEFAULT '' COMMENT '封面图(空=App 用默认封面)',
  `video_url`    VARCHAR(500) NOT NULL COMMENT '视频地址(后台上传的文件地址或外部链接)',
  `duration_sec` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '时长(秒)',
  `sort`         INT          NOT NULL DEFAULT 0 COMMENT '排序,越小越靠前',
  `status`       TINYINT      NOT NULL DEFAULT 2 COMMENT '状态:1上架 2下架',
  `created_by`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '创建人(管理员ID)',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_list` (`status`, `lang`, `category`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='App教程视频表';

INSERT IGNORE INTO `app_tutorial`
  (`id`, `category`, `lang`, `title`, `description`, `cover_url`, `video_url`, `duration_sec`, `sort`, `status`)
VALUES
(1, 'hotel', 'zh-CN', '观看酒店预订教程', '如何预订酒店', '', 'https://www.pexels.com/download/video/5961493/', 120, 1, 1),
(2, 'other', 'zh-CN', '注册账号', '如何注册账号', '', 'https://www.pexels.com/download/video/5961493/', 120, 2, 1),
(3, 'hotel', 'zh-CN', '取消订单', '如何取消我的订单', '', 'https://www.pexels.com/download/video/5961493/', 120, 3, 1),
(4, 'hotel', 'en-US', 'Watch the Hotel Booking Guide', 'How to book a hotel', '', 'https://www.pexels.com/download/video/5961493/', 120, 1, 1),
(5, 'other', 'en-US', 'Create an account', 'How to register an account', '', 'https://www.pexels.com/download/video/5961493/', 120, 2, 1),
(6, 'hotel', 'en-US', 'Cancel a booking', 'How to cancel my booking', '', 'https://www.pexels.com/download/video/5961493/', 120, 3, 1),
(7, 'hotel', 'my-MM', 'ဟိုတယ်မှာယူနည်း ကြည့်ရန်', 'ဟိုတယ်ဘယ်လိုမှာမလဲ', '', 'https://www.pexels.com/download/video/5961493/', 120, 1, 1),
(8, 'other', 'my-MM', 'အကောင့်ဖွင့်ရန်', 'အကောင့်ဘယ်လိုဖွင့်မလဲ', '', 'https://www.pexels.com/download/video/5961493/', 120, 2, 1),
(9, 'hotel', 'my-MM', 'မှာယူမှုပယ်ဖျက်ရန်', 'မှာယူမှုဘယ်လိုပယ်ဖျက်မလဲ', '', 'https://www.pexels.com/download/video/5961493/', 120, 3, 1);

INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `i18n_key`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`)
VALUES (1203, 1200, '教程管理', 'Tutorial Management', '', 'config:tutorial:list', 2, '/content/tutorial', 'content/tutorial/index', '', 3);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`)
VALUES (120301, 1203, '保存教程', 'Save', 'config:tutorial:save', 3, 1),
       (120302, 1203, '删除教程', 'Delete', 'config:tutorial:delete', 3, 2);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 1203), (1, 120301), (1, 120302);
