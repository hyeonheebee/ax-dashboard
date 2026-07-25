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
