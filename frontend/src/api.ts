import type { Account, Card, MerchantCategory, Transaction } from './types'

const BASE = '/api'

async function readError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    if (typeof j.detail === 'string') return j.detail
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((d: { msg?: string }) => d.msg ?? JSON.stringify(d))
        .join('; ')
    }
    return res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${BASE}/accounts/`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function createAccount(body: {
  owner_name: string
  email: string
}): Promise<Account> {
  const res = await fetch(`${BASE}/accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function fetchAccount(id: number): Promise<Account> {
  const res = await fetch(`${BASE}/accounts/${id}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function deposit(
  accountId: number,
  amount_cents: number,
): Promise<Transaction> {
  const res = await fetch(`${BASE}/accounts/${accountId}/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_cents }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function issueCard(accountId: number): Promise<Card> {
  const res = await fetch(`${BASE}/accounts/${accountId}/cards`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function simulatePurchase(
  accountId: number,
  body: { amount_cents: number; merchant_category: MerchantCategory },
): Promise<Transaction> {
  const res = await fetch(`${BASE}/accounts/${accountId}/purchases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function fetchTransactions(accountId: number): Promise<Transaction[]> {
  const res = await fetch(`${BASE}/accounts/${accountId}/transactions`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}
