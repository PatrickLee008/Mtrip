-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 商户管理整改 Phase C]:Marketplace Ranking
-- 需求源:docs/redesign/需求分析-商户管理模块.md §3.9(Listing Ranking / Popular Destinations)
-- 库:mtrip_business;demo 种子仅为原型演示数据(site_id=0),真实数据上线前按站点清空重灌
-- ============================================================
USE `mtrip_business`;

-- 商家/房源排名条目(Listing Ranking)
CREATE TABLE IF NOT EXISTS `ranking_listing` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `business_type`    VARCHAR(30)  NOT NULL DEFAULT 'hotel' COMMENT '业态:hotel/restaurant',
  `business_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '业务对象ID(商品/房源,0=演示名)',
  `business_name`    VARCHAR(150) NOT NULL DEFAULT '' COMMENT '展示名称',
  `merchant_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联商户ID',
  `merchant_name`    VARCHAR(100) NOT NULL DEFAULT '' COMMENT '商户名(快照)',
  `city`             VARCHAR(100) NOT NULL DEFAULT '' COMMENT '城市',
  `price_from`       DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '起价(站点货币,演示数据)',
  `rating`           DECIMAL(3,2) NOT NULL DEFAULT 0.00 COMMENT '评分(0-5)',
  `rank`             INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序(1起,小=前)',
  `featured`         TINYINT      NOT NULL DEFAULT 0 COMMENT '置顶/精选:0否 1是',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1Active 2Inactive',
  `published_version` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已发布版本号(发布机制 C5)',
  `publisher_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '最近发布人ID',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`       DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_type_city` (`site_id`, `business_type`, `city`),
  KEY `idx_site_rank` (`site_id`, `rank`),
  KEY `idx_site_status` (`site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='市场排名-商家条目(整改 Phase C)';

-- 热门目的地条目(Popular Destinations)
CREATE TABLE IF NOT EXISTS `ranking_destination` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`           BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `name`              VARCHAR(100) NOT NULL COMMENT '目的地名称',
  `region`            VARCHAR(100) NOT NULL DEFAULT '' COMMENT '区域/省邦',
  `tagline`           VARCHAR(200) NOT NULL DEFAULT '' COMMENT '副标题',
  `image_url`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '图片URL',
  `rank`              INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序(1起,小=前)',
  `featured`          TINYINT      NOT NULL DEFAULT 0 COMMENT '置顶/精选:0否 1是',
  `status`            TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1Active 2Hidden',
  `published_version` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已发布版本号(发布机制 C5)',
  `last_updated_by`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '最近操作人ID',
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`        DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_region` (`site_id`, `region`),
  KEY `idx_site_rank` (`site_id`, `rank`),
  KEY `idx_site_status` (`site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='市场排名-热门目的地(整改 Phase C)';

-- 排名操作审计(谁在何时做了 pin/重排/新增/发布/状态变更)
CREATE TABLE IF NOT EXISTS `ranking_history` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `entity_type`   VARCHAR(20)  NOT NULL DEFAULT 'listing' COMMENT '实体类型:listing/destination',
  `entity_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '实体ID',
  `entity_name`   VARCHAR(150) NOT NULL DEFAULT '' COMMENT '实体名(快照)',
  `action`        VARCHAR(30)  NOT NULL COMMENT '动作:pin/unpin/reorder/add/update/publish/status_change',
  `from_rank`     INT          NOT NULL DEFAULT 0 COMMENT '原排名(0=无)',
  `to_rank`       INT          NOT NULL DEFAULT 0 COMMENT '新排名',
  `note`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '说明',
  `operator_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID',
  `operator_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '操作人姓名(快照)',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_entity` (`site_id`, `entity_type`, `entity_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='市场排名操作审计(整改 Phase C)';

-- Demo 种子:Listing(Yangon 6 家酒店,原型 §3.9.2)
INSERT INTO `ranking_listing` (`site_id`, `business_type`, `business_id`, `business_name`, `merchant_id`, `merchant_name`, `city`, `price_from`, `rating`, `rank`, `featured`, `status`, `published_version`)
VALUES
  (0,'hotel',0,'Grand Palace Hotel',0,'Grand Palace Group','Yangon',180000.00,4.80,1,1,1,1),
  (0,'hotel',0,'River View Resort',0,'RV Hospitality','Yangon',145000.00,4.70,2,0,1,1),
  (0,'hotel',0,'Traders Hotel Yangon',0,'Traders Holdings','Yangon',210000.00,4.60,3,0,1,1),
  (0,'hotel',0,'Chatrium Hotel Royal Lake',0,'Chatrium Group','Yangon',195000.00,4.50,4,0,1,1),
  (0,'hotel',0,'City Inn Yangon',0,'City Hospitality','Yangon',85000.00,4.30,5,0,1,1),
  (0,'hotel',0,'Savoy Hotel',0,'Savoy Group Myanmar','Yangon',120000.00,4.20,6,0,1,1);

-- Demo 种子:Destinations(8 个,原型 §3.9.3)
INSERT INTO `ranking_destination` (`site_id`, `name`, `region`, `tagline`, `rank`, `featured`, `status`, `published_version`)
VALUES
  (0,'Yangon','Yangon Region','The Golden City',1,1,1,1),
  (0,'Bagan','Mandalay Region','Land of Ancient Temples',2,1,1,1),
  (0,'Inle Lake','Shan State','Serenity on the Water',3,0,1,1),
  (0,'Mandalay','Mandalay Region','Royal Heritage City',4,0,1,1),
  (0,'Ngapali Beach','Rakhine State','Paradise on the Bay of Bengal',5,0,1,1),
  (0,'Naypyidaw','Naypyidaw','The Capital City',6,0,1,1),
  (0,'Kyaiktiyo (Golden Rock)','Mon State','Pilgrimage & Panoramic Views',7,0,1,1),
  (0,'Mrauk U','Rakhine State','Hidden Kingdom of the West',8,0,2,1);
