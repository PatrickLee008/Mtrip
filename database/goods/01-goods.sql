-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 业务表 04:商品(文档 5.2.3 + 业务模块4:酒店房型/门票票种/分时库存)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 商品分类表(酒店分类/景区分类,各站点独立)
CREATE TABLE IF NOT EXISTS `goods_category` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `parent_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '父分类ID,0=根',
  `category_name` VARCHAR(50)  NOT NULL COMMENT '分类名称',
  `goods_type`    TINYINT      NOT NULL DEFAULT 1 COMMENT '适用商品类型:1酒店 2门票',
  `icon`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '分类图标',
  `sort`          INT          NOT NULL DEFAULT 0 COMMENT '排序号',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1显示 2隐藏',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商品分类表';

-- 商品表(严格按文档 5.2.3,酒店与门票共用)
CREATE TABLE IF NOT EXISTS `goods_info` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户ID',
  `supplier_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '供应商ID',
  `goods_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '商品类型:1酒店 2门票',
  `category_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '分类ID',
  `goods_name`   VARCHAR(200) NOT NULL COMMENT '商品名称',
  `goods_brief`  VARCHAR(500) NOT NULL DEFAULT '' COMMENT '商品简介',
  `goods_detail` TEXT         NULL COMMENT '商品详情(富文本)',
  `cover_image`  VARCHAR(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `images`       JSON         NULL COMMENT '图集',
  `address`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '地址',
  `longitude`    DECIMAL(10,7) NULL DEFAULT NULL COMMENT '经度',
  `latitude`     DECIMAL(10,7) NULL DEFAULT NULL COMMENT '纬度',
  `star_level`   TINYINT      NOT NULL DEFAULT 0 COMMENT '星级/等级',
  `facilities`   JSON         NULL COMMENT '配套设施标签',
  `open_time`    VARCHAR(100) NOT NULL DEFAULT '' COMMENT '开放时间/入住时间',
  `close_time`   VARCHAR(100) NOT NULL DEFAULT '' COMMENT '关闭时间/退房时间',
  `status`       TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0草稿 1待审核 2审核驳回 3已上架 4已下架 5已删除',
  `audit_remark` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '审核备注',
  `audit_by`     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '审核人ID',
  `audit_time`   DATETIME     NULL DEFAULT NULL COMMENT '审核时间',
  `sort_weight`  INT          NOT NULL DEFAULT 0 COMMENT '排序权重',
  `is_recommend` TINYINT      NOT NULL DEFAULT 0 COMMENT '是否推荐:0否 1是',
  `is_hot`       TINYINT      NOT NULL DEFAULT 0 COMMENT '是否热门:0否 1是',
  `sales_count`  INT          NOT NULL DEFAULT 0 COMMENT '销量(冗余)',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_goods_type` (`goods_type`),
  KEY `idx_status` (`status`),
  KEY `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商品表';

-- 酒店房型表
CREATE TABLE IF NOT EXISTS `hotel_room_type` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `goods_id`     BIGINT UNSIGNED NOT NULL COMMENT '所属酒店商品ID',
  `room_name`    VARCHAR(100) NOT NULL COMMENT '房型名称',
  `bed_type`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '床型(大床/双床等)',
  `area`         VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '面积(㎡)',
  `max_guests`   TINYINT      NOT NULL DEFAULT 2 COMMENT '最大入住人数',
  `breakfast`    TINYINT      NOT NULL DEFAULT 0 COMMENT '早餐:0无早 1单早 2双早',
  `base_price`   DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '基础门市价',
  `base_stock`   INT          NOT NULL DEFAULT 0 COMMENT '基础每日库存',
  `images`       JSON         NULL COMMENT '房型图片',
  `facilities`   JSON         NULL COMMENT '房型设施',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '售卖状态:1在售 2停售',
  `sort`         INT          NOT NULL DEFAULT 0 COMMENT '排序号',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_goods_id` (`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='酒店房型表';

-- 门票票种表
CREATE TABLE IF NOT EXISTS `ticket_type` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `goods_id`      BIGINT UNSIGNED NOT NULL COMMENT '所属景区商品ID',
  `ticket_name`   VARCHAR(100) NOT NULL COMMENT '票种名称',
  `ticket_kind`   TINYINT      NOT NULL DEFAULT 1 COMMENT '票种类型:1普通票 2分时票 3套票',
  `base_price`    DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '基础门市价',
  `base_stock`    INT          NOT NULL DEFAULT 0 COMMENT '基础每日库存',
  `time_slots`    JSON         NULL COMMENT '分时时段配置(分时票)',
  `valid_days`    INT          NOT NULL DEFAULT 1 COMMENT '有效天数(自使用日期起)',
  `book_limit`    INT          NOT NULL DEFAULT 0 COMMENT '单人限购数量,0=不限',
  `advance_hours` INT          NOT NULL DEFAULT 0 COMMENT '提前预订小时数',
  `verify_times`  INT          NOT NULL DEFAULT 1 COMMENT '单票可核销次数',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '售卖状态:1在售 2停售',
  `sort`          INT          NOT NULL DEFAULT 0 COMMENT '排序号',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_goods_id` (`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='门票票种表';

-- 分时库存价格日历表(房型/票种 × 日期)
CREATE TABLE IF NOT EXISTS `goods_daily_stock` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `goods_id`    BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  `sku_type`    TINYINT      NOT NULL DEFAULT 1 COMMENT 'SKU类型:1房型 2票种',
  `sku_id`      BIGINT UNSIGNED NOT NULL COMMENT '房型ID/票种ID',
  `stock_date`  DATE         NOT NULL COMMENT '库存日期',
  `price`       DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '当日售价',
  `stock_total` INT          NOT NULL DEFAULT 0 COMMENT '当日总库存',
  `stock_sold`  INT          NOT NULL DEFAULT 0 COMMENT '当日已售',
  `stock_locked` INT         NOT NULL DEFAULT 0 COMMENT '当日锁定(待支付占用)',
  `is_closed`   TINYINT      NOT NULL DEFAULT 0 COMMENT '当日是否关房/停售:0否 1是',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sku_date` (`sku_type`, `sku_id`, `stock_date`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_goods_id` (`goods_id`),
  KEY `idx_stock_date` (`stock_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='分时库存价格日历表';

-- 退改规则表
CREATE TABLE IF NOT EXISTS `goods_refund_rule` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `goods_id`    BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  `sku_type`    TINYINT      NOT NULL DEFAULT 0 COMMENT 'SKU类型:0商品级 1房型 2票种',
  `sku_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '房型ID/票种ID,0=商品级规则',
  `rule_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '规则类型:1免费取消 2阶梯退款 3不可退',
  `rules`       JSON         NULL COMMENT '阶梯规则([{hours_before,refund_rate}])',
  `remark`      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '规则说明(C端展示)',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_goods_id` (`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商品退改规则表';

-- 库存变动流水表
CREATE TABLE IF NOT EXISTS `goods_stock_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `goods_id`    BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  `sku_type`    TINYINT      NOT NULL DEFAULT 1 COMMENT 'SKU类型:1房型 2票种',
  `sku_id`      BIGINT UNSIGNED NOT NULL COMMENT '房型ID/票种ID',
  `stock_date`  DATE         NOT NULL COMMENT '库存日期',
  `change_type` TINYINT      NOT NULL DEFAULT 1 COMMENT '变动类型:1下单锁定 2支付扣减 3取消释放 4退款回补 5手动调整',
  `change_qty`  INT          NOT NULL DEFAULT 0 COMMENT '变动数量(正增负减)',
  `order_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联订单ID',
  `operator_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID(手动调整时)',
  `remark`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_sku` (`sku_type`, `sku_id`, `stock_date`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='库存变动流水表';
