type Props = {
  open: boolean
  suggested: string
  previousName: string
  hasLocalStats: boolean
  busy?: boolean
  error?: string | null
  onSubmit: (nickname: string) => void
  onCancel: () => void
}

export function NicknameSetupModal({
  open,
  suggested,
  previousName,
  hasLocalStats,
  busy,
  error,
  onSubmit,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="nick-setup-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nick-setup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nick-setup-title">닉네임 정하기</h2>
        <p className="nick-setup-sub">
          Google 계정과 처음 연동하는 단계예요. 아래를 확인한 뒤 이름을 정해
          주세요.
        </p>

        <ul className="nick-setup-guide">
          <li>
            <strong>첫 연동</strong>
            <span>
              지금 정한 닉네임이 계정 시작 데이터예요. 이 기기의 연속 승리 등도
              같이 이어붙어요.
            </span>
          </li>
          <li>
            <strong>중복 불가</strong>
            <span>
              이미 다른 사람이 쓰는 닉네임은 가입·변경 모두 안 돼요.
            </span>
          </li>
          <li>
            <strong>나중에 이름 변경</strong>
            <span>
              바꿔도 통계는 그대로이고, 랭킹 기록 이름도 함께 따라가요.
            </span>
          </li>
        </ul>

        {previousName ? (
          <p className="nick-setup-hint">
            예전에 <strong>{previousName}</strong>으로 플레이했어요. 그대로
            두면 그 이름으로 이어가요.
          </p>
        ) : hasLocalStats ? (
          <p className="nick-setup-hint">
            이 브라우저의 연속 승리 기록은 계정에 이어갈게요.
          </p>
        ) : null}

        <form
          className="nick-setup-form"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const name = String(fd.get('nickname') ?? '')
            onSubmit(name)
          }}
        >
          <label className="nick-setup-label" htmlFor="nickname-input">
            사용할 닉네임
          </label>
          <input
            id="nickname-input"
            name="nickname"
            type="text"
            maxLength={20}
            defaultValue={suggested}
            placeholder="닉네임"
            autoFocus
            disabled={busy}
            required
          />
          {error && <p className="name-error">{error}</p>}
          <div className="nick-setup-actions">
            <button
              type="button"
              className="cta cta-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              취소
            </button>
            <button type="submit" className="cta" disabled={busy}>
              {busy ? '저장 중...' : '이 이름으로 시작'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
