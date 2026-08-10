/**
 * (합쳐졌다) 실기기 허브 감사 — 실제 구현은 `scripts/browser-test/audit-hub.js` 한 곳이다.
 *
 * 왜 (2026-08-10): 같은 화면을 두 벌로 재고 있었다. 눈이 둘이면 한쪽만 고치는 날이 오고,
 * 그때부터 두 결과가 조용히 어긋난 채로 남는다. → 재는 눈은 하나, 붙는 방법만 옵션으로.
 *
 * 이 파일은 옛 명령을 쓰던 사람이 막히지 않게 넘겨주기만 한다.
 */
'use strict';
console.log('ℹ️  이 도구는 합쳐졌다 → scripts/browser-test/audit-hub.js --phone');
process.argv.push('--phone');
require('../browser-test/audit-hub.js');
