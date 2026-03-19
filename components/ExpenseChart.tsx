"use client"

import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

interface ExpenseChartProps {
  expenses: any[]
}

export default function ExpenseChart({ expenses }: ExpenseChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    if (!expenses.length || !chartRef.current) return

    // Destroy old chart
    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    // Group by category
    const categoryTotals: { [key: string]: number } = {}
    expenses.forEach(exp => {
      const cat = exp.category || 'Khác'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount
    })

    // Group by month
    const monthlyTotals: { [key: string]: number } = {}
    expenses.forEach(exp => {
      const date = new Date(exp.date)
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`
      monthlyTotals[monthYear] = (monthlyTotals[monthYear] || 0) + exp.amount
    })

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(monthlyTotals),
        datasets: [{
          label: 'Chi phí (VNĐ)',
          data: Object.values(monthlyTotals),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Chi phí theo tháng'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('vi-VN').format(Number(value)) + 'đ'
              }
            }
          }
        }
      }
    })

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [expenses])

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <canvas ref={chartRef} />
    </div>
  )
}