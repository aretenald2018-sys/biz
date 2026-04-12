// 전체 자산에 대해 capture + extract 을 일괄 실행.
// 사용: node scripts/terms-bulk-process.mjs [--force]

const FORCE = process.argv.includes('--force');
const API = 'http://localhost:3001';

async function jsonFetch(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, payload };
}

const { ok: ok1, payload: assets } = await jsonFetch(`${API}/api/terms/assets`);
if (!ok1) { console.error('asset 목록 조회 실패'); process.exit(1); }
console.log(`총 자산 ${assets.length}건 처리 시작`);

let succeeded = 0, unchanged = 0, blocked = 0, failed = 0;
const blockedUrls = [];

for (const asset of assets) {
  const cap = await jsonFetch(`${API}/api/terms/documents/capture/${asset.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: FORCE }),
  });

  if (!cap.ok) {
    const httpStatus = cap.payload?.http_status;
    if (httpStatus === -1 || (httpStatus != null && httpStatus >= 400) || cap.payload?.blocked_by_robots) {
      blocked++;
      blockedUrls.push(asset.url);
      console.log(`  [차단] ${asset.market_entity} ${asset.url}`);
    } else {
      failed++;
      console.log(`  [실패] ${asset.market_entity} ${asset.url} - ${cap.payload?.error || cap.status}`);
    }
    continue;
  }

  const ver = cap.payload;
  if (ver?.id && (ver.change_kind === 'new' || ver.change_kind === 'normalized_change')) {
    const ex = await jsonFetch(`${API}/api/terms/facts/extract/${ver.id}`, { method: 'POST' });
    if (ex.ok) {
      succeeded++;
      const p = ex.payload || {};
      console.log(`  [분석] ${asset.market_entity} ${asset.url} - ${p.processing ?? 0}pf / ${p.transfer ?? 0}tf`);
    } else {
      failed++;
      console.log(`  [추출실패] ${asset.market_entity} ${asset.url} - ${ex.payload?.error || ex.status}`);
    }
  } else {
    unchanged++;
  }
}

console.log('\n=== 요약 ===');
console.log(`신규 분석: ${succeeded}건 / 변경 없음: ${unchanged}건 / 차단: ${blocked}건 / 실패: ${failed}건`);
if (blockedUrls.length) {
  console.log('\n차단된 URL (수동 업로드 필요):');
  for (const u of blockedUrls) console.log('  -', u);
}
