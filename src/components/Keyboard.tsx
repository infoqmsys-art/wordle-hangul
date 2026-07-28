import type { KeyStatus } from '../lib/game'

/** 카톡 단어맞추기형 자모 키보드 (입력은 하단 버튼) */
const ROWS = [
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'Backspace'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'],
] as const

type Props = {
  keyStatuses: Record<string, KeyStatus>
  onKey: (key: string) => void
  disabled?: boolean
}

export function Keyboard({ keyStatuses, onKey, disabled }: Props) {
  return (
    <div className="keyboard" aria-label="자모 키보드">
      {ROWS.map((row, ri) => (
        <div key={ri} className="keyboard-row">
          {row.map((key) => {
            if (key === 'Backspace') {
              return (
                <button
                  key={key}
                  type="button"
                  className="key key-action key-backspace"
                  aria-label="지우기"
                  disabled={disabled}
                  onClick={() => onKey('Backspace')}
                >
                  ←
                </button>
              )
            }
            const status = keyStatuses[key] ?? 'unused'
            return (
              <button
                key={key}
                type="button"
                className={`key key-${status}`}
                disabled={disabled}
                onClick={() => onKey(key)}
              >
                {key}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
