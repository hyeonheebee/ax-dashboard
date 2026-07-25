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
