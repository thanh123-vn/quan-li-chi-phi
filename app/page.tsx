"use client"

/**
 * CHI PHÍ THÔNG MINH — Expense Dashboard
 * 
 * Flow: Upload ảnh → Tesseract OCR (tiếng Việt) → Claude LLM classify → Supabase save
 * 
 * Để sử dụng thực tế:
 *  1. Thêm NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY vào .env.local
 *  2. Thêm ANTHROPIC_API_KEY vào .env.local (server-side)
 *  3. Tạo bảng "expenses" trong Supabase với các cột:
 *     id, created_at, amount (numeric), category (text), raw_text (text),
 *     image_url (text), date (timestamptz), confidence (text), reason (text)
 *  4. Tạo storage bucket "receipts" trong Supabase (public)
 *  5. Gọi classifyWithLLM() qua /api/classify thay vì trực tiếp (để bảo mật API key)
 */

import Tesseract from "tesseract.js"
import { createClient } from "@supabase/supabase-js"
import { useState, useRef, useEffect, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts"

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE (replace with real env vars)
// ─────────────────────────────────────────────────────────────────────────────
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || ""
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase     = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null  // null = demo mode with local state only

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "Nguyên liệu",     icon: "🌾", color: "#2D6A4F", bg: "#D8F3DC" },
  { label: "Điện nước",       icon: "⚡", color: "#1D3557", bg: "#A8DADC" },
  { label: "Lương nhân viên", icon: "👥", color: "#6D2B7E", bg: "#E9D8FD" },
  { label: "Thuê mặt bằng",   icon: "🏠", color: "#7A4100", bg: "#FDECC8" },
  { label: "Marketing",       icon: "📢", color: "#1B4332", bg: "#B7E4C7" },
  { label: "Vận chuyển",      icon: "🚚", color: "#0D3B66", bg: "#BDE0FE" },
  { label: "Bảo trì",         icon: "🔧", color: "#7B3F00", bg: "#FFE8CC" },
  { label: "Khác",            icon: "📦", color: "#374151", bg: "#F3F4F6" },
]

const CAT_LABELS = CATEGORIES.map(c => c.label)
const CAT_MAP    = Object.fromEntries(CATEGORIES.map(c => [c.label, c]))
const CHART_COLORS = CATEGORIES.map(c => c.color)

const LAST_MONTH_BUDGET = 18_000_000
const WARN_RATIO = 1.2

// ─────────────────────────────────────────────────────────────────────────────
// DEMO DATA — shown when Supabase is not configured
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_EXPENSES = [
  { id: "1", amount: 4_200_000, category: "Nguyên liệu",     date: new Date(Date.now() - 1 * 86400000).toISOString(), raw_text: "Gạo, bột mì, đường, dầu ăn - cửa hàng Minh Hùng",    confidence: "cao",       reason: "Từ khóa thực phẩm nguyên liệu" },
  { id: "2", amount: 1_650_000, category: "Điện nước",        date: new Date(Date.now() - 2 * 86400000).toISOString(), raw_text: "EVN HN - Hóa đơn điện tháng 3/2025",                confidence: "cao",       reason: "Hóa đơn điện lực" },
  { id: "3", amount: 9_000_000, category: "Lương nhân viên",  date: new Date(Date.now() - 4 * 86400000).toISOString(), raw_text: "Thanh toán lương tháng 3 - 3 nhân viên phục vụ",    confidence: "cao",       reason: "Từ khóa lương, nhân viên" },
  { id: "4", amount: 5_500_000, category: "Thuê mặt bằng",   date: new Date(Date.now() - 6 * 86400000).toISOString(), raw_text: "Tiền thuê quán - 25 Nguyễn Trãi, Q1",               confidence: "cao",       reason: "Biên lai thuê nhà / mặt bằng" },
  { id: "5", amount: 780_000,  category: "Vận chuyển",       date: new Date(Date.now() - 7 * 86400000).toISOString(), raw_text: "Giao Hàng Nhanh - ship nguyên liệu từ chợ đầu mối", confidence: "trung bình", reason: "Phiếu vận chuyển" },
  { id: "6", amount: 1_500_000, category: "Marketing",        date: new Date(Date.now() - 9 * 86400000).toISOString(), raw_text: "Facebook Ads - quảng cáo fanpage tháng 3",            confidence: "cao",       reason: "Invoice quảng cáo mạng xã hội" },
  { id: "7", amount: 450_000,  category: "Bảo trì",          date: new Date(Date.now() - 11 * 86400000).toISOString(), raw_text: "Sửa máy pha cà phê - Điện lạnh Thịnh Phát",         confidence: "cao",       reason: "Biên lai sửa chữa thiết bị" },
  { id: "8", amount: 3_100_000, category: "Nguyên liệu",     date: new Date(Date.now() - 13 * 86400000).toISOString(), raw_text: "Hoa quả nhập khẩu - chợ Long Biên",                 confidence: "trung bình", reason: "Thực phẩm / nguyên liệu chế biến" },
  { id: "9", amount: 350_000,  category: "Khác",             date: new Date(Date.now() - 15 * 86400000).toISOString(), raw_text: "Văn phòng phẩm, hóa chất vệ sinh",                  confidence: "thấp",      reason: "Không rõ danh mục cụ thể" },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency", currency: "VND", maximumFractionDigits: 0
  }).format(n)

const fmtShort = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "tr"
  : n >= 1_000   ? (n / 1_000).toFixed(0) + "k"
  : String(n)

  const extractAmount = (text: string): number | null => { const lowerText = text.toLowerCase()
     //1. Normalize nhẹ để chống OCR sai
   const normalized = lowerText .replace(/t[o0]ng/g, "tổng") .replace(/ti[e3]n/g, "tiền") .replace(/th[aà]nh/g, "thành")
    const lines = normalized.split("\n").map(l => l.trim()) 
    let candidates: number[] = [] 
    for (const line of lines) {
    // Ưu tiên dòng chứa keyword 
  if ( line.includes("tổng") || line.includes("thành tiền") || line.includes("thanh toán") ) { const matches = line.match(/(\d{1,3}(?:[.,]\d{3})+)/g)
  if (matches) { const nums = matches.map(m => parseInt(m.replace(/[.,]/g, "")) )
     candidates.push(...nums) } } } 
  // 2. Nếu có candidate → lấy số lớn nhất 
  if (candidates.length > 0)
     { return Math.max(...candidates) } 
  // 3. fallback: lấy số lớn nhưng bỏ giá món
   const matches = normalized.match(/(\d{1,3}(?:[.,]\d{3})+)/g) 
   if (!matches) return null 
   const amounts = matches .map(str => parseInt(str.replace(/[.,]/g, ""))) .filter(n => n > 10000) 
   //loại giá nhỏ
    if (amounts.length === 0) return null 
    // 👉 QUAN TRỌNG: lấy số CUỐI (thường là tổng) 
    return Math.max(...amounts)
  }

  
// ─────────────────────────────────────────────────────────────────────────────
// LLM CLASSIFY — calls /api/classify (server route that holds Anthropic key)
// For demo, falls back to keyword matching
// ─────────────────────────────────────────────────────────────────────────────
async function classifyExpense(
  ocrText: string
): Promise<{ category: string; confidence: string; reason: string }> {
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: ocrText, categories: CAT_LABELS }),
    })
    if (!res.ok) throw new Error("API error " + res.status)
    return await res.json()
  } catch {
    // Fallback: keyword heuristic
    const lower = ocrText.toLowerCase()
    // Thêm "sữa", "vnm", "vinamilk" vào danh mục Nguyên liệu
if (/gạo|bột|thịt|rau|hoa quả|thực phẩm|nguyên liệu|sữa|vinamilk|vnm/.test(lower)) {
  return { category: "Nguyên liệu", confidence: "cao", reason: "Sản phẩm thực phẩm/đồ uống" };
}
    if (/gạo|bột|thịt|rau|hoa quả|thực phẩm|nguyên liệu/.test(lower))
      return { category: "Nguyên liệu", confidence: "trung bình", reason: "Từ khóa thực phẩm (fallback)" }
    if (/điện|nước|evn|pcvn|tiền điện/.test(lower))
      return { category: "Điện nước", confidence: "trung bình", reason: "Hóa đơn tiện ích (fallback)" }
    if (/lương|salari|nhân viên|tiền công/.test(lower))
      return { category: "Lương nhân viên", confidence: "trung bình", reason: "Từ khóa lương thưởng (fallback)" }
    if (/thuê|mặt bằng|căn hộ|tiền thuê/.test(lower))
      return { category: "Thuê mặt bằng", confidence: "trung bình", reason: "Từ khóa thuê mặt bằng (fallback)" }
    if (/ads|quảng cáo|marketing|facebook|google/.test(lower))
      return { category: "Marketing", confidence: "trung bình", reason: "Từ khóa quảng cáo (fallback)" }
    if (/ship|vận chuyển|giao hàng|ghn|ghtk/.test(lower))
      return { category: "Vận chuyển", confidence: "trung bình", reason: "Từ khóa vận chuyển (fallback)" }
    if (/sửa|bảo trì|bảo dưỡng|linh kiện/.test(lower))
      return { category: "Bảo trì", confidence: "trung bình", reason: "Từ khóa sửa chữa (fallback)" }
    return { category: "Khác", confidence: "thấp", reason: "Không nhận dạng được (fallback)" }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE
// ─────────────────────────────────────────────────────────────────────────────
function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    cao:          { bg: "#DCFCE7", text: "#166534", label: "AI: cao"    },
    "trung bình": { bg: "#FEF9C3", text: "#854D0E", label: "AI: TB"     },
    thấp:         { bg: "#FEE2E2", text: "#991B1B", label: "AI: thấp"   },
  }
  const s = map[level] || map.thấp
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
      background: s.bg, color: s.text, letterSpacing: "0.3px",
    }}>
      {s.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ExpensePage() {
  const [expenses, setExpenses]     = useState<any[]>(DEMO_EXPENSES)
  const [file, setFile]             = useState<File | null>(null)
  const [preview, setPreview]       = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [steps, setSteps]           = useState<{ text: string; done: boolean }[]>([])
  const [lastResult, setLastResult] = useState<any>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualAmt, setManualAmt]   = useState("")
  const [manualCat, setManualCat]   = useState("")
  const [activeChart, setActiveChart] = useState<"bar" | "pie" | "trend">("bar")
  const [dragOver, setDragOver]     = useState(false)
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load from Supabase on mount
  useEffect(() => {
    if (!supabase) return
    supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data?.length) setExpenses(data) })
  }, [])

  // ── Derived stats
  const now         = new Date()
  const thisMonth   = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const total       = thisMonth.reduce((s, e) => s + (e.amount || 0), 0)
  const overBudget  = total > LAST_MONTH_BUDGET * WARN_RATIO
  const overPct     = Math.round((total / LAST_MONTH_BUDGET - 1) * 100)

  // Bar chart data
  const barData = CATEGORIES
    .map(c => ({
      name:  c.label.length > 9 ? c.label.slice(0, 9) + "…" : c.label,
      full:  c.label,
      value: thisMonth.filter(e => e.category === c.label).reduce((s, e) => s + (e.amount || 0), 0),
      color: c.color,
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  // Pie data
  const pieData = barData.map(d => ({ name: d.full, value: d.value, color: d.color }))

  // Trend: last 6 months
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const mon = d.getMonth()
    const yr  = d.getFullYear()
    const sum = expenses
      .filter(e => { const ed = new Date(e.date); return ed.getMonth() === mon && ed.getFullYear() === yr })
      .reduce((s, e) => s + (e.amount || 0), 0)
    return {
      name:  d.toLocaleDateString("vi-VN", { month: "short" }),
      total: sum,
    }
  })

  // ── Handlers
  const handleFile = useCallback((f: File) => {
    setFile(f)
    setLastResult(null)
    setSteps([])
    setOcrPreview(null)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [])

  const addStep = (text: string) =>
    setSteps(prev => [...prev, { text, done: false }])
  const doneStep = () =>
    setSteps(prev => prev.map((s, i) => i === prev.length - 1 ? { ...s, done: true } : s))

  const processReceipt = async () => {
    if (!file) return
    setLoading(true)
    setLastResult(null)
    setSteps([])
    setOcrPreview(null)

    try {
      // Step 1 — OCR
      addStep("Đang đọc hóa đơn bằng OCR (tiếng Việt)...")
      const result = await Tesseract.recognize(file, "eng+vie", { logger: () => {} } as any)
      const raw  = result.data.text
      const text = raw.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim()
      if (!text) throw new Error("OCR không đọc được nội dung. Thử chụp lại rõ hơn.")
      setOcrPreview(text.substring(0, 300))
      doneStep()

      // Step 2 — Extract amount
      addStep("Đang trích xuất số tiền...")
      const amount = extractAmount(text) || 0
      doneStep()

      // Step 3 — LLM classify
      addStep("Đang phân loại chi phí bằng AI (Claude)...")
      const classified = await classifyExpense(text)
      doneStep()

      // Step 4 — Save
      addStep("Đang lưu vào hệ thống...")
      const newExp = {
        id:         String(Date.now()),
        amount,
        category:   classified.category,
        date:       new Date().toISOString(),
        raw_text:   text.substring(0, 400),
        confidence: classified.confidence,
        reason:     classified.reason,
        image_url:  preview,
      }

      if (supabase) {
        // Upload image
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`
        await supabase.storage.from("receipts").upload(fileName, file)
        const imageUrl = `${supabaseUrl}/storage/v1/object/public/receipts/${fileName}`
        newExp.image_url = imageUrl
        await supabase.from("expenses").insert([newExp])
      }

      setExpenses(prev => [newExp, ...prev])
      setLastResult({ ...newExp, ocrText: text })
      doneStep()

      // Reset
      setFile(null)
      setPreview(null)
      setTimeout(() => setSteps([]), 3000)
    } catch (err: any) {
      setSteps(prev => [...prev, { text: "❌ " + err.message, done: false }])
    } finally {
      setLoading(false)
    }
  }

  const addManual = async () => {
    if (!manualAmt || !manualCat) return
    const exp = {
      id:       String(Date.now()),
      amount:   parseFloat(manualAmt),
      category: manualCat,
      date:     new Date().toISOString(),
      raw_text: "Nhập thủ công",
    }
    if (supabase) await supabase.from("expenses").insert([exp])
    setExpenses(prev => [exp, ...prev])
    setManualAmt("")
    setManualCat("")
    setShowManual(false)
  }

  const deleteExpense = async (id: string) => {
    if (supabase) await supabase.from("expenses").delete().eq("id", id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STYLES (CSS variables-less approach for Next.js compatibility)
  // ─────────────────────────────────────────────────────────────────────────
  const S = {
    page:    { minHeight: "100vh", background: "#F5F6FA", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#111827" } as React.CSSProperties,
    topbar:  { background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 28px", display: "flex", alignItems: "center", height: 60, gap: 12 } as React.CSSProperties,
    wrap:    { maxWidth: 1200, margin: "0 auto", padding: "24px 20px", display: "grid", gap: 20 } as React.CSSProperties,
    card:    { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px 22px" } as React.CSSProperties,
    label:   { fontSize: 12, color: "#6B7280", marginBottom: 4 } as React.CSSProperties,
    bigNum:  { fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" } as React.CSSProperties,
    sub:     { fontSize: 12, color: "#9CA3AF", marginTop: 2 } as React.CSSProperties,
    input:   { width: "100%", padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" } as React.CSSProperties,
    btn:     (color: string) => ({ width: "100%", padding: "11px 16px", background: color, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "opacity .15s" }) as React.CSSProperties,
    tabBtn:  (active: boolean) => ({ fontSize: 12, padding: "5px 14px", borderRadius: 8, border: active ? "1.5px solid #2563EB" : "1px solid #E5E7EB", background: active ? "#EFF6FF" : "#fff", color: active ? "#2563EB" : "#6B7280", cursor: "pointer", fontWeight: active ? 700 : 400, transition: "all .15s" }) as React.CSSProperties,
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── TOP BAR ── */}
      <div style={S.topbar}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#2563EB"/>
          <path d="M7 17l3-4 3 3 3-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.3px" }}>Chi Phí Thông Minh</span>
        <span style={{ fontSize: 11, background: "#DBEAFE", color: "#1D4ED8", borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>
          OCR + AI
        </span>
        {!supabase && (
          <span style={{ marginLeft: "auto", fontSize: 11, background: "#FEF9C3", color: "#92400E", borderRadius: 20, padding: "3px 10px" }}>
            Chế độ demo — chưa kết nối Supabase
          </span>
        )}
      </div>

      <div style={S.wrap}>

        {/* ── BUDGET ALERT ── */}
        {overBudget && (
          <div style={{
            background: "#FFFBEB", border: "1px solid #FCD34D",
            borderLeft: "4px solid #F59E0B", borderRadius: 12,
            padding: "14px 20px", display: "flex", gap: 14, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: "#78350F", fontSize: 15, marginBottom: 3 }}>
                Cảnh báo vượt ngân sách tháng {now.getMonth() + 1}/{now.getFullYear()}
              </div>
              <div style={{ color: "#92400E", fontSize: 13, lineHeight: 1.6 }}>
                Tổng chi phí hiện tại <strong>{fmt(total)}</strong> — đã vượt{" "}
                <strong style={{ color: "#DC2626" }}>+{overPct}%</strong> so với tháng trước
                ({fmt(LAST_MONTH_BUDGET)}). Hãy xem xét cắt giảm chi phí không cần thiết.
              </div>
            </div>
          </div>
        )}

        {/* ── SUMMARY CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {[
            {
              label: "Tổng chi tháng này",
              value: fmt(total),
              sub: `${thisMonth.length} giao dịch`,
              accent: "#2563EB",
              bg: "#EFF6FF",
            },
            {
              label: "Danh mục lớn nhất",
              value: barData[0]?.full || "—",
              sub: barData[0] ? fmt(barData[0].value) : "Chưa có dữ liệu",
              accent: "#7C3AED",
              bg: "#F5F3FF",
            },
            {
              label: "Chi phí trung bình",
              value: thisMonth.length ? fmt(Math.round(total / thisMonth.length)) : "—",
              sub: "mỗi giao dịch",
              accent: "#059669",
              bg: "#ECFDF5",
            },
            {
              label: overBudget ? "⚠ Vượt ngân sách" : "So tháng trước",
              value: total ? (overPct >= 0 ? `+${overPct}%` : `${overPct}%`) : "—",
              sub: `Ngưỡng cảnh báo: ${fmt(LAST_MONTH_BUDGET)}`,
              accent: overBudget ? "#DC2626" : "#059669",
              bg: overBudget ? "#FEF2F2" : "#ECFDF5",
            },
          ].map(c => (
            <div key={c.label} style={{ ...S.card, borderLeft: `3px solid ${c.accent}` }}>
              <div style={S.label}>{c.label}</div>
              <div style={{ ...S.bigNum, color: c.accent, fontSize: 20 }}>{c.value}</div>
              <div style={S.sub}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: "grid", gap: 18 }}>

            {/* CHART */}
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Phân tích chi phí</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>Tháng {now.getMonth() + 1}/{now.getFullYear()}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["bar", "pie", "trend"] as const).map(t => (
                    <button key={t} onClick={() => setActiveChart(t)} style={S.tabBtn(activeChart === t)}>
                      {{ bar: "Cột", pie: "Vòng", trend: "Xu hướng" }[t]}
                    </button>
                  ))}
                </div>
              </div>

              {barData.length === 0 && activeChart !== "trend" ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14 }}>
                  Chưa có dữ liệu tháng này
                </div>
              ) : activeChart === "bar" ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                    <Tooltip
                     formatter={(value: any) => [fmt(Number(value || 0)), "Chi phí"]}
                      labelFormatter={(_: any, p: any) => p?.[0]?.payload?.full || ""}
                      contentStyle={{ borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", boxShadow: "0 4px 16px #0001" }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : activeChart === "pie" ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                   formatter={(value: any, name: any, props: any) => [
  fmt(Number(value || 0)),
  props?.payload?.name || ""
]}
                    />
                    <Legend iconType="circle" iconSize={8}
                      formatter={v => <span style={{ fontSize: 11, color: "#374151" }}>{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                    <Tooltip
                     formatter={(value: any) => [fmt(Number(value || 0)), "Chi phí"]}
                      contentStyle={{ borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB" }}
                    />
                    <Line type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2.5}
                      dot={{ fill: "#2563EB", r: 4 }} activeDot={{ r: 6 }} />
                    {/* Budget line */}
                    <Line type="monotone" data={trendData.map(d => ({ ...d, budget: LAST_MONTH_BUDGET * WARN_RATIO }))}
                      dataKey="budget" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* Category legend for bar/pie */}
              {(activeChart === "bar" || activeChart === "pie") && barData.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 14 }}>
                  {barData.map(d => (
                    <div key={d.full} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: "inline-block" }} />
                      {d.full}
                      <span style={{ color: "#9CA3AF" }}>{fmtShort(d.value)}</span>
                    </div>
                  ))}
                </div>
              )}
              {activeChart === "trend" && (
                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#374151" }}>
                    <span style={{ width: 16, height: 2, background: "#2563EB", display: "inline-block", borderRadius: 2 }} />
                    Chi phí thực tế
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#374151" }}>
                    <span style={{ width: 16, height: 2, background: "#F59E0B", display: "inline-block", borderRadius: 2, borderTop: "1.5px dashed #F59E0B" }} />
                    Ngưỡng cảnh báo
                  </span>
                </div>
              )}
            </div>

            {/* EXPENSE LIST */}
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
                Lịch sử chi phí
                <span style={{ marginLeft: 8, fontSize: 12, color: "#9CA3AF", fontWeight: 400 }}>
                  {expenses.length} giao dịch
                </span>
              </div>

              <div style={{ display: "grid", gap: 8, maxHeight: 400, overflowY: "auto" }}>
                {expenses.map(exp => {
                  const cat = CAT_MAP[exp.category] || CAT_MAP["Khác"]
                  const d   = new Date(exp.date)
                  return (
                    <div key={exp.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 10,
                      border: "1px solid #F3F4F6", background: "#FAFAFA",
                      transition: "background .1s",
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: cat.bg, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 18, flexShrink: 0,
                      }}>
                        {cat.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{exp.category}</span>
                          {exp.confidence && <ConfidenceBadge level={exp.confidence} />}
                        </div>
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                          {d.toLocaleDateString("vi-VN")}
                          {exp.reason && ` · ${exp.reason}`}
                        </div>
                        {exp.raw_text && (
                          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320 }}>
                            {exp.raw_text}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{fmt(exp.amount)}</div>
                        <button
                          onClick={() => deleteExpense(exp.id)}
                          style={{ fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 3 }}
                        >
                          xóa
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>

            {/* UPLOAD CARD */}
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📸 Upload hóa đơn</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14, marginTop: 2 }}>
                OCR tiếng Việt → phân loại tự động bằng AI
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f) handleFile(f)
                }}
                style={{
                  border: `2px dashed ${dragOver ? "#2563EB" : preview ? "#2563EB" : "#D1D5DB"}`,
                  borderRadius: 12, cursor: "pointer", overflow: "hidden",
                  background: preview ? "#000" : dragOver ? "#EFF6FF" : "#FAFAFA",
                  transition: "all .2s", minHeight: preview ? 0 : 130,
                  display: preview ? "block" : "flex", alignItems: "center",
                  justifyContent: "center", flexDirection: "column", textAlign: "center",
                  padding: preview ? 0 : 16,
                }}
              >
                {preview ? (
                  <img src={preview} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }} />
                ) : (
                  <>
                    <div style={{ fontSize: 32 }}>📄</div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
                      Nhấn hoặc kéo thả ảnh hóa đơn
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                      Hỗ trợ: JPG, PNG, WEBP
                    </div>
                  </>
                )}
              </div>
             <label htmlFor="upload-receipt" style={{ display: "none" }}>
  Upload hóa đơn
</label>

<input
  id="upload-receipt"
  ref={fileRef}
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={e => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
  }}
/>

              {file && !loading && (
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
                  📎 {file.name} · {(file.size / 1024).toFixed(1)} KB
                </div>
              )}

              {/* Progress steps */}
              {steps.length > 0 && (
                <div style={{ marginTop: 12, display: "grid", gap: 5 }}>
                  {steps.map((s, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                      padding: "7px 10px", borderRadius: 8,
                      background: s.text.startsWith("❌") ? "#FEF2F2" : s.done ? "#ECFDF5" : "#EFF6FF",
                      color: s.text.startsWith("❌") ? "#DC2626" : s.done ? "#065F46" : "#1D4ED8",
                    }}>
                      <span>{s.done ? "✅" : s.text.startsWith("❌") ? "❌" : "⏳"}</span>
                      <span>{s.text.replace(/^❌ /, "")}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* OCR preview */}
              {ocrPreview && (
                <div style={{ marginTop: 10, background: "#F8F9FA", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Nội dung OCR đọc được:</div>
                  <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.6, fontFamily: "monospace", maxHeight: 100, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                    {ocrPreview}
                  </div>
                </div>
              )}

              {/* Result banner */}
              {lastResult && (
                <div style={{
                  marginTop: 12, background: "#ECFDF5", border: "1px solid #A7F3D0",
                  borderRadius: 10, padding: "12px 14px",
                }}>
                  <div style={{ fontWeight: 700, color: "#065F46", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    ✅ Phân loại thành công
                    <ConfidenceBadge level={lastResult.confidence} />
                  </div>
                  <div style={{ display: "grid", gap: 4, fontSize: 13, color: "#047857" }}>
                    <div>
                      <span style={{ color: "#6B7280" }}>Danh mục: </span>
                      <strong>{lastResult.category}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6B7280" }}>Số tiền: </span>
                      <strong>{fmt(lastResult.amount)}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: "#6EE7B7", marginTop: 2 }}>
                      Lý do: {lastResult.reason}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={processReceipt}
                disabled={loading || !file}
                style={{
                  ...S.btn(loading || !file ? "#9CA3AF" : "#2563EB"),
                  marginTop: 14,
                  cursor: loading || !file ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "⏳ Đang xử lý..." : "📤 Xử lý tự động (OCR + AI)"}
              </button>

              {preview && !loading && (
                <button
                  onClick={() => { setFile(null); setPreview(null); setSteps([]); setLastResult(null); setOcrPreview(null) }}
                  style={{ ...S.btn("#6B7280"), marginTop: 8 }}
                >
                  Chọn ảnh khác
                </button>
              )}
            </div>

            {/* MANUAL ENTRY */}
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>✏️ Nhập thủ công</div>

              {!showManual ? (
                <button onClick={() => setShowManual(true)} style={S.btn("#6366F1")}>
                  + Thêm chi phí thủ công
                </button>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Số tiền (VNĐ)</div>
                    <input
                      type="number"
                      placeholder="Ví dụ: 500000"
                      value={manualAmt}
                      onChange={e => setManualAmt(e.target.value)}
                      style={S.input}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Danh mục</div>
<select
  aria-label="Chọn danh mục"
  value={manualCat}
  onChange={e => setManualCat(e.target.value)}
  style={S.input}
>                      <option value="">Chọn danh mục...</option>
                      {CATEGORIES.map(c => (
                        <option key={c.label} value={c.label}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={addManual} disabled={!manualAmt || !manualCat}
                      style={{ ...S.btn(!manualAmt || !manualCat ? "#9CA3AF" : "#6366F1"), cursor: !manualAmt || !manualCat ? "not-allowed" : "pointer" }}>
                      Lưu
                    </button>
                    <button onClick={() => setShowManual(false)}
                      style={{ ...S.btn("#6B7280") }}>
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CATEGORY BREAKDOWN */}
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Danh mục tháng này</div>
              <div style={{ display: "grid", gap: 8 }}>
                {CATEGORIES.map(c => {
                  const catTotal = thisMonth.filter(e => e.category === c.label).reduce((s, e) => s + (e.amount || 0), 0)
                  const pct = total > 0 ? Math.round(catTotal / total * 100) : 0
                  if (catTotal === 0) return null
                  return (
                    <div key={c.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>{c.icon} {c.label}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(catTotal)} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 5, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: c.color, borderRadius: 4, transition: "width .4s ease" }} />
                      </div>
                    </div>
                  )
                })}
                {thisMonth.length === 0 && (
                  <div style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "12px 0" }}>Chưa có chi phí tháng này</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}