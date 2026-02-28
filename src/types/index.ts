export type BizId = 'wellbuild' | 'tcchemical' | 'wellprint'

export const BIZ: Record<BizId, { name: string; color: string; bg: string; desc: string }> = {
  wellbuild:  { name: 'WELLBUILD',   color: '#d4a017', bg: '#fdf8e8', desc: 'Construction & Hardware' },
  tcchemical: { name: 'TC CHEMICAL', color: '#5b9490', bg: '#eef6f5', desc: 'Chemical & Laboratory'  },
  wellprint:  { name: 'WELLPRINT',   color: '#4e6b65', bg: '#eff3f2', desc: 'Printing Materials'      },
}

export const AVATAR_COLORS = [
  '#d4a017','#5b9490','#4e6b65','#3d9e74',
  '#c07a2a','#7a7ea8','#2e8b80','#c46b3a',
  '#8a6e4b','#4a8a6f','#6b7e9e','#a07040',
]

export const UNITS = ['pcs','kg','g','L','mL','box','pack','roll','sheet','set','bag','drum','m','ft']

export type Role = 'admin' | 'staff'
export type TxType = 'stock_in' | 'stock_out' | 'adjustment'

export const TX_LABEL: Record<TxType, string> = {
  stock_in: 'Stock In', stock_out: 'Stock Out', adjustment: 'Adjustment',
}

export interface SessionUser {
  id: string
  username: string
  full_name: string
  email: string | null
  role: Role
  business_id: BizId
  avatar_color: string | null
  password_hash?: string
}

export interface Product {
  id: string; sku: string; name: string; description: string | null
  category_id: string | null; supplier_id: string | null
  business_id: BizId; unit: string; quantity: number
  reorder_level: number; cost_price: number; selling_price: number
  is_active: boolean; created_at: string; updated_at: string
  categories?: { name: string } | null
  suppliers?: { name: string } | null
}

export interface Category {
  id: string; name: string; description: string | null
  business_id: BizId; created_at: string
}

export interface Supplier {
  id: string; name: string; contact_person: string | null
  email: string | null; phone: string | null; address: string | null
  business_id: BizId; is_active: boolean; created_at: string
}

export interface Transaction {
  id: string; product_id: string; business_id: BizId
  transaction_type: TxType; quantity: number
  reference_number: string | null; notes: string | null
  performed_by: string; created_at: string
  // Sale / stock-out fields
  voucher_number: string | null
  date_of_sale: string | null
  customer_name: string | null
  customer_phone: string | null
  products?: { name: string; sku: string; unit: string } | null
  users?: { full_name: string; username: string } | null
}

export interface Customer {
  id: string; name: string; phone: string | null
  email: string | null; address: string | null
  business_id: BizId; is_active: boolean; created_at: string
}

export interface StaffUser {
  id: string; email: string | null; username: string; full_name: string
  role: Role; business_id: BizId; avatar_color: string | null
  is_active: boolean; created_at: string
}
