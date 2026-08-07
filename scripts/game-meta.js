/**
 * 게임 13종의 '바깥에 보여줄 정보' 한 벌 — 이름·한 줄 설명·소요시간·자동 캡처 방법.
 *
 * 왜 한 곳에 두나 (2026-08-07)
 *   링크 미리보기 태그(add-og-tags.js)와 미리보기 카드(make-og-card.js)가 각자 같은 문구를
 *   들고 있으면 반드시 어긋난다 — 한쪽만 고치는 날이 온다. 카드에 적힌 시간과 태그에 적힌 시간이
 *   다르면 그건 그냥 거짓말이 된다.
 *
 * 시간 표기는 허브 배지와 같은 값이다(`balance-sim.js` 실측 기준). 게임 밸런스를 바꾸면 여기도 같이 고칠 것.
 */
'use strict';

module.exports = {
  kb:          { name: '너클본즈',     desc: '주사위를 굴려 상대 줄을 부순다',        time: '1분 안팎',  start: '#startBtn',   wait: 2600 },
  yacht:       { name: '요트 다이스',   desc: '주사위 다섯 개로 열두 칸을 채운다',      time: '2~3분',    start: '#startLocal', wait: 2600 },
  ld:          { name: '라이어 다이스', desc: '허풍과 도전으로 주사위를 지킨다',        time: '1~2분',    start: '#startBtn',   wait: 3000 },
  lcr:         { name: '좌·중·우',     desc: '규칙 없이 굴리기만 하면 되는 파티 게임',  time: '1분 안팎',  start: '#startBtn',   wait: 2600 },
  yut:         { name: '윷놀이',       desc: '업고 잡고 지름길로, 네 말 먼저 들이기',   time: '3~4분',    start: '#startBtn',   wait: 3200 },
  alkkagi:     { name: '알까기',       desc: '손끝으로 튕겨 상대 돌을 판 밖으로',       time: '1분 이내',  start: '#startBtn',   wait: 2600 },
  seotda:      { name: '섯다',         desc: '두 장으로 겨루는 한국식 포커',           time: '4~5분',    start: '#startBtn',   wait: 3400 },
  indianpoker: { name: '인디언 포커',   desc: '남의 패는 보이고 내 패만 안 보인다',      time: '2~3분',    start: '#startBtn',   wait: 3200 },
  onecard:     { name: '원카드',       desc: '같은 무늬나 숫자로 먼저 손을 비운다',     time: '1분 안팎',  start: '#startBtn',   wait: 3000 },
  oldmaid:     { name: '도둑잡기',     desc: '조커를 떠넘기는 눈치 싸움',              time: '1~2분',    start: '#startBtn',   wait: 3000 },
  blackjack:   { name: '블랙잭',       desc: '21을 넘기지 않고 딜러를 이긴다',         time: '라운드제',  start: '#startBtn',   wait: 3000 },
  baccarat:    { name: '바카라',       desc: '플레이어냐 뱅커냐, 한 판 승부',          time: '라운드제',  start: '#startBtn',   wait: 3000 },
  highlow:     { name: '하이로우',     desc: '다음 카드가 높을까 낮을까',              time: '라운드제',  start: '#startBtn',   wait: 3000 },
};
