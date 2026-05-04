"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function BudgetStatusWidget({ accounts, periodBalances, startDate }: { accounts: any[], periodBalances: Record<string, number>, startDate: string }) {
  const [budgets, setBudgets] = useState<any[]>([])

  const targetMonth = startDate.substring(0, 7)
  const [year, month] = targetMonth.split('-')

  const loadBudgets = async () => {
    const { data: userAuth } = await supabase.auth.getUser()
    if (!userAuth?.user) return
    const { data } = await supabase.from("budgets").select("*").eq("owner_id", userAuth.user.id).eq("target_month", targetMonth)
    if (data) setBudgets(data)
  }

  useEffect(() => { loadBudgets() }, [targetMonth])

  // 실제 지출액 계산
  const categorySpending: Record<string, number> = {}
  accounts.forEach(a => {
    if (a.type !== 'expense') return
    const gName = a.group_type || "미분류"
    categorySpending[gName] = (categorySpending[gName] || 0) + Math.abs(periodBalances[a.id] || 0)
  })

  return (
    <Card className="rounded-xl border bg-white shadow-sm w-full">
      <CardHeader>
        <CardTitle>예산 현황</CardTitle>
        <CardDescription><span className="font-bold text-blue-600">{year}년 {month}월</span>의 예산 대비 지출 소진율입니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {budgets.length === 0 ? (
          <div className="text-center text-slate-500 py-6 text-sm">설정된 예산이 없습니다. [예산/결산] 탭에서 추가해주세요.</div>
        ) : (
          <div className="space-y-6">
            {budgets.map(b => {
              const spent = categorySpending[b.category_name] || 0
              const limit = Number(b.amount)
              const percent = Math.min(100, Math.max(0, (spent / limit) * 100))
              const isOver = spent > limit
              
              return (
                <div key={b.id} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="font-bold text-slate-700 text-sm flex items-center space-x-2">
                       <span>{b.category_name}</span>
                    </div>
                    <div className="text-xs text-right">
                       <span className={isOver ? 'text-red-500 font-bold' : 'text-slate-700 font-bold'}>{spent.toLocaleString()} 원</span>
                       <span className="text-slate-400"> / {limit.toLocaleString()} 원</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : (percent > 80 ? 'bg-orange-400' : 'bg-blue-500')}`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
