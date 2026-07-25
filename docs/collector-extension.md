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
