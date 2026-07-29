# HANDOFF — 서울 AI 허브 직원용 AX 사이트

> 이 문서가 이 프로젝트의 맥락 SSOT. 새 세션(개인 맥북·회사 컴퓨터 어디서든)은 이 파일부터 읽는다.
> 마지막 갱신: 2026-07-28

## 한 줄 요약

전직원 공개 AX 현황 사이트. **라이브: `http://187.127.125.127:8080/site/`** (반드시 `/site/` 경로로 공유 — 루트 `/`는 운영자용 현황판).

## 무엇이 있나 (탭 4개)

1. **홈** — 히어로 + 섹션 요약 카드 3장
2. **프로젝트 마일스톤** — Guide Check Bot / 회계 기입 자동화(SRnD-민간위탁시스템, 종료 수순 — Plan A~C 시도 이력 투명 공개) / AI 리터러시 세션 5회차 / 작은 단위 자동화
3. **AI 채널 활동** — 슬랙 3채널(#talk-ai-tips, #talk-ai-tech-trends, #talk-ax-idea) 일자별 추이 + 오늘 현황
4. **참석 도장판** — 이름만 공개 → 클릭하면 도장판·스트릭·뱃지 6종 펼침. 내 이름 선택 시 localStorage로 내 카드 상단 고정. 탭 딥링크: `#stamps`

## 아키텍처 (정적 사이트 + 자동 갱신)

```
회사 컴 수집기 ──(매일 12·17시 push)──▶ GitHub main: data.json
수동/Claude ──(수정 push)──▶ site/attendance.json, site/milestones.json
GitHub main ──(VPS cron 1분 git pull)──▶ nginx(8080) 정적 서빙
```

- `site/config.js` — 데이터 URL 단일 소스 (Flask API 전환 시 여기만 교체)
- `site/badges.js` — 도장·스트릭·뱃지 파생 순수 로직 (뱃지는 데이터에 저장하지 않고 항상 계산)
- `site/app.js` — 탭 라우터(해시) + 렌더. 차트는 채널 탭 첫 진입 시 lazy 렌더
- `site/attendance.json` — 세션·참석 기록 (아래 "운영" 참조)
- `site/milestones.json` — 직원용 마일스톤 문구 큐레이션
- 테스트: `node --test site/tests/*.test.mjs` (9개 — 스키마·금지어·뱃지 규칙)

## 절대 규칙 (스펙 구속)

- **운영자 멘트 금지**: data.json의 `headline/watch/next/progress/risk/deliverable` 필드는 어떤 코드에서도 읽지 않는다
- **랭킹 금지**: 참석자 정렬은 가나다순만. 미참석 X표시 금지, 스트릭 압박 문구 금지
- **명칭 고정**: "Guide Check Bot"(지침검수봇 표기 금지), "회계 기입 자동화 (SRnD-민간위탁시스템)"
- **루트 `index.html`·`data.json` 스키마 무수정** (수집기 파이프라인 보호)
- 디자인: 코발트 블루(#1E5EFF/#0047AB) 메인 + 카나리 옐로우(#FFD43B) 포인트, 딥 네이비 다크

## 운영 (반복 작업)

**세션 후 참석 기록 갱신** — `site/attendance.json`:
1. `sessions`에서 해당 회차 `held: true` + `date` 입력
2. 참석자마다 `attended`에 회차 번호 추가, 후기 스레드 작성자는 `reviews`에도, 실습 결과물 공유자는 `maker`에도
3. 신규 참석자는 `members`에 객체 추가 (스키마는 기존 항목 복사)
4. commit + push → 1분 내 사이트 반영. 도장·스트릭·뱃지는 전부 자동 재계산

**마일스톤 문구 갱신** — `site/milestones.json`의 `steps[].state`(done/current/future)·`note` 수정 후 push.

## 인프라

- VPS: Hostinger KVM2, Ubuntu 24.04, srv1796289.hstgr.cloud. nginx 8080 + cron `* * * * * git pull --ff-only` (로그 `/root/ax-pull.log`)
- 배포 절차·재설치: `docs/deploy-vps.md`
- 개인 맥북에서 SSH: `ssh aihub-vps` (전용 키, 로컬 ~/.ssh/config에 정의 — 키는 repo에 없음)

## 백로그 (다음 작업 후보)

1. **수집기 확장 2건** — `docs/collector-extension.md` 스펙 완성됨. ①세션 공지 스레드 댓글 작성자 자동 추출(참석 기록 완전 자동화) ②채널 글 작성자 분리 집계(운영자 vs 구성원) — 필드가 생기면 사이트는 수정 없이 자동 표시
2. **Google 로그인(seoulaihub.kr)** — `site/identity.js`만 교체하면 됨. 선행 조건: 도메인+HTTPS. 진짜 비공개 프로필이 필요해지면 Flask 전환(config.js만 교체)
3. 동명이인 대비 — 현재 이름 유니크 테스트로 방어 중, 실제 발생 시 구분자(부서) UI 추가
4. badges.js attended 중복 dedup 방어 한 줄 (`new Set().size`)

## 문서 위치

- 설계 스펙: `docs/superpowers/specs/2026-07-25-ax-employee-site-design.md`
- 구현 계획(완료): `docs/superpowers/plans/2026-07-25-ax-employee-site.md`
- 배포 가이드: `docs/deploy-vps.md` / 수집기 확장: `docs/collector-extension.md`
