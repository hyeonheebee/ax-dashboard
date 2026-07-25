import test from 'node:test';
import assert from 'node:assert/strict';
import { heldSessions, deriveStamps, deriveStreak, deriveBadges, BADGE_DEFS } from '../badges.js';

const SESSIONS = [
  { no: 1, date: '2026-07-24', title: '매직 프롬프트로 업무 도구 만들기', held: true },
  { no: 2, date: '2026-08-21', title: '2회차', held: true },
  { no: 3, date: '2026-09-18', title: '3회차', held: true },
  { no: 4, date: '2026-10-16', title: '4회차', held: false },
  { no: 5, date: '2026-11-13', title: '5회차', held: false },
];

test('heldSessions: held=true만 no순으로', () => {
  assert.deepEqual(heldSessions(SESSIONS).map(s => s.no), [1, 2, 3]);
});

test('deriveStamps: 5칸 전체, 참석/후기 표시', () => {
  const m = { name: '장문석', attended: [1, 3], reviews: [1], maker: [] };
  const st = deriveStamps(m, SESSIONS);
  assert.equal(st.length, 5);
  assert.deepEqual(st[0], { no: 1, title: '매직 프롬프트로 업무 도구 만들기', date: '2026-07-24', attended: true, review: true });
  assert.equal(st[1].attended, false);
  assert.equal(st[2].attended, true);
  assert.equal(st[2].review, false);
});

test('deriveStreak: 마지막 개최 회차로 끝나는 연속 길이', () => {
  assert.equal(deriveStreak({ attended: [1, 2, 3] }, SESSIONS), 3);
  assert.equal(deriveStreak({ attended: [2, 3] }, SESSIONS), 2);
  assert.equal(deriveStreak({ attended: [1, 2] }, SESSIONS), 0); // 마지막(3회) 미참석
  assert.equal(deriveStreak({ attended: [] }, SESSIONS), 0);
  assert.equal(deriveStreak({ attended: [1] }, [SESSIONS[0]]), 1);
  assert.equal(deriveStreak({ attended: [] }, []), 0); // 개최 0회 엣지
});

test('deriveBadges: 규칙별 획득', () => {
  const total = 5;
  // 1회 참석 → 🌱
  assert.deepEqual(deriveBadges({ attended: [1], reviews: [], maker: [] }, SESSIONS, total), ['seed']);
  // 2연속(한 번이라도) → streak2 유지 (이후 결석해도 회수 안 함)
  assert.ok(deriveBadges({ attended: [1, 2], reviews: [], maker: [] }, SESSIONS, total).includes('streak2'));
  // 누적 3회 → half
  const b3 = deriveBadges({ attended: [1, 2, 3], reviews: [], maker: [] }, SESSIONS, total);
  assert.ok(b3.includes('half'));
  assert.ok(!b3.includes('full')); // 5회 미만
  // 후기 → reviewer, 결과물 → maker
  assert.ok(deriveBadges({ attended: [1], reviews: [1], maker: [] }, SESSIONS, total).includes('reviewer'));
  assert.ok(deriveBadges({ attended: [1], reviews: [], maker: [1] }, SESSIONS, total).includes('maker'));
  // 미참석자 → 빈 배열
  assert.deepEqual(deriveBadges({ attended: [], reviews: [], maker: [] }, SESSIONS, total), []);
});

test('BADGE_DEFS: 6종 정의', () => {
  assert.deepEqual(Object.keys(BADGE_DEFS), ['seed', 'streak2', 'half', 'full', 'reviewer', 'maker']);
  for (const d of Object.values(BADGE_DEFS)) {
    assert.ok(d.emoji && d.label && d.desc);
  }
});
