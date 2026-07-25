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
