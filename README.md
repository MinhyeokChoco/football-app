# 주고 들어가 (football-app)

링크 하나로 참석/불참을 받는 풋살 모임 앱. 예전 `football`(Angular + NestJS + Neon, Vercel/Render)을
**Firebase(Hosting + Firestore + 익명 로그인) + PWA**로 다시 만든 것이다. 서버가 없어서 잠들 일이 없다.

## 개발

```bash
npm install
npm run dev          # Auth·Firestore 에뮬레이터 + ng serve → http://localhost:4200
                     # 에뮬레이터 UI → http://localhost:4000
npm test             # 단위 테스트
npm run test:rules   # 보안 규칙 테스트 (에뮬레이터를 직접 띄운다. npm run dev 와 동시에 못 돌림)
```

localhost 에서는 자동으로 에뮬레이터(`demo-football`)에 붙으니 Firebase 프로젝트 없이 개발할 수 있다.
Java 가 있어야 에뮬레이터가 뜬다.

## 처음 배포할 때

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만든다 (무료 Spark 요금제로 충분)
2. **Authentication > 로그인 방법 > 익명** 을 켠다
3. **Firestore Database** 를 만든다 (위치: `asia-northeast3` 서울)
4. **프로젝트 설정 > 내 앱 > 웹 앱 추가** 후 나오는 값을 `src/app/core/firebase.ts` 의 `prodConfig` 에 채운다 (현재 `football-mh`)
5. `.firebaserc` 의 `default` 를 실제 프로젝트 id 로 바꾼다
6. `npx firebase login` 후 `npm run deploy` (hosting + 규칙)

## 구조

```
events/{eventId}            모임. 누구나 읽기, 주최자만 수정·마감·삭제
                            정원(maxPeople)·회비(fee, account)·마감(closed)은 없으면 null/false
  hosts/{uid}               주최자 명단. 주최자 키를 아는 사람만 자기 uid 로 추가
  private/admin             주최자 키. 주최자만 읽기
  attendees/{name}          응답. 문서 id 가 이름이라 같은 이름은 하나뿐
                            guests(데려오는 친구 수)는 본인, paid(회비)는 주최자만 바꾼다
  activities/{id}           기록. 같은 batch 의 실제 변경과 맞아야만 쓸 수 있다
```

권한 검사는 전부 `firestore.rules` 에 있고 `rules-tests/` 가 지킨다.

- **대기 명단**은 저장하지 않는다. 참석을 누른 시각(`updatedAt`) 순서로 정원까지 채우고 나머지를 대기로
  계산한다(`core/lineup.ts`). 앞사람이 빠지면 대기 1번이 저절로 올라온다. 친구 수만 바꿀 때는 규칙이
  `updatedAt` 을 못 바꾸게 해서 줄을 잃지 않는다.
- **실력**(상/중/하)은 남에게 보이면 안 돼서 서버에 안 올리고 주최자 기기의 localStorage 에만 둔다.
- **모임 삭제**는 명단·기록을 먼저 지우고, 마지막 batch 에서 모임·주최자 키·주최자 명단을 함께 지운다.

| 예전 (NestJS) | 지금 |
| --- | --- |
| attendee token (localStorage) | 익명 로그인 uid. 응답 문서의 `uid` 와 같아야 수정·삭제 |
| admin token, `?admin=` 링크 | `?key=` 링크로 `hosts/{uid}` 등록. 주최자 화면에서 링크 다시 복사 가능 |
| 409 이름 중복 | 문서 id = 이름. 남의 이름이면 update 가 되고 규칙이 막는다 |
| 새로고침해야 반영 | `onSnapshot` 실시간 |

## 예전보다 나아진 점

- 콜드 스타트 없음 (Render 무료 플랜 30~50초 대기 사라짐)
- 홈 화면에 설치되는 PWA, 한 번 본 모임은 오프라인에서도 열림
- 친구가 누르면 모든 화면에 바로 반영
- 주최자가 나눈 팀이 모두에게 똑같이 보임 (주최자가 아니면 자기 화면에서만 섞어보기)
- 주최자 링크를 잃어버려도 주최자 화면에서 다시 복사
- 홈에 "최근 모임", 모임마다 이름을 다시 안 써도 됨
- 기록에 시간 표시, 조사(이/가, 으로/로) 자연스럽게
- 정원과 대기 명단, 친구 데려가기(+1), 회비·계좌와 낸 사람 체크
- 실력(상/중/하)을 고려한 팀 나누기, 모임 마감·삭제, 지난 모임 그대로 다음 주에 또 만들기

## 아직 안 한 것

- 모임마다 다른 카톡 미리보기(OG) — 서버 렌더링(Cloud Functions, Blaze 요금제)이 필요
- 인원 충족·팀 공개 푸시 알림
- 구장별 이용 기록
