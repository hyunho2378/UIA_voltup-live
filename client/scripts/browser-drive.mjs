import { chromium, devices } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
const root = resolve(process.cwd(), 'test-artifacts/드라이브');
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).map((line) => {
  const i = line.indexOf('=');
  return i > 0 ? [line.slice(0, i), line.slice(i + 1).trim()] : [];
}).filter(([key]) => key));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const consoleErrors = [];
const report = { baseURL, maxConcurrentConnections: 5, steps: [], consoleErrors, failures: [], wordCloud: 'not-run' };

await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
let screenContext, mobile1Context, mobile2Context, adminContext, mobile3Context;

const fail = (message) => { report.failures.push(message); throw new Error(message); };
const expect = async (name, predicate) => {
  try { await predicate(); } catch (error) { fail(`${name}: ${error.message}`); }
};
const count = async (questionId) => (await db.from('votes').select('*', { count: 'exact', head: true }).eq('question_id', questionId)).count;
const allCount = async () => (await db.from('votes').select('*', { count: 'exact', head: true })).count;
const listen = (page, name) => page.on('console', (message) => {
  if (message.type() === 'error' && !/status of (409|501)/.test(message.text())) consoleErrors.push({ page: name, text: message.text() });
});
const hideDev = async (page) => page.addStyleTag({ content: 'aside { display: none !important; }' });
const snap = async (step, screen, mobile, admin) => {
  await Promise.all([
    screen.screenshot({ path: `${root}/${step}-screen.png`, fullPage: true }),
    mobile.screenshot({ path: `${root}/${step}-mobile.png`, fullPage: true }),
    admin.screenshot({ path: `${root}/${step}-admin.png`, fullPage: true }),
  ]);
  report.steps.push(step);
};
const control = (page, body, allowError = false) => page.evaluate(async ({ payload, allowError: permitted }) => {
  const response = await fetch('/__dev__/session-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const json = await response.json();
  if (!response.ok && !permitted) throw new Error(json?.error || String(response.status));
  return json;
}, { payload: body, allowError });
const waitText = (page, text) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 8000 });

try {
  const { data: questions, error } = await db.from('questions').select('id, order_no, type').order('order_no');
  if (error) throw error;
  const [q1, q2] = questions.filter((question) => question.type === 'choice');
  const q3 = questions.find((question) => question.type === 'text');
  if (!q1 || !q2 || !q3) fail('객관식 질문 2개와 주관식 질문 1개가 필요합니다.');

  screenContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  mobile1Context = await browser.newContext({ ...devices['iPhone 13'] });
  mobile2Context = await browser.newContext({ ...devices['iPhone 13'] });
  adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const screen = await screenContext.newPage();
  const mobile1 = await mobile1Context.newPage();
  const mobile2 = await mobile2Context.newPage();
  const admin = await adminContext.newPage();
  for (const [page, name] of [[screen, 'screen'], [mobile1, 'mobile1'], [mobile2, 'mobile2'], [admin, 'admin']]) listen(page, name);
  await Promise.all([screen.goto(`${baseURL}/screen`), mobile1.goto(`${baseURL}/vote`), mobile2.goto(`${baseURL}/vote`), admin.goto(`${baseURL}/vote`)]);
  await Promise.all([hideDev(screen), hideDev(mobile1), hideDev(mobile2)]);

  const login = await adminContext.newPage();
  listen(login, 'admin-login');
  await login.goto(`${baseURL}/admin/login`);
  await login.screenshot({ path: `${root}/admin-login.png`, fullPage: true });
  await login.close();

  await control(admin, { action: 'reset', scope: 'all' });
  await expect('S0 screen QR', () => screen.getByRole('img').waitFor({ state: 'visible', timeout: 8000 }));
  await snap('S0-standby', screen, mobile1, admin);

  await control(admin, { action: 'set_question', questionId: q1.id });
  await expect('S1 mobile question', () => mobile1.locator('h1').waitFor({ state: 'visible', timeout: 8000 }));
  await expect('S1 no mobile options', async () => { if (await mobile1.locator('ul button').count()) throw new Error('선택지가 보입니다'); });
  await snap('S1-question', screen, mobile1, admin);

  await admin.getByRole('button', { name: '투표 열기' }).click();
  await expect('S2 mobile1 realtime open', () => mobile1.locator('ul button').first().waitFor({ state: 'visible', timeout: 8000 }));
  await expect('S2 mobile2 realtime open', () => mobile2.locator('ul button').first().waitFor({ state: 'visible', timeout: 8000 }));
  await snap('S2-open', screen, mobile1, admin);

  await mobile1.locator('ul button').first().click();
  await mobile1.getByRole('button', { name: '투표하기' }).click();
  await waitText(mobile1, '투표했어요');
  await mobile2.locator('ul button').nth(1).click();
  await mobile2.getByRole('button', { name: '투표하기' }).click();
  await waitText(mobile2, '투표했어요');
  await snap('S3-votes', screen, mobile1, admin);

  await admin.getByRole('button', { name: '결과 공개' }).click();
  await expect('S4 screen bars', () => screen.locator('.bar-fill').first().waitFor({ state: 'visible', timeout: 8000 }));
  if (await count(q1.id) !== 2) fail('S4 DB count가 2가 아닙니다.');
  await mobile1.reload(); await hideDev(mobile1);
  await mobile1.locator('ul button').first().click();
  await mobile1.getByRole('button', { name: '투표하기' }).click();
  await waitText(mobile1, '이미 투표했어요');
  await snap('S4-results', screen, mobile1, admin);

  mobile3Context = await browser.newContext({ ...devices['iPhone 13'] });
  const mobile3 = await mobile3Context.newPage();
  listen(mobile3, 'mobile3');
  await mobile3.goto(`${baseURL}/vote`); await hideDev(mobile3);
  await mobile3.locator('ul button').last().click();
  await mobile3.getByRole('button', { name: '투표하기' }).click();
  await expect('S5 screen realtime third vote', () => screen.getByText('3명 참여').waitFor({ state: 'visible', timeout: 8000 }));
  if (await count(q1.id) !== 3) fail('S5 DB count가 3이 아닙니다.');
  await snap('S5-live-update', screen, mobile1, admin);

  await admin.getByRole('button', { name: '다음 질문' }).click();
  await expect('S6 stale cleared', () => screen.locator('.bar-fill').first().waitFor({ state: 'detached', timeout: 8000 }));
  await admin.getByRole('button', { name: '투표 열기' }).click();
  await mobile1.locator('ul button').first().click(); await mobile1.getByRole('button', { name: '투표하기' }).click();
  await admin.getByRole('button', { name: '결과 공개' }).click();
  await expect('S6 Q2 results', () => screen.locator('.bar-fill').first().waitFor({ state: 'visible', timeout: 8000 }));
  if (await count(q2.id) !== 1) fail('S6 Q2 DB count가 1이 아닙니다.');
  await snap('S6-q2', screen, mobile1, admin);

  await admin.getByRole('button', { name: '다음 질문' }).click();
  await admin.getByRole('button', { name: '투표 열기' }).click();
  await expect('S7 text input', () => mobile1.locator('input[placeholder="한 단어로"]').waitFor({ state: 'visible', timeout: 8000 }));
  for (const [page, word] of [[mobile1, '미래'], [mobile2, '미래'], [mobile3, '연결']]) {
    await page.locator('input[placeholder="한 단어로"]').fill(word);
    await page.getByRole('button', { name: '투표하기' }).click();
    await waitText(page, '투표했어요');
  }
  await admin.getByRole('button', { name: '결과 공개' }).click();
  await expect('S7 text bars', () => screen.getByText('미래').waitFor({ state: 'visible', timeout: 8000 }));
  if (await count(q3.id) !== 3) fail('S7 Q3 DB count가 3이 아닙니다.');
  const cloudResponse = await control(admin, { action: 'view_cloud' }, true);
  if (cloudResponse?.error === 'results_view_not_migrated') {
    report.wordCloud = 'skipped: migration 0007 not applied';
  } else {
    report.wordCloud = 'pass';
    await expect('S7 word cloud', () => screen.locator('.cloud-word').first().waitFor({ state: 'visible', timeout: 8000 }));
  }
  await snap('S7-word-cloud', screen, mobile1, admin);
  if (report.wordCloud === 'pass') await admin.getByRole('button', { name: '막대로' }).click();

  await admin.getByRole('button', { name: '이 질문 초기화' }).click();
  await expect('S8 reset hides bars', () => screen.locator('.bar-fill').first().waitFor({ state: 'detached', timeout: 8000 }));
  if (await count(q3.id) !== 0 || await count(q1.id) !== 3 || await count(q2.id) !== 1) fail('S8 질문별 초기화 보존 조건 실패');
  await snap('S8-reset', screen, mobile1, admin);

  await admin.getByRole('button', { name: '대기로' }).click();
  await expect('S9 standby QR', () => screen.getByRole('img').waitFor({ state: 'visible', timeout: 8000 }));
  await snap('S9-standby', screen, mobile1, admin);
  if (consoleErrors.length) fail(`console errors: ${JSON.stringify(consoleErrors)}`);
} catch (error) {
  if (!report.failures.length) report.failures.push(error.message);
} finally {
  await db.from('votes').delete().not('id', 'is', null);
  const { data: session } = await db.from('sessions').update({ status: 'standby', voting_open: false, results_visible: false }).eq('id', '00000000-0000-0000-0000-000000000001').select().single();
  report.cleanup = { votes: await allCount(), session };
  await Promise.all([screenContext?.close(), mobile1Context?.close(), mobile2Context?.close(), mobile3Context?.close(), adminContext?.close()]);
  await browser.close();
  await writeFile(`${root}/browser-drive-report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ steps: report.steps, failures: report.failures, cleanup: report.cleanup, maxConcurrentConnections: report.maxConcurrentConnections }, null, 2));
if (report.failures.length || report.cleanup.votes !== 0 || report.cleanup.session.status !== 'standby') process.exit(1);
