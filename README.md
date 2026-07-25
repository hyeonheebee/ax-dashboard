# ax-dashboard

서울 AI 허브 AX 데이터 + 대시보드.

- `data.json` — 회사 컴 수집기가 매일 12·17시 자동 push (슬랙 3채널 + 프로젝트 현황)
- `index.html` — 운영 현황판 (운영자용)
- `site/` — **직원용 AX 사이트** (마일스톤·채널 활동·세션 참석 도장판) → 배포: `docs/deploy-vps.md`
- 참석 기록 갱신: `site/attendance.json` 수정 후 push (형식: 같은 파일 참고)
- 테스트: `node --test site/tests/`
