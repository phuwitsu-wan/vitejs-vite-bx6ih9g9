import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAll, subscribe, getSession, cachedData } from './api'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './constants'

const Ctx = createContext(null)

export function DataProvider({ children }) {
  const [state, setState] = useState(() => {
    const c = cachedData()
    return c ? { ...c, loading: false, error: null } : { sites: [], categories: DEFAULT_CATEGORIES, settings: DEFAULT_SETTINGS, loading: true, error: null }
  })
  const [session, setSession] = useState(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current
    try {
      const s = await getSession().catch(() => null)
      const d = await fetchAll({ includeHidden: !!s?.isAdmin })
      if (my !== seq.current) return
      setSession(s)
      setState({ ...d, loading: false, error: null })
    } catch (e) {
      if (my !== seq.current) return
      setSession(await getSession().catch(() => null))
      setState((p) => ({ ...p, loading: false, error: e.message || String(e) }))
    }
  }, [])

  useEffect(() => {
    load()
    let t
    const unsub = subscribe(() => { clearTimeout(t); t = setTimeout(load, 200) })
    return () => { unsub(); clearTimeout(t) }
  }, [load])

  const catMap = useMemo(() => Object.fromEntries(state.categories.map((c) => [c.key, c])), [state.categories])
  const publicCategories = useMemo(() => state.categories.filter((c) => c.is_visible !== false), [state.categories])
  const publicSites = useMemo(() => state.sites.filter((s) => s.is_published !== false && catMap[s.category] && catMap[s.category].is_visible !== false), [state.sites, catMap])

  const value = { ...state, publicSites, publicCategories, catMap, session, setSession, reload: load }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)
