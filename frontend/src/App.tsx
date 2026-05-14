import { useCallback, useEffect, useState } from 'react'
import './App.css'
import * as api from './api'
import type { Account, Card, MerchantCategory, Transaction } from './types'

const MERCHANT_QUALIFIED: { value: MerchantCategory; label: string }[] = [
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'vision', label: 'Vision' },
  { value: 'therapy', label: 'Therapy' },
  { value: 'medical_equipment', label: 'Medical equipment' },
]

const MERCHANT_OTHER: { value: MerchantCategory; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
]

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function dollarsToCents(raw: string): number {
  const n = Number.parseFloat(raw.trim())
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Enter a valid dollar amount greater than zero.')
  }
  return Math.round(n * 100)
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [accountDetail, setAccountDetail] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [sessionCards, setSessionCards] = useState<Card[]>([])
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [depositDollars, setDepositDollars] = useState('')
  const [purchaseDollars, setPurchaseDollars] = useState('')
  const [purchaseCategory, setPurchaseCategory] = useState<MerchantCategory>('pharmacy')

  const [concurrentA, setConcurrentA] = useState('80')
  const [concurrentB, setConcurrentB] = useState('50')
  const [concurrentCategory, setConcurrentCategory] = useState<MerchantCategory>('pharmacy')
  const [concurrentOutcome, setConcurrentOutcome] = useState<
    | null
    | {
        rows: {
          label: string
          status: 'fulfilled' | 'rejected'
          tx?: Transaction
          error?: string
        }[]
      }
  >(null)

  const show = useCallback((type: 'ok' | 'err', text: string) => {
    setBanner({ type, text })
    window.setTimeout(() => setBanner(null), 6000)
  }, [])

  const loadAccounts = useCallback(async () => {
    const list = await api.fetchAccounts()
    setAccounts(list)
    return list
  }, [])

  const refreshSelection = useCallback(
    async (id: number) => {
      const [acc, txs] = await Promise.all([
        api.fetchAccount(id),
        api.fetchTransactions(id),
      ])
      setAccountDetail(acc)
      setTransactions(txs)
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadAccounts()
      } catch (e) {
        if (!cancelled) show('err', e instanceof Error ? e.message : 'Failed to load accounts.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadAccounts, show])

  useEffect(() => {
    if (selectedId == null) {
      setAccountDetail(null)
      setTransactions([])
      setConcurrentOutcome(null)
      return
    }
    setConcurrentOutcome(null)
    let cancelled = false
    ;(async () => {
      try {
        await refreshSelection(selectedId)
      } catch (e) {
        if (!cancelled) show('err', e instanceof Error ? e.message : 'Failed to load account.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, refreshSelection, show])

  async function onCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const acc = await api.createAccount({
        owner_name: createName.trim(),
        email: createEmail.trim(),
      })
      setCreateName('')
      setCreateEmail('')
      await loadAccounts()
      setSelectedId(acc.id)
      show('ok', `Account created for ${acc.owner_name}.`)
    } catch (err) {
      show('err', err instanceof Error ? err.message : 'Create failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onDeposit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedId == null) return
    setBusy(true)
    try {
      const cents = dollarsToCents(depositDollars)
      await api.deposit(selectedId, cents)
      setDepositDollars('')
      await loadAccounts()
      await refreshSelection(selectedId)
      show('ok', `Deposited ${formatMoney(cents)}.`)
    } catch (err) {
      show('err', err instanceof Error ? err.message : 'Deposit failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onIssueCard() {
    if (selectedId == null) return
    setBusy(true)
    try {
      const card = await api.issueCard(selectedId)
      setSessionCards((prev) => [card, ...prev])
      show('ok', `Virtual card issued — last four: ${card.last_four}`)
    } catch (err) {
      show('err', err instanceof Error ? err.message : 'Could not issue card.')
    } finally {
      setBusy(false)
    }
  }

  async function onPurchase(e: React.FormEvent) {
    e.preventDefault()
    if (selectedId == null) return
    setBusy(true)
    try {
      const cents = dollarsToCents(purchaseDollars)
      const tx = await api.simulatePurchase(selectedId, {
        amount_cents: cents,
        merchant_category: purchaseCategory,
      })
      setPurchaseDollars('')
      await loadAccounts()
      await refreshSelection(selectedId)
      const outcome =
        tx.status === 'approved'
          ? `Approved — charged ${formatMoney(cents)}.`
          : `Declined — ${tx.decline_reason ?? 'unknown reason'}.`
      show(tx.status === 'approved' ? 'ok' : 'err', outcome)
    } catch (err) {
      show('err', err instanceof Error ? err.message : 'Purchase simulation failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onConcurrentPurchaseTest() {
    if (selectedId == null) return
    setBusy(true)
    setConcurrentOutcome(null)
    try {
      const c1 = dollarsToCents(concurrentA)
      const c2 = dollarsToCents(concurrentB)
      const id = selectedId
      const cat = concurrentCategory
      const results = await Promise.allSettled([
        api.simulatePurchase(id, { amount_cents: c1, merchant_category: cat }),
        api.simulatePurchase(id, { amount_cents: c2, merchant_category: cat }),
      ])
      await loadAccounts()
      await refreshSelection(id)
      setConcurrentOutcome({
        rows: [
          {
            label: `Concurrent A (${formatMoney(c1)})`,
            status: results[0].status,
            tx: results[0].status === 'fulfilled' ? results[0].value : undefined,
            error:
              results[0].status === 'rejected'
                ? results[0].reason instanceof Error
                  ? results[0].reason.message
                  : String(results[0].reason)
                : undefined,
          },
          {
            label: `Concurrent B (${formatMoney(c2)})`,
            status: results[1].status,
            tx: results[1].status === 'fulfilled' ? results[1].value : undefined,
            error:
              results[1].status === 'rejected'
                ? results[1].reason instanceof Error
                  ? results[1].reason.message
                  : String(results[1].reason)
                : undefined,
          },
        ],
      })
      const fulfilled = results.filter(
        (r): r is PromiseFulfilledResult<Transaction> => r.status === 'fulfilled',
      )
      const approved = fulfilled.filter((r) => r.value.status === 'approved').length
      show(
        'ok',
        `Fired 2 concurrent purchase requests. ${approved} approved in responses (see panel + history).`,
      )
    } catch (err) {
      show('err', err instanceof Error ? err.message : 'Concurrent test failed.')
    } finally {
      setBusy(false)
    }
  }

  const cardsForAccount = sessionCards.filter((c) => c.account_id === selectedId)

  return (
    <div className="app">
      <header className="header">
        <h1>HSA account demo</h1>
        <p className="subtitle">
          Create accounts, deposit funds, issue a virtual card, and simulate purchases. Run the
          FastAPI backend on port <code>8000</code> with <code>npm run dev</code> here (Vite proxies{' '}
          <code>/api</code>).
        </p>
      </header>

      {banner && (
        <div className={`banner banner-${banner.type}`} role="status">
          {banner.text}
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <section className="panel">
            <h2>Create account</h2>
            <form onSubmit={onCreateAccount} className="form">
              <label>
                Owner name
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  minLength={1}
                  autoComplete="name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <button type="submit" disabled={busy}>
                Create account
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Accounts</h2>
            {accounts.length === 0 ? (
              <p className="muted">No accounts yet.</p>
            ) : (
              <ul className="account-list">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={a.id === selectedId ? 'account-pill active' : 'account-pill'}
                      onClick={() => setSelectedId(a.id)}
                    >
                      <span className="account-name">{a.owner_name}</span>
                      <span className="account-meta">
                        #{a.id} · {formatMoney(a.balance_cents)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <main className="main">
          {selectedId == null || accountDetail == null ? (
            <div className="empty-main">
              <p>Select an account on the left, or create one to try deposits and purchases.</p>
            </div>
          ) : (
            <>
              <section className="hero">
                <h2>{accountDetail.owner_name}</h2>
                <p className="hero-email">{accountDetail.email}</p>
                <p className="balance">
                  Balance: <strong>{formatMoney(accountDetail.balance_cents)}</strong>
                </p>
              </section>

              <div className="grid-actions">
                <section className="panel">
                  <h3>Deposit funds</h3>
                  <form onSubmit={onDeposit} className="form">
                    <label>
                      Amount (USD)
                      <input
                        inputMode="decimal"
                        placeholder="e.g. 100.00"
                        value={depositDollars}
                        onChange={(e) => setDepositDollars(e.target.value)}
                        required
                      />
                    </label>
                    <button type="submit" disabled={busy}>
                      Deposit
                    </button>
                  </form>
                </section>

                <section className="panel">
                  <h3>Issue virtual card</h3>
                  <p className="muted small">
                    Issues one card record per click (last four only in this demo).
                  </p>
                  <button type="button" className="secondary" disabled={busy} onClick={onIssueCard}>
                    Issue card
                  </button>
                  {cardsForAccount.length > 0 && (
                    <ul className="card-chips">
                      {cardsForAccount.map((c) => (
                        <li key={c.id}>
                          Card ·••• {c.last_four}
                          {c.is_active ? '' : ' (inactive)'}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="panel panel-wide">
                  <h3>Simulate transaction</h3>
                  <p className="muted small">
                    Qualified categories (pharmacy, hospital, etc.) can debit if balance is enough.
                    Others are declined as non-qualified.
                  </p>
                  <form onSubmit={onPurchase} className="form form-row">
                    <label>
                      Amount (USD)
                      <input
                        inputMode="decimal"
                        placeholder="e.g. 25.00"
                        value={purchaseDollars}
                        onChange={(e) => setPurchaseDollars(e.target.value)}
                        required
                      />
                    </label>
                    <label className="grow">
                      Merchant category
                      <select
                        value={purchaseCategory}
                        onChange={(e) =>
                          setPurchaseCategory(e.target.value as MerchantCategory)
                        }
                      >
                        <optgroup label="Qualified medical (example rules)">
                          {MERCHANT_QUALIFIED.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Not qualified">
                          {MERCHANT_OTHER.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                    <button type="submit" disabled={busy}>
                      Run purchase
                    </button>
                  </form>
                </section>

                <section className="panel panel-wide panel-concurrent">
                  <h3>Concurrent purchase test</h3>
                  <p className="muted small">
                    Fires <strong>two purchase API calls at the same time</strong> (same account,
                    qualified category). Example: deposit <code>100.00</code>, leave defaults{' '}
                    <code>80</code> and <code>50</code> — at most one should approve if the backend
                    prevents overlapping debits from overspending.
                  </p>
                  <div className="concurrent-row">
                    <label>
                      Amount A (USD)
                      <input
                        inputMode="decimal"
                        value={concurrentA}
                        onChange={(e) => setConcurrentA(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Amount B (USD)
                      <input
                        inputMode="decimal"
                        value={concurrentB}
                        onChange={(e) => setConcurrentB(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <label className="grow">
                      Category (both requests)
                      <select
                        value={concurrentCategory}
                        onChange={(e) =>
                          setConcurrentCategory(e.target.value as MerchantCategory)
                        }
                        disabled={busy}
                      >
                        <optgroup label="Qualified medical">
                          {MERCHANT_QUALIFIED.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Not qualified">
                          {MERCHANT_OTHER.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="concurrent-btn"
                      disabled={busy}
                      onClick={() => void onConcurrentPurchaseTest()}
                    >
                      Run 2 concurrent purchases
                    </button>
                  </div>
                  {concurrentOutcome && (
                    <div className="concurrent-results">
                      <h4>Last run — responses</h4>
                      <table className="tx-table concurrent-table">
                        <thead>
                          <tr>
                            <th>Request</th>
                            <th>HTTP / result</th>
                            <th>Tx status</th>
                            <th>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {concurrentOutcome.rows.map((row) => (
                            <tr key={row.label}>
                              <td>{row.label}</td>
                              <td>{row.status === 'fulfilled' ? 'OK' : `Error: ${row.error}`}</td>
                              <td>
                                {row.tx ? (
                                  <span className={`badge badge-${row.tx.status}`}>
                                    {row.tx.status}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="muted">
                                {row.tx?.decline_reason ?? (row.tx ? '—' : row.error ?? '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <section className="panel">
                <h3>Transaction history</h3>
                {transactions.length === 0 ? (
                  <p className="muted">No transactions yet.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="tx-table">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id}>
                            <td>{formatWhen(t.created_at)}</td>
                            <td>{t.transaction_type}</td>
                            <td>{formatMoney(t.amount_cents)}</td>
                            <td>{t.merchant_category ?? '—'}</td>
                            <td>
                              <span className={`badge badge-${t.status}`}>{t.status}</span>
                            </td>
                            <td className="muted">{t.decline_reason ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
