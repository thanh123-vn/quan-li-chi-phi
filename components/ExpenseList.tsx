"use client"

import { supabase } from "../lib/supabase"
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

interface ExpenseListProps {
  expenses: any[]
  onRefresh: () => void
}

export default function ExpenseList({ expenses, onRefresh }: ExpenseListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount)
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Nguyên liệu': 'bg-blue-100 text-blue-800',
      'Điện nước': 'bg-yellow-100 text-yellow-800',
      'Lương nhân viên': 'bg-green-100 text-green-800',
      'Thuê mặt bằng': 'bg-purple-100 text-purple-800',
      'Marketing': 'bg-pink-100 text-pink-800',
      'Vận chuyển': 'bg-indigo-100 text-indigo-800',
      'Bảo trì': 'bg-orange-100 text-orange-800',
      'Khác': 'bg-gray-100 text-gray-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  const deleteExpense = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (!error) {
      onRefresh()
    }
  }

  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0)

  return (
    <div>
      <div className="mb-4 text-right text-lg font-semibold">
        Tổng: {formatCurrency(total)}
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(expense.category)}`}>
                  {expense.category}
                </span>
                <span className="text-sm text-gray-500">
                  {expense.date && format(new Date(expense.date), 'dd/MM/yyyy', { locale: vi })}
                </span>
              </div>
              
              <div className="mt-1 font-medium">
                {formatCurrency(expense.amount)}
              </div>
              
              {expense.note && (
                <div className="text-sm text-gray-600">
                  📝 {expense.note}
                </div>
              )}
              
              {expense.image_url && (
                <a
                  href={expense.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Xem hóa đơn
                </a>
              )}
            </div>

            <button
              onClick={() => deleteExpense(expense.id)}
              className="text-red-600 hover:text-red-800 p-2"
            >
              🗑️
            </button>
          </div>
        ))}

        {expenses.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Chưa có chi phí nào
          </div>
        )}
      </div>
    </div>
  )
}