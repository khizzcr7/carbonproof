export interface Account {
  index: number
  label: string
  address: string
}

export interface ProjectMetadata {
  projectName: string
  projectType: string
  country: string
  region: string
  methodology: string
  vintage: number
  description: string
}

export interface Assessment {
  score: number
  verdict: string
  mode: string
  flags?: string[]
  summary?: string
}

export interface Credit {
  id: number
  issuer: string
  owner: string
  ownerLabel: string
  issuerLabel: string
  amountTonnes: number
  metadataHash: string
  retired: boolean
  issuedAt: string | null
  retiredAt: string | null
  retireReason: string
  metadata: ProjectMetadata | null
  assessment: Assessment | null
  metadataIntegrity: boolean
}

export interface TimelineEvent {
  type: 'issued' | 'transferred' | 'retired'
  txHash: string
  blockNumber: number
  at: string | null
  args: Record<string, string | number>
  fromLabel?: string
  toLabel?: string
  ownerLabel?: string
}

export interface CreditDetail extends Credit {
  timeline: TimelineEvent[]
}

export interface Stats {
  creditCount: number
  totalIssuedTonnes: number
  totalRetiredTonnes: number
  activeTonnes: number
  contract: string
}

export interface VerifyResult {
  creditId: number
  authentic: boolean
  onChainMetadataHash: string
  recomputedMetadataHash: string | null
  status: string
  owner: string
  amountTonnes: number
  project: string | null
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data as T
}

export const api = {
  health: () => req<{ ok: boolean; chainConnected: boolean; blockNumber?: number; contract?: string }>('/api/health'),
  accounts: () => req<Account[]>('/api/accounts'),
  stats: () => req<Stats>('/api/stats'),
  credits: () => req<Credit[]>('/api/credits'),
  credit: (id: number) => req<CreditDetail>(`/api/credits/${id}`),
  verifyCredit: (id: number) => req<VerifyResult>(`/api/verify/${id}`),
  aiVerify: (input: ProjectMetadata & { amountTonnes: number }) =>
    req<Assessment>('/api/ai/verify', { method: 'POST', body: JSON.stringify(input) }),
  issue: (body: { ownerIndex: number; amountTonnes: number; metadata: ProjectMetadata; assessment: Assessment | null }) =>
    req<{ creditId: number; txHash: string; metadataHash: string }>('/api/credits/issue', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  transfer: (id: number, toIndex: number) =>
    req<{ ok: boolean; txHash: string; from: string; to: string }>(`/api/credits/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ toIndex }),
    }),
  retire: (id: number, reason: string) =>
    req<{ ok: boolean; txHash: string }>(`/api/credits/${id}/retire`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
}
