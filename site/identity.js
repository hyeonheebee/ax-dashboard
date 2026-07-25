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
