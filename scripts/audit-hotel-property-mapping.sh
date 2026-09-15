#!/usr/bin/env bash
# 只读盘点旧酒店商品与物业的显式映射，不做名称、地址或创建顺序推断。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -uo pipefail

OUTPUT=""
case "${1:-}" in
    "") ;;
    --output)
        [ $# -eq 2 ] || { echo "用法: $0 [--output <file>]" >&2; exit 2; }
        OUTPUT="$2"
        ;;
    -h|--help)
        echo "用法: $0 [--output <file>]"
        echo "当旧酒店商品退役门禁未通过时，报告仍会生成，脚本退出码为 1。"
        exit 0
        ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
esac
[ $# -le 2 ] || { echo "参数过多" >&2; exit 2; }

CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-}"
DOCKER="${DOCKER:-docker}"

fail() { echo "[FAIL] $*" >&2; }

if ! $DOCKER ps >/dev/null 2>&1; then
    fail "无法访问 docker"
    exit 1
fi
if ! $DOCKER ps --filter "name=${CONTAINER}" --filter "status=running" --format '{{.Names}}' | grep -qxF "$CONTAINER"; then
    fail "MySQL 容器 $CONTAINER 未运行"
    exit 1
fi
if [ -z "$ROOT_PWD" ]; then
    ROOT_PWD="$($DOCKER exec "$CONTAINER" printenv MYSQL_ROOT_PASSWORD 2>/dev/null)" \
        || { fail "无法从容器读取 MYSQL_ROOT_PASSWORD"; exit 1; }
fi
[ -n "$ROOT_PWD" ] || { fail "MYSQL_ROOT_PASSWORD 为空"; exit 1; }

mysql_query() {
    $DOCKER exec -e "MYSQL_PWD=${ROOT_PWD}" "$CONTAINER" \
        mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw \
        --init-command='SET SESSION TRANSACTION READ ONLY' mtrip_business -e "$1"
}

mapping_ctes() {
    cat <<'SQL'
WITH explicit_edges AS (
    SELECT 'ranking_listing' AS source_name, id AS source_id, site_id AS relation_site_id,
           merchant_id AS relation_merchant_id, property_id, goods_id
    FROM ranking_listing
    WHERE deleted_at IS NULL AND business_type = 'hotel'
      AND property_id IS NOT NULL AND goods_id IS NOT NULL
    UNION ALL
    SELECT 'merchant_store_goods', id, site_id, merchant_id, store_id, goods_id
    FROM merchant_store_goods
    WHERE deleted_at IS NULL
),
pairs AS (
    SELECT property_id, goods_id, GROUP_CONCAT(DISTINCT source_name ORDER BY source_name) AS sources
    FROM explicit_edges
    GROUP BY property_id, goods_id
),
property_degrees AS (
    SELECT property_id, COUNT(DISTINCT goods_id) AS goods_count
    FROM pairs
    GROUP BY property_id
),
goods_degrees AS (
    SELECT goods_id, COUNT(DISTINCT property_id) AS property_count
    FROM pairs
    GROUP BY goods_id
),
pair_status AS (
    SELECT p.property_id, p.goods_id, p.sources,
           pd.goods_count, gd.property_count,
           s.id IS NOT NULL AS property_exists,
           g.id IS NOT NULL AS goods_exists,
           s.site_id AS property_site_id, g.site_id AS goods_site_id,
           s.merchant_id AS property_merchant_id, g.merchant_id AS goods_merchant_id,
           s.business_type AS property_business_type, g.goods_type,
           SUM(CASE WHEN s.id IS NOT NULL AND g.id IS NOT NULL AND
                         (e.relation_site_id <> s.site_id OR e.relation_site_id <> g.site_id)
                    THEN 1 ELSE 0 END) AS source_site_mismatches,
           SUM(CASE WHEN s.id IS NOT NULL AND g.id IS NOT NULL AND
                         (e.relation_merchant_id <> s.merchant_id OR e.relation_merchant_id <> g.merchant_id)
                    THEN 1 ELSE 0 END) AS source_merchant_mismatches
    FROM pairs p
    JOIN explicit_edges e ON e.property_id = p.property_id AND e.goods_id = p.goods_id
    LEFT JOIN property_degrees pd ON pd.property_id = p.property_id
    LEFT JOIN goods_degrees gd ON gd.goods_id = p.goods_id
    LEFT JOIN merchant_store s ON s.id = p.property_id AND s.deleted_at IS NULL
    LEFT JOIN goods_info g ON g.id = p.goods_id AND g.deleted_at IS NULL
    GROUP BY p.property_id, p.goods_id, p.sources, pd.goods_count, gd.property_count,
             s.id, g.id, s.site_id, g.site_id, s.merchant_id, g.merchant_id,
             s.business_type, g.goods_type
),
valid_pairs AS (
    SELECT *
    FROM pair_status
    WHERE goods_count = 1 AND property_count = 1
      AND property_exists = 1 AND goods_exists = 1 AND goods_type = 1
      AND property_site_id = goods_site_id
      AND property_merchant_id = goods_merchant_id
      AND source_site_mismatches = 0 AND source_merchant_mismatches = 0
)
SQL
}

query_with_mapping() {
    local body="$1"
    mysql_query "$(mapping_ctes)
$body"
}

TMP_REPORT="$(mktemp "${TMPDIR:-/tmp}/mtrip-hotel-property-audit.XXXXXX")" || exit 1
trap 'rm -f "$TMP_REPORT"' EXIT

SUMMARY_SQL="$(cat <<'SQL'
SELECT 'valid_explicit_mappings', COUNT(*), 0 FROM valid_pairs
UNION ALL
SELECT 'hotel_properties', COUNT(*), 0
FROM merchant_store s
WHERE s.deleted_at IS NULL AND (
    s.business_type = 'hotel'
    OR EXISTS (SELECT 1 FROM pair_status p WHERE p.property_id = s.id AND p.goods_type = 1)
)
UNION ALL
SELECT 'property_only', COUNT(*), 0
FROM merchant_store s
WHERE s.deleted_at IS NULL AND s.business_type = 'hotel'
  AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.property_id = s.id)
UNION ALL
SELECT 'hotel_goods', COUNT(*), 0 FROM goods_info g WHERE g.deleted_at IS NULL AND g.goods_type = 1
UNION ALL
SELECT 'hotel_goods_only', COUNT(*), 1
FROM goods_info g
WHERE g.deleted_at IS NULL AND g.goods_type = 1
  AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.goods_id = g.id)
UNION ALL
SELECT 'invalid_explicit_pairs', COUNT(*), 1
FROM pair_status p
WHERE NOT EXISTS (
    SELECT 1 FROM valid_pairs v WHERE v.property_id = p.property_id AND v.goods_id = p.goods_id
)
UNION ALL
SELECT 'duplicate_property_mappings', COUNT(*), 1 FROM property_degrees WHERE goods_count > 1
UNION ALL
SELECT 'duplicate_goods_mappings', COUNT(*), 1 FROM goods_degrees WHERE property_count > 1
UNION ALL
SELECT 'cross_site_pairs', COUNT(*), 1
FROM pair_status
WHERE property_exists = 1 AND goods_exists = 1
  AND (property_site_id <> goods_site_id OR source_site_mismatches > 0)
UNION ALL
SELECT 'cross_merchant_pairs', COUNT(*), 1
FROM pair_status
WHERE property_exists = 1 AND goods_exists = 1
  AND (property_merchant_id <> goods_merchant_id OR source_merchant_mismatches > 0)
UNION ALL
SELECT 'missing_entity_pairs', COUNT(*), 1
FROM pair_status WHERE property_exists = 0 OR goods_exists = 0 OR goods_type <> 1
UNION ALL
SELECT 'property_type_mismatches', COUNT(*), 0
FROM valid_pairs WHERE property_business_type <> 'hotel'
UNION ALL
SELECT 'unmapped_room_types', COUNT(*), 1
FROM hotel_room_type r
WHERE r.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM valid_pairs v WHERE v.goods_id = r.goods_id)
UNION ALL
SELECT 'unmapped_hotel_orders', COUNT(*), 1
FROM order_main o
WHERE o.deleted_at IS NULL AND o.order_type = 1
  AND NOT EXISTS (SELECT 1 FROM valid_pairs v WHERE v.goods_id = o.goods_id)
UNION ALL
SELECT 'unclassified_stores', COUNT(*), 0
FROM merchant_store s
WHERE s.deleted_at IS NULL AND COALESCE(s.business_type, '') = ''
  AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.property_id = s.id)
ORDER BY 1;
SQL
)"

SUMMARY="$(query_with_mapping "$SUMMARY_SQL")" || { fail "无法查询映射摘要"; exit 1; }
GENERATED_AT="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
GATE_BLOCKERS=0

{
    echo "# 酒店商品→物业映射审计报告"
    echo
    echo "> 生成时间：${GENERATED_AT}  "
    echo "> 数据库：\`mtrip_business\`  "
    echo "> 映射来源：\`ranking_listing(property_id, goods_id)\` 与 \`merchant_store_goods(store_id, goods_id)\`  "
    echo "> 原则：仅认可显式 ID 关系，不使用名称、地址、主门店标记或创建顺序推断。"
    echo
    echo "## 全局摘要"
    echo
    echo "| 指标 | 数量 | 退役门禁 |"
    echo "|---|---:|---|"
    while IFS=$'\t' read -r metric count blocks; do
        [ -n "$metric" ] || continue
        if [ "$blocks" = "1" ] && [ "$count" -gt 0 ]; then
            gate_text="阻断"
            GATE_BLOCKERS=$((GATE_BLOCKERS + count))
        elif [ "$blocks" = "1" ]; then
            gate_text="通过"
        else
            gate_text="信息"
        fi
        printf '| `%s` | %s | %s |\n' "$metric" "$count" "$gate_text"
    done <<< "$SUMMARY"
} > "$TMP_REPORT"

SITE_SQL="$(cat <<'SQL'
, site_universe AS (
    SELECT site_id FROM merchant_store WHERE deleted_at IS NULL
    UNION
    SELECT site_id FROM goods_info WHERE deleted_at IS NULL AND goods_type = 1
    UNION
    SELECT property_site_id FROM pair_status WHERE property_site_id IS NOT NULL
    UNION
    SELECT goods_site_id FROM pair_status WHERE goods_site_id IS NOT NULL
)
SELECT u.site_id,
       (SELECT COUNT(*) FROM merchant_store s WHERE s.deleted_at IS NULL AND s.site_id = u.site_id
          AND (s.business_type = 'hotel' OR EXISTS (
              SELECT 1 FROM pair_status p WHERE p.property_id = s.id AND p.goods_type = 1
          ))) AS hotel_properties,
       (SELECT COUNT(*) FROM goods_info g WHERE g.deleted_at IS NULL AND g.goods_type = 1 AND g.site_id = u.site_id) AS hotel_goods,
       (SELECT COUNT(*) FROM valid_pairs v WHERE v.property_site_id = u.site_id) AS valid_mappings,
       (SELECT COUNT(*) FROM merchant_store s WHERE s.deleted_at IS NULL AND s.business_type = 'hotel'
          AND s.site_id = u.site_id AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.property_id = s.id)) AS property_only,
       (SELECT COUNT(*) FROM goods_info g WHERE g.deleted_at IS NULL AND g.goods_type = 1
          AND g.site_id = u.site_id AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.goods_id = g.id)) AS goods_only,
       (SELECT COUNT(*) FROM hotel_room_type r WHERE r.deleted_at IS NULL AND r.site_id = u.site_id
          AND NOT EXISTS (SELECT 1 FROM valid_pairs v WHERE v.goods_id = r.goods_id)) AS unmapped_rooms,
       (SELECT COUNT(*) FROM order_main o WHERE o.deleted_at IS NULL AND o.order_type = 1
          AND o.site_id = u.site_id AND NOT EXISTS (SELECT 1 FROM valid_pairs v WHERE v.goods_id = o.goods_id)) AS unmapped_orders,
       (SELECT COUNT(*) FROM merchant_store s WHERE s.deleted_at IS NULL AND s.site_id = u.site_id
          AND COALESCE(s.business_type, '') = ''
          AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.property_id = s.id)) AS unclassified_stores
FROM site_universe u
ORDER BY u.site_id;
SQL
)"
SITE_ROWS="$(query_with_mapping "$SITE_SQL")" || { fail "无法查询分站点摘要"; exit 1; }
{
    echo
    echo "## 分站点摘要"
    echo
    echo "| 站点 ID | 酒店物业 | 旧酒店商品 | 有效映射 | 仅物业 | 仅商品 | 未映射房型 | 未映射酒店订单 | 未分类门店 |"
    echo "|---:|---:|---:|---:|---:|---:|---:|---:|---:|"
    if [ -z "$SITE_ROWS" ]; then
        echo "| - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |"
    else
        while IFS=$'\t' read -r site_id properties goods valid property_only goods_only rooms orders unclassified; do
            printf '| %s | %s | %s | %s | %s | %s | %s | %s | %s |\n' \
                "$site_id" "$properties" "$goods" "$valid" "$property_only" "$goods_only" "$rooms" "$orders" "$unclassified"
        done <<< "$SITE_ROWS"
    fi
} >> "$TMP_REPORT"

emit_detail() {
    local title="$1" header="$2" empty_text="$3" sql="$4" rows
    rows="$(query_with_mapping "$sql")" || { fail "无法查询明细: $title"; exit 1; }
    {
        echo
        echo "## $title"
        echo
        if [ -z "$rows" ]; then
            echo "$empty_text"
        else
            echo "$header"
            echo "|---|---|---|---|---|---|"
            while IFS=$'\t' read -r c1 c2 c3 c4 c5 c6; do
                printf '| %s | %s | %s | %s | %s | %s |\n' \
                    "${c1:--}" "${c2:--}" "${c3:--}" "${c4:--}" "${c5:--}" "${c6:--}"
            done <<< "$rows"
        fi
    } >> "$TMP_REPORT"
}

emit_detail "有效显式一对一映射" \
    "| 物业 ID | 酒店商品 ID | 站点 ID | 商户 ID | 映射来源 | 物业业态 |" \
    "无有效显式映射。" \
    "SELECT property_id, goods_id, property_site_id, property_merchant_id, sources,
            COALESCE(NULLIF(property_business_type, ''), '(blank)')
     FROM valid_pairs ORDER BY property_site_id, property_id, goods_id;"

emit_detail "仅物业" \
    "| 物业 ID | 站点 ID | 商户 ID | 业态 | 占位 | 占位 |" \
    "无已标注为酒店但没有旧商品映射的物业。" \
    "SELECT s.id, s.site_id, s.merchant_id, s.business_type, '-', '-'
     FROM merchant_store s
     WHERE s.deleted_at IS NULL AND s.business_type = 'hotel'
       AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.property_id = s.id)
     ORDER BY s.site_id, s.id;"

emit_detail "仅旧酒店商品" \
    "| 酒店商品 ID | 站点 ID | 商户 ID | 商品状态 | 占位 | 占位 |" \
    "无未映射的旧酒店商品。" \
    "SELECT g.id, g.site_id, g.merchant_id, g.status, '-', '-'
     FROM goods_info g
     WHERE g.deleted_at IS NULL AND g.goods_type = 1
       AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.goods_id = g.id)
     ORDER BY g.site_id, g.id;"

emit_detail "冲突或无效显式关系" \
    "| 物业 ID | 酒店商品 ID | 物业站点/商户 | 商品站点/商户 | 来源 | 原因 |" \
    "无重复、跨站点、跨商户、缺失实体或非酒店关系。" \
    "SELECT p.property_id, p.goods_id,
            CONCAT(COALESCE(p.property_site_id, '-'), '/', COALESCE(p.property_merchant_id, '-')),
            CONCAT(COALESCE(p.goods_site_id, '-'), '/', COALESCE(p.goods_merchant_id, '-')),
            p.sources,
            CONCAT_WS(',',
                IF(p.goods_count > 1, 'property-to-many-goods', NULL),
                IF(p.property_count > 1, 'goods-to-many-properties', NULL),
                IF(p.property_exists = 0, 'missing-property', NULL),
                IF(p.goods_exists = 0, 'missing-goods', NULL),
                IF(p.goods_exists = 1 AND p.goods_type <> 1, 'non-hotel-goods', NULL),
                IF(p.property_exists = 1 AND p.goods_exists = 1 AND p.property_site_id <> p.goods_site_id, 'cross-site', NULL),
                IF(p.source_site_mismatches > 0, 'source-site-mismatch', NULL),
                IF(p.property_exists = 1 AND p.goods_exists = 1 AND p.property_merchant_id <> p.goods_merchant_id, 'cross-merchant', NULL),
                IF(p.source_merchant_mismatches > 0, 'source-merchant-mismatch', NULL)
            )
     FROM pair_status p
     WHERE NOT EXISTS (SELECT 1 FROM valid_pairs v
                       WHERE v.property_id = p.property_id AND v.goods_id = p.goods_id)
     ORDER BY COALESCE(p.property_site_id, p.goods_site_id), p.property_id, p.goods_id;"

emit_detail "未映射的房型" \
    "| 房型 ID | 站点 ID | 旧酒店商品 ID | 房型状态 | 占位 | 占位 |" \
    "无未能解析到唯一物业的房型。" \
    "SELECT r.id, r.site_id, r.goods_id, r.status, '-', '-'
     FROM hotel_room_type r
     WHERE r.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM valid_pairs v WHERE v.goods_id = r.goods_id)
     ORDER BY r.site_id, r.id;"

emit_detail "未映射的酒店订单" \
    "| 订单 ID | 站点 ID | 商户 ID | 旧酒店商品 ID | 订单状态 | 占位 |" \
    "无未能解析到唯一物业的酒店订单。" \
    "SELECT o.id, o.site_id, o.merchant_id, o.goods_id, o.order_status, '-'
     FROM order_main o
     WHERE o.deleted_at IS NULL AND o.order_type = 1
       AND NOT EXISTS (SELECT 1 FROM valid_pairs v WHERE v.goods_id = o.goods_id)
     ORDER BY o.site_id, o.id;"

UNCLASSIFIED_SQL="$(cat <<'SQL'
SELECT s.id, s.site_id, s.merchant_id, '-', '-', '-'
FROM merchant_store s
WHERE s.deleted_at IS NULL AND COALESCE(s.business_type, '') = ''
  AND NOT EXISTS (SELECT 1 FROM pair_status p WHERE p.property_id = s.id)
ORDER BY s.site_id, s.id;
SQL
)"
emit_detail "未分类门店（不自动当作酒店）" \
    "| 门店 ID | 站点 ID | 商户 ID | 占位 | 占位 | 占位 |" \
    "无未分类门店。" "$UNCLASSIFIED_SQL"

{
    echo
    echo "## 退役门禁"
    echo
    if [ "$GATE_BLOCKERS" -eq 0 ]; then
        echo "**PASS**：旧酒店商品未映射、映射冲突、未映射房型和未映射酒店订单均为 0。"
    else
        echo "**BLOCKED**：共命中 ${GATE_BLOCKERS} 个阻断计数（类别可重叠）。在人工确认并清零前，不得归档或删除旧酒店商品。"
    fi
    echo
    echo "\`property_type_mismatches\` 可依已确定的酒店映射回填为 \`hotel\`；\`unclassified_stores\` 没有明确酒店证据，本报告不自动将其认定为酒店物业。"
} >> "$TMP_REPORT"

if [ -n "$OUTPUT" ]; then
    mkdir -p "$(dirname "$OUTPUT")"
    cp "$TMP_REPORT" "$OUTPUT"
else
    cat "$TMP_REPORT"
fi

[ "$GATE_BLOCKERS" -eq 0 ]
