import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchAll, subscribe, getSession } from './api'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './constants'

const Ctx = createContext(null)

export function DataProvider({ children }) {
  const [state, setState] = useState({ sites: [], categories: DEFAULT_CATEGORIES, settings: DEFAULT_SETTINGS, loading: true, error: null })
  const [session, setSession] = useState(null)

  const load = useCallback(async () => {
    try {
      const s = await getSession().catch(() => null)
      setSession(s)
      const d = await fetchAll({ includeHidden: !!s?.isAdmin })
      setState({ ...d, loading: false, error: null })
    } catch (e) {
      setState((p) => ({ ...p, loading: false, error: e.message || String(e) }))
    }
  }, [])

  useEffect(() => {
    load()
    let t
    const unsub = subscribe(() => { clearTimeout(t); t = setTimeout(load, 250) })
    return () => { unsub(); clearTimeout(t) }
  }, [load])

  const catMap = useMemo(() => Object.fromEntries(state.categories.map((c) => [c.key, c])), [state.categories])
  const publicSites = useMemo(() => state.sites.filter((s) => s.is_published !== false && catMap[s.category]), [state.sites, catMap])

  const value = { ...state, publicSites, catMap, session, setSession, reload: load }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)
