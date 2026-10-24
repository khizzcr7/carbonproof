import { useCallback, useEffect, useState } from 'react'
import {
  api,
  type Account,
  type Assessment,
  type Credit,
  type CreditDetail,
  type ProjectMetadata,
  type Stats,
  type VerifyResult,
} from './api'

type View = 'registry' | 'issue' | 'verify'

const fmt = (n: number) => n.toLocaleString('en-US')
const short = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s)
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')

function scoreClass(score: number) {
  if (score >= 80) return 'score good'
  if (score >= 60) return 'score mid'
  return 'score bad'
}

export default function App() {
  const [view, setView] = useState<View>('registry')
  const [chainOk, setChainOk] = useState<boolean | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [credits, setCredits] = useState<Credit[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [h, s, c, a] = await Promise.all([api.health(), api.stats(), api.credits(), api.accounts()])
      setChainOk(h.chainConnected)
      setStats(s)
      setCredits(c)
      setAccounts(a)
      setError('')
    } catch (e) {
      setChainOk(false)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo">⛓️🌿</div>
          <div>
            <h1>CarbonProof</h1>
            <p>On-chain carbon credit provenance &amp; verification registry</p>
          </div>
        </div>
        <div className={`chain-pill ${chainOk ? 'ok' : 'down'}`}>
          {chainOk === null ? 'Checking chain…' : chainOk ? '● Local EVM chain connected' : '● Chain offline — start the local node'}
        </div>
      </header>

      <nav className="tabs">
        <button className={view === 'registry' ? 'tab active' : 'tab'} onClick={() => setView('registry')}>
          Credit Registry
        </button>
        <button className={view === 'issue' ? 'tab active' : 'tab'} onClick={() => setView('issue')}>
          Issue a Credit
        </button>
        <button className={view === 'verify' ? 'tab active' : 'tab'} onClick={() => setView('verify')}>
          Verify a Credit
        </button>
      </nav>

      {error && <div className="banner error">{error}</div>}

      {view === 'registry' && <Registry stats={stats} credits={credits} accounts={accounts} onChanged={refresh} />}
      {view === 'issue' && (
        <IssueForm
          accounts={accounts}
          onIssued={() => {
            void refresh()
            setView('registry')
          }}
        />
      )}
      {view === 'verify' && <VerifyPanel />}

      <footer className="footer">
        <p>
          IEEE ClimateChain Global Hackathon 2026 · Track: Carbon Markets &amp; Emissions Transparency · The smart
          contract registry prevents double counting: a retired credit can never be transferred or retired again.
        </p>
        {stats && <p className="mono">Registry contract: {stats.contract}</p>}
      </footer>
    </div>
  )
}

function Registry({
  stats,
  credits,
  accounts,
  onChanged,
}: {
  stats: Stats | null
  credits: Credit[]
  accounts: Account[]
  onChanged: () => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'retired'>('all')
  const shown = credits.filter((c) => (filter === 'all' ? true : filter === 'retired' ? c.retired : !c.retired))

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <span className="stat-num">{stats ? fmt(stats.totalIssuedTonnes) : '—'}</span>
          <span className="stat-label">tCO₂e issued on-chain</span>
        </div>
        <div className="stat">
          <span className="stat-num">{stats ? fmt(stats.activeTonnes) : '—'}</span>
          <span className="stat-label">tCO₂e active</span>
        </div>
        <div className="stat">
          <span className="stat-num">{stats ? fmt(stats.totalRetiredTonnes) : '—'}</span>
          <span className="stat-label">tCO₂e retired (offsets claimed)</span>
        </div>
        <div className="stat">
          <span className="stat-num">{stats ? stats.creditCount : '—'}</span>
          <span className="stat-label">credits in registry</span>
        </div>
      </div>

      <div className="filter-row">
        {(['all', 'active', 'retired'] as const).map((f) => (
          <button key={f} className={filter === f ? 'chip active' : 'chip'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All credits' : f === 'active' ? 'Active' : 'Retired'}
          </button>
        ))}
      </div>

      <div className="grid">
        {shown.map((c) => (
          <article key={c.id} className={`card ${selectedId === c.id ? 'selected' : ''}`} onClick={() => setSelectedId(c.id)}>
            <div className="card-top">
              <span className="credit-id">Credit #{c.id}</span>
              <span className={c.retired ? 'badge retired' : 'badge active'}>{c.retired ? 'RETIRED' : 'ACTIVE'}</span>
            </div>
            <h3>{c.metadata?.projectName ?? 'Unknown project'}</h3>
            <p className="card-sub">
              {c.metadata?.projectType} · {c.metadata?.region}, {c.metadata?.country} · Vintage {c.metadata?.vintage}
            </p>
            <div className="card-row">
              <span className="amount">{fmt(c.amountTonnes)} tCO₂e</span>
              {c.assessment && <span className={scoreClass(c.assessment.score)}>AI score {c.assessment.score}/100</span>}
            </div>
            <p className="card-owner">
              Owner: {c.ownerLabel} {c.metadataIntegrity ? '· ✓ metadata verified' : ''}
            </p>
          </article>
        ))}
        {shown.length === 0 && <p className="empty">No credits match this filter yet.</p>}
      </div>

      {selectedId !== null && (
        <DetailPanel key={selectedId} id={selectedId} accounts={accounts} onChanged={onChanged} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}

function DetailPanel({
  id,
  accounts,
  onChanged,
  onClose,
}: {
  id: number
  accounts: Account[]
  onChanged: () => Promise<void>
  onClose: () => void
}) {
  const [detail, setDetail] = useState<CreditDetail | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [transferTo, setTransferTo] = useState<number>(2)
  const [retireReason, setRetireReason] = useState('')

  const load = useCallback(async () => {
    try {
      setDetail(await api.credit(id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!detail) return <div className="panel">{err || 'Loading credit…'}</div>

  const ownerIndex = accounts.find((a) => a.address.toLowerCase() === detail.owner.toLowerCase())?.index ?? -1

  const doTransfer = async () => {
    setBusy('transfer')
    setErr('')
    try {
      await api.transfer(id, transferTo)
      await load()
      await onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const doRetire = async () => {
    if (!retireReason.trim()) {
      setErr('Give a retirement reason, e.g. the footprint being offset.')
      return
    }
    setBusy('retire')
    setErr('')
    try {
      await api.retire(id, retireReason.trim())
      await load()
      await onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>
          Credit #{detail.id} — {detail.metadata?.projectName}
        </h2>
        <button className="ghost" onClick={onClose}>
          Close ✕
        </button>
      </div>
      {err && <div className="banner error">{err}</div>}
      <div className="detail-grid">
        <div>
          <h4>Project</h4>
          <p>{detail.metadata?.description}</p>
          <dl>
            <dt>Methodology</dt>
            <dd>{detail.metadata?.methodology}</dd>
            <dt>Amount</dt>
            <dd>{fmt(detail.amountTonnes)} tCO₂e</dd>
            <dt>Issuer (verifier)</dt>
            <dd>{detail.issuerLabel}</dd>
            <dt>Current owner</dt>
            <dd>{detail.ownerLabel}</dd>
            <dt>Status</dt>
            <dd>
              {detail.retired ? `Retired ${fmtDate(detail.retiredAt)} — ${detail.retireReason}` : `Active since ${fmtDate(detail.issuedAt)}`}
            </dd>
            <dt>Metadata hash (on-chain)</dt>
            <dd className="mono">{short(detail.metadataHash)}</dd>
            <dt>Metadata integrity</dt>
            <dd>{detail.metadataIntegrity ? '✓ Hash matches — metadata untampered' : '✗ Mismatch or missing record'}</dd>
          </dl>
          {detail.assessment && (
            <div className="assessment">
              <h4>AI pre-issuance verification</h4>
              <p>
                <span className={scoreClass(detail.assessment.score)}>{detail.assessment.score}/100</span>{' '}
                <strong>{detail.assessment.verdict}</strong> <span className="muted">({detail.assessment.mode})</span>
              </p>
              {detail.assessment.flags && detail.assessment.flags.length > 0 && (
                <ul>
                  {detail.assessment.flags.map((f, i) => (
                    <li key={i}>⚠ {f}</li>
                  ))}
                </ul>
              )}
              {detail.assessment.summary && <p className="muted">{detail.assessment.summary}</p>}
            </div>
          )}
        </div>
        <div>
          <h4>Provenance timeline (from chain events)</h4>
          <ul className="timeline">
            {detail.timeline.map((e, i) => (
              <li key={i}>
                <span className={`dot ${e.type}`} />
                <div>
                  <strong>
                    {e.type === 'issued' && `Issued to ${e.ownerLabel ?? ''}`}
                    {e.type === 'transferred' && `Transferred ${e.fromLabel ?? ''} → ${e.toLabel ?? ''}`}
                    {e.type === 'retired' && `Retired by ${e.ownerLabel ?? ''}`}
                  </strong>
                  <p className="muted">
                    {fmtDate(e.at)} · block {e.blockNumber} · <span className="mono">{short(e.txHash)}</span>
                  </p>
                  {e.type === 'retired' && e.args.reason && <p className="muted">Reason: {String(e.args.reason)}</p>}
                </div>
              </li>
            ))}
          </ul>

          {!detail.retired && (
            <div className="actions">
              <h4>Actions</h4>
              <div className="action-row">
                <select value={transferTo} onChange={(e) => setTransferTo(Number(e.target.value))}>
                  {accounts
                    .filter((a) => a.index !== 0 && a.index !== ownerIndex)
                    .map((a) => (
                      <option key={a.index} value={a.index}>
                        {a.label}
                      </option>
                    ))}
                </select>
                <button onClick={doTransfer} disabled={busy !== ''}>
                  {busy === 'transfer' ? 'Transferring…' : 'Transfer credit'}
                </button>
              </div>
              <div className="action-row">
                <input
                  placeholder="Retirement reason (footprint being offset)"
                  value={retireReason}
                  onChange={(e) => setRetireReason(e.target.value)}
                />
                <button className="danger" onClick={doRetire} disabled={busy !== ''}>
                  {busy === 'retire' ? 'Retiring…' : 'Retire permanently'}
                </button>
              </div>
              <p className="muted">Retirement is irreversible and blocks all future transfers — the anti-double-counting guarantee.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PROJECT_TYPES = ['Solar', 'Wind', 'Geothermal', 'Mangrove Restoration', 'Forestry', 'Agroforestry', 'Household Devices', 'Waste Management', 'Other']

function IssueForm({ accounts, onIssued }: { accounts: Account[]; onIssued: () => void }) {
  const [form, setForm] = useState<ProjectMetadata>({
    projectName: '',
    projectType: 'Solar',
    country: '',
    region: '',
    methodology: '',
    vintage: 2026,
    description: '',
  })
  const [amountTonnes, setAmountTonnes] = useState(1000)
  const [ownerIndex, setOwnerIndex] = useState(1)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const set = (k: keyof ProjectMetadata, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  const runAi = async () => {
    setBusy('ai')
    setErr('')
    try {
      const a = await api.aiVerify({ ...form, amountTonnes })
      setAssessment(a)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const issue = async () => {
    setBusy('issue')
    setErr('')
    setMsg('')
    try {
      const r = await api.issue({ ownerIndex, amountTonnes, metadata: form, assessment })
      setMsg(`Credit #${r.creditId} issued on-chain. Tx: ${r.txHash}`)
      setTimeout(onIssued, 900)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="panel form-panel">
      <h2>Issue a new carbon credit</h2>
      <p className="muted">
        The verifier runs an AI credibility check on the project, then issues the credit on-chain. The project metadata
        hash is anchored in the smart contract at issuance, so the record can never be quietly altered afterwards.
      </p>
      {err && <div className="banner error">{err}</div>}
      {msg && <div className="banner ok">{msg}</div>}
      <div className="form-grid">
        <label>
          Project name
          <input value={form.projectName} onChange={(e) => set('projectName', e.target.value)} placeholder="e.g. Sindh Solar Park Phase III" />
        </label>
        <label>
          Project type
          <select value={form.projectType} onChange={(e) => set('projectType', e.target.value)}>
            {PROJECT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Country
          <input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Pakistan" />
        </label>
        <label>
          Region
          <input value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="Sindh" />
        </label>
        <label>
          Methodology
          <input
            value={form.methodology}
            onChange={(e) => set('methodology', e.target.value)}
            placeholder="e.g. ACM0002 - Grid-connected renewable electricity generation"
          />
        </label>
        <label>
          Vintage year
          <input type="number" value={form.vintage} onChange={(e) => set('vintage', Number(e.target.value))} />
        </label>
        <label>
          Amount (tCO₂e)
          <input type="number" value={amountTonnes} onChange={(e) => setAmountTonnes(Number(e.target.value))} />
        </label>
        <label>
          Initial owner
          <select value={ownerIndex} onChange={(e) => setOwnerIndex(Number(e.target.value))}>
            {accounts
              .filter((a) => a.index !== 0)
              .map((a) => (
                <option key={a.index} value={a.index}>
                  {a.label}
                </option>
              ))}
          </select>
        </label>
        <label className="wide">
          Project description (monitoring &amp; verification approach matter for the AI score)
          <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
      </div>

      <div className="action-row">
        <button onClick={runAi} disabled={busy !== ''}>
          {busy === 'ai' ? 'Analysing…' : '1 · Run AI verification'}
        </button>
        <button className="primary" onClick={issue} disabled={busy !== '' || !form.projectName}>
          {busy === 'issue' ? 'Issuing on-chain…' : '2 · Issue credit on-chain'}
        </button>
      </div>

      {assessment && (
        <div className="assessment">
          <h4>AI verification result</h4>
          <p>
            <span className={scoreClass(assessment.score)}>{assessment.score}/100</span> <strong>{assessment.verdict}</strong>{' '}
            <span className="muted">({assessment.mode})</span>
          </p>
          {assessment.flags && assessment.flags.length > 0 && (
            <ul>
              {assessment.flags.map((f, i) => (
                <li key={i}>⚠ {f}</li>
              ))}
            </ul>
          )}
          {assessment.summary && <p className="muted">{assessment.summary}</p>}
        </div>
      )}
    </div>
  )
}

function VerifyPanel() {
  const [id, setId] = useState('1')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const check = async () => {
    setBusy(true)
    setErr('')
    setResult(null)
    try {
      setResult(await api.verifyCredit(Number(id)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel form-panel">
      <h2>Public authenticity check</h2>
      <p className="muted">
        Anyone can audit a credit: enter its ID and we recompute the project metadata hash and compare it against the
        hash anchored on-chain when the credit was issued. A match proves the record is untampered; the status proves
        the offset has not already been claimed by someone else.
      </p>
      {err && <div className="banner error">{err}</div>}
      <div className="action-row">
        <input type="number" min={1} value={id} onChange={(e) => setId(e.target.value)} placeholder="Credit ID" />
        <button className="primary" onClick={check} disabled={busy}>
          {busy ? 'Checking…' : 'Verify on-chain'}
        </button>
      </div>
      {result && (
        <div className={`verify-result ${result.authentic ? 'ok' : 'bad'}`}>
          <h3>{result.authentic ? '✓ AUTHENTIC — metadata matches the on-chain anchor' : '✗ NOT VERIFIED — metadata mismatch'}</h3>
          <dl>
            <dt>Project</dt>
            <dd>{result.project ?? '—'}</dd>
            <dt>Amount</dt>
            <dd>{fmt(result.amountTonnes)} tCO₂e</dd>
            <dt>Current owner</dt>
            <dd>{result.owner}</dd>
            <dt>Status</dt>
            <dd>{result.status}</dd>
            <dt>On-chain hash</dt>
            <dd className="mono">{result.onChainMetadataHash}</dd>
            <dt>Recomputed hash</dt>
            <dd className="mono">{result.recomputedMetadataHash ?? '—'}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
