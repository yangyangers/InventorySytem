import { AVATAR_COLORS, BizId, BIZ, TxType } from "@/types"

function dateStamp() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

export function genVoucherNumber(): string {
  const stamp = dateStamp()
  const key = `vch_counter_${stamp}`
  const current = parseInt(localStorage.getItem(key) || "0", 10)
  const next = current + 1
  localStorage.setItem(key, String(next))
  return `VCH-${stamp}-${String(next).padStart(4, "0")}`
}

export function genRefNumber(): string {
  const stamp = dateStamp()
  const key = `ref_counter_${stamp}`
  const current = parseInt(localStorage.getItem(key) || "0", 10)
  const next = current + 1
  localStorage.setItem(key, String(next))
  return `REF-${stamp}-${String(next).padStart(4, "0")}`
}

export const php = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n)

export const dt = (s: string) =>
  new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(s))

export const dtShort = (s: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(s))

export const avatarColor = (name: string, override?: string | null) =>
  override || AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

export const bizColor = (id: BizId) => BIZ[id]?.color ?? "#f97066"

export function stockBadge(qty: number, reorder: number) {
  if (qty === 0)        return { label: "Out of Stock", cls: "badge-red"   }
  if (qty <= reorder)   return { label: "Low Stock",    cls: "badge-amber" }
  return                       { label: "In Stock",     cls: "badge-green" }
}

export function txBadgeCls(t: TxType) {
  return t === "stock_in" ? "badge-green" : t === "stock_out" ? "badge-red" : "badge-blue"
}

export function txSign(t: TxType) {
  return t === "stock_in" ? "+" : t === "stock_out" ? "-" : "+-"
}

export function txColor(t: TxType) {
  return t === "stock_in" ? "var(--green)" : t === "stock_out" ? "var(--red)" : "var(--teal)"
}
