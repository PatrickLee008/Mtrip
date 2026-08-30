#!/usr/bin/env python3
"""校验 test/sql 下的 INSERT 列名是否与线上 schema 一致。

连接开发库读取每张表的真实列,解析 SQL 里的 INSERT 语句,
报告不存在的列名 / 表名 / 被省略的 NOT NULL 无默认值列。
"""
import os
import re
import sys
import pymysql

ROOT = os.path.dirname(os.path.abspath(__file__))
SQL_DIR = os.path.join(ROOT, "sql")

DB_CONF = dict(
    host="127.0.0.1", port=3307, user="root", password="root@2026", charset="utf8mb4"
)


def get_columns():
    cols = {}
    for db in ("mtrip_system", "mtrip_business"):
        c = pymysql.connect(db=db, **DB_CONF).cursor()
        c.execute(
            "SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, "
            "GENERATION_EXPRESSION "
            "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s",
            (db,),
        )
        for tbl, col, nullable, default, extra, gen in c.fetchall():
            cols.setdefault(f"{db}.{tbl}", {})[col] = (
                nullable == "YES",
                default is not None,
                "auto_increment" in (extra or "").lower(),
                bool(gen),  # 是否 GENERATED 列(禁止手动 INSERT)
            )
        c.connection.close()
    return cols


INSERT_RE = re.compile(
    r"INSERT\s+INTO\s+`?(?P<tbl>[a-zA-Z0-9_]+)`?\s*\((?P<cols>[^)]*)\)\s*VALUES",
    re.IGNORECASE,
)


def parse_sql_files(cols):
    problems = []
    for fn in sorted(os.listdir(SQL_DIR)):
        if not fn.endswith(".sql") or fn.startswith("00-"):
            continue
        path = os.path.join(SQL_DIR, fn)
        text = open(path, encoding="utf8").read()
        for m in INSERT_RE.finditer(text):
            tbl = m.group("tbl")
            col_list = [x.strip().strip("`") for x in m.group("cols").split(",")]
            key = None
            for db in ("mtrip_system", "mtrip_business"):
                if f"{db}.{tbl}" in cols:
                    key = f"{db}.{tbl}"
                    break
            if key is None:
                problems.append(f"[{fn}] 未知表 `{tbl}`")
                continue
            schema = cols[key]
            for col in col_list:
                if col not in schema:
                    problems.append(f"[{fn}] 表 `{tbl}` 不存在列 `{col}`")
                elif schema[col][3]:
                    problems.append(
                        f"[{fn}] 表 `{tbl}` 的列 `{col}` 为 GENERATED 列,禁止手动 INSERT"
                    )
            # 检查被省略的 NOT NULL 且无默认值的列
            for col, (nullable, has_default, auto_inc, generated) in schema.items():
                if col not in col_list and not nullable and not has_default and not auto_inc:
                    problems.append(
                        f"[{fn}] 表 `{tbl}` 的列 `{col}` 为 NOT NULL 且无默认值,但 INSERT 未提供"
                    )
    return problems


def main():
    try:
        cols = get_columns()
    except Exception as e:
        print("连接数据库失败:", e)
        sys.exit(2)
    problems = parse_sql_files(cols)
    if problems:
        print(f"发现 {len(problems)} 处列名/表名不匹配:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print(f"校验通过:共 {len(cols)} 张表,所有 INSERT 列名均与 schema 一致。")


if __name__ == "__main__":
    main()
