import { useState, useEffect, useRef } from 'react'
import './popup.css'

export default function Popup() {
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function clearCache() {
    setClearing(true)
    try {
      await chrome.storage.local.clear()
      setCleared(true)
      timerRef.current = setTimeout(() => setCleared(false), 2000)
    } catch {
      // storage.local.clear() failed; button returns to idle state via finally
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="title">CUNY Scheduler Helper</div>
        <div className="subtitle">Hover over a course in the Schedule Builder to see professor ratings.</div>
      </div>

      <div className="section">
        <div className="section-title">Data Source</div>
        <div className="section-body">
          Ratings are fetched from{' '}
          <span className="highlight">RateMyProfessors</span> and cached
          locally for 1 hour.
        </div>
      </div>

      <div className="section">
        <div className="section-title">Cache</div>
        <div className="section-body">
          Clear cached professor data if ratings seem stale.
        </div>
        <button className="btn" onClick={clearCache} disabled={clearing}>
          {cleared ? 'Cleared!' : clearing ? 'Clearing…' : 'Clear Cache'}
        </button>
      </div>
    </div>
  )
}
