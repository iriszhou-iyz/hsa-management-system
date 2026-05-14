export type MerchantCategory =
  | 'pharmacy'
  | 'hospital'
  | 'clinic'
  | 'dentist'
  | 'vision'
  | 'therapy'
  | 'medical_equipment'
  | 'restaurant'
  | 'electronics'
  | 'grocery'
  | 'entertainment'
  | 'other'

export type TransactionType = 'DEPOSIT' | 'PURCHASE'
export type TransactionStatus = 'approved' | 'declined'

export interface Account {
  id: number
  owner_name: string
  email: string
  balance_cents: number
  created_at: string
}

export interface Transaction {
  id: number
  account_id: number
  transaction_type: TransactionType
  amount_cents: number
  merchant_category: MerchantCategory | null
  status: TransactionStatus
  decline_reason: string | null
  created_at: string
}

export interface Card {
  id: number
  account_id: number
  last_four: string
  is_active: boolean
  issued_at: string
}
