import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const att = JSON.parse(readFileSync(join(root, 'attendance.json'), 'utf8'));
const ms = JSON.parse(readFileSync(join(root, 'milestones.json'), 'utf8'));

test('attendance: 프로그램·세션·멤버 스키마', () => {
  assert.equal(att.program.total_sessions, 5);
  assert.ok(att.sessions.length >= 1);
  for (const s of att.sessions) {
    assert.ok(Number.isInteger(s.no) && s.title);
    if (s.held) assert.ok(s.date);
    assert.equal(typeof s.held, 'boolean');
  }
  for (const m of att.members) {
    assert.ok(m.name);
    for (const k of ['attended', 'reviews', 'maker']) assert.ok(Array.isArray(m[k]));
    // 참석하지 않은 회차의 후기는 불가
    for (const r of m.reviews) assert.ok(m.attended.includes(r), `${m.name} 후기 ${r}회차는 참석 기록 필요`);
  }
});

test('milestones: 4트랙, 명칭 고정, 단계 상태', () => {
  const keys = ms.tracks.map(t => t.key);
  assert.deepEqual(keys, ['gcb', 'accounting', 'literacy', 'automations']);
  const gcb = ms.tracks.find(t => t.key === 'gcb');
  assert.equal(gcb.title, 'Guide Check Bot');
  const acc = ms.tracks.find(t => t.key === 'accounting');
  assert.ok(acc.title.startsWith('회계 기입 자동화'));
  assert.equal(acc.closing, true);
  assert.ok(acc.plans.length >= 3, 'Plan A~C 병기');
  for (const t of ms.tracks) {
    for (const st of t.steps || []) assert.ok(['done', 'current', 'future'].includes(st.state));
  }
});

test('milestones: 운영자 멘트 금지어 스캔', () => {
  const raw = readFileSync(join(root, 'milestones.json'), 'utf8');
  for (const banned of ['검수표', '심현희님', '해주세요', '판단만 하면']) {
    assert.ok(!raw.includes(banned), `배포용 문구에 "${banned}" 포함 금지`);
  }
});
