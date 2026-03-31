import { useMemo, useRef, useState } from 'react'

const API_BASE_URL = ''

const MARKETS = ['DAVANAGERE', 'RANEBENNURU', 'HUBBALLI']
const GRADES = ['AVERAGE', 'SMALL', 'LARGE', 'MEDIUM']

/** Calendar uses YYYY-MM-DD; we pass the same format to the API */
function isoDateToApi(iso) {
  return iso
}

function dateToIsoLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today in local time — earliest selectable day in the calendar */
function getTodayIso() {
  return dateToIsoLocal(new Date())
}

/** Tomorrow in local time, for date input default */
function getTomorrowIso() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return dateToIsoLocal(d)
}

/** Vibrant palette on dark bg (min / modal / max) */
const SERIES = {
  min: { stroke: '#38bdf8', fill: '#38bdf8', name: 'Min price' },
  modal: { stroke: '#4ade80', fill: '#4ade80', name: 'Average price' },
  max: { stroke: '#fbbf24', fill: '#fbbf24', name: 'Max price' },
}

const formatDateLabel = (dateString) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
}

const formatPrice = (value) => `Rs. ${value.toFixed(2)}`

/** One cubic segment from Catmull–Rom control points P0–P3, curve from P1 to P2 */
function catmullRomSegment(p0, p1, p2, p3) {
  const cp1x = p1.x + (p2.x - p0.x) / 6
  const cp1y = p1.y + (p2.y - p0.y) / 6
  const cp2x = p2.x - (p3.x - p1.x) / 6
  const cp2y = p2.y - (p3.y - p1.y) / 6
  return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
}

function smoothPath(pts) {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(n - 1, i + 2)]
    d += ` ${catmullRomSegment(p0, p1, p2, p3)}`
  }
  return d
}

function PriceChart({ predictions, crop, latestModal }) {
  const series = Array.isArray(predictions) ? predictions : []
  const wrapRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 })

  const width = 960
  const height = 380
  const padding = { top: 28, right: 28, bottom: 52, left: 56 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const plotRight = width - padding.right

  if (series.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#2d333b] bg-[#161b22] px-4 py-8 text-center text-sm text-[#8b949e]">
        No prediction series to display. The API did not return a{' '}
        <code className="text-[#c9d1d9]">predictions</code> array.
      </div>
    )
  }

  const allPrices = series.flatMap((entry) => [
    entry.min_price,
    entry.modal_price,
    entry.max_price,
  ])
  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const span = maxPrice - minPrice || 400
  /* Extra headroom: smooth curves overshoot control points; avoid clipping peaks/troughs */
  const yMin = minPrice - Math.max(span * 0.12, 35)
  const yMax = maxPrice + Math.max(span * 0.18, 45)
  const range = yMax - yMin || 1

  const xStep = series.length > 1 ? chartWidth / (series.length - 1) : 0

  const getX = (index) => padding.left + index * xStep
  const getY = (value) => padding.top + ((yMax - value) / range) * chartHeight

  const toPts = (key) =>
    series.map((point, index) => ({
      x: getX(index),
      y: getY(point[key]),
    }))

  const ptsMin = toPts('min_price')
  const ptsModal = toPts('modal_price')
  const ptsMax = toPts('max_price')
  const dMin = smoothPath(ptsMin)
  const dModal = smoothPath(ptsModal)
  const dMax = smoothPath(ptsMax)
  const dArea =
    series.length > 1
      ? `${smoothPath(ptsModal)} L ${ptsModal[ptsModal.length - 1].x} ${padding.top + chartHeight} L ${ptsModal[0].x} ${padding.top + chartHeight} Z`
      : ''

  const hitLeft = (i) => (i === 0 ? padding.left : (getX(i - 1) + getX(i)) / 2)
  const hitRight = (i) => (i === series.length - 1 ? plotRight : (getX(i) + getX(i + 1)) / 2)

  const updateHover = (i, e) => {
    setHoverIndex(i)
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTipPos({ x: e.clientX - r.left, y: e.clientY - r.top })
  }

  const lineDrawStyle = (delayMs) => ({
    strokeDasharray: 1,
    strokeDashoffset: 1,
    animation: 'chart-stroke-draw 1.05s cubic-bezier(0.4, 0, 0.2, 1) forwards',
    animationDelay: `${delayMs}ms`,
  })

  const gridLines = 5
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const value = yMin + (range * i) / gridLines
    const y = getY(value)
    return { y, value }
  })

  const title = (crop || 'MAIZE').toUpperCase()
  const subtitle = `${series.length} points · daily`
  const hoverPoint = hoverIndex !== null ? series[hoverIndex] : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#2d333b] bg-[#161b22] shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#2d333b]/85 px-4 py-2.5 max-[900px]:flex-col max-[900px]:items-start sm:px-5 sm:py-3">
        <div className="text-left">
          <h2 className="mb-0.5 text-lg font-bold tracking-tight text-green-400 sm:text-[22px]">{title}</h2>
          <p className="text-xs text-[#8b949e] sm:text-[13px]">{subtitle}</p>
        </div>
        {typeof latestModal === 'number' && (
          <div className="shrink-0 text-right max-[900px]:text-left">
            <span className="block text-lg font-semibold tabular-nums tracking-tight text-[#c9d1d9] sm:text-[22px]">
              {latestModal.toFixed(2)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[#8b949e] sm:text-[11px]">
              modal · last forecast day
            </span>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-[#13151a] px-3 pb-2 pt-2 sm:px-[18px] sm:pb-3 sm:pt-3">
        <div ref={wrapRef} className="relative min-h-0 w-full flex-1">
          <svg
            className="absolute inset-0 block h-full w-full max-w-none min-h-[120px]"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Maize price forecast chart"
          >
          <defs>
            <linearGradient id="plotFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(74, 222, 128, 0.12)" />
              <stop offset="100%" stopColor="rgba(74, 222, 128, 0)" />
            </linearGradient>
          </defs>

          <rect
            x={padding.left}
            y={padding.top}
            width={chartWidth}
            height={chartHeight}
            className="fill-black/20"
            rx="6"
          />

          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={width - padding.right}
                y2={tick.y}
                className="stroke-[1] stroke-[rgba(139,148,158,0.18)] [stroke-dasharray:3_6]"
              />
              <text
                x={padding.left - 12}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-[#8b949e] font-sans text-[11px] tabular-nums"
              >
                {tick.value.toFixed(0)}
              </text>
            </g>
          ))}

          {series.map((point, index) => (
            <text
              key={point.date}
              x={getX(index)}
              y={height - 18}
              textAnchor="middle"
              className="fill-[#8b949e] font-sans text-[11px] opacity-90"
            >
              {formatDateLabel(point.date)}
            </text>
          ))}

          {series.length > 1 && (
            <path
              className="pointer-events-none"
              d={dArea}
              fill="url(#plotFade)"
              style={{
                opacity: 0,
                animation: 'chart-area-fade-in 0.75s ease 0.4s forwards',
              }}
            />
          )}

          <path
            pathLength={1}
            d={dMin}
            className="fill-none stroke-sky-400 stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round] drop-shadow-[0_0_6px_rgba(56,189,248,0.35)]"
            style={lineDrawStyle(0)}
          />
          <path
            pathLength={1}
            d={dModal}
            className="fill-none stroke-green-400 stroke-[2.75] [stroke-linecap:round] [stroke-linejoin:round] drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]"
            style={lineDrawStyle(140)}
          />
          <path
            pathLength={1}
            d={dMax}
            className="fill-none stroke-amber-300 stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round] drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]"
            style={lineDrawStyle(280)}
          />

          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              x2={getX(hoverIndex)}
              y1={padding.top}
              y2={padding.top + chartHeight}
              className="stroke-[#8b949e]/35"
              strokeWidth={1}
              strokeDasharray="4 5"
              pointerEvents="none"
            />
          )}

          {(['min_price', 'modal_price', 'max_price']).map((key) => {
            const strokeFill =
              key === 'min_price'
                ? 'fill-sky-400'
                : key === 'modal_price'
                  ? 'fill-green-400'
                  : 'fill-amber-300'
            return series.map((point, index) => {
              const active = index === hoverIndex
              return (
                <circle
                  key={`${key}-${point.date}`}
                  cx={getX(index)}
                  cy={getY(point[key])}
                  r={active ? 6.5 : 4}
                  className={`stroke-[#1a1d24] stroke-[1.25] transition-[r] duration-150 ${strokeFill}`}
                  style={{
                    opacity: 0,
                    animation: `chart-area-fade-in 0.35s ease ${320 + index * 24}ms forwards`,
                  }}
                />
              )
            })
          })}

          {series.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={hitLeft(i)}
              y={padding.top}
              width={Math.max(hitRight(i) - hitLeft(i), 1)}
              height={chartHeight}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={(e) => updateHover(i, e)}
              onMouseMove={(e) => updateHover(i, e)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          ))}
        </svg>

          {hoverPoint != null && (
            <div
              className="pointer-events-none absolute z-20 min-w-[180px] rounded-lg border border-[#2d333b] bg-[#1c2128]/98 px-3 py-2.5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm"
              style={{
                left: tipPos.x,
                top: tipPos.y,
                transform: 'translate(-12px, calc(-100% - 14px))',
              }}
              role="status"
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8b949e]">
                {formatDateLabel(hoverPoint.date)}
              </p>
              <ul className="space-y-1.5 text-[13px] tabular-nums">
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-[#c9d1d9]">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                    Min price
                  </span>
                  <span className="font-medium text-[#e6edf3]">{formatPrice(hoverPoint.min_price)}</span>
                </li>
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-[#c9d1d9]">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
                    Average price
                  </span>
                  <span className="font-medium text-[#e6edf3]">{formatPrice(hoverPoint.modal_price)}</span>
                </li>
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-[#c9d1d9]">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                    Max price
                  </span>
                  <span className="font-medium text-[#e6edf3]">{formatPrice(hoverPoint.max_price)}</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-7" aria-hidden="true">
          {Object.entries(SERIES).map(([k, { stroke, name }]) => (
            <span key={k} className="inline-flex items-center gap-2.5">
              <svg className="shrink-0" viewBox="0 0 48 12" width="48" height="12" aria-hidden="true">
                <line x1="2" y1="6" x2="46" y2="6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
                <circle cx="24" cy="6" r="3.5" fill={stroke} stroke="#1a1d24" strokeWidth="1" />
              </svg>
              <span className="text-[13px] font-medium text-[#c9d1d9]">{name}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [market, setMarket] = useState('HUBBALLI')
  const [grade, setGrade] = useState('AVERAGE')
  const [targetDateIso, setTargetDateIso] = useState(() => getTomorrowIso())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const stats = useMemo(() => {
    const preds = Array.isArray(data?.predictions) ? data.predictions : []
    if (preds.length === 0) {
      return null
    }
    const last = preds[preds.length - 1]
    return {
      points: preds.length,
      latestModal: last.modal_price,
      band: last.max_price - last.min_price,
    }
  }, [data])

  const fetchPredictions = async (event) => {
    event?.preventDefault()
    setLoading(true)
    setError('')

    try {
      const query = new URLSearchParams({
        market: market.trim(),
        grade: grade.trim(),
        target_date: isoDateToApi(targetDateIso),
      }).toString()

      const response = await fetch(`${API_BASE_URL}/api/predict-maize?${query}`, {
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()
      console.log(result)
      setData(result)
    } catch (fetchError) {
      setError(
        fetchError.message.includes('Failed to fetch')
          ? 'Unable to reach API. Check CORS or ngrok URL availability.'
          : fetchError.message,
      )
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'rounded-lg border border-[#2d333b] bg-[#1c2128] px-2.5 py-1.5 text-sm text-[#e6edf3] transition focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 sm:px-3 sm:py-2 sm:text-[15px]'
  const selectClass = `${inputClass} cursor-pointer pr-8 [color-scheme:dark]`
  const dateClass = `${inputClass} cursor-pointer [color-scheme:dark]`
  const labelClass =
    'flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wider text-[#c9d1d9] sm:gap-1 sm:text-xs'

  const headerBlock = (
    <header className="shrink-0 flex flex-col items-center justify-center">
      <h1 className="text-lg font-semibold tracking-tight text-[#e6edf3] sm:text-xl">
        Maize forecast
      </h1>
    </header>
  )

  const formBlock = (
    <form
      className="grid shrink-0 grid-cols-[repeat(4,minmax(100px,1fr))] items-end gap-1.5 sm:gap-2 max-[900px]:grid-cols-1"
      onSubmit={fetchPredictions}
    >
      <label className={labelClass}>
        Market
        <select
          value={market}
          onChange={(event) => setMarket(event.target.value)}
          className={selectClass}
        >
          {MARKETS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Grade
        <select
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          className={selectClass}
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Target date
        <input
          type="date"
          min={getTodayIso()}
          value={targetDateIso}
          onChange={(event) => setTargetDateIso(event.target.value)}
          className={dateClass}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg border border-green-400/45 bg-gradient-to-br from-green-400/[0.22] to-sky-400/10 px-2.5 py-1.5 text-sm font-semibold text-[#e6edf3] transition hover:border-green-400/70 hover:shadow-lg disabled:cursor-wait disabled:opacity-55 sm:px-3 sm:py-2 sm:text-[15px]"
      >
        {loading ? 'Loading…' : 'Get prediction'}
      </button>
    </form>
  )

  const errorBlock =
    error != null && error !== '' ? (
      <p className="shrink-0 rounded-lg border border-red-500/35 bg-red-500/10 px-2 py-1 text-xs text-red-300 sm:px-3 sm:text-sm">
        {error}
      </p>
    ) : null

  const statsCards =
    stats != null ? (
      <div className="grid min-h-0 shrink grid-cols-3 gap-1.5 max-[900px]:grid-cols-1 sm:gap-2">
        <article
          className="rounded-xl border border-[#2d333b] bg-[#161b22] px-2 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.2)] sm:px-3 sm:py-2"
          title="How many daily price points the API returned in this forecast."
        >
          <h3 className="mb-0.5 text-[9px] font-semibold leading-snug text-[#8b949e] sm:text-[10px]">
            Next 15 days forecast
          </h3>
          <p className="text-base font-semibold tabular-nums tracking-tight text-[#e6edf3] sm:text-lg">{stats.points}</p>
        </article>
        <article
          className="rounded-xl border border-[#2d333b] bg-[#161b22] px-2 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.2)] sm:px-3 sm:py-2"
          title="Predicted modal (typical) price on the last day of the forecast."
        >
          <h3 className="mb-0.5 text-[9px] font-semibold leading-snug text-[#8b949e] sm:text-[10px]">
            Modal price — last day
          </h3>
          <p className="truncate text-base font-semibold tabular-nums tracking-tight text-[#e6edf3] sm:text-lg">
            {formatPrice(stats.latestModal)}
          </p>
        </article>
        <article
          className="rounded-xl border border-[#2d333b] bg-[#161b22] px-2 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.2)] sm:px-3 sm:py-2"
          title="On the last forecast day: predicted maximum price minus predicted minimum price (width of the band)."
        >
          <h3 className="mb-0.5 text-[9px] font-semibold leading-snug text-[#8b949e] sm:text-[10px]">
            Max − min range — last day
          </h3>
          <p className="truncate text-base font-semibold tabular-nums tracking-tight text-[#e6edf3] sm:text-lg">
            {formatPrice(stats.band)}
          </p>
        </article>
      </div>
    ) : null

  return (
    <main className="flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden px-3 py-2 text-left sm:px-5 sm:py-2">
      {!data ? (
        <>
          <div className="shrink-0 space-y-3">
            {headerBlock}
            {formBlock}
            {errorBlock}
          </div>
        </>
      ) : (
        <>
          {/* 25% viewport: title, form, metrics */}
          <section className="flex min-h-0 shrink-0 grow-0 basis-1/4 flex-col justify-start gap-1.5 overflow-hidden sm:gap-2">
            {headerBlock}
            {formBlock}
            {errorBlock}
            {statsCards}
          </section>

          {/* ~75% viewport: chart */}
          <section className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden pt-1.5 sm:pt-2">
            <PriceChart
              predictions={data.predictions}
              crop={data.crop}
              latestModal={stats?.latestModal}
            />
          </section>
        </>
      )}
    </main>
  )
}

export default App
