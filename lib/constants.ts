import type { Category } from "../types"

export const CATEGORIES: Category[] = [
  "Nguyên liệu",
  "Điện nước",
  "Lương",
  "Thuê mặt bằng",
  "Vận chuyển",
  "Marketing",
  "Thiết bị",
  "Khác",
]

export const CAT_COLOR: Record<Category, string> = {
  "Nguyên liệu":   "#3B8BD4",
  "Điện nước":     "#F2A623",
  "Lương":         "#1D9E75",
  "Thuê mặt bằng": "#7F77DD",
  "Vận chuyển":    "#D85A30",
  "Marketing":     "#D4537E",
  "Thiết bị":      "#639922",
  "Khác":          "#888780",
}

export const CAT_BG: Record<Category, string> = {
  "Nguyên liệu":   "#E6F1FB",
  "Điện nước":     "#FAEEDA",
  "Lương":         "#E1F5EE",
  "Thuê mặt bằng": "#EEEDFE",
  "Vận chuyển":    "#FAECE7",
  "Marketing":     "#FBEAF0",
  "Thiết bị":      "#EAF3DE",
  "Khác":          "#F1EFE8",
}

/** Monthly budget limit (VNĐ) */
export const BUDGET_LIMIT = 20_000_000

export function fmtMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN")
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}