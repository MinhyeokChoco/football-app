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
events/{eventId}            모임. 누구나 읽기, 주최자만 수정
  hosts/{uid}               주최자 명단. 주최자 키를 아는 사람만 자기 uid 로 추가
  private/admin             주최자 키. 주최자만 읽기
  attendees/{name}          응답. 문서 id 가 이름이라 같은 이름은 하나뿐
  activities/{id}           기록. 같은 batch 의 실제 변경과 맞아야만 쓸 수 있다
```

권한 검사는 전부 `firestore.rules` 에 있고 `rules-tests/` 가 지킨다.

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

## 아직 안 한 것

- 모임마다 다른 카톡 미리보기(OG) — 서버 렌더링(Cloud Functions, Blaze 요금제)이 필요
- 모임 삭제, 인원 충족 푸시 알림
