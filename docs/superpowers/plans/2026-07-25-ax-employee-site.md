# 서울 AI 허브 직원용 AX 사이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ax-dashboard repo에 직원용 정적 사이트(`site/`)를 추가 — AX 마일스톤 투명 공유 + 슬랙 3채널 현황 + AI 세션 참석 도장판·뱃지.

**Architecture:** 순수 정적 HTML/CSS/JS(ES modules). 데이터는 `fetch`로만 접근(`config.js` 단일화 → 추후 Flask API 전환 시 config만 교체). 뱃지·스트릭은 `attendance.json`에서 클라이언트가 파생. 배포는 VPS nginx + cron `git pull`.

**Tech Stack:** Vanilla JS (ES modules), Chart.js 4 (CDN), Node 내장 `node --test` (로직 테스트), Python http.server (로컬 확인).

## Global Constraints

- 명칭 고정: **"Guide Check Bot"** ("지침검수봇" 표기 금지), **"회계 기입 자동화 (SRnD-민간위탁시스템)"**
- `data.json`의 `headline`/`watch`/`next`/`progress`/`risk`/`deliverable` 필드는 **절대 렌더링하지 않는다** (운영자 멘트 금지)
- 랭킹 금지: 참석자 정렬은 `localeCompare('ko')` 가나다순 고정
- 미참석 회차에 X·결손 표시 금지 (빈 칸만), 스트릭 "끊김" 경고 문구 금지
- 기존 루트 `index.html`·`data.json` 스키마 무수정 (수집기 파이프라인 보호)
- 모든 화면 문구는 직원 대상 완성형 (작업지시·검수요청 문구 금지)
- 데이터 URL은 `site/config.js`에만 존재

## File Structure

```
site/
  config.js          # 데이터 URL 단일 소스
  badges.js          # 순수 파생 로직 (도장/스트릭/뱃지) — node --test 대상
  identity.js        # "내 이름 선택" localStorage 모듈 (추후 OAuth로 교체 가능)
  app.js             # fetch + 3섹션 렌더
  style.css
  index.html
  milestones.json    # 직원용 마일스톤 큐레이션 (Plan A~C 포함)
  attendance.json    # 세션·참석 기록 (시드: 1회차 3명)
  tests/
    badges.test.mjs
    identity.test.mjs
    data.test.mjs    # JSON 스키마 검증
docs/
  collector-extension.md   # 수집기 확장 스펙 2건 (백로그)
  deploy-vps.md            # nginx + cron pull 배포 가이드
```

---

### Task 1: 파생 로직 `badges.js` (TDD)

**Files:**
- Create: `site/badges.js`
- Test: `site/tests/badges.test.mjs`

**Interfaces:**
- Produces: `heldSessions(sessions) → session[]` (held=true, no 오름차순)
- Produces: `deriveStamps(member, sessions) → [{no, title, date, attended, review}]` (전체 total 회차 기준)
- Produces: `deriveStreak(member, sessions) → number` (마지막 개최 회차에서 끝나는 연속 참석 길이, 마지막 미참석이면 0)
- Produces: `deriveBadges(member, sessions, totalSessions) → string[]` (획득 뱃지 key 배열)
- Produces: `BADGE_DEFS` — `{key: {emoji, label, desc}}` 6종

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// site/tests/badges.test.mjs
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
```

- [ ] **Step 2: 실패 확인**

Run: `cd ~/ax-dashboard && node --test site/tests/badges.test.mjs`
Expected: FAIL — `Cannot find module '../badges.js'`

- [ ] **Step 3: 구현**

```js
// site/badges.js
// 참석 데이터(attendance.json)에서 도장·스트릭·뱃지를 파생하는 순수 로직.
// 뱃지는 데이터에 저장하지 않고 항상 여기서 계산한다 (규칙 변경 시 일괄 반영).

export const BADGE_DEFS = {
  seed:     { emoji: '🌱', label: '첫 발걸음',     desc: '세션에 처음 참석했어요' },
  streak2:  { emoji: '🔥', label: '연속 출석',     desc: '2회 연속으로 참석했어요' },
  half:     { emoji: '⚡', label: '하프 마스터',   desc: '누적 3회 참석을 달성했어요' },
  full:     { emoji: '🏆', label: '풀 코스',       desc: '전체 회차를 모두 참석했어요' },
  reviewer: { emoji: '✍️', label: '후기 크리에이터', desc: '세션 후기를 남겼어요' },
  maker:    { emoji: '🚀', label: '메이커',        desc: '실습 결과물을 공유했어요' },
};

export function heldSessions(sessions) {
  return sessions.filter(s => s.held).sort((a, b) => a.no - b.no);
}

export function deriveStamps(member, sessions) {
  const att = new Set(member.attended || []);
  const rev = new Set(member.reviews || []);
  return [...sessions].sort((a, b) => a.no - b.no).map(s => ({
    no: s.no, title: s.title, date: s.date,
    attended: att.has(s.no),
    review: rev.has(s.no),
  }));
}

export function deriveStreak(member, sessions) {
  const held = heldSessions(sessions);
  const att = new Set(member.attended || []);
  let streak = 0;
  for (let i = held.length - 1; i >= 0; i--) {
    if (att.has(held[i].no)) streak++;
    else break;
  }
  return streak;
}

// 한 번이라도 달성한 연속 2회 (이후 결석해도 뱃지는 유지)
function everStreak2(member, sessions) {
  const held = heldSessions(sessions);
  const att = new Set(member.attended || []);
  let run = 0;
  for (const s of held) {
    run = att.has(s.no) ? run + 1 : 0;
    if (run >= 2) return true;
  }
  return false;
}

export function deriveBadges(member, sessions, totalSessions) {
  const n = (member.attended || []).length;
  const out = [];
  if (n >= 1) out.push('seed');
  if (everStreak2(member, sessions)) out.push('streak2');
  if (n >= 3) out.push('half');
  if (n >= totalSessions) out.push('full');
  if ((member.reviews || []).length >= 1) out.push('reviewer');
  if ((member.maker || []).length >= 1) out.push('maker');
  return out;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test site/tests/badges.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add site/badges.js site/tests/badges.test.mjs
git commit -m "feat(site): 도장·스트릭·뱃지 파생 로직 + 테스트"
```

---

### Task 2: `identity.js` + `config.js` (TDD)

**Files:**
- Create: `site/identity.js`, `site/config.js`
- Test: `site/tests/identity.test.mjs`

**Interfaces:**
- Produces: `getMyName(storage) → string|null`, `setMyName(storage, name)`, `clearMyName(storage)` — storage는 localStorage 호환 객체(테스트 주입용). 추후 Google 로그인 전환 시 이 모듈만 교체.
- Produces: `window` 전역 없이 import 가능한 `CONFIG` — `{ dataUrl, milestonesUrl, attendanceUrl }`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// site/tests/identity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { getMyName, setMyName, clearMyName } from '../identity.js';

function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

test('identity: 저장·조회·삭제', () => {
  const s = memStorage();
  assert.equal(getMyName(s), null);
  setMyName(s, '장문석');
  assert.equal(getMyName(s), '장문석');
  clearMyName(s);
  assert.equal(getMyName(s), null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test site/tests/identity.test.mjs`
Expected: FAIL — `Cannot find module '../identity.js'`

- [ ] **Step 3: 구현**

```js
// site/identity.js
// "내 이름 선택" — 지금은 localStorage 기반. Google 로그인(seoulaihub.kr) 도입 시
// 이 모듈의 세 함수만 OAuth 기반 구현으로 교체하면 app.js는 무수정.
const KEY = 'ax-site.myName';

export function getMyName(storage) {
  return storage.getItem(KEY);
}
export function setMyName(storage, name) {
  storage.setItem(KEY, name);
}
export function clearMyName(storage) {
  storage.removeItem(KEY);
}
```

```js
// site/config.js
// 데이터 URL 단일 소스. Flask API 전환 시 여기만 바꾼다.
export const CONFIG = {
  dataUrl: '../data.json',        // 기존 수집기 산출물 (repo 루트)
  milestonesUrl: './milestones.json',
  attendanceUrl: './attendance.json',
};
```

- [ ] **Step 4: 통과 확인**

Run: `node --test site/tests/identity.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add site/identity.js site/config.js site/tests/identity.test.mjs
git commit -m "feat(site): identity(localStorage)·config 모듈"
```

---

### Task 3: 데이터 파일 `attendance.json` + `milestones.json` + 스키마 테스트

**Files:**
- Create: `site/attendance.json`, `site/milestones.json`
- Test: `site/tests/data.test.mjs`

**Interfaces:**
- Produces: attendance 스키마 `{program:{title,total_sessions}, sessions:[{no,date,title,held}], members:[{name,attended[],reviews[],maker[]}]}`
- Produces: milestones 스키마 `{tracks:[{key,title,subtitle,closing?,steps:[{label,state:'done'|'current'|'future'}],note,plans?:[{name,tried,result}],items?:[{label,state}]}]}`
- 주의: `plans`의 내용은 **사용자 사실검수 대상 초안** — 커밋 메시지에 명시

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// site/tests/data.test.mjs
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
    assert.ok(Number.isInteger(s.no) && s.date && s.title);
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test site/tests/data.test.mjs`
Expected: FAIL — attendance.json 없음

- [ ] **Step 3: 데이터 파일 작성**

```json
// site/attendance.json
{
  "program": { "title": "AX 실습 시리즈", "total_sessions": 5 },
  "sessions": [
    { "no": 1, "date": "2026-07-24", "title": "매직 프롬프트로 업무 도구 만들기", "held": true },
    { "no": 2, "date": null, "title": "2회차 (준비 중)", "held": false },
    { "no": 3, "date": null, "title": "3회차 (준비 중)", "held": false },
    { "no": 4, "date": null, "title": "4회차 (준비 중)", "held": false },
    { "no": 5, "date": null, "title": "5회차 (준비 중)", "held": false }
  ],
  "members": [
    { "name": "장문석", "attended": [1], "reviews": [1], "maker": [1] },
    { "name": "이슬기", "attended": [1], "reviews": [1], "maker": [1] },
    { "name": "정준호", "attended": [1], "reviews": [1], "maker": [1] }
  ]
}
```

(주: 3명 모두 후기에서 실습 결과물 완성을 언급 → maker 부여. `data.test.mjs`의 date 검증은 held=true인 세션만 date 필수로 완화해 작성: `if (s.held) assert.ok(s.date)`. 위 테스트 코드의 해당 줄을 `assert.ok(Number.isInteger(s.no) && s.title); if (s.held) assert.ok(s.date);`로 한다.)

```json
// site/milestones.json
{
  "tracks": [
    {
      "key": "gcb",
      "title": "Guide Check Bot",
      "subtitle": "사내 업무지침을 슬랙에서 바로 묻고 답을 받는 봇",
      "steps": [
        { "label": "기획·설계", "state": "done" },
        { "label": "파일럿 배포 (GPTs→Slack)", "state": "done" },
        { "label": "전용 서버 24/7 가동", "state": "done" },
        { "label": "지침 데이터 확충·정비", "state": "current" },
        { "label": "8월 정식 배포", "state": "future" },
        { "label": "사용 피드백 반영 사이클", "state": "future" }
      ],
      "note": "현재 118개 지침 카드로 답변 중이며, 신규·개정 지침을 반영해 8월 정식 오픈을 준비하고 있습니다."
    },
    {
      "key": "accounting",
      "title": "회계 기입 자동화 (SRnD-민간위탁시스템)",
      "subtitle": "연구비 지급신청을 통합지출결의서로 자동 전기하는 실험",
      "closing": true,
      "steps": [
        { "label": "프로세스 분석·기술 탐색", "state": "done" },
        { "label": "자동 전기 1건 검증 성공", "state": "done" },
        { "label": "실사용 환경 검증", "state": "done" },
        { "label": "규모 재평가", "state": "done" },
        { "label": "검증 자산 문서화 후 전환", "state": "current" }
      ],
      "plans": [
        {
          "name": "Plan A — 브라우저 자동화 단독 실행",
          "tried": "Playwright로 두 시스템(SRnD·민간위탁)을 자동 조작해 지급신청 1건을 결의서까지 자동 전기",
          "result": "end-to-end 1건 검증 성공. 다만 실사용 환경의 로그인·팝업 변수 확인 필요"
        },
        {
          "name": "Plan B — 실사용 브라우저 연결(CDP Attach) 방식",
          "tried": "담당자가 쓰던 브라우저 세션에 직접 연결해 실데이터로 라이브 검증",
          "result": "데이터 추출·화면 전환 구조를 실측으로 확증. 대량 처리 시 예외 케이스가 다양함을 확인"
        },
        {
          "name": "Plan C — 전수 처리 실행 계획 재설계",
          "tried": "확인된 사실만으로 실행 계획서 1.1판 수립, 전체 건수 기준 완료 조건 정의",
          "result": "안정 운영에 필요한 규모가 1인 프로젝트 범위를 넘는다고 판단"
        }
      ],
      "note": "여기까지 검증한 뒤, 무리하게 확장하는 대신 검증 결과를 문서로 남기고 더 작은 단위의 자동화로 방향을 전환했습니다. 시도에서 얻은 기술 검증 자산은 다음 자동화 과제에 재사용됩니다."
    },
    {
      "key": "literacy",
      "title": "AI 리터러시 세션 (AX 실습 시리즈)",
      "subtitle": "월 1회, 30분 실습으로 내 업무 도구를 직접 만들어보는 시간",
      "steps": [
        { "label": "1회차 · 매직 프롬프트로 업무 도구 만들기", "state": "done" },
        { "label": "2회차", "state": "future" },
        { "label": "3회차", "state": "future" },
        { "label": "4회차", "state": "future" },
        { "label": "5회차", "state": "future" }
      ],
      "note": "참석 도장판은 아래 '세션 참석 현황'에서 확인할 수 있어요."
    },
    {
      "key": "automations",
      "title": "작은 단위 자동화",
      "subtitle": "일상 업무를 조금씩 덜어내는 소규모 자동화 모음",
      "steps": [],
      "items": [
        { "label": "교육·행사 입퇴실 & 만족도 집계 자동화", "state": "done" },
        { "label": "다음 자동화 과제 발굴 중 — #talk-ax-idea에 아이디어를 남겨주세요", "state": "current" }
      ],
      "note": "회계 자동화 검증에서 얻은 기술을 작은 과제부터 차례로 적용합니다."
    }
  ]
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test site/tests/data.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add site/attendance.json site/milestones.json site/tests/data.test.mjs
git commit -m "feat(site): 참석·마일스톤 데이터 시드 (회계 Plan A~C는 사실검수 대기 초안)"
```

---

### Task 4: 페이지 뼈대 + 섹션① 마일스톤 렌더

**Files:**
- Create: `site/index.html`, `site/style.css`, `site/app.js`

**Interfaces:**
- Consumes: `CONFIG` (Task 2), milestones/attendance 스키마 (Task 3)
- Produces: `app.js` 내 `renderMilestones(ms, attendance)`, `esc(s)` — 이후 Task 5·6이 같은 파일에 `renderChannels(data)`, `renderAttendance(att, storage)` 추가

- [ ] **Step 1: index.html 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>서울 AI 허브 — AX 여정</title>
<link rel="stylesheet" href="./style.css" />
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🚀 서울 AI 허브 AX 여정</h1>
    <p class="tagline">우리 조직의 AI 전환, 지금 어디까지 왔는지 투명하게 공유합니다.</p>
    <p class="meta" id="meta"></p>
  </header>

  <section id="sec-milestones">
    <h2>AX 프로젝트 마일스톤</h2>
    <div id="tracks"></div>
  </section>

  <section id="sec-channels">
    <h2>AI 채널 활동</h2>
    <div class="grid2">
      <div class="panel"><canvas id="trend" height="180"></canvas><p class="foot-note" id="trendnote"></p></div>
      <div class="panel" id="chcards"></div>
    </div>
    <div id="member-participation"></div>
  </section>

  <section id="sec-attendance">
    <h2>AX 실습 시리즈 — 참석 도장판</h2>
    <p class="hint">이름을 누르면 도장판과 뱃지가 열립니다. 내 이름을 선택하면 다음부터 내 카드가 맨 위에 고정돼요.</p>
    <div id="mycard"></div>
    <div id="members" class="member-list"></div>
  </section>

  <footer>서울 AI 허브 AX · 문의는 #talk-ax-idea 채널로</footer>
</div>
<script type="module" src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 2: style.css 작성** (뼈대 + 마일스톤 트랙; 도장판 스타일은 Task 6에서 추가)

```css
:root{
  --bg:#f7f8fc; --card:#fff; --ink:#1e2430; --sub:#69707f; --line:#e4e7ef;
  --brand:#2563eb; --ok:#16a34a; --warn:#d97706; --violet:#7c3aed; --chip:#eef2ff;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Pretendard','Segoe UI','Malgun Gothic',system-ui,sans-serif;line-height:1.55}
.wrap{max-width:1080px;margin:0 auto;padding:32px 20px 80px}
header h1{font-size:26px;margin:0}
.tagline{color:var(--sub);margin:6px 0 0}
.meta{color:var(--sub);font-size:12.5px}
h2{font-size:17px;margin:44px 0 14px;padding-bottom:8px;border-bottom:2px solid var(--line)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.grid2{display:grid;grid-template-columns:1.5fr 1fr;gap:16px}
@media(max-width:760px){.grid2{grid-template-columns:1fr}}
.foot-note{color:var(--sub);font-size:12px;margin:8px 0 0}
.hint{color:var(--sub);font-size:13px}
footer{margin-top:60px;color:var(--sub);font-size:12.5px;text-align:center}

/* 마일스톤 트랙 */
.track{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:14px}
.track .head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.track h3{margin:0;font-size:15.5px}
.track .subtitle{color:var(--sub);font-size:13px}
.track .pill{font-size:11px;font-weight:700;padding:2px 10px;border-radius:99px}
.pill.ing{background:#eff6ff;color:var(--brand)}
.pill.done{background:#f0fdf4;color:var(--ok)}
.pill.closing{background:#fff7ed;color:var(--warn)}
.steps{display:flex;align-items:flex-start;margin:16px 0 4px;overflow-x:auto;padding-bottom:6px}
.step{flex:1;min-width:90px;text-align:center;position:relative;font-size:12px;color:var(--sub)}
.step .dot{width:14px;height:14px;border-radius:50%;margin:0 auto 6px;background:var(--line);position:relative;z-index:1}
.step.done .dot{background:var(--ok)}
.step.done{color:var(--ink)}
.step.current .dot{background:var(--brand);box-shadow:0 0 0 4px #dbeafe}
.step.current{color:var(--brand);font-weight:650}
.step::before{content:'';position:absolute;top:7px;left:-50%;width:100%;height:2px;background:var(--line)}
.step:first-child::before{display:none}
.step.done::before{background:var(--ok)}
.step.current::before{background:var(--ok)}
.track .note{font-size:13px;color:var(--sub);margin:10px 0 0}
.plans{margin-top:12px}
.plans summary{cursor:pointer;font-size:13px;color:var(--brand);font-weight:600}
.plan{border-left:3px solid var(--line);padding:8px 0 8px 14px;margin:10px 0}
.plan b{font-size:13.5px}
.plan p{margin:3px 0;font-size:13px;color:var(--sub)}
.items li{font-size:13.5px;margin:6px 0}
.items .done::before{content:'✅ '}
.items .current::before{content:'🔄 '}
```

- [ ] **Step 3: app.js — fetch 골격 + 마일스톤 렌더**

```js
// site/app.js
import { CONFIG } from './config.js';
import { heldSessions } from './badges.js';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function fetchJSON(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

function statusPill(track, data) {
  if (track.closing) return '<span class="pill closing">종료 수순 · 검증 완료</span>';
  const p = (data.projects || []).find(x => x.key === track.key);
  if (p && String(p.status).includes('완료')) return '<span class="pill done">완료</span>';
  return '<span class="pill ing">진행 중</span>';
}

export function renderMilestones(ms, attendance, data) {
  const held = heldSessions(attendance.sessions).length;
  const el = document.getElementById('tracks');
  el.innerHTML = ms.tracks.map(t => {
    // 리터러시 트랙은 개최 회차 수만큼 자동 done 처리 (attendance.json 연동)
    let steps = t.steps;
    if (t.key === 'literacy') {
      steps = t.steps.map((s, i) => ({
        ...s,
        state: i < held ? 'done' : (i === held ? 'current' : 'future'),
      }));
    }
    const stepsHtml = steps.length ? `<div class="steps">${steps.map(s =>
      `<div class="step ${s.state}"><div class="dot"></div>${esc(s.label)}</div>`).join('')}</div>` : '';
    const itemsHtml = t.items ? `<ul class="items">${t.items.map(i =>
      `<li class="${i.state}">${esc(i.label)}</li>`).join('')}</ul>` : '';
    const plansHtml = t.plans ? `<details class="plans"><summary>어디까지 시도했나요? (Plan A~C)</summary>${t.plans.map(p =>
      `<div class="plan"><b>${esc(p.name)}</b><p>${esc(p.tried)}</p><p>→ ${esc(p.result)}</p></div>`).join('')}</details>` : '';
    return `<div class="track">
      <div class="head"><h3>${esc(t.title)}</h3>${statusPill(t, data)}<span class="subtitle">${esc(t.subtitle)}</span></div>
      ${stepsHtml}${itemsHtml}${plansHtml}
      ${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}
    </div>`;
  }).join('');
}

async function main() {
  const [data, ms, att] = await Promise.all([
    fetchJSON(CONFIG.dataUrl), fetchJSON(CONFIG.milestonesUrl), fetchJSON(CONFIG.attendanceUrl),
  ]);
  document.getElementById('meta').textContent =
    '자동 갱신 · 마지막 데이터 수집: ' + new Date(data.generated_at).toLocaleString('ko-KR');
  renderMilestones(ms, att, data);
  // Task 5: renderChannels(data);
  // Task 6: renderAttendance(att, window.localStorage);
}
main().catch(e => {
  document.getElementById('meta').textContent = '데이터를 불러오지 못했어요. 잠시 후 새로고침해 주세요.';
  console.error(e);
});
```

주의: `data.json`에서 사용하는 필드는 `generated_at`, `projects[].key`, `projects[].status`, `channel_history`뿐. `headline`/`watch`/`next`/`progress`/`risk`/`deliverable`는 어떤 코드 경로에서도 읽지 않는다.

- [ ] **Step 4: 로컬 렌더 확인**

Run: `cd ~/ax-dashboard && python3 -m http.server 8899` (백그라운드) → 브라우저 `http://localhost:8899/site/`
Expected: 헤더 + 마일스톤 4트랙 렌더 (Guide Check Bot 진행바, 회계 Plan A~C 접힘, 리터러시 1회차 done, 자동화 목록). 콘솔 에러 0 (renderChannels 호출은 아직 주석).

- [ ] **Step 5: Commit**

```bash
git add site/index.html site/style.css site/app.js
git commit -m "feat(site): 페이지 뼈대 + AX 마일스톤 섹션"
```

---

### Task 5: 섹션② 채널 현황판 (+ 작성자 분리 graceful fallback)

**Files:**
- Modify: `site/app.js` (renderChannels 추가, main에서 호출 주석 해제)
- Modify: `site/style.css` (채널 칩 스타일 추가)

**Interfaces:**
- Consumes: `data.channel_history` — `[{date, channel, members, posts_total, posts_today, replies_total, reactions_total, top_emojis}]`
- Produces: `renderChannels(data)`. 확장 필드 `posts_by_members`(구성원 글 수)가 행에 존재하면 "구성원 참여" 카드 자동 표시

- [ ] **Step 1: style.css에 추가**

```css
/* 채널 카드 */
.chchip{border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin-bottom:10px;font-size:13px}
.chchip b{font-size:15px}
.chchip .nm{font-weight:700;margin-bottom:2px}
.emoji{color:var(--sub);font-size:12px;margin-top:3px}
.member-part{margin-top:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px 16px;font-size:13.5px}
```

- [ ] **Step 2: app.js에 renderChannels 추가 + main 주석 해제**

```js
const CH_COLORS = ['#2563eb', '#16a34a', '#d97706'];

export function renderChannels(data) {
  const hist = data.channel_history || [];
  if (!hist.length) {
    document.getElementById('chcards').innerHTML = '<p class="foot-note">채널 데이터가 아직 없어요.</p>';
    return;
  }
  const dates = [...new Set(hist.map(r => r.date))].sort();
  const channels = [...new Set(hist.map(r => r.channel))];
  const latest = hist.filter(r => r.date === dates[dates.length - 1]);

  document.getElementById('chcards').innerHTML =
    '<div style="font-size:13px;color:var(--sub);margin-bottom:8px">채널별 현황 (오늘)</div>' +
    latest.map(c => `<div class="chchip">
      <div class="nm">#${esc(c.channel)}</div>
      멤버 <b>${c.members ?? 0}</b> · 글 <b>${c.posts_total ?? 0}</b> · 댓글 <b>${c.replies_total ?? 0}</b> · 반응 <b>${c.reactions_total ?? 0}</b>
      ${c.top_emojis ? `<div class="emoji">인기 반응: ${esc(c.top_emojis)}</div>` : ''}
    </div>`).join('');

  // 작성자 분리 필드(수집기 확장 후 생김)가 있으면 구성원 참여 카드 표시
  const withMembers = latest.filter(c => typeof c.posts_by_members === 'number');
  if (withMembers.length) {
    const total = withMembers.reduce((a, c) => a + c.posts_by_members, 0);
    document.getElementById('member-participation').innerHTML =
      `<div class="member-part">🙌 구성원이 직접 올린 글 <b>${total}</b>건 — 함께 만드는 채널이 되고 있어요!</div>`;
  }

  new Chart(document.getElementById('trend'), {
    type: 'line',
    data: {
      labels: dates,
      datasets: channels.map((ch, i) => ({
        label: '#' + ch, borderColor: CH_COLORS[i % 3], backgroundColor: CH_COLORS[i % 3],
        tension: .3, pointRadius: 2.5, borderWidth: 2, spanGaps: true,
        data: dates.map(dt => {
          const row = hist.find(r => r.date === dt && r.channel === ch);
          return row ? (row.posts_today || 0) + (row.reactions_total || 0) : null;
        }),
      })),
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                 title: { display: true, text: '일자별 참여 흐름 (새 글 + 누적 반응)', font: { size: 12 } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}
```

main()에서 `renderChannels(data);` 주석 해제.

- [ ] **Step 3: 로컬 확인**

브라우저 새로고침 → 3채널 카드 + 25일치 추이 차트 렌더, `member-participation`은 (필드 없으므로) 비어 있음. 콘솔 에러 0.

- [ ] **Step 4: Commit**

```bash
git add site/app.js site/style.css
git commit -m "feat(site): 채널 현황판 + 구성원 참여 fallback"
```

---

### Task 6: 섹션③ 참석 도장판 (클릭 펼침 + 내 카드 고정 + 스탬프 애니메이션)

**Files:**
- Modify: `site/app.js` (renderAttendance 추가, main 주석 해제)
- Modify: `site/style.css` (도장판·뱃지·애니메이션)

**Interfaces:**
- Consumes: `deriveStamps`/`deriveStreak`/`deriveBadges`/`BADGE_DEFS` (Task 1), `getMyName`/`setMyName`/`clearMyName` (Task 2)
- Produces: `renderAttendance(att, storage)` — 이름 가나다순, 클릭 토글, 내 카드 상단 고정

- [ ] **Step 1: style.css에 추가**

```css
/* 참석 도장판 */
.member-list{display:flex;flex-wrap:wrap;gap:10px}
.member-chip{background:var(--card);border:1px solid var(--line);border-radius:99px;
  padding:8px 18px;font-size:14px;cursor:pointer;transition:all .15s}
.member-chip:hover{border-color:var(--brand);color:var(--brand)}
.member-chip.open{background:var(--brand);color:#fff;border-color:var(--brand)}
.profile-card{background:var(--card);border:1px solid var(--line);border-radius:16px;
  padding:20px 22px;margin:12px 0;width:100%;animation:reveal .25s ease-out}
@keyframes reveal{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.profile-card .top{display:flex;align-items:center;gap:12px}
.avatar{width:44px;height:44px;border-radius:50%;background:var(--chip);color:var(--violet);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px}
.profile-card .who{font-weight:700;font-size:16px}
.streak{font-size:13px;color:var(--warn);font-weight:650}
.stamps{display:flex;gap:12px;margin:16px 0;flex-wrap:wrap}
.stamp{width:64px;text-align:center}
.stamp .circle{width:54px;height:54px;border-radius:50%;border:2px dashed var(--line);
  margin:0 auto 5px;display:flex;align-items:center;justify-content:center;font-size:24px;position:relative}
.stamp.got .circle{border:2px solid var(--ok);background:#f0fdf4;animation:stampin .35s cubic-bezier(.2,1.6,.4,1)}
@keyframes stampin{0%{transform:scale(1.6) rotate(-14deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
.stamp .rv{position:absolute;right:-4px;bottom:-4px;font-size:14px}
.stamp .lb{font-size:10.5px;color:var(--sub)}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.badge-tile{background:var(--chip);border-radius:10px;padding:6px 12px;font-size:12.5px;font-weight:600}
.badge-tile .d{display:block;font-weight:400;font-size:11px;color:var(--sub)}
.mine-actions{margin-top:12px;font-size:12px}
.mine-actions button{border:1px solid var(--line);background:none;border-radius:8px;
  padding:4px 10px;cursor:pointer;color:var(--sub);font-size:12px}
#mycard .profile-card{border:2px solid var(--brand)}
#mycard .mytag{font-size:11px;font-weight:700;color:var(--brand);margin-bottom:6px}
```

- [ ] **Step 2: app.js에 renderAttendance 추가**

```js
import { deriveStamps, deriveStreak, deriveBadges, BADGE_DEFS, heldSessions } from './badges.js';
import { getMyName, setMyName, clearMyName } from './identity.js';
// (기존 import { heldSessions } 라인은 위 한 줄로 통합)

function profileCardHTML(m, att, isMine) {
  const stamps = deriveStamps(m, att.sessions);
  const streak = deriveStreak(m, att.sessions);
  const badges = deriveBadges(m, att.sessions, att.program.total_sessions);
  return `<div class="profile-card">
    ${isMine ? '<div class="mytag">⭐ 내 도장판</div>' : ''}
    <div class="top">
      <div class="avatar">${esc(m.name.slice(0, 1))}</div>
      <div><div class="who">${esc(m.name)}</div>
      ${streak >= 2 ? `<div class="streak">🔥 ${streak}회 연속 참석 중</div>` : ''}</div>
    </div>
    <div class="stamps">${stamps.map(s => `
      <div class="stamp ${s.attended ? 'got' : ''}">
        <div class="circle">${s.attended ? '✅' : ''}${s.review ? '<span class="rv">✍️</span>' : ''}</div>
        <div class="lb">${s.no}회차</div>
      </div>`).join('')}</div>
    <div class="badges">${badges.map(k => {
      const d = BADGE_DEFS[k];
      return `<div class="badge-tile">${d.emoji} ${esc(d.label)}<span class="d">${esc(d.desc)}</span></div>`;
    }).join('') || '<span class="foot-note">다음 세션에서 첫 뱃지를 받아보세요 🌱</span>'}</div>
    ${isMine ? `<div class="mine-actions"><button id="unset-me">내 이름 선택 해제</button></div>` : ''}
  </div>`;
}

export function renderAttendance(att, storage) {
  const membersEl = document.getElementById('members');
  const myEl = document.getElementById('mycard');
  const sorted = [...att.members].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const myName = getMyName(storage);
  let openName = null;

  function draw() {
    const mine = sorted.find(m => m.name === myName);
    myEl.innerHTML = mine ? profileCardHTML(mine, att, true) : '';
    if (mine) document.getElementById('unset-me').onclick = () => { clearMyName(storage); location.reload(); };

    membersEl.innerHTML = sorted.filter(m => m.name !== myName).map(m =>
      `<button class="member-chip ${openName === m.name ? 'open' : ''}" data-name="${esc(m.name)}">${esc(m.name)}</button>`
    ).join('');
    const openM = sorted.find(m => m.name === openName && m.name !== myName);
    if (openM) membersEl.insertAdjacentHTML('beforeend', profileCardHTML(openM, att, false));

    membersEl.querySelectorAll('.member-chip').forEach(btn => {
      btn.onclick = () => {
        const name = btn.dataset.name;
        if (!myName) {
          // 첫 클릭 시 내 이름인지 물어봄 → 내 카드 고정 (은근한 개인화)
          if (confirm(`'${name}' — 내 이름으로 고정할까요?\n(취소하면 카드만 열어봅니다)`)) {
            setMyName(storage, name);
            location.reload();
            return;
          }
        }
        openName = openName === name ? null : name;
        draw();
      };
    });
  }
  draw();
}
```

main()에서 `renderAttendance(att, window.localStorage);` 주석 해제.

- [ ] **Step 3: 파생 로직 회귀 확인**

Run: `node --test site/tests/`
Expected: 전체 PASS (badges 5 + identity 1 + data 3)

- [ ] **Step 4: 로컬 브라우저 검증**

`http://localhost:8899/site/` 새로고침:
1. 이름 3개 가나다순(이슬기·장문석·정준호) 칩 표시, 도장 수 비노출 ✓
2. 칩 클릭 → confirm 취소 → 카드 펼침: 1회차 도장(✅+✍️ 마크, 스탬프 애니메이션), 빈 칸 4개(X 없음), 뱃지 🌱✍️🚀 ✓
3. 다른 칩 클릭 시 이전 카드 닫힘(토글) ✓
4. confirm 수락 → 새로고침 후 내 카드 상단 고정(⭐ 내 도장판, 파란 테두리), 칩 목록에서 내 이름 제외 ✓
5. "내 이름 선택 해제" 동작 ✓
6. 모바일 뷰(375px)에서 도장판 줄바꿈 정상 ✓

- [ ] **Step 5: Commit**

```bash
git add site/app.js site/style.css
git commit -m "feat(site): 참석 도장판 — 클릭 펼침·내 카드 고정·뱃지 6종"
```

---

### Task 7: 배포·백로그 문서

**Files:**
- Create: `docs/deploy-vps.md`, `docs/collector-extension.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: 없음 (문서만)
- Produces: VPS 배포 절차(nginx+cron), 수집기 확장 스펙 2건(참석 자동 추출·작성자 분리)

- [ ] **Step 1: docs/deploy-vps.md 작성**

````markdown
# 직원용 AX 사이트 — VPS 배포 가이드

Guide Check Bot이 돌고 있는 VPS에 정적 서빙으로 올린다. 서버 앱 불필요.

## 1) 최초 1회 설정 (VPS에서)

```bash
sudo git clone https://github.com/hyeonheebee/ax-dashboard.git /opt/ax-dashboard
sudo tee /etc/nginx/sites-available/ax-site <<'EOF'
server {
    listen 8080;                     # Guide Check Bot 포트와 겹치지 않게 조정
    root /opt/ax-dashboard;
    index index.html;
    location / { try_files $uri $uri/ =404; }
    add_header Cache-Control "no-cache";
}
EOF
sudo ln -s /etc/nginx/sites-available/ax-site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 2) 자동 갱신 (cron, 1분마다 pull)

```bash
( crontab -l 2>/dev/null; echo '* * * * * cd /opt/ax-dashboard && git pull --ff-only >> /var/log/ax-pull.log 2>&1' ) | crontab -
```

이후 갱신 경로:
- 프로젝트·채널 데이터: 회사 컴 수집기 push → 1분 내 반영 (기존 파이프라인)
- 참석 기록: attendance.json 수정·push → 1분 내 반영
- 사이트 코드: push만 하면 배포 끝

## 3) 직원 공유 URL

`http://<VPS주소>:8080/site/` — 슬랙 채널 북마크에 등록 권장.
(루트 `/`는 운영 현황판이므로 직원 공유 링크는 반드시 `/site/`로.)

## 4) 추후 HTTPS/도메인 (Google 로그인 대비)

Google 로그인(seoulaihub.kr 계정)을 붙이려면 도메인 + HTTPS(Let's Encrypt)가 선행 조건.
그 시점에 `site/identity.js`만 Google Identity Services 기반으로 교체하면 된다.
````

- [ ] **Step 2: docs/collector-extension.md 작성**

````markdown
# 수집기 확장 스펙 (백로그) — 회사 컴 수집기에 적용

직원용 사이트는 아래 필드가 생기면 **자동으로** 추가 표시된다 (사이트 코드 수정 불필요).

## 확장 1: 채널 글 작성자 분리 집계

`channel_history` 각 행에 추가:

```json
{
  "posts_by_operator": 12,     // 운영자(심현희) 작성 글 수 (누적)
  "posts_by_members": 3,       // 그 외 구성원 작성 글 수 (누적)
  "member_authors_today": []   // 오늘 글 쓴 구성원 표시명 목록 (선택)
}
```

- 판별: 메시지 `user` ID == 운영자 Slack ID → operator, 그 외 → members (봇 제외)
- 사이트 동작: `posts_by_members`가 존재하면 "구성원 참여" 카드 자동 렌더

## 확장 2: 세션 참석 자동 추출

세션 공지 메시지(공지 채널의 특정 메시지 ts)를 `session_posts.json` 등으로 등록해 두고,
해당 스레드의 **댓글 작성자**를 수집해 `site/attendance.json`의 `members[].attended`/`reviews`에 merge:

- 스레드에 댓글 작성 = 후기 제출 = 참석 확정 (`attended` + `reviews` 동시 추가)
- 표시명 매핑 테이블(Slack user ID → 실명) 필요
- merge 시 기존 수기 기록은 보존 (합집합)
````

- [ ] **Step 3: README.md 업데이트**

```markdown
# ax-dashboard

서울 AI 허브 AX 데이터 + 대시보드.

- `data.json` — 회사 컴 수집기가 매일 12·17시 자동 push (슬랙 3채널 + 프로젝트 현황)
- `index.html` — 운영 현황판 (운영자용)
- `site/` — **직원용 AX 사이트** (마일스톤·채널 활동·세션 참석 도장판) → 배포: `docs/deploy-vps.md`
- 참석 기록 갱신: `site/attendance.json` 수정 후 push (형식: 같은 파일 참고)
- 테스트: `node --test site/tests/`
```

- [ ] **Step 4: Commit**

```bash
git add docs/deploy-vps.md docs/collector-extension.md README.md
git commit -m "docs: VPS 배포 가이드 + 수집기 확장 백로그 스펙"
```

---

### Task 8: 통합 검증 + push

**Files:**
- Modify: 검증 중 발견된 결함 수정만

- [ ] **Step 1: 전체 테스트**

Run: `node --test site/tests/`
Expected: 전체 PASS

- [ ] **Step 2: 엣지 케이스 수동 검증** (브라우저 devtools에서 fetch 스텁 또는 임시 데이터로)

1. `attendance.json`의 `members: []` → 참석 섹션이 빈 목록으로 렌더, 에러 없음
2. `data.json` fetch 실패 시(오프라인) → meta에 안내 문구, 콘솔 외 사용자 노출 에러 없음
3. 운영자 멘트 유출 스캔: 페이지 전체 텍스트에 "검수", "판단만", "심현희님" 미포함 확인 — devtools에서 `document.body.innerText.match(/검수|판단만|심현희님/)` → null

- [ ] **Step 3: 최종 육안 확인 + 스크린샷** (3섹션 데스크톱/모바일)

- [ ] **Step 4: push**

```bash
git push origin main
```

Expected: GitHub 반영. VPS 셋업(docs/deploy-vps.md)은 회사에서 사용자가 수행 — 사이트는 로컬 검증 완료 상태로 전달.

---

## Self-Review 결과

- 스펙 커버리지: §1 아키텍처(T2·T7), §2 마일스톤+Plan A~C(T3·T4), §3 채널+작성자분리 fallback(T5), §4 참석판·뱃지 6종·내 카드(T1·T3·T6), §5 갱신 플로우(T7), §6 이론 반영(문구는 T3·T6에 내장), §7 성공판단(T6 Step4·T8), §8 테스트(T8) — 누락 없음
- 금지어·운영자 멘트: 데이터 레벨(T3 테스트) + 렌더 레벨(T8 스캔) 이중 확인
- 타입 일관성: `deriveStamps/deriveStreak/deriveBadges/BADGE_DEFS/heldSessions`·`getMyName/setMyName/clearMyName` 명칭 전 태스크 일치 확인
