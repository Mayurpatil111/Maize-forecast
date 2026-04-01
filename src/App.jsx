import { useLayoutEffect, useMemo, useRef, useState } from 'react'

const API_BASE_URL = 'https://web-production-235ac.up.railway.app'

const MARKETS = ['DAVANAGERE', 'RANIBENNUR', 'HUBBALLI']
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

/** API calendar fields: hide placeholder strings */
function formatCalendarLabel(value) {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  if (s === 'None' || s === 'Unknown') return '—'
  return s
}

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

function ChartPanelHeader({ crop, pointsCount, latestModal, headerActions }) {
  const title = (crop || 'MAIZE').toUpperCase()
  return (
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#2d333b]/85 px-4 py-2.5 max-[900px]:flex-col max-[900px]:items-start sm:px-5 sm:py-3">
      <div className="text-left">
        <h2 className="mb-0.5 text-lg font-bold tracking-tight text-green-400 sm:text-[22px]">{title}</h2>
        <p className="text-xs text-[#8b949e] sm:text-[13px]">{pointsCount} points · daily</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-start justify-end gap-2 sm:gap-3 max-[900px]:w-full max-[900px]:justify-between">
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
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
      </div>
    </header>
  )
}

function ForecastDaysTable({ predictions }) {
  if (!Array.isArray(predictions) || predictions.length === 0) return null
  const thBase =
    'whitespace-nowrap px-2 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] sm:px-3 sm:py-3 sm:text-[10px]'
  const tdBase = 'px-2 py-2 align-middle sm:px-3 sm:py-2.5'
  return (
    <div className="rounded-xl border border-[#2d333b]/85 bg-gradient-to-b from-[#1b1f26]/95 via-[#151921]/90 to-[#10141a]/95 shadow-[0_10px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/25">
      <table className="w-full min-w-[720px] border-collapse text-left text-[10px] sm:min-w-[820px] sm:text-[11px]">
        <thead>
          <tr className="sticky top-0 z-[2] border-b border-[#2d333b] bg-[#1c2128] shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
            <th className={`${thBase} border-b border-[#3d444d]/60 text-left text-[#b1bac4]`}>
              Date
            </th>
            <th
              className={`${thBase} border-b border-[#3d444d]/60 bg-sky-500/[0.06] text-right text-sky-300`}
            >
              Min
            </th>
            <th
              className={`${thBase} border-b border-[#3d444d]/60 bg-green-500/[0.06] text-right text-green-300`}
            >
              Avg
            </th>
            <th
              className={`${thBase} border-b border-[#3d444d]/60 bg-amber-500/[0.05] text-right text-amber-200`}
            >
              Max
            </th>
            <th
              className={`${thBase} border-l-2 border-[#2d333b] border-b border-[#3d444d]/60 text-left text-[#b1bac4]`}
            >
              Festival
            </th>
            <th className={`${thBase} border-b border-[#3d444d]/60 text-left text-[#b1bac4]`}>
              Tithi
            </th>
            <th className={`${thBase} border-b border-[#3d444d]/60 text-left text-[#b1bac4]`}>
              Nakshatra
            </th>
            <th className={`${thBase} border-b border-[#3d444d]/60 text-left text-[#b1bac4]`}>
              Paksha
            </th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((row, index) => {
            const stripe = index % 2 === 0 ? 'bg-[#13151a]/55' : 'bg-[#161b22]/25'
            return (
              <tr
                key={row.date}
                className={`group border-b border-[#2d333b]/35 transition-colors duration-150 hover:bg-[#21262d]/95 ${stripe}`}
              >
                <td
                  className={`${tdBase} whitespace-nowrap border-r border-transparent font-semibold text-[#e6edf3] group-hover:border-[#2d333b]/40`}
                  title={row.date}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-green-400/70 shadow-[0_0_6px_rgba(74,222,128,0.5)] sm:inline-block"
                      aria-hidden
                    />
                    {formatDateLabel(row.date)}
                  </span>
                </td>
                <td
                  className={`${tdBase} whitespace-nowrap text-right tabular-nums text-sky-200/95 group-hover:text-sky-100`}
                >
                  {formatPrice(row.min_price)}
                </td>
                <td
                  className={`${tdBase} whitespace-nowrap text-right tabular-nums text-green-200/95 group-hover:text-green-100`}
                >
                  {formatPrice(row.modal_price)}
                </td>
                <td
                  className={`${tdBase} whitespace-nowrap text-right tabular-nums text-amber-200/95 group-hover:text-amber-100`}
                >
                  {formatPrice(row.max_price)}
                </td>
                <td
                  className={`${tdBase} max-w-[100px] truncate border-l-2 border-[#2d333b]/90 text-[#b1bac4] sm:max-w-[150px]`}
                >
                  {formatCalendarLabel(row.festival)}
                </td>
                <td className={`${tdBase} max-w-[90px] truncate text-[#b1bac4] sm:max-w-[130px]`}>
                  {formatCalendarLabel(row.tithi)}
                </td>
                <td className={`${tdBase} max-w-[90px] truncate text-[#b1bac4] sm:max-w-[130px]`}>
                  {formatCalendarLabel(row.nakshatra)}
                </td>
                <td className={`${tdBase} max-w-[80px] truncate text-[#b1bac4] sm:max-w-[110px]`}>
                  {formatCalendarLabel(row.paksha)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PriceChart({ predictions, crop, latestModal, headerActions }) {
  const series = Array.isArray(predictions) ? predictions : []
  const wrapRef = useRef(null)
  const tipRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 })
  const [tipBox, setTipBox] = useState({ left: 0, top: 0 })

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

  useLayoutEffect(() => {
    const container = wrapRef.current
    const tip = tipRef.current
    if (!container || !tip) return
    if (hoverIndex == null) return

    const containerW = container.clientWidth
    const containerH = container.clientHeight
    const tipW = tip.offsetWidth
    const tipH = tip.offsetHeight

    const inset = 8
    const anchorDx = 12
    const anchorDy = 14

    let left = tipPos.x - anchorDx
    let top = tipPos.y - tipH - anchorDy

    left = Math.max(inset, Math.min(left, Math.max(inset, containerW - tipW - inset)))
    top = Math.max(inset, Math.min(top, Math.max(inset, containerH - tipH - inset)))

    setTipBox({ left, top })
  }, [hoverIndex, tipPos.x, tipPos.y])

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

  const hoverPoint = hoverIndex !== null ? series[hoverIndex] : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#2d333b] bg-[#161b22] shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
      <ChartPanelHeader
        crop={crop}
        pointsCount={series.length}
        latestModal={latestModal}
        headerActions={headerActions}
      />

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
              ref={tipRef}
              className="pointer-events-none absolute z-20 max-w-[min(320px,calc(100vw-24px))] min-w-[200px] rounded-lg border border-[#2d333b] bg-[#1c2128]/98 px-3 py-2.5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm"
              style={{
                left: tipBox.left,
                top: tipBox.top,
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
              <div className="mt-2 border-t border-[#2d333b] pt-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8b949e]">
                  Festival & panchang
                </p>
                <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-[12px] leading-snug">
                  <dt className="text-[#8b949e]">Festival</dt>
                  <dd className="text-[#e6edf3]">{formatCalendarLabel(hoverPoint.festival)}</dd>
                  <dt className="text-[#8b949e]">Tithi</dt>
                  <dd className="text-[#e6edf3]">{formatCalendarLabel(hoverPoint.tithi)}</dd>
                  <dt className="text-[#8b949e]">Nakshatra</dt>
                  <dd className="text-[#e6edf3]">{formatCalendarLabel(hoverPoint.nakshatra)}</dd>
                  <dt className="text-[#8b949e]">Paksha</dt>
                  <dd className="text-[#e6edf3]">{formatCalendarLabel(hoverPoint.paksha)}</dd>
                </dl>
              </div>
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
  const [showFestivals, setShowFestivals] = useState(false)

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

      const response = await fetch(`${API_BASE_URL}/predict-maize?${query}`, {
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()
      console.log(result)
      setData(result)
      setShowFestivals(false)
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
      <div className="grid shrink-0 grid-cols-3 gap-1.5 max-[1200px]:grid-cols-1 sm:gap-2">
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

  const festivalsHeaderButton =
    data != null ? (
      <button
        type="button"
        onClick={() => setShowFestivals((v) => !v)}
        className="rounded-lg border border-[#2d333b] bg-[#1c2128] px-3 py-1.5 text-xs font-semibold text-[#e6edf3] transition hover:border-green-400/60 hover:bg-[#161b22]"
      >
        {showFestivals ? 'Back to chart' : 'Festivals'}
      </button>
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
          {/* 25% viewport: title, form, metrics — stats + calendar scroll here if tight */}
          <section className="flex min-h-0 shrink-0 grow-0 basis-1/4 flex-col gap-1.5 overflow-hidden sm:gap-2">
            <div className="flex shrink-0 flex-col gap-1.5">
              {headerBlock}
              {formBlock}
              {errorBlock}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
              {statsCards}
            </div>
          </section>

          {/* ~75% viewport: chart or festivals table */}
          <section className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden pt-1.5 sm:pt-2">
            {showFestivals ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#2d333b] bg-[#161b22] shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                <ChartPanelHeader
                  crop={data.crop}
                  pointsCount={data.predictions.length}
                  latestModal={stats?.latestModal}
                  headerActions={festivalsHeaderButton}
                />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#13151a] px-3 pb-2 pt-2 sm:px-[18px] sm:pb-3 sm:pt-3">
                  <div className="mb-3 shrink-0 overflow-hidden rounded-xl border border-[#2d333b]/90 bg-gradient-to-br from-[#1a1f27] via-[#171b22] to-[#13161c] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-4 sm:py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                      <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                        <div
                          className="mt-0.5 h-9 w-1 shrink-0 rounded-full bg-gradient-to-b from-green-400 via-emerald-400/90 to-sky-500/70 shadow-[0_0_12px_rgba(74,222,128,0.35)]"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold leading-snug tracking-tight text-[#e6edf3] sm:text-sm">
                            All forecast days
                          </p>
                          <p className="mt-0.5 text-[10px] leading-snug text-[#6e7681] sm:text-[11px]">
                            One row per day — min, average, max, and calendar fields.
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-baseline gap-1.5 rounded-lg border border-green-400/20 bg-green-400/[0.08] px-2.5 py-1 ring-1 ring-black/25 sm:px-3 sm:py-1.5">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#8b949e] sm:text-[10px]">
                          Days
                        </span>
                        <span className="text-base font-bold tabular-nums tracking-tight text-green-400 sm:text-lg">
                          {data.predictions.length}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    <ForecastDaysTable predictions={data.predictions} />
                  </div>
                </div>
              </div>
            ) : (
              <PriceChart
                predictions={data.predictions}
                crop={data.crop}
                latestModal={stats?.latestModal}
                headerActions={festivalsHeaderButton}
              />
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default App
