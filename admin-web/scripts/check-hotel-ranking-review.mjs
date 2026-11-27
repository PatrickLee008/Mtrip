import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const vue = require('vue');
const { compileScript, parse } = require('@vue/compiler-sfc');
const src = fileURLToPath(new URL('../src', import.meta.url));
const directory = src + '/views/merchant/ranking';
const filename = directory + '/HotelRankingReview.vue';
assert.ok(existsSync(filename), 'Hotel market needs a dedicated draft review and publish flow');
const script = compileScript(parse(readFileSync(filename, 'utf8')).descriptor, { id: 'review' });
const { outputFiles } = await require('esbuild').build({
  stdin: { contents: script.content, loader: 'ts', resolveDir: directory },
  bundle: true, write: false, format: 'iife', globalName: 'review', alias: { '@': src },
  plugins: [{ name: 'review-boundaries', setup(b) {
    b.onResolve({ filter: /^(vue|vue-i18n|ant-design-vue)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
      path === 'vue' ? `export const {${Object.keys(vue).join(',')}}=host.vue;` :
      path === 'vue-i18n' ? 'export const useI18n=()=>({locale:host.vue.ref("en-US"),t:host.t});' :
      'export const message={success(){}};',
    }));
    b.onLoad({ filter: /\/stores\/user\.ts$/ }, () => ({ contents: 'export const useUserStore=()=>host.user;' }));
    b.onLoad({ filter: /\/utils\/http\.ts$/ }, () => ({ contents: 'export const get=(...a)=>host.get(...a),post=(...a)=>host.post(...a);' }));
  } }],
});
const scope = { entityType: 'listing', businessType: 'hotel', siteId: 2, countryCode: 'MM', cityKey: 'yangon', region: '' };
const config = { id: 17, property_id: 512, pinned: 0, featured: 1, status: 1, rank: 1 };
const row = { ...config, property_name: 'City Inn', eligible: true, min_price: 350 };
const props = vue.reactive({ scope: { ...scope }, market: { version: 5, published_version: 2 },
  rows: [{ ...row }], publishedConfig: [{ ...config, rank: '1' }], cityLabel: 'Yangon', busy: false });
const calls = [], events = [];
const host = { vue, user: vue.reactive({ isSuper: true, hasPerm: () => true }), t: (key, args) => key + (args ? JSON.stringify(args) : ''),
  get: async () => ({ list: [], total: 0, version: 1 }), post: async (...a) => { calls.push(a); } };
const context = vm.createContext({ host, console });
vm.runInContext(outputFiles[0].text, context);
const s = context.review.default.setup(props, { expose() {}, emit: (...args) => events.push(args) });

assert.equal(s.changes.value.length, 0, 'live details or higher draft version alone cannot enable publish');
props.rows[0].pinned = 1;
assert.equal(s.changes.value.length, 1, 'pinning an already featured hotel is a distinct change');
s.openPublish();
await s.publish();
assert.equal(calls.length, 0, 'publishing requires a reason');
s.note.value = '  Seasonal order  ';
props.rows[0].eligible = false;
await s.publish();
assert.equal(calls.length, 0, 'a visible ineligible hotel blocks publication');
props.rows[0].eligible = true;
await s.publish();
assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['/admin/merchant/ranking/publish', { ...scope, expectedVersion: 5, note: 'Seasonal order' }]]);
assert.deepEqual(events, [['busy-change', true], ['refresh'], ['busy-change', false]]);
console.log('PASS draft diff, eligibility gate and one reason for the selected market');

s.openPublish();
s.note.value = 'Another reason';
props.scope.cityKey = 'bagan';
await s.publish();
assert.equal(calls.length, 1, 'a stale confirmation cannot publish another city');
await vue.nextTick();
assert.equal(s.publishOpen.value, false);
host.user.isSuper = false;
s.openPublish();
assert.equal(s.publishOpen.value, false);
host.user.isSuper = true;
console.log('PASS stale confirmation and read-only access');

host.get = async () => ({ list: [{ id: 321, action: 'display_flags', version: 5, operator_name: 'Alice',
  created_at: '2026-11-25', note: 'Winter campaign', before_json: [config], after_json: [{ ...config, pinned: 1 }] }], total: 1 });
await s.showHistory();
const history = s.historyRows.value[0];
assert.equal(history.operator_name, 'Alice');
assert.equal(history.note, 'Winter campaign');
assert.equal(history.changes[0].name, 'City Inn');
assert.match(history.changes[0].description, /pinned/i);
console.log('PASS older history snapshots with property names, flag, actor and reason');

let finishDraft;
host.get = async (_path, data) => data.view === 'draft' ? new Promise(resolve => { finishDraft = resolve; })
  : { list: [{ property_id: 93, minPrice: 300, rating: 4.5 }], version: 4 };
const draft = s.showPreview('draft');
await s.showPreview('published');
finishDraft({ list: [{ property_id: 99 }], version: 8 });
await draft;
assert.equal(s.previewRows.value[0].property_id, 93);
assert.equal(s.previewVersion.value, 4);
console.log('PASS a late draft preview cannot replace the selected online cards');

const ordinary = { ...config, id: 18, property_id: 513, featured: 0, rank: 1 };
const other = { ...ordinary, id: 19, property_id: 514, rank: 2 };
props.publishedConfig = [config, ordinary, other];
props.rows = [{ ...row }, { ...other, eligible: true, rank: 1 }, { ...ordinary, eligible: true, rank: 2 }];
assert.match(s.changes.value.find(change => change.key === '514').description, /cityRank.*3.*2/);
props.rows = [{ ...row }, { ...ordinary, eligible: true, rank: 12 }, { ...other, eligible: true, rank: 13 }];
assert.equal(s.changes.value.length, 0, 'rank gaps alone do not change the ranking');
console.log('PASS market-wide displayed ranks and no false diff after reversing a move');

props.rows[0].pinned = 1;
s.openPublish();
s.note.value = 'Revision 5';
props.market.version = 6;
await s.publish();
assert.equal(calls.length, 1, 'never submit an unreviewed version');
await vue.nextTick();
s.openPublish();
s.note.value = 'Revision 6';
let rejectWrite;
host.post = async (...args) => { calls.push(args); return new Promise((_resolve, reject) => { rejectWrite = reject; }); };
const submitting = s.publish();
await s.publish();
assert.equal(calls.length, 2, 'only one write is allowed in flight');
rejectWrite(new Error('Conflict'));
await submitting;
assert.deepEqual(events.slice(-3), [['busy-change', true], ['refresh'], ['busy-change', false]]);
console.log('PASS version mismatch, double submit and refresh after conflict');
