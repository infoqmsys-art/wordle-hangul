type Props = {
  open: boolean
  onClose: () => void
  guessCount?: number
  answerCount?: number
}

export function HowTo({ open, onClose, guessCount = 0, answerCount = 0 }: Props) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal howto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="howto-title">어떻게 할까요?</h2>
        <ul className="howto-list">
          <li>사전 속 단어를 <strong>자모 5개</strong>로 맞춰요.</li>
          <li>
            <strong>ㅔ</strong>처럼 합쳐진 모음은 <strong>ㅓ + ㅣ</strong>로
            나눠 입력해요.
          </li>
          <li>기회는 하루 <strong>4번</strong>이에요.</li>
          <li>
            추측은 사전 명사로 넓게 받고, 정답은{' '}
            <strong>익숙한 일상 단어</strong>만 나와요
            {guessCount > 0
              ? ` (추측 ${guessCount.toLocaleString()}개 / 정답 ${answerCount.toLocaleString()}개)`
              : ''}
            .
          </li>
        </ul>
        <div className="howto-samples">
          <div className="howto-sample">
            <div className="tile tile-correct mini">ㄷ</div>
            <p>초록 · 글자와 자리가 맞아요</p>
          </div>
          <div className="howto-sample">
            <div className="tile tile-present mini">ㄱ</div>
            <p>노랑 · 글자는 있지만 자리가 달라요</p>
          </div>
          <div className="howto-sample">
            <div className="tile tile-absent mini">ㅎ</div>
            <p>회색 · 단어에 없어요</p>
          </div>
        </div>
        <button type="button" className="btn-primary full" onClick={onClose}>
          알겠어요
        </button>
      </div>
    </div>
  )
}
