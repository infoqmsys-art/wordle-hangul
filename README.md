# 오늘의 단어

한글 자모 Wordle형 미니게임입니다.

- **오늘의 단어**: 날짜마다 같은 정답
- **메인게임**: 랜덤 연속 플레이
- **Google로 이어가기**(선택): 닉네임·연속 승리를 계정에 저장

## 로컬 실행

```bash
npm install
npm run dev
```

## Firebase (기록·로그인)

`.env`에 Firebase 웹 앱 설정을 넣습니다. (`.env.example` 참고)

Google 로그인을 쓰려면 Firebase Console에서:

1. **Authentication → Sign-in method → Google** → 사용 설정 → 저장  
   (이 단계가 없으면 팝업에 `The requested action is invalid` 가 뜹니다)
2. **Authentication → Settings → Authorized domains**에 `localhost` 확인
   (배포 시 `github.io` / 본인 Pages 도메인도 추가)
3. Firestore 규칙을 프로젝트의 `firestore.rules`와 같게 **게시**  
   (`users`, `nicknames`, 로그인 사용자의 `records` 이름 수정 포함)

`records` 컬렉션은 기존처럼 랭킹/기록용입니다.  
로그인 닉네임은 `nicknames`로 중복을 막으며, 이름 바꿔도 통계·기록은 uid를 따라갑니다.

## GitHub Pages

`main` 브랜치에 push하면 Actions가 자동 배포합니다.

- 주소: `https://<username>.github.io/wordle-hangul/`
