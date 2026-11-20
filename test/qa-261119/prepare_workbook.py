#!/usr/bin/env python3
"""Create a corrected local QA workbook and evidence copies, preserving inputs."""
import hashlib
import json
import re
from pathlib import Path
import shutil

import openpyxl

ROOT = Path('C:/test_result')
ANALYSIS = ROOT / 'analysis-261119'
SOURCE = ROOT / 'mTrip Test Cases__261119.xlsx'
OUTPUT = ROOT / 'mTrip Test Cases__261119_reviewed.xlsx'
EVIDENCE = ROOT / 'MTrip Test Evidences_20261119_reviewed'
original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
audit = json.loads((ANALYSIS / 'evidence-audit.json').read_text(encoding='utf-8'))
original_evidence = Path(audit['directory'])
if not EVIDENCE.exists():
    shutil.copytree(original_evidence, EVIDENCE)
    renames = [
        ('Consumer App/Lite_TC_003.png', 'Consumer App/L_TC_003.png'),
        ('Consumer App/L_TC_003.mp4', 'Consumer App/Lite_TC_003.mp4'),
        ('Merchant Dashboard/L_TC_014.mp4', 'Consumer App/L_TC_014.mp4'),
    ]
    for old, new in renames:
        source, target = (EVIDENCE / old).resolve(), (EVIDENCE / new).resolve()
        assert EVIDENCE.resolve() in source.parents and EVIDENCE.resolve() in target.parents
        assert source.is_file() and not target.exists()
        source.rename(target)

book = openpyxl.load_workbook(SOURCE)
changes = []


def headers(sheet):
    for row in sheet.iter_rows(min_row=1, max_row=15):
        if any(c.value == 'Test Case ID' for c in row):
            return {str(c.value): c.column for c in row if c.value}
    return {}


def case(sheet, cid):
    h = headers(sheet)
    return next(row[0].row for row in sheet if str(row[h['Test Case ID'] - 1].value or '').strip() == cid)


def change(sheet, row, field, value):
    cell = sheet.cell(row, headers(sheet)[field])
    if cell.value != value:
        changes.append(dict(sheet=sheet.title, row=row, field=field, before=cell.value, after=value))
        cell.value = value


for title, ids in [('Login Consumer App', ['L_TC_022', 'L_TC_023']), ('Register Consumer App', ['R_TC_012'])]:
    sheet = book[title]
    for cid in ids:
        change(sheet, case(sheet, cid), 'Expected Result',
               'New passwords must be 6–32 characters and contain at least one uppercase letter and one number.')
sheet = book['Login Consumer App']
change(sheet, case(sheet, 'L_TC_032'), 'Expected Result',
       'Sign-in accepts existing passwords of 6–32 characters. New-password complexity rules must not block legacy passwords.')
sheet = book['Home Consumer App']
for cid in ['Home_TC_016', 'Home_TC_023']:
    change(sheet, case(sheet, cid), 'Test Step', '1. Open the consumer app while signed out. 2. Open Home.')
change(sheet, case(sheet, 'Home_TC_023'), 'Expected Result', 'Login/Sign Up opens the Sign In page.')

for title, ids in [('All Properties Merchant Dashboa', ['AP_TC_020', 'AP_TC_021', 'AP_TC_022']),
                   ('UIUX Consumer App', ['UI/UX_TC_002', 'UI/UX_TC_003', 'UI/UX_TC_004', 'UI/UX_TC_005', 'UI/UX_TC_006'])]:
    sheet = book[title]
    for cid in ids:
        row = case(sheet, cid)
        h = headers(sheet)
        previous = sheet.cell(row, h['Actual Result']).value
        remark = sheet.cell(row, h['QA Remark']).value or ''
        change(sheet, row, 'QA Remark', (remark + '\nHistorical Actual Result: ' + str(previous)).strip())
        change(sheet, row, 'Actual Result',
               'Latest supplied QA Status is Pass. The previous failure description is retained in QA Remark; no new QA execution date is claimed.')

mapping = book.create_sheet('Evidence map 20261119')
mapping.append(['Sheet', 'Case ID', 'Original reference', 'Original Drive link', 'Local evidence copy'])
for ref in audit['references']:
    if ref.get('verified_file'):
        local = Path(ref['verified_file'])
    elif ref['exact']:
        local = Path(ref['exact'][0])
    else:
        local = Path(ref['same_link_aliases'][0]['files'][0])
    relative = local.relative_to(original_evidence).as_posix()
    if ref['sheet'] == 'Login Consumer App' and ref['id'] == 'L_TC_003': relative = 'Consumer App/L_TC_003.png'
    if ref['sheet'] == 'Accessibility Mode Consumer App' and ref['id'] == 'Lite_TC_003': relative = 'Consumer App/Lite_TC_003.mp4'
    if ref['sheet'] == 'Login Consumer App' and ref['id'] == 'L_TC_014': relative = 'Consumer App/L_TC_014.mp4'
    target = EVIDENCE / relative
    assert target.is_file() and hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(local.read_bytes()).digest()
    sheet = book[ref['sheet']]
    change(sheet, ref['row'], 'Issues Image', target.name)
    sheet.cell(ref['row'], headers(sheet)['Issues Image']).hyperlink = target.as_uri()
    mapping.append([ref['sheet'], ref['id'], ref['reference'], ref['link'], str(target)])

retest = book.create_sheet('Dev retest 20261119')
retest.append(['Case ID', 'Local result', 'Method and limits', 'Next step'])
browser = json.loads((ANALYSIS / 'browser-results.json').read_text(encoding='utf-8'))
browser_tests = browser['results']
for entry in browser_tests:
    retest.append([entry['name'], entry['result'], 'Current H5 with local fixture API; not real SMS or provider authorization.', 'Target QA / native confirmation where applicable.'])
integration_bytes = (ANALYSIS / 'referral-integration.log').read_bytes()
integration_log = integration_bytes.decode('utf-16' if integration_bytes.startswith(b'\xff\xfe') else 'utf-8')
integration_count = re.search(r'PASS_COUNT=(\d+)', integration_log)[1]
retest.append(['Ref_TC_014', 'Local implementation and regression passed',
               f'Real HTTP, MySQL and wallet/lifecycle fixtures: {integration_count} checks. Component rendering: 24 checks. Original zero-value historical completion preserved.',
               'Deploy user/order service + H5, repeat QA; do not automatically compensate historical records.'])
sheet = book['Referral Consumer App']
row = case(sheet, 'Ref_TC_014')
change(sheet, row, 'Development Status', 'Completed')
change(sheet, row, 'Dev Remark',
       '2026-11-19 local fix and retest: reward offer now uses actual site configuration; zero-value completed referrals are explicitly shown without claiming wallet credit. Real wallet integration and H5 fixture checks passed. Pending deployment and target QA. Historical compensation not executed.')

added = json.loads((ANALYSIS / 'diff.json').read_text(encoding='utf-8'))['added']
covered = set()
for entry in browser_tests:
    for match in re.finditer(r'([A-Za-z_]*TC_)(\d+)(?:/(\d+))?', entry['name']):
        covered.add(match[1] + match[2])
        if match[3]:
            covered.add(match[1] + match[3])
for row in added:
    if row['Status']:
        continue
    cid = row['id']
    if cid in ['Home_TC_019', 'Home_TC_020', 'Home_TC_021']:
        result, note = 'Planned business capability', 'Food/Cars show Coming soon; Package currently routes to ticket goods. Product flow is not fully implemented.'
    elif cid in covered:
        result, note = 'Local coverage recorded above', 'Read the method/limits; source QA Status is unchanged.'
    elif cid.startswith('L_TC_') and int(cid[-3:]) in [35, 36, 37]:
        result, note = 'Provider-adapter integration passed', 'Facebook 51 / Apple 62 / TikTok 54 checks; real provider account rejection still requires QA authorization.'
    elif cid.startswith('L_TC_') and int(cid[-3:]) in [34, 38, 39, 46, 47, 48, 49, 50, 51, 58, 59]:
        result, note = 'Outside implemented login providers', 'Google/WeChat remain planned; no live integration was added in this defect repair.'
    else:
        result, note = 'Needs target environment or further UI verification', 'No new Pass claimed. Backend SMS unit tests cover invalid/expired/cooldown cases; live delivery requires the configured QA channel.'
    retest.append([cid, result, note, 'QA / product follow-up as recorded.'])

result_sheets = [mapping, retest]
remaining_path = ANALYSIS / 'remaining/browser-results.json'
if remaining_path.is_file():
    remaining = book.create_sheet('Remaining retest 20261119')
    remaining.append(['Case / check', 'Local result', 'Method and limits', 'Next step'])
    paths = [remaining_path, ANALYSIS / 'remaining-navigation/browser-results.json']
    for path in paths:
        if not path.is_file():
            continue
        for entry in json.loads(path.read_text(encoding='utf-8'))['results']:
            assert entry['result'] == 'pass', entry
            remaining.append([entry['name'], entry['result'],
                              'Current H5 with local API fixtures; no real SMS, wallet debit or provider authorization.',
                              'Deploy H5 and repeat in the target QA environment.'])
    remaining.append(['UTC parsing / invitation utilities', '44 checks passed',
                      'Actual TypeScript utilities in UTC, Shanghai, Yangon and New York; malformed input and invitation lifecycle covered.',
                      'Native engines still need device verification.'])
    remaining.append(['Ref_TC_015', 'H5 invitation fixed; original download expectation still open',
                      'Shared link uses current H5 domain; phone signup retains a read-only invitation through OTP. Existing accounts are not rebound. No app-store redirect or native universal link was added.',
                      'Verify production H5 link after deployment; separately confirm app-store/native delivery. Original Development Status and QA Status unchanged.'])
    remaining.append(['H_TC_115', 'Existing-order countdown/status fixed; pre-order display retained',
                      'Created orders use UTC deadlines, earliest pending Trip child and repeated expiry refresh. User explicitly requested retaining the pre-order fixed 10 minutes pending product confirmation.',
                      'Product decision on the pre-order page remains open. Do not mark this whole case completed.'])
    sheet = book['Referral Consumer App']
    change(sheet, case(sheet, 'Ref_TC_015'), 'Dev Remark',
           '2026-11-19: H5 invitation link and phone registration attribution fixed and locally verified (OTP/no-SMS, read-only code, no silent skip, existing-user sign-in). App-store download/native deep linking not implemented by this repair; original whole-case Development Status and QA Status retained. Pending target QA after H5 deployment.')
    sheet = book['Hotels Consumer App']
    change(sheet, case(sheet, 'H_TC_115'), 'Dev Remark',
           '2026-11-19: existing-order UTC countdown, earliest Trip deadline, repeated server expiry refresh and paid-state reconciliation fixed and locally verified in full/Lite H5. Before order creation, fixed 10 minutes retained at explicit user request pending product confirmation. Original whole-case Development Status and QA Status retained.')
    result_sheets.append(remaining)

for sheet in result_sheets:
    sheet.freeze_panes = 'A2'
    sheet.auto_filter.ref = sheet.dimensions
    for col in sheet.columns:
        sheet.column_dimensions[col[0].column_letter].width = 30 if col[0].column < 3 else 90
book.save(OUTPUT)
checked = openpyxl.load_workbook(OUTPUT)
assert book.sheetnames == checked.sheetnames
for original_sheet in openpyxl.load_workbook(SOURCE):
    assert len(checked[original_sheet.title].data_validations.dataValidation) == len(original_sheet.data_validations.dataValidation)
    h = headers(original_sheet)
    for field in ['Status', 'QA Status']:
        if field in h:
            for row in original_sheet:
                original = row[h[field] - 1]
                assert checked[original_sheet.title].cell(original.row, original.column).value == original.value
assert len(list(EVIDENCE.rglob('*.*'))) == len(list(original_evidence.rglob('*.*')))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == original_hash
(ANALYSIS / 'workbook-changes.json').write_text(json.dumps(changes, ensure_ascii=False, indent=2), encoding='utf-8')
print('Corrected workbook:', OUTPUT)
print('Evidence copies:', EVIDENCE)
print('Changed value cells:', len(changes))
print('All source data, evidence hashes and validation lists preserved.')
