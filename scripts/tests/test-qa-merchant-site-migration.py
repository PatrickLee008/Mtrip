#!/usr/bin/env python3
"""Exercise the exact QA repair in disposable schema clones, never source data."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
ORIGINAL_MIGRATION = ROOT / 'database/migrations/V20261119073300__move-qa-merchant-7014-to-yangon.sql'
MIGRATION = ROOT / 'database/migrations/V20261119090000__recover-qa-merchant-site-notification-reads.sql'
DOCKER = os.environ.get('DOCKER', 'docker')
CONTAINER = os.environ.get('MYSQL_CONTAINER', 'mtrip-mysql-1')
SOURCE_BUSINESS = os.environ.get('DB_BUSINESS_DATABASE', 'mtrip_business')
SOURCE_SYSTEM = os.environ.get('DB_SYSTEM_DATABASE', 'mtrip_system')
TEST_BUSINESS = f'mtrip_qa7014_test_{os.getpid()}'
TEST_SYSTEM = f'mtrip_qa7014_system_test_{os.getpid()}'
PASSWORD = os.environ.get('MYSQL_ROOT_PASSWORD') or subprocess.check_output(
    [DOCKER, 'exec', CONTAINER, 'printenv', 'MYSQL_ROOT_PASSWORD'], text=True).strip()
CREATED = []
PASSED = 0


def sql(statement, allow_failure=False):
    result = subprocess.run([
        DOCKER, 'exec', '-i', '-e', f'MYSQL_PWD={PASSWORD}', CONTAINER,
        'mysql', '-uroot', '--default-character-set=utf8mb4', '--batch', '--raw', '--skip-column-names',
    ], input=('SET NAMES utf8mb4;\n' + statement).encode('utf-8'), capture_output=True)
    if result.returncode and not allow_failure:
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
    return result.returncode, result.stdout.decode('utf-8'), result.stderr.decode('utf-8', errors='replace')


def scalar(statement):
    return sql(statement)[1].strip()


def literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    return "CONVERT(0x%s USING utf8mb4)" % str(value).encode('utf-8').hex() if value else "''"


def check(condition, message):
    global PASSED
    if not condition:
        raise AssertionError(message)
    PASSED += 1
    print(f'PASS: {message}', flush=True)


def rewrite(text):
    return text.replace('mtrip_business', TEST_BUSINESS).replace('mtrip_system', TEST_SYSTEM)


MIGRATION_SQL = rewrite(MIGRATION.read_text(encoding='utf-8-sig'))
PLAN = re.findall(r"\('([a-z_]+)','", MIGRATION_SQL.split('INSERT INTO qa_7014_plan(table_name,predicate_sql) VALUES', 1)[1].split(';', 1)[0])
METADATA = {}


def insert(table, values, database=TEST_BUSINESS):
    columns = METADATA[(database, table)]
    fields = dict(values)
    for name, data_type, nullable, default_value, extra in columns:
        if name in fields or nullable == 'YES' or default_value != '[NULL]' or 'auto_increment' in extra or 'GENERATED' in extra:
            continue
        if data_type in ('tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'decimal', 'float', 'double', 'bit'):
            fields[name] = 0
        elif data_type in ('date', 'datetime', 'timestamp'):
            fields[name] = '2026-11-19 00:00:00' if data_type != 'date' else '2026-11-19'
        elif data_type == 'json':
            fields[name] = '[]'
        else:
            fields[name] = 'fixture'
    valid = {column[0] for column in columns}
    fields = {key: value for key, value in fields.items() if key in valid}
    return f"INSERT INTO `{database}`.`{table}` ({','.join('`'+key+'`' for key in fields)}) VALUES ({','.join(literal(value) for value in fields.values())});"


def fixture():
    tables = set(PLAN) | {'merchant_admin_role', 'merchant_role_menu', 'merchant_onboarding_agreement', 'merchant_notify_read', 'merchant_notify_delivery', 'order_main', 'marketing_coupon', 'ranking_market'}
    tables.add('migration_merchant_site_backup')
    existing = set(scalar(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{TEST_BUSINESS}';").splitlines())
    statements = [f'USE `{TEST_BUSINESS}`;', 'DROP TRIGGER IF EXISTS qa_7014_fail_update;', 'DROP TABLE IF EXISTS qa_future_merchant_dependency;']
    statements += ['START TRANSACTION;']
    statements += [f'DELETE FROM `{table}`;' for table in sorted(tables & existing)]
    statements += [f'DELETE FROM `{TEST_SYSTEM}`.sys_site;', f'DELETE FROM `{TEST_SYSTEM}`.sys_file;']
    statements += [insert('sys_site', {'id': 1, 'site_name': 'Global', 'status': 2, 'country_code': ''}, TEST_SYSTEM),
                   insert('sys_site', {'id': 7, 'site_name': 'Yangon', 'status': 1, 'country_code': 'MM'}, TEST_SYSTEM),
                   insert('sys_file', {'id': 999001, 'site_id': 1, 'file_name': 'audit-original.png', 'file_url': '/fixture.png'}, TEST_SYSTEM)]
    for index, table in enumerate(PLAN):
        names = {column[0] for column in METADATA[(TEST_BUSINESS, table)]}
        fields = {'id': 85020 + index, 'site_id': 1}
        for name, value in {'merchant_id': 7014, 'property_id': 7522, 'store_id': 7522, 'application_id': 1041,
                            'application_business_id': 2080, 'admin_id': 4716, 'account_id': 4716,
                            'target_account_id': 4716, 'recipient_id': 4716, 'doc_id': 85027,
                            'room_id': 7021, 'sku_id': 7021, 'sku_type': 1}.items():
            if name in names:
                fields[name] = value
        overrides = {
            'merchant_info': {'id': 7014, 'merchant_code': 'MCH-0010', 'merchant_name': 'Testing Hotel', 'status': 3},
            'merchant_application': {'id': 1041, 'app_no': 'APP-2026-B7998A92D6', 'company_name': 'Testing Hotel', 'merchant_code': 'MCH-0010', 'kyc_template_id': 85002},
            'merchant_application_business': {'id': 2080, 'business_name': 'Test Hotel', 'business_type': 'hotel', 'kyc_template_id': 85000},
            'merchant_store': {'id': 7522, 'store_name': 'Test Hotel', 'source_business_id': 2080, 'country_code': 'MM', 'city_key': 'yangon',
                               'business_type': 'hotel', 'status': 1, 'kyc_status': 1, 'kyc_template_id': 85000, 'content_status': 2,
                               'content_approved_version': 1, 'publish_status': 1, 'operating_status': 1, 'display_enabled': 1},
            'merchant_admin': {'id': 4716, 'username': 'm007014', 'password': 'preserve-password-hash', 'account_type': 2, 'is_owner': 1,
                               'status': 1, 'auth_version': 4, 'two_fa_secret_enc': 'preserve-enrolled-secret', 'pending_secret_enc': 'discard-pending-secret'},
            'merchant_verify_document': {'id': 85027, 'doc_type': 'license'},
            'merchant_application_signature': {'agreement_id': 85003, 'agreement_version': '1.0', 'agreement_sha256': 'a' * 64},
            'merchant_role': {'id': 85004, 'is_builtin': 0, 'account_type': 2, 'role_name': 'QA owned role'},
            'merchant_kyc_template': {'id': 85000, 'scope_type': 'property', 'business_type': 'hotel', 'name': 'Private checklist', 'source_template_id': 85001},
            'merchant_credential_delivery': {'status': 'delivered', 'payload_hash': 'b' * 64, 'approval_request_id': 'qa7014-fixture'},
            'merchant_auth_challenge': {'purpose': 'login', 'method': 'totp', 'token_hash': 'c' * 64, 'status': 'pending', 'expires_at': '2027-01-01 00:00:00'},
            'merchant_impersonation_session': {'status': 1, 'expires_at': '2027-01-01 00:00:00'},
            'merchant_commercial_config': {'version': 1, 'request_id': 'qa7014-commercial', 'payload_hash': 'd' * 64},
            'merchant_pay_at_hotel_terms': {'version': 1},
            'hotel_room_type': {'id': 7021, 'room_name': 'Standard Room', 'status': 1, 'publish_status': 2, 'approved_version': 1, 'base_stock': 10, 'base_price': '45000.00'},
            'hotel_room_type_revision': {'version': 1, 'payload_json': '{"room_name":"Standard Room","original_site_id":1}'},
            'merchant_property_content_revision': {'version': 1, 'payload_json': '{"original_site_id":1}'},
            'goods_daily_stock': {'stock_date': '2026-11-20', 'stock_total': 10, 'stock_sold': 0, 'stock_locked': 0, 'price': '45000.00'},
        }
        fields.update(overrides.get(table, {}))
        statements.append(insert(table, fields))
    for template_id, scope in [(85001, 'property'), (85002, 'merchant')]:
        statements.append(insert('merchant_kyc_template', {'id': template_id, 'site_id': 0, 'scope_type': scope, 'name': 'Shared immutable checklist', 'application_business_id': 0}))
    statements.append(insert('merchant_onboarding_agreement', {'id': 85003, 'site_id': 0, 'agreement_version': '1.0', 'content_sha256': 'a' * 64}))
    statements.append(insert('merchant_role', {'id': 85005, 'site_id': 0, 'merchant_id': 0, 'is_builtin': 1, 'account_type': 2, 'role_name': 'Global builtin'}))
    statements += [insert('merchant_admin_role', {'admin_id': 4716, 'role_id': role}) for role in (85004, 85005)]
    statements.append(insert('merchant_role_menu', {'role_id': 85004, 'menu_id': 100}))
    statements.append(insert('merchant_info', {'id': 999901, 'site_id': 1, 'merchant_code': 'UNRELATED', 'merchant_name': 'Must remain untouched', 'credit_code': 'UNRELATED', 'status': 3}))
    statements.append(insert('merchant_admin', {'id': 999902, 'site_id': 1, 'merchant_id': 999901, 'username': 'unrelated-reader', 'password': 'fixture', 'status': 1}))
    notify_id = 85020 + PLAN.index('merchant_notify')
    statements += [insert('merchant_notify', {'id': 999910, 'site_id': 1, 'merchant_id': 0, 'property_id': 0, 'recipient_id': None}),
                   insert('merchant_notify', {'id': 999911, 'site_id': 1, 'merchant_id': 999901, 'property_id': 0, 'recipient_id': 999902}),
                   insert('merchant_notify_read', {'notify_id': notify_id, 'account_id': 4716, 'read_at': '2026-11-19 01:00:00'}),
                   insert('merchant_notify_read', {'notify_id': 999910, 'account_id': 4716, 'read_at': '2026-11-19 01:01:00', 'hidden_at': '2026-11-19 01:02:00'}),
                   insert('merchant_notify_read', {'notify_id': 999911, 'account_id': 999902, 'read_at': '2026-11-19 01:03:00'}),
                   insert('merchant_notify_delivery', {'id': 999920, 'notify_id': notify_id, 'channel': 'inapp', 'status': 'delivered', 'receipt': 'preserve-receipt'})]
    statements.append('COMMIT;')
    sql('\n'.join(statements))


def fingerprint():
    statements = [f'USE `{TEST_BUSINESS}`;']
    for table in PLAN + ['merchant_admin_role', 'merchant_role_menu', 'merchant_onboarding_agreement', 'merchant_notify_read', 'merchant_notify_delivery']:
        fields = ','.join('`' + column[0] + '`' for column in METADATA[(TEST_BUSINESS, table)])
        statements.append(f'SELECT {fields} FROM `{table}` ORDER BY 1;')
    statements.append(f'SELECT * FROM `{TEST_SYSTEM}`.sys_file ORDER BY id;')
    return hashlib.sha256(sql('\n'.join(statements))[1].encode()).hexdigest()


def reject_case(message, mutation):
    fixture()
    sql(f'USE `{TEST_BUSINESS}`;\n' + mutation)
    before = fingerprint()
    code, output, error = sql(MIGRATION_SQL, allow_failure=True)
    check(code != 0 and 'QA7014' in error, message + ' rejects')
    check(fingerprint() == before, message + ' leaves all reviewed rows unchanged')
    check(scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.migration_merchant_site_backup;') == '0', message + ' rolls back backups')


def test_creation_policy():
    """Run the actual admin/public controllers against the disposable database."""
    source_tables = scalar(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{TEST_SYSTEM}' AND TABLE_TYPE='BASE TABLE';").splitlines()
    for table in source_tables:
        sql(f'CREATE TABLE IF NOT EXISTS `{TEST_BUSINESS}`.`{table}` LIKE `{TEST_SYSTEM}`.`{table}`;')
    bootstrap = (ROOT / 'backend/shared/tests/integration/M12Bootstrap.php').read_text(encoding='utf-8-sig').replace('mtrip_m12_s1_test', TEST_BUSINESS)
    # Refresh the disposable image's annotation cache once; concurrent child
    # workers then reuse that fresh cache without racing proxy generation.
    bootstrap = bootstrap.replace("putenv('SCAN_CACHEABLE=true');", "putenv('SCAN_CACHEABLE=' . (getenv('QA_SITE_SCAN_READY') === '1' ? 'true' : 'false'));")
    bootstrap = bootstrap.replace('Hyperf\\Di\\ClassLoader::init();', "Hyperf\\Di\\ClassLoader::init();\nputenv('QA_SITE_SCAN_READY=1');\nputenv('SCAN_CACHEABLE=true');")
    redis_name = f'mtrip-qa7014-redis-{os.getpid()}'
    network = os.environ.get('MYSQL_NETWORK', 'mtrip_default')
    subprocess.run([DOCKER, 'run', '--rm', '-d', '--name', redis_name, '--network', network, 'redis:7-alpine'], check=True, stdout=subprocess.DEVNULL)
    try:
        with tempfile.TemporaryDirectory(prefix='mtrip-qa7014-policy-') as directory:
            bootstrap_path = Path(directory) / 'M12Bootstrap.php'
            bootstrap_path.write_text(bootstrap, encoding='utf-8')
            test_files = ['onboarding-site.php', 'onboarding-registration.php', 'onboarding-final-approval.php']
            for test_file in test_files:
                fixture()
                if test_file == 'onboarding-final-approval.php':
                    sql(insert('merchant_info', {'site_id': 994, 'merchant_code': 'MCH-REG-LEGACY',
                                                'merchant_name': 'Legacy empty registration', 'credit_code': '', 'status': 1})
                        + insert('merchant_info', {'site_id': 994, 'merchant_code': 'MCH-REG-PRESENT',
                                                  'merchant_name': 'Existing registration', 'credit_code': 'STAGE4-MIGRATION-PRESERVED', 'status': 1}))
                    registration_migration = rewrite((ROOT / 'database/migrations/V20261119070000__allow-missing-merchant-registration-number.sql').read_text(encoding='utf-8-sig'))
                    sql(registration_migration)
                    sql(registration_migration)
                policy_container = f'mtrip-qa7014-policy-{os.getpid()}'
                args = [DOCKER, 'create', '--name', policy_container, '--network', network, '--entrypoint', 'php']
                for key, value in {'APP_ENV': 'test', 'DB_HOST': CONTAINER, 'DB_PORT': '3306', 'DB_USERNAME': 'root', 'DB_PASSWORD': PASSWORD,
                                   'DB_BUSINESS_DATABASE': TEST_BUSINESS, 'DB_SYSTEM_DATABASE': TEST_BUSINESS,
                                   'REDIS_HOST': redis_name, 'REDIS_PORT': '6379', 'REDIS_AUTH': '', 'REDIS_DB': '0',
                                   'MTRIP_AES_KEY': 'a' * 64, 'MTRIP_JWT_SECRET': 'qa7014-disposable-test-secret'}.items():
                    args += ['-e', f'{key}={value}']
                mounts = [(ROOT / 'backend/services/merchant-service/app', '/opt/www/app'),
                          (ROOT / 'backend/shared/src', '/opt/www/vendor/mtrip/shared/src'), (bootstrap_path, '/tmp/M12Bootstrap.php')]
                for filename in test_files + ['onboarding-final-approval-worker.php', 'onboarding-kyc-review-worker.php']:
                    mounts.append((ROOT / 'backend/services/merchant-service/test' / filename, '/tmp/' + filename))
                args += [os.environ.get('MERCHANT_TEST_IMAGE', 'mtrip-merchant-service'), '/tmp/' + test_file]
                created = subprocess.run(args, capture_output=True)
                if created.returncode:
                    raise RuntimeError(created.stderr.decode('utf-8', errors='replace'))
                try:
                    for source, target in mounts:
                        source_arg = source.resolve().as_posix() + ('/.' if source.is_dir() else '')
                        copied = subprocess.run([DOCKER, 'cp', source_arg, policy_container + ':' + target], capture_output=True)
                        if copied.returncode:
                            raise RuntimeError(copied.stderr.decode('utf-8', errors='replace'))
                    result = subprocess.run([DOCKER, 'start', '--attach', policy_container], capture_output=True)
                    print(result.stdout.decode('utf-8', errors='replace'), flush=True)
                    exit_code = subprocess.check_output([DOCKER, 'inspect', '--format', '{{.State.ExitCode}}', policy_container], text=True).strip()
                    if result.returncode or exit_code != '0':
                        raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
                finally:
                    subprocess.run([DOCKER, 'rm', '-f', policy_container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                check(True, 'real controller/service integration: ' + test_file)
    finally:
        subprocess.run([DOCKER, 'rm', '-f', redis_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def test_recovery():
    """Use the actual shell recovery and the ordinary migration validator."""
    with tempfile.TemporaryDirectory(prefix='mtrip-qa7014-recovery-') as directory:
        checkout = Path(directory)
        for subdir in ('scripts', 'database/init', 'database/migrations'):
            (checkout / subdir).mkdir(parents=True, exist_ok=True)
        old_file = checkout / 'database/migrations' / ORIGINAL_MIGRATION.name
        new_file = checkout / 'database/migrations' / MIGRATION.name
        old_file.write_text(rewrite(ORIGINAL_MIGRATION.read_text(encoding='utf-8-sig')), encoding='utf-8')
        new_file.write_text(MIGRATION_SQL, encoding='utf-8')
        helper = checkout / 'scripts/recover-qa-merchant-7014-site.sh'
        helper.write_text((ROOT / 'scripts' / helper.name).read_text(encoding='utf-8-sig'), encoding='utf-8')
        (checkout / 'scripts/db-migrate.sh').write_text(rewrite((ROOT / 'scripts/db-migrate.sh').read_text(encoding='utf-8-sig')), encoding='utf-8')
        ledger_ddl = rewrite((ROOT / 'database/init/01-schema-migrations.sql').read_text(encoding='utf-8-sig'))
        (checkout / 'database/init/01-schema-migrations.sql').write_text(ledger_ddl, encoding='utf-8')
        sql(ledger_ddl)
        old_hash = hashlib.sha256(old_file.read_bytes()).hexdigest()
        new_hash = hashlib.sha256(new_file.read_bytes()).hexdigest()
        shell = os.environ.get('BASH', r'C:\Program Files\Git\bin\bash.exe' if os.name == 'nt' else 'bash')
        env = {**os.environ, 'MTRIP_REPO_ROOT': checkout.as_posix(), 'MYSQL_CONTAINER': CONTAINER,
               'MYSQL_ROOT_PASSWORD': PASSWORD, 'DB_BUSINESS_DATABASE': TEST_BUSINESS,
               'DB_SYSTEM_DATABASE': TEST_SYSTEM, 'MSYS_NO_PATHCONV': '1', 'MYSQL_MIGRATION_LOCK_TIMEOUT': '0'}

        def command(mode, script=helper):
            result = subprocess.run([shell, str(script), mode], cwd=checkout, env=env, capture_output=True, timeout=120)
            return result.returncode, result.stdout.decode('utf-8', errors='replace'), result.stderr.decode('utf-8', errors='replace')

        def reset():
            fixture()
            sql(f'DELETE FROM `{TEST_SYSTEM}`.schema_migrations;')
            if scalar(f"SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='{TEST_SYSTEM}' AND TABLE_NAME='schema_migration_recovery';") == '1':
                sql(f'DELETE FROM `{TEST_SYSTEM}`.schema_migration_recovery;')
            code, _, error = sql(old_file.read_text(encoding='utf-8'), allow_failure=True)
            assert code and 'merchant_notify_read' in error
            sql(insert('schema_migrations', {'version': '20261119073300', 'description': 'original failed intent',
                       'script_path': 'database/migrations/' + old_file.name, 'checksum': old_hash, 'status': 'failed',
                       'attempt_id': 'original-failed-read-link', 'git_commit': 'a' * 40, 'applied_by': 'original-ops',
                       'started_at': '2026-11-19 08:53:00', 'finished_at': '2026-11-19 08:53:04',
                       'error_message': 'mysql client execution failed'}, TEST_SYSTEM))

        reset()
        before = fingerprint()
        code, output, error = command('--check')
        check(code == 0 and fingerprint() == before, 'recovery check is read-only: ' + error)
        check(scalar(f"SELECT status FROM `{TEST_SYSTEM}`.schema_migrations WHERE version='20261119073300';") == 'failed', 'check does not clear a failed ledger')
        code, output, error = command('--apply')
        check(code == 0, 'real recovery command succeeds: ' + output[-400:] + error)
        check(scalar(f"SELECT COUNT(*) FROM `{TEST_SYSTEM}`.schema_migrations WHERE status='applied';") == '2', 'both completed intents are recorded after successful correction')
        check(scalar(f"SELECT checksum FROM `{TEST_SYSTEM}`.schema_migrations WHERE version='20261119073300';") == old_hash, 'original published checksum is unchanged')
        check(scalar(f"SELECT checksum FROM `{TEST_SYSTEM}`.schema_migrations WHERE version='20261119090000';") == new_hash, 'replacement execution has its own file checksum')
        check(scalar(f"SELECT JSON_UNQUOTE(JSON_EXTRACT(original_ledger,'$.status')) FROM `{TEST_SYSTEM}`.schema_migration_recovery;") == 'failed', 'original failed status is retained in recovery audit')
        check(scalar(f"SELECT JSON_UNQUOTE(JSON_EXTRACT(original_ledger,'$.attempt_id')) FROM `{TEST_SYSTEM}`.schema_migration_recovery;") == 'original-failed-read-link', 'original failed attempt identity is retained')
        backups = list((checkout / 'deploy/backups').glob('qa7014-recovery-*.sql'))
        check(len(backups) == 1 and backups[0].stat().st_size > 1000 and Path(str(backups[0]) + '.sha256').is_file(), 'recovery writes a full database backup and checksum')
        check(scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.merchant_notify_read;') == '3', 'recovery keeps all notification read links')
        code, output, error = command('--status', checkout / 'scripts/db-migrate.sh')
        check(code == 0, 'ordinary migration validation resumes without bypass flags: ' + output[-400:] + error)
        recovered = fingerprint()
        code, _, error = command('--apply')
        check(code == 0 and fingerprint() == recovered, 'repeat recovery is a no-op: ' + error)
        check(len(list((checkout / 'deploy/backups').glob('qa7014-recovery-*.sql'))) == 1, 'completed recovery does not create another backup or attempt')

        reset()
        sql(f"UPDATE `{TEST_SYSTEM}`.schema_migrations SET checksum=REPEAT('f',64);")
        before = fingerprint()
        code, _, _ = command('--apply')
        check(code != 0 and fingerprint() == before, 'recovery refuses checksum mismatches before business writes')

        reset()
        prerequisite = checkout / 'database/migrations/V20261119080000__missing-prerequisite.sql'
        prerequisite.write_text('SET NAMES utf8mb4;\nSELECT 1;\n', encoding='utf-8')
        before = fingerprint()
        code, _, _ = command('--apply')
        check(code != 0 and fingerprint() == before, 'recovery refuses an unapplied prerequisite version')
        prerequisite.unlink()

        reset()
        sql(insert('order_main', {'id': 999100, 'site_id': 1, 'merchant_id': 7014, 'property_id': 7522,
                                 'sku_id': 7021, 'order_type': 1, 'order_no': 'RECOVERY-MUST-STOP'}))
        before = fingerprint()
        code, _, error = command('--apply')
        check(code != 0 and fingerprint() == before, 'corrective guard failure rolls back business changes')
        check(scalar(f"SELECT COUNT(*) FROM `{TEST_SYSTEM}`.schema_migrations WHERE status='failed';") == '2', 'failed correction never clears either failed ledger')
        check(scalar(f'SELECT COUNT(*) FROM `{TEST_SYSTEM}`.schema_migration_recovery;') == '0', 'failed correction never records a successful audit')
        sql(f'DELETE FROM `{TEST_BUSINESS}`.order_main;')
        code, output, error = command('--apply')
        check(code == 0, 'reviewed retry of a failed corrective attempt succeeds: ' + output[-400:] + error)
        check(scalar(f"SELECT JSON_UNQUOTE(JSON_EXTRACT(previous_recovery_ledger,'$.status')) FROM `{TEST_SYSTEM}`.schema_migration_recovery;") == 'failed', 'retry audit preserves the previous corrective failure')

        reset()
        sql(MIGRATION_SQL)
        auth_version = scalar(f'SELECT auth_version FROM `{TEST_BUSINESS}`.merchant_admin WHERE id=4716;')
        code, output, error = command('--apply')
        check(code == 0, 'recovery resumes after data committed but ledger completion did not: ' + output[-400:] + error)
        check(scalar(f'SELECT auth_version FROM `{TEST_BUSINESS}`.merchant_admin WHERE id=4716;') == auth_version, 'ledger completion does not revoke credentials a second time')
        check(hashlib.sha256(old_file.read_bytes()).hexdigest() == old_hash, 'recovery never edits the original published SQL file')
        print('Audited failed migration recovery tests passed.', flush=True)


def main():
    for name in (SOURCE_BUSINESS, SOURCE_SYSTEM, TEST_BUSINESS, TEST_SYSTEM):
        if not re.fullmatch('[A-Za-z0-9_]+', name):
            raise RuntimeError('Unsafe database identifier')
    for name in (TEST_BUSINESS, TEST_SYSTEM):
        if scalar(f"SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{name}';") != '0':
            raise RuntimeError('Refusing an existing disposable database')
        sql(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;')
        CREATED.append(name)
    original = scalar(f'CHECKSUM TABLE `{SOURCE_BUSINESS}`.merchant_info,`{SOURCE_BUSINESS}`.merchant_store;')
    for source, target in [(SOURCE_BUSINESS, TEST_BUSINESS), (SOURCE_SYSTEM, TEST_SYSTEM)]:
        tables = scalar(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{source}' AND TABLE_TYPE='BASE TABLE';").splitlines()
        sql('\n'.join(f'CREATE TABLE `{target}`.`{table}` LIKE `{source}`.`{table}`;' for table in tables))
    for filename in ['V20261117100000__merchant-commercial-settings.sql', 'V20261118090000__onboarding-property-kyc-templates.sql', 'V20261118130000__public-kyc-template-management.sql', 'V20261119070000__allow-missing-merchant-registration-number.sql']:
        sql(rewrite((ROOT / 'database/migrations' / filename).read_text(encoding='utf-8-sig')))
    metadata = scalar(f"SELECT TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME,DATA_TYPE,IS_NULLABLE,IFNULL(COLUMN_DEFAULT,'[NULL]'),EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA IN ('{TEST_BUSINESS}','{TEST_SYSTEM}') ORDER BY TABLE_NAME,ORDINAL_POSITION;")
    for line in metadata.splitlines():
        database, table, *columns = line.split('\t')
        METADATA.setdefault((database, table), []).append(columns)

    if '--creation-only' in sys.argv:
        test_creation_policy()
        return
    if '--recovery-only' in sys.argv:
        test_recovery()
        check(original == scalar(f'CHECKSUM TABLE `{SOURCE_BUSINESS}`.merchant_info,`{SOURCE_BUSINESS}`.merchant_store;'), 'recovery tests leave source development data unchanged')
        print(f'QA site recovery: {PASSED} assertions passed.', flush=True)
        return

    sql(MIGRATION_SQL)
    check(scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.migration_merchant_site_backup;') == '0', 'absent merchant is a no-op')
    fixture()
    before = fingerprint()
    code, _, error = sql(rewrite(ORIGINAL_MIGRATION.read_text(encoding='utf-8-sig')), allow_failure=True)
    check(code != 0 and 'unreviewed dependency in merchant_notify_read' in error, 'published original reproduces the actual notification-read failure')
    check(fingerprint() == before, 'original failure occurs before business changes')
    check(scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.migration_merchant_site_backup;') == '0', 'original failed attempt leaves no row backups')
    fixture()
    before = fingerprint()
    sql('SET @qa_7014_preview=1;\n' + MIGRATION_SQL)
    check(fingerprint() == before, 'preview leaves business rows unchanged')
    check(scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.migration_merchant_site_backup;') == '0', 'preview does not persist backups')
    sql(MIGRATION_SQL)
    check(scalar(f'SELECT site_id FROM `{TEST_BUSINESS}`.merchant_info WHERE id=7014;') == '7', 'merchant moves to site 7')
    check(scalar(f'SELECT COUNT(DISTINCT table_name) FROM `{TEST_BUSINESS}`.migration_merchant_site_backup;') == str(len(PLAN)), 'every reviewed table has an original row backup')
    check(scalar(f"SELECT auth_version,password,two_fa_secret_enc,LENGTH(pending_secret_enc) FROM `{TEST_BUSINESS}`.merchant_admin WHERE id=4716;") == '5\tpreserve-password-hash\tpreserve-enrolled-secret\t0', 'old sessions revoked and enrolled credentials preserved')
    check(scalar(f"SELECT status FROM `{TEST_BUSINESS}`.merchant_auth_challenge WHERE account_id=4716;") == 'expired', 'pending authentication challenge expires')
    check(scalar(f'SELECT status FROM `{TEST_BUSINESS}`.merchant_impersonation_session WHERE merchant_id=7014;') == '2', 'old impersonation session ends')
    check(scalar(f'SELECT site_id FROM `{TEST_BUSINESS}`.merchant_info WHERE id=999901;') == '1', 'unrelated merchant is preserved')
    check(scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.merchant_kyc_template WHERE id IN (85001,85002) AND site_id=0;') == '2', 'shared templates keep their scope and IDs')
    check(scalar(f'SELECT site_id FROM `{TEST_BUSINESS}`.merchant_kyc_template WHERE id=85000;') == '7', 'private property checklist moves with the application')
    check(scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.merchant_notify_read;') == '3', 'all read/hidden links are retained')
    check(scalar(f"SELECT hidden_at FROM `{TEST_BUSINESS}`.merchant_notify_read WHERE notify_id=999910 AND account_id=4716;") == '2026-11-19 01:02:00', 'hidden broadcast flag is preserved')
    check(scalar(f"SELECT receipt FROM `{TEST_BUSINESS}`.merchant_notify_delivery WHERE id=999920;") == 'preserve-receipt', 'site-less delivery receipt is preserved')
    notify_id = 85020 + PLAN.index('merchant_notify')
    check(scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.merchant_notify n JOIN `{TEST_BUSINESS}`.merchant_notify_read r ON r.notify_id=n.id WHERE n.id={notify_id} AND n.site_id=7 AND r.account_id=4716;') == '1', 'moved notification retains the same reader in site 7')
    check(scalar(f"SELECT JSON_UNQUOTE(JSON_EXTRACT(row_json,'$.auth_version')) FROM `{TEST_BUSINESS}`.migration_merchant_site_backup WHERE table_name='merchant_admin' AND row_id=4716;") == '4', 'backup preserves the pre-migration authentication version')
    moved = fingerprint()
    backups = scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.migration_merchant_site_backup;')
    sql(MIGRATION_SQL)
    check(fingerprint() == moved and scalar(f'SELECT COUNT(*) FROM `{TEST_BUSINESS}`.migration_merchant_site_backup;') == backups, 'replay changes neither data nor backup rows')
    sql(insert('order_main', {'id': 999100, 'site_id': 7, 'merchant_id': 7014, 'property_id': 7522, 'sku_id': 7021, 'order_type': 1, 'order_no': 'AFTER-MOVE'}))
    sql(MIGRATION_SQL)
    check(scalar(f'SELECT auth_version FROM `{TEST_BUSINESS}`.merchant_admin WHERE id=4716;') == '5', 'replay remains harmless after normal post-migration activity')

    reject_case('identity mismatch', "UPDATE merchant_info SET merchant_code='DIFFERENT' WHERE id=7014;")
    reject_case('disabled target site', f'UPDATE `{TEST_SYSTEM}`.sys_site SET status=2 WHERE id=7;')
    reject_case('mixed child site', 'UPDATE hotel_room_type SET site_id=6 WHERE id=7021;')
    reject_case('unreviewed added property', insert('merchant_store', {'id': 999100, 'site_id': 1, 'merchant_id': 7014, 'store_name': 'Extra'}))
    reject_case('site-specific shared checklist', 'UPDATE merchant_kyc_template SET site_id=1 WHERE id=85001;')
    reject_case('missing checklist', 'DELETE FROM merchant_kyc_template WHERE id=85002;')
    reject_case('site-specific signed agreement', 'UPDATE merchant_onboarding_agreement SET site_id=1 WHERE id=85003;')
    reject_case('shared role from old site', 'UPDATE merchant_role SET site_id=1 WHERE id=85005;')
    reject_case('pending credential outbox', "UPDATE merchant_credential_delivery SET status='pending';")
    reject_case('locked inventory', 'UPDATE goods_daily_stock SET stock_locked=1;')
    reject_case('existing booking', insert('order_main', {'id': 999100, 'site_id': 1, 'merchant_id': 7014, 'property_id': 7522, 'sku_id': 7021, 'order_type': 1, 'order_no': 'BEFORE-MOVE'}))
    reject_case('published ranking snapshot', insert('ranking_market', {'site_id': 1, 'entity_type': 'listing', 'business_type': 'hotel', 'country_code': 'MM', 'market_key': 'yangon', 'published_json': '[{"property_id":7522}]'}))
    reject_case('shared coupon snapshot', insert('marketing_coupon', {'site_id': 1, 'merchant_id': 0, 'property_ids': '[7522]'}))
    reject_case('future unmapped dependency', 'CREATE TABLE qa_future_merchant_dependency(id BIGINT PRIMARY KEY,merchant_id BIGINT,site_id BIGINT) ENGINE=InnoDB; INSERT INTO qa_future_merchant_dependency VALUES(1,7014,1);')
    reject_case('wrong document owner', 'UPDATE merchant_verify_document SET merchant_id=999901;')
    reject_case('already moved without backup', 'UPDATE merchant_info SET site_id=7 WHERE id=7014;')
    reject_case('unexpected scoped read-link schema', 'ALTER TABLE merchant_notify_read ADD COLUMN site_id BIGINT NOT NULL DEFAULT 1;')
    sql(f'ALTER TABLE `{TEST_BUSINESS}`.merchant_notify_read DROP COLUMN site_id;')
    fixture()
    sql(f'ALTER TABLE `{TEST_BUSINESS}`.goods_daily_stock ENGINE=MyISAM;')
    before = fingerprint()
    code, _, error = sql(MIGRATION_SQL, allow_failure=True)
    check(code != 0 and 'missing transactional schema' in error and fingerprint() == before, 'nontransactional dependent table fails before updates')
    sql(f'ALTER TABLE `{TEST_BUSINESS}`.goods_daily_stock ENGINE=InnoDB;')
    reject_case('failure partway through updates', "CREATE TRIGGER qa_7014_fail_update BEFORE UPDATE ON merchant_store FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: injected database failure';")
    test_creation_policy()
    check(original == scalar(f'CHECKSUM TABLE `{SOURCE_BUSINESS}`.merchant_info,`{SOURCE_BUSINESS}`.merchant_store;'), 'source development data was not changed')
    print(f'QA site migration: {PASSED} assertions passed.', flush=True)


try:
    main()
except Exception as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)
finally:
    for database in CREATED:
        if not database.startswith('mtrip_qa7014_') or database in (SOURCE_BUSINESS, SOURCE_SYSTEM):
            raise RuntimeError('Unsafe cleanup target')
        sql(f'DROP DATABASE `{database}`;', allow_failure=True)
