type StdictItem = {
  word?: string
  sense?: { definition?: string }
}

type StdictResponse = {
  channel?: {
    total?: number
    item?: StdictItem | StdictItem[]
  }
}

export type DictLookup = {
  word: string
  definition: string | null
  fromApi: boolean
}

/**
 * 표준국어대사전 Open API 조회 (Vite 프록시 `/api/stdict`).
 * 키가 없거나 실패하면 null.
 */
export async function lookupStdict(word: string): Promise<DictLookup | null> {
  try {
    const url = `/api/stdict?q=${encodeURIComponent(word)}&req_type=json&type_search=search`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as StdictResponse
    const raw = data.channel?.item
    if (!raw) return null
    const item = Array.isArray(raw) ? raw[0] : raw
    if (!item?.word) return null
    return {
      word: item.word,
      definition: item.sense?.definition ?? null,
      fromApi: true,
    }
  } catch {
    return null
  }
}
