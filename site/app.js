// site/app.js
import { CONFIG } from './config.js';
import { deriveStamps, deriveStreak, deriveBadges, BADGE_DEFS, heldSessions } from './badges.js';
import { getMyName, setMyName, clearMyName } from './identity.js';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CH_COLORS = ['#1E5EFF', '#FFD43B', '#3DDC97'];
const AXIS = { ticks: { color: '#93A3C7', font: { size: 10.5 } }, grid: { color: 'rgba(148,170,220,.08)' } };

let chartDrawn = false;

export function renderChannels(data) {
  const hist = data.channel_history || [];
  if (!hist.length) {
    document.getElementById('chcards').innerHTML = '<p class="foot-note">채널 데이터가 아직 없어요.</p>';
    return;
  }
  const dates = [...new Set(hist.map(r => r.date))].sort();
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
  const total = withMembers.reduce((a, c) => a + c.posts_by_members, 0);
  if (withMembers.length && total > 0) {
    document.getElementById('member-participation').innerHTML =
      `<div class="member-part">🙌 구성원이 직접 올린 글 <b>${total}</b>건 — 함께 만드는 채널이 되고 있어요!</div>`;
  }
}

// 차트는 채널 탭이 처음 열릴 때 그린다 (숨김 탭에서 그리면 폭이 0으로 잡힘)
export function drawTrendOnce(data) {
  if (chartDrawn || typeof Chart === 'undefined') return;
  const hist = data.channel_history || [];
  if (!hist.length) return;
  const dates = [...new Set(hist.map(r => r.date))].sort();
  const channels = [...new Set(hist.map(r => r.channel))];
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
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: '#93A3C7' } },
        title: { display: true, text: '일자별 참여 흐름 (새 글 + 누적 반응)', font: { size: 12 }, color: '#EAF0FC' },
      },
      scales: { y: { beginAtZero: true, ticks: { ...AXIS.ticks, precision: 0 }, grid: AXIS.grid }, x: AXIS },
    },
  });
  chartDrawn = true;
}

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
  if (myName && !sorted.some(m => m.name === myName)) { clearMyName(storage); location.reload(); return; }
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

// ── 홈 탭: 요약 카드 (클릭 시 해당 탭으로 이동) ──
export function renderHome(data, ms, att) {
  const held = heldSessions(att.sessions).length;
  const total = att.program.total_sessions;
  const doneTracks = ms.tracks.filter(t => t.closing || (data.projects || []).some(p => p.key === t.key && String(p.status).includes('완료'))).length;
  const hist = data.channel_history || [];
  const dates = [...new Set(hist.map(r => r.date))].sort();
  const latest = hist.filter(r => r.date === dates[dates.length - 1]);
  const posts = latest.reduce((a, c) => a + (c.posts_total || 0), 0);
  const reactions = latest.reduce((a, c) => a + (c.reactions_total || 0), 0);

  const cards = [
    { tab: 'milestones', ico: '🚀', title: '프로젝트 마일스톤', num: `${ms.tracks.length}개 트랙`, desc: `진행 상황 투명 공개 · 완료/전환 ${doneTracks}건 포함` },
    { tab: 'channels', ico: '💬', title: 'AI 채널 활동', num: `글 ${posts} · 반응 ${reactions}`, desc: '3개 채널 참여 흐름, 매일 자동 집계' },
    { tab: 'stamps', ico: '🏅', title: '참석 도장판', num: `${held}/${total}회차`, desc: `AX 실습 시리즈 · 참석자 ${att.members.length}명의 도장과 뱃지` },
  ];
  document.getElementById('home-cards').innerHTML = cards.map(c => `
    <div class="home-card" data-tab="${c.tab}">
      <div class="hc-ico">${c.ico}</div>
      <h3>${esc(c.title)}</h3>
      <div class="hc-num">${esc(c.num)}</div>
      <p>${esc(c.desc)}</p>
    </div>`).join('');
  document.querySelectorAll('.home-card').forEach(el => el.onclick = () => activateTab(el.dataset.tab));
}

// ── 우측 레일 ──
function renderRail(data, att) {
  const next = att.sessions.find(s => !s.held);
  const nextTitle = next && !/^\d+회차/.test(next.title) ? `<br />${esc(next.title)}` : '';
  document.getElementById('rail-next-session').innerHTML = next
    ? `<b>${next.no}회차</b> · ${next.date ? esc(next.date) : '일정 준비 중'}${nextTitle}`
    : '전 회차가 마무리되었습니다 🎉';

  const hist = data.channel_history || [];
  const dates = [...new Set(hist.map(r => r.date))].sort();
  const latest = hist.filter(r => r.date === dates[dates.length - 1]);
  document.getElementById('rail-channels').innerHTML = latest.length
    ? latest.map(c => `<div class="rail-ch"><span>#${esc(c.channel)}</span><b>글 ${c.posts_total ?? 0}</b></div>`).join('')
    : '데이터 준비 중';
}

// ── 탭 라우터 ──
const TITLES = { home: '홈', milestones: 'AX 프로젝트 마일스톤', channels: 'AI 채널 활동', stamps: 'AX 실습 시리즈 — 참석 도장판' };
let loaded = null; // {data, ms, att}

function activateTab(name) {
  if (!TITLES[name]) name = 'home';
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.id === 'tab-' + name));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === name));
  document.getElementById('page-title').textContent = TITLES[name];
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (name === 'channels' && loaded) drawTrendOnce(loaded.data);
}

function initTabs() {
  document.querySelectorAll('.nav-item').forEach(btn => btn.onclick = () => activateTab(btn.dataset.tab));
  window.addEventListener('hashchange', () => activateTab(location.hash.slice(1)));
}

async function main() {
  initTabs();
  const [data, ms, att] = await Promise.all([
    fetchJSON(CONFIG.dataUrl), fetchJSON(CONFIG.milestonesUrl), fetchJSON(CONFIG.attendanceUrl),
  ]);
  loaded = { data, ms, att };
  const stamp = new Date(data.generated_at).toLocaleString('ko-KR');
  document.getElementById('meta').textContent = '자동 갱신 · 마지막 데이터 수집: ' + stamp;
  document.getElementById('side-updated').textContent = stamp;
  try { renderHome(data, ms, att); } catch (e) { console.error(e); }
  try { renderMilestones(ms, att, data); } catch (e) { console.error(e); }
  try { renderChannels(data); } catch (e) { console.error(e); }
  try { renderAttendance(att, window.localStorage); } catch (e) { console.error(e); }
  try { renderRail(data, att); } catch (e) { console.error(e); }
  activateTab(location.hash.slice(1) || 'home');
}
main().catch(e => {
  document.getElementById('meta').textContent = '데이터를 불러오지 못했어요. 잠시 후 새로고침해 주세요.';
  console.error(e);
});
