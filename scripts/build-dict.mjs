/**
 * 표준국어대사전 기반 명사에서 자모 5/7 단어를 추출한다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_NOUNS, COMMON_NOUNS } from 'pd-korean-noun-list-for-wordles'

const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const JUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ',
  'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
]

const JONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ',
  'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ',
  'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const EXPAND = {
  ㄲ: ['ㄱ', 'ㄱ'],
  ㄸ: ['ㄷ', 'ㄷ'],
  ㅃ: ['ㅂ', 'ㅂ'],
  ㅆ: ['ㅅ', 'ㅅ'],
  ㅉ: ['ㅈ', 'ㅈ'],
  ㅐ: ['ㅏ', 'ㅣ'],
  ㅔ: ['ㅓ', 'ㅣ'],
  ㅒ: ['ㅑ', 'ㅣ'],
  ㅖ: ['ㅕ', 'ㅣ'],
  ㅘ: ['ㅗ', 'ㅏ'],
  ㅙ: ['ㅗ', 'ㅏ', 'ㅣ'],
  ㅚ: ['ㅗ', 'ㅣ'],
  ㅝ: ['ㅜ', 'ㅓ'],
  ㅞ: ['ㅜ', 'ㅓ', 'ㅣ'],
  ㅟ: ['ㅜ', 'ㅣ'],
  ㅢ: ['ㅡ', 'ㅣ'],
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
}

const BASIC = new Set([
  'ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ',
  'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ',
  'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ',
])

function expand(jamo) {
  return EXPAND[jamo] ?? [jamo]
}

function decompose(text) {
  const result = []
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code < 0xac00 || code > 0xd7a3) return []
    const s = code - 0xac00
    const cho = CHO[Math.floor(s / 588)]
    const jung = JUNG[Math.floor((s % 588) / 28)]
    const jong = JONG[s % 28]
    result.push(...expand(cho), ...expand(jung))
    if (jong) result.push(...expand(jong))
  }
  return result
}

function isPlayable(word, length) {
  if (!/^[가-힣]+$/.test(word)) return null
  if (word.length < 2 || word.length > 5) return null
  const jamo = decompose(word)
  if (jamo.length !== length) return null
  if (!jamo.every((j) => BASIC.has(j))) return null
  return jamo
}

function buildMap(words, lengths) {
  const byJamo = {}
  for (const word of words) {
    for (const length of lengths) {
      const jamo = isPlayable(word, length)
      if (!jamo) continue
      const key = jamo.join('')
      if (!byJamo[key]) byJamo[key] = word
    }
  }
  return byJamo
}

function buildAnswers(words, length, guesses) {
  const map = {}
  for (const word of words) {
    const jamo = isPlayable(word, length)
    if (!jamo) continue
    const key = jamo.join('')
    if (!guesses[key]) guesses[key] = word
    if (!map[key]) map[key] = { word, jamo: jamo.slice() }
  }
  return Object.values(map)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/dict')
fs.mkdirSync(outDir, { recursive: true })

const guesses = buildMap(ALL_NOUNS, [5, 7])

const FAMILIAR = [
  '하늘', '구름', '바람', '바다', '호수', '산길', '들판', '계곡', '폭포',
  '단풍', '낙엽', '햇살', '노을', '이슬', '서리', '우박', '장마', '태풍',
  '여름', '가을', '겨울', '봄날', '맑음', '흐림', '한파', '건조',
  '가방', '우산', '지갑', '시계', '반지', '이불', '커튼', '거울', '바늘',
  '종이', '가위', '자석', '지폐', '카드', '선물', '편지', '사진', '그림',
  '노래', '음악', '영화', '소설', '잡지', '만화', '시집', '메모',
  '사과', '수박', '라면', '김치', '소금', '갈비', '치킨', '초밥', '과자',
  '사탕', '야식', '녹차', '홍차', '커피', '주스', '우유', '감자', '양파',
  '마늘', '호박', '배추', '버섯', '식초', '카레', '시럽', '연유', '두부',
  '계란', '달걀', '생선', '고기', '치즈', '버터', '설탕', '간장', '된장',
  '서울', '부산', '대구', '제주', '학교', '교실', '카페', '시장', '서점',
  '터널', '항구', '시청', '공원', '극장', '병원', '약국', '은행', '회사',
  '시골', '마을', '거실', '부엌', '다락', '창고', '마당', '지붕',
  '친구', '가족', '자매', '형제', '부모', '자식', '사촌', '손자', '손녀',
  '사위', '신부', '선수', '작가', '동료', '상사',
  '시간', '저녁', '아침', '주말', '공부', '시험', '수영', '조깅', '독서',
  '미술', '수학', '국어', '영어', '역사', '사회', '도덕', '기술', '가정',
  '한자', '발표', '토론', '취미', '특기', '미래', '과거', '시작', '도전',
  '목표', '노력', '축하', '추석', '연초', '축구', '농구', '배구', '골프',
  '문자', '속도', '무게', '길이', '높이', '온도', '습도', '기압',
  '토끼', '여우', '늑대', '파랑', '노랑', '초록', '연두', '하양', '투명',
  '무늬', '체크', '세모', '네모', '뿌리', '줄기', '장미', '이끼',
  '마음', '기억', '모래', '저금', '저축', '주식', '보험', '좌표', '위치',
  '사랑', '우정', '배려', '감사', '전시', '공연', '야근', '거래',
  '정치', '자연', '토성', '폭포', '평야', '이혼', '미혼',
  '모자', '장갑', '양말', '구두', '치마', '바지', '셔츠', '코트',
  '창문', '방문', '현관', '침대', '소파', '책상', '의자', '연필',
  '공책', '필통', '분필', '칠판', '숙제', '성적', '방학', '입학',
  '졸업', '합격', '여행', '휴가', '캠핑', '등산', '낚시', '산책',
  '운동', '건강', '의사', '간호', '약사', '주사',
  '버스', '택시', '기차', '도로', '다리', '신호',
  '전화', '번호', '주소', '이름', '나이', '생일', '파티', '케이크',
  '빵집', '식당', '메뉴', '주문', '계산', '영수증',
  '엄마', '아빠', '동생', '언니', '오빠', '누나', '형님',
  '학생', '선생', '복도',
  '오늘', '내일', '어제', '모레', '점심',
  '행복', '기쁨', '슬픔', '웃음', '미소', '눈물', '희망',
  '평화', '자유', '용기', '친절', '정직', '성실', '인내', '존중',
  '신뢰', '효도', '예절', '약속', '비밀', '소식', '뉴스', '날씨',
  // 7칸용 친숙어
  '고양이', '강아지', '도서관', '운동장', '비행기', '자동차', '휴대폰',
  '선생님', '화장실', '초등학교', '중학교', '고등학교', '대학교',
  '아이스크림', '텔레비전', '컴퓨터', '세탁기', '냉장고',
  '편의점', '백화점', '지하철', '주차장', '횡단보도',
  '생일날', '생일파티', '운동화', '양산', '지우개', '필통통',
  '바나나', '오렌지', '딸기맛', '포도주', '수박씨',
  '개나리', '진달래', '무궁화', '코스모스', '해바라기',
  '다람쥐', '병아리', '송아지', '호랑이', '코끼리',
  '개구리', '잠자리', '달팽이', '물고기',
  '비빔밥', '떡볶이', '김밥집', '순댓국',
  '햄버거', '샌드위치', '파스타', '스테이크',
  '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일',
  '부모님', '할머니', '할아버지', '외할머니',
  '연필심', '공책장', '칠판지우개',
  '소방서', '경찰서', '우체국', '주민센터',
  '놀이터', '수영장', '체육관', '영화관',
  '카메라', '라디오', '이어폰', '충전기',
  '초코플', '사탕집', '과자점',
]

// 정답 풀: 친숙 수동목록 + 패키지 COMMON_NOUNS (워드클용 흔한 명사)
// 추측 허용은 ALL_NOUNS 기반 guesses.json
const answers5Map = {}
for (const entry of [
  ...buildAnswers(FAMILIAR, 5, guesses),
  ...buildAnswers(COMMON_NOUNS, 5, guesses),
]) {
  const key = entry.jamo.join('')
  if (!answers5Map[key]) answers5Map[key] = entry
}
const answers5 = Object.values(answers5Map)

const answers7Map = {}
for (const entry of [
  ...buildAnswers(FAMILIAR, 7, guesses),
  ...buildAnswers(COMMON_NOUNS, 7, guesses),
]) {
  const key = entry.jamo.join('')
  if (!answers7Map[key]) answers7Map[key] = entry
}
const answers7 = Object.values(answers7Map)

/** 표준국어대사전 뜻 캐시 (scripts/fetch-definitions.mjs 로 채움) */
const defCachePath = path.join(__dirname, 'data/definitions-cache.json')
let defCache = {}
try {
  if (fs.existsSync(defCachePath)) {
    defCache = JSON.parse(fs.readFileSync(defCachePath, 'utf8'))
  }
} catch {
  defCache = {}
}

function withDefinitions(entries) {
  return entries.map((entry) => {
    const definition = defCache[entry.word]
    if (typeof definition === 'string' && definition.trim()) {
      return { ...entry, definition: definition.trim() }
    }
    return entry
  })
}

const answers5Out = withDefinitions(answers5)
const answers7Out = withDefinitions(answers7)
const definitions = {}
for (const entry of [...answers5Out, ...answers7Out]) {
  if (entry.definition) definitions[entry.word] = entry.definition
}

fs.writeFileSync(path.join(outDir, 'guesses.json'), JSON.stringify(guesses), 'utf8')
fs.writeFileSync(path.join(outDir, 'answers-5.json'), JSON.stringify(answers5Out), 'utf8')
fs.writeFileSync(path.join(outDir, 'answers-7.json'), JSON.stringify(answers7Out), 'utf8')
fs.writeFileSync(
  path.join(outDir, 'definitions.json'),
  JSON.stringify(definitions),
  'utf8',
)
// 하위 호환
fs.writeFileSync(path.join(outDir, 'answers.json'), JSON.stringify(answers5Out), 'utf8')

const defCount = Object.keys(definitions).length
console.log(`guesses: ${Object.keys(guesses).length}`)
console.log(`answers-5: ${answers5Out.length}`)
console.log(`answers-7: ${answers7Out.length}`)
console.log(`definitions: ${defCount}`)
console.log(`sample5: ${answers5Out.slice(0, 8).map((a) => a.word).join(', ')}`)
console.log(`sample7: ${answers7Out.slice(0, 8).map((a) => a.word).join(', ')}`)
