"use client"
import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pie, PieChart, Bar, BarChart, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine, ReferenceArea } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export default function BudgetManager({ accounts, startDate }: { accounts: any[], startDate: string }) {
  const [budgets, setBudgets] = useState<any[]>([])
  const [budgetInputMatrix, setBudgetInputMatrix] = useState<Record<string, Record<number, string>>>({})

  const [reportYear, setReportYear] = useState(startDate.substring(0, 4))
  const [yearlyTransactions, setYearlyTransactions] = useState<any[]>([])
  const [prevYearTransactions, setPrevYearTransactions] = useState<any[]>([])
  const [isReportLoading, setIsReportLoading] = useState(false)

  const [chartMode, setChartMode] = useState<"separate" | "net">("separate")
  const [topCategoryType, setTopCategoryType] = useState<"expense" | "revenue">("expense")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [editingCell, setEditingCell] = useState<{ cat: string, month: number } | null>(null)

  const loadBudgets = async () => {
    const { data: userAuth } = await supabase.auth.getUser()
    if (!userAuth?.user) return
    const { data } = await supabase.from("budgets")
      .select("*")
      .eq("owner_id", userAuth.user.id)
      .like("target_month", `${reportYear}-%`)
    if (data) {
      setBudgets(data)
      const newMatrix: Record<string, Record<number, string>> = {}
      data.forEach(b => {
        const m = parseInt(b.target_month.substring(5, 7), 10) - 1
        if (!newMatrix[b.category_name]) newMatrix[b.category_name] = {}
        newMatrix[b.category_name][m] = b.amount.toString()
      })
      setBudgetInputMatrix(newMatrix)
    }
  }

  const loadYearlyReport = async () => {
    setIsReportLoading(true)
    const { data: userAuth } = await supabase.auth.getUser()
    if (!userAuth?.user) return

    const yStart = `${reportYear}-01-01`
    const yEnd = `${reportYear}-12-31`
    const prevYStart = `${parseInt(reportYear) - 1}-01-01`
    const prevYEnd = `${parseInt(reportYear) - 1}-12-31`

    const { data: txs } = await supabase.from("transactions")
      .select(`id, transaction_date, journal_entries ( account_id, amount, accounts ( name, type, group_type, sub_category ) )`)
      .eq("creator_id", userAuth.user.id)
      .gte("transaction_date", yStart)
      .lte("transaction_date", yEnd)

    const { data: prevTxs } = await supabase.from("transactions")
      .select(`id, transaction_date, journal_entries ( account_id, amount, accounts ( name, type, group_type, sub_category ) )`)
      .eq("creator_id", userAuth.user.id)
      .gte("transaction_date", prevYStart)
      .lte("transaction_date", prevYEnd)

    if (txs) setYearlyTransactions(txs)
    if (prevTxs) setPrevYearTransactions(prevTxs)
    setIsReportLoading(false)
  }

  useEffect(() => { loadBudgets(); loadYearlyReport() }, [reportYear])

  const allCategories = Array.from(new Set(accounts.filter(a => a.type === 'expense' || a.type === 'revenue').map(a => a.sub_category || a.group_type || "미분류"))).filter(Boolean)
  const categoryTypes: Record<string, string> = {}
  accounts.forEach(a => {
    if (a.type === 'expense' || a.type === 'revenue') {
      const gName = a.sub_category || a.group_type || "미분류"
      categoryTypes[gName] = a.type
    }
  })

  const handleBudgetBlur = async (catName: string, monthIndex: number, value: string) => {
    const amount = Number(value)
    const monthStr = String(monthIndex + 1).padStart(2, '0')
    const tMonth = `${reportYear}-${monthStr}`

    const { data: userAuth } = await supabase.auth.getUser()
    if (!userAuth?.user) return

    const existing = budgets.find(b => b.category_name === catName && b.target_month === tMonth)
    
    if (existing) {
      if (amount === 0 || value === "") {
        await supabase.from("budgets").delete().eq("id", existing.id)
        setBudgets(prev => prev.filter(b => b.id !== existing.id))
      } else {
        await supabase.from("budgets").update({ amount }).eq("id", existing.id)
        setBudgets(prev => prev.map(b => b.id === existing.id ? { ...b, amount } : b))
      }
    } else {
      if (amount > 0) {
        const { data } = await supabase.from("budgets").insert([{ owner_id: userAuth.user.id, category_name: catName, target_month: tMonth, amount }]).select()
        if (data && data.length > 0) {
           setBudgets(prev => [...prev, data[0]])
        }
      }
    }
  }

  // 연간 데이터 집계
  let totalRevenue = 0
  let totalExpense = 0
  const revenueBySub: Record<string, { total: number, subs: Record<string, number> }> = {}
  const expenseBySub: Record<string, { total: number, subs: Record<string, number> }> = {}
  const monthlyData: Record<string, { revenue: number, expense: number }> = {}
  
  // 매트릭스 데이터: [category][monthIndex 0~11] = amount
  const categoryMonthlyMatrix: Record<string, number[]> = {}
  allCategories.forEach((cat: any) => {
    categoryMonthlyMatrix[cat] = Array(12).fill(0)
  })
  categoryMonthlyMatrix["미분류"] = Array(12).fill(0)

  for (let i = 1; i <= 12; i++) {
    monthlyData[`${reportYear}-${String(i).padStart(2, '0')}`] = { revenue: 0, expense: 0 }
  }

  yearlyTransactions.forEach(tx => {
    const monthStr = tx.transaction_date.substring(5, 7) // "01" ~ "12"
    const monthIndex = parseInt(monthStr, 10) - 1
    const monthKey = tx.transaction_date.substring(0, 7)

    tx.journal_entries.forEach((je: any) => {
      const type = je.accounts?.type
      const amount = Number(je.amount)
      
      if (type === 'revenue') {
        const rev = Math.abs(amount)
        totalRevenue += rev
        if (monthlyData[monthKey]) monthlyData[monthKey].revenue += rev
        
        const sName = je.accounts?.sub_category || "미분류"
        const accName = je.accounts?.name || "미분류"
        
        if (!revenueBySub[sName]) revenueBySub[sName] = { total: 0, subs: {} }
        revenueBySub[sName].total += rev
        revenueBySub[sName].subs[accName] = (revenueBySub[sName].subs[accName] || 0) + rev

        const matrixName = je.accounts?.sub_category || je.accounts?.group_type || "미분류"
        if (!categoryMonthlyMatrix[matrixName]) {
          categoryMonthlyMatrix[matrixName] = Array(12).fill(0)
          categoryTypes[matrixName] = 'revenue'
        }
        categoryMonthlyMatrix[matrixName][monthIndex] += rev
      } else if (type === 'expense') {
        const exp = Math.abs(amount)
        totalExpense += exp
        if (monthlyData[monthKey]) monthlyData[monthKey].expense += exp
        
        const sName = je.accounts?.sub_category || "미분류"
        const accName = je.accounts?.name || "미분류"
        
        if (!expenseBySub[sName]) expenseBySub[sName] = { total: 0, subs: {} }
        expenseBySub[sName].total += exp
        expenseBySub[sName].subs[accName] = (expenseBySub[sName].subs[accName] || 0) + exp
        
        const matrixName = je.accounts?.sub_category || je.accounts?.group_type || "미분류"
        if (!categoryMonthlyMatrix[matrixName]) {
          categoryMonthlyMatrix[matrixName] = Array(12).fill(0)
          categoryTypes[matrixName] = 'expense'
        }
        categoryMonthlyMatrix[matrixName][monthIndex] += exp
      }
    })
  })

  const savings = totalRevenue - totalExpense

  let budgetRevenue = 0
  let budgetExpense = 0
  budgets.forEach(b => {
    const type = categoryTypes[b.category_name]
    if (type === 'revenue') budgetRevenue += Number(b.amount)
    else budgetExpense += Number(b.amount)
  })
  const budgetNetIncome = budgetRevenue - budgetExpense
  const goalAchievementRate = budgetNetIncome === 0 ? "예산수립필요" : `${((savings / budgetNetIncome) * 100).toFixed(1)}%`

  let prevRevenue = 0
  let prevExpense = 0
  prevYearTransactions.forEach(tx => {
    tx.journal_entries.forEach((je: any) => {
      const type = je.accounts?.type
      const amount = Number(je.amount)
      if (type === 'revenue') prevRevenue += Math.abs(amount)
      else if (type === 'expense') prevExpense += Math.abs(amount)
    })
  })
  const prevSavings = prevRevenue - prevExpense
  const yoyGrowthRate = prevYearTransactions.length === 0 ? "산출불가" : (prevSavings === 0 ? "산출불가" : `${(((savings - prevSavings) / Math.abs(prevSavings)) * 100).toFixed(1)}%`)

  const currentCategoryData = topCategoryType === 'expense' ? expenseBySub : revenueBySub
  const topCategories = Object.entries(currentCategoryData)
    .map(([name, data]) => ({ name, value: data.total, subs: data.subs }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  const toggleAllGroups = (expand: boolean) => {
    const newExpanded: Record<string, boolean> = {}
    topCategories.forEach(e => {
      newExpanded[e.name] = expand
    })
    setExpandedGroups(newExpanded)
  }
  
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({...prev, [groupName]: !prev[groupName]}))
  }

  const monthlyChartData = Object.entries(monthlyData).map(([name, data]) => ({
    name: name.split('-')[1] + '월',
    수입: data.revenue,
    지출: -data.expense, // 분산형 차트를 위해 음수 처리
    순이익: data.revenue - data.expense
  }))

  const COLORS = ['#3b82f6', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6']

  const chartConfig = {
    수입: {
      label: "수입",
      color: "hsl(var(--chart-1))",
    },
    지출: {
      label: "지출",
      color: "hsl(var(--chart-2))",
    },
    순이익: {
      label: "순이익",
      color: "#8b5cf6",
    }
  }

  let totalBudgetForYear = 0
  budgets.forEach(b => { totalBudgetForYear += Number(b.amount) })

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="border-slate-200 shadow-md w-full overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between space-y-3 md:space-y-0">
          <div>
            <CardTitle className="text-2xl font-black text-slate-800">{reportYear}년 종합 결산 리포트</CardTitle>
            <CardDescription>한 해 동안의 예산 계획과 지출 패턴을 분석합니다.</CardDescription>
          </div>
          <Select value={reportYear} onValueChange={(val) => { if (val) setReportYear(val) }}>
            <SelectTrigger className="w-[120px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}년</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="pt-6 w-full overflow-x-hidden">
          {isReportLoading ? (
            <div className="text-center py-10 text-slate-500">리포트 데이터를 불러오는 중입니다...</div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex flex-col justify-center items-center">
                  <span className="text-sm font-bold text-blue-600 mb-1">총 수입</span>
                  <span className="text-2xl font-black text-blue-800">{totalRevenue.toLocaleString()} 원</span>
                </div>
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col justify-center items-center">
                  <span className="text-sm font-bold text-red-600 mb-1">총 지출</span>
                  <span className="text-2xl font-black text-red-800">{totalExpense.toLocaleString()} 원</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col justify-center items-center">
                  <span className="text-sm font-bold text-emerald-600 mb-1">순이익</span>
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-emerald-800">{savings.toLocaleString()} 원</span>
                    <span className="text-xs font-bold text-emerald-600 mt-1">목표: <span className="font-black text-emerald-700">{goalAchievementRate}</span> | 전년비: <span className="font-black text-emerald-700">{yoyGrowthRate}</span></span>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mt-8 items-start">
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="font-bold text-base sm:text-lg text-slate-800 flex-1">{topCategoryType === 'expense' ? '지출 항목 Top 5' : '수입 항목 Top 5'}</h3>
                    <div className="flex bg-slate-100 p-0.5 rounded-md ml-2 shrink-0">
                      <button 
                        onClick={() => { setTopCategoryType("expense"); setExpandedGroups({}); }}
                        className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${topCategoryType === 'expense' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                      >지출</button>
                      <button 
                        onClick={() => { setTopCategoryType("revenue"); setExpandedGroups({}); }}
                        className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${topCategoryType === 'revenue' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                      >수입</button>
                    </div>
                  </div>
                  {topCategories.length > 0 ? (
                    <div className="flex flex-col">
                      <div className="h-[220px] mb-4">
                        <ChartContainer config={{}} className="h-full w-full !aspect-auto min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={topCategories}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {topCategories.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip formatter={(value: any) => `${Number(value).toLocaleString()} 원`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </div>
                      
                      {/* 지출 상위 카테고리 트리 뷰 */}
                      <div className="flex justify-between items-center mt-2 mb-2 px-1">
                        <h4 className="font-bold text-slate-700 text-sm">{topCategoryType === 'expense' ? '상위 지출 상세 내역' : '상위 수입 상세 내역'}</h4>
                        <div className="space-x-3">
                          {(() => {
                            const isAllExpanded = topCategories.length > 0 && topCategories.every(group => expandedGroups[group.name]);
                            return (
                              <button onClick={() => toggleAllGroups(!isAllExpanded)} className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors">
                                {isAllExpanded ? "➖ 전체 접기" : "➕ 전체 펼치기"}
                              </button>
                            )
                          })()}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {topCategories.map((group, i) => (
                          <div key={group.name} className="border border-slate-200 rounded-md bg-white overflow-hidden shadow-sm">
                            <div 
                              className="flex justify-between items-center p-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={() => toggleGroup(group.name)}
                            >
                              <div className="flex items-center text-xs font-bold text-slate-700">
                                <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                <span className="mr-2 text-[10px] text-slate-400">{expandedGroups[group.name] ? '▼' : '▶'}</span>
                                {group.name}
                              </div>
                              <div className={`text-xs font-bold ${topCategoryType === 'revenue' ? 'text-blue-600' : 'text-red-600'}`}>{group.value.toLocaleString()} 원</div>
                            </div>
                            {expandedGroups[group.name] && (
                              <div className="p-2 space-y-1 border-t border-slate-100 bg-white">
                                {Object.entries(group.subs)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([subName, amount]) => (
                                    <div key={subName} className="flex justify-between items-center px-6 py-1">
                                      <span className="text-[11px] text-slate-600">- {subName}</span>
                                      <span className="text-[11px] font-medium text-slate-600">{amount.toLocaleString()} 원</span>
                                    </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400">내역이 없습니다.</div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-base sm:text-lg text-slate-800 flex-1">{chartMode === 'separate' ? '월별 수입/지출 현황' : '월별 순이익 현황'}</h3>
                    <div className="flex bg-slate-100 p-0.5 rounded-md ml-2 shrink-0">
                      <button 
                        onClick={() => setChartMode("separate")}
                        className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${chartMode === 'separate' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                      >수입/지출</button>
                      <button 
                        onClick={() => setChartMode("net")}
                        className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${chartMode === 'net' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                      >순이익</button>
                    </div>
                  </div>
                  <div className="h-[270px] border border-slate-200 rounded-lg p-2 sm:p-4 bg-slate-50/30 w-full min-w-0">
                    <ChartContainer config={chartConfig} className="h-full w-full !aspect-auto min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} stackOffset="sign">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={true} />
                          {monthlyChartData.map((d, i) => i % 2 === 0 && (
                            <ReferenceArea key={i} x1={d.name} x2={d.name} fill="#f8fafc" />
                          ))}
                          <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tickMargin={8} />
                          <YAxis 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `${Math.round(value/10000)}만`} 
                            width={45} 
                          />
                          <ChartTooltip 
                            content={<ChartTooltipContent indicator="line" />} 
                            cursor={{fill: 'rgba(226, 232, 240, 0.4)'}} 
                            formatter={(value: any, name: any, item: any) => (
                              <>
                                <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color || item.payload?.fill }} />
                                <div className="flex flex-1 justify-between items-center text-xs">
                                  <span className="text-slate-500 font-medium">{name} :</span>
                                  <span className="font-mono font-bold text-slate-700 tabular-nums ml-2">
                                    {value.toLocaleString()}원
                                  </span>
                                </div>
                              </>
                            )}
                          />
                          {chartMode === 'separate' ? (
                            <>
                              <Bar dataKey="수입" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                              <Bar dataKey="지출" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                            </>
                          ) : (
                            <Bar dataKey="순이익" radius={[4, 4, 0, 0]} fill="#8b5cf6" />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </div>
              </div>

              {/* 연간 결산 매트릭스 (카테고리 x 월별 지출/예산 현황) */}
              <div className="mt-12 space-y-4">
                <div className="flex flex-col mb-2">
                  <h3 className="font-bold text-xl text-slate-800">📊 예산/결산</h3>
                  <p className="text-sm text-slate-500">각 월별 예산을 입력하고, 실제 결산액과 직접 비교해 보세요. 표 안의 예산 칸을 클릭하여 바로 수정할 수 있습니다.</p>
                </div>
                <div className="rounded-xl border bg-white overflow-x-auto shadow-sm w-full relative">
                  <Table className="relative min-w-max">
                    <TableHeader className="bg-slate-50 sticky top-0 z-30 shadow-sm">
                      <TableRow>
                        <TableHead className="font-bold whitespace-nowrap sticky left-0 bg-slate-50 z-40 border-r w-[85px] min-w-[85px] max-w-[85px] text-center">카테고리</TableHead>
                        <TableHead className="font-medium whitespace-nowrap sticky left-[85px] bg-slate-50 z-40 border-r w-[50px] min-w-[50px] max-w-[50px] text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">구분</TableHead>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <TableHead key={i} className="text-center whitespace-nowrap text-slate-600 border-r min-w-[85px] md:min-w-[70px]">{i + 1}월</TableHead>
                        ))}
                        <TableHead className="text-center font-black whitespace-nowrap bg-blue-100 border-l sticky right-0 z-40 min-w-[90px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          합계
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.keys(categoryMonthlyMatrix)
                        // 표시 조건: 결산액이 0보다 크거나, 예산이 하나라도 설정된 카테고리
                        .filter(catName => 
                           categoryMonthlyMatrix[catName].some(v => v > 0) || 
                           (budgetInputMatrix[catName] && Object.values(budgetInputMatrix[catName]).some(v => Number(v) > 0))
                        )
                        .sort((a, b) => categoryMonthlyMatrix[b].reduce((sum, v) => sum + v, 0) - categoryMonthlyMatrix[a].reduce((sum, v) => sum + v, 0))
                        .map((catName) => {
                          const monthlyAmounts = categoryMonthlyMatrix[catName]
                          const rowActualTotal = monthlyAmounts.reduce((sum, val) => sum + val, 0)
                          let rowBudgetTotal = 0
                          for (let i = 0; i < 12; i++) {
                            rowBudgetTotal += Number(budgetInputMatrix[catName]?.[i] || 0)
                          }
                          let totalRowRate = ""
                          if (rowBudgetTotal > 0) {
                             totalRowRate = Math.round(((rowActualTotal - rowBudgetTotal) / rowBudgetTotal) * 100) + "%"
                          }

                          return (
                            <React.Fragment key={catName}>
                              {/* 1. 예산 행 */}
                              <TableRow className="hover:bg-slate-50 border-b-0">
                                <TableCell rowSpan={3} className="font-semibold text-slate-700 sticky left-0 bg-white z-20 border-r align-top pt-4 w-[85px] min-w-[85px] max-w-[85px]">
                                  <div className="flex flex-col truncate">
                                    <span className="text-[10px] text-slate-400 font-normal">{categoryTypes[catName] === 'revenue' ? '[수입]' : '[지출]'}</span>
                                    <span className="truncate" title={catName}>{catName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-[11px] font-medium text-slate-600 bg-slate-50 border-r text-center px-1 sticky left-[85px] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">예산</TableCell>
                                {Array.from({ length: 12 }).map((_, idx) => {
                                  const budgetVal = budgetInputMatrix[catName]?.[idx] || ""
                                  const isEditing = editingCell?.cat === catName && editingCell?.month === idx

                                  return (
                                    <TableCell 
                                      key={idx} 
                                      className="p-0 border-r min-w-[85px] md:min-w-[60px]"
                                      onClick={() => { if (!isEditing) setEditingCell({ cat: catName, month: idx }) }}
                                    >
                                      {isEditing ? (
                                        <Input 
                                          type="number"
                                          autoFocus
                                          value={budgetVal}
                                          onChange={(e) => setBudgetInputMatrix(prev => ({...prev, [catName]: {...prev[catName], [idx]: e.target.value}}))}
                                          onBlur={(e) => {
                                            handleBudgetBlur(catName, idx, e.target.value)
                                            setEditingCell(null)
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              handleBudgetBlur(catName, idx, (e.target as HTMLInputElement).value)
                                              setEditingCell(null)
                                            }
                                          }}
                                          className="h-7 text-right text-[12px] px-1 font-medium focus-visible:ring-1 border-blue-400 bg-white rounded-none w-full shadow-inner"
                                          placeholder="0"
                                        />
                                      ) : (
                                        <div className={`h-7 w-full flex items-center justify-end px-2 text-[12px] cursor-text hover:bg-blue-50 transition-colors ${Number(budgetVal) > 0 ? 'text-slate-600 font-medium' : 'text-slate-300'}`}>
                                          {Number(budgetVal) > 0 ? Number(budgetVal).toLocaleString() : '-'}
                                        </div>
                                      )}
                                    </TableCell>
                                  )
                                })}
                                <TableCell className="text-right font-bold text-slate-600 bg-slate-50 px-2 sticky right-0 z-20 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-clip-padding">
                                  {rowBudgetTotal > 0 ? rowBudgetTotal.toLocaleString() : '-'}
                                </TableCell>
                              </TableRow>

                              {/* 2. 결산 행 */}
                              <TableRow className="hover:bg-blue-50/20 border-b-0">
                                <TableCell className="text-[11px] font-bold text-blue-700 bg-slate-50 border-r text-center px-1 sticky left-[85px] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">결산</TableCell>
                                {Array.from({ length: 12 }).map((_, idx) => {
                                  const actual = monthlyAmounts[idx]
                                  return (
                                    <TableCell key={idx} className={`text-right text-[12px] px-2 border-r ${actual > 0 ? 'text-blue-700 font-medium' : 'text-slate-300'}`}>
                                      {actual > 0 ? actual.toLocaleString() : '-'}
                                    </TableCell>
                                  )
                                })}
                                <TableCell className="text-right font-bold text-blue-800 bg-white opacity-100 px-2 sticky right-0 z-20 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-clip-padding">
                                  {rowActualTotal > 0 ? rowActualTotal.toLocaleString() : '-'}
                                </TableCell>
                              </TableRow>

                              {/* 3. 차이 행 */}
                              <TableRow className="hover:bg-slate-50">
                                <TableCell className="text-[10px] font-medium text-slate-500 bg-slate-50 border-r text-center px-1 sticky left-[85px] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">차이(%)</TableCell>
                                {Array.from({ length: 12 }).map((_, idx) => {
                                  const actual = monthlyAmounts[idx]
                                  const budgetNum = Number(budgetInputMatrix[catName]?.[idx]) || 0
                                  let rate = ""
                                  if (budgetNum > 0) {
                                     rate = Math.round(((actual - budgetNum) / budgetNum) * 100) + "%"
                                  } else if (actual > 0) {
                                     rate = "초과"
                                  }
                                  return (
                                    <TableCell key={idx} className={`text-right text-[11px] px-1 border-r ${budgetNum > 0 && actual > budgetNum ? 'text-red-500 font-bold' : 'text-slate-400 font-medium'}`}>
                                      {rate}
                                    </TableCell>
                                  )
                                })}
                                <TableCell className={`text-right font-bold bg-slate-50 opacity-100 px-2 sticky right-0 z-20 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[11px] bg-clip-padding ${rowBudgetTotal > 0 && rowActualTotal > rowBudgetTotal ? 'text-red-500' : 'text-slate-500'}`}>
                                  {totalRowRate}
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          )
                        })}
                      
                      {/* 수입 총합계 행 */}
                      <TableRow className="bg-blue-50 hover:bg-blue-50">
                        <TableCell colSpan={2} className="font-black text-blue-800 sticky left-0 bg-blue-50 z-20 border-r text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">수입 총합계</TableCell>
                        {Array.from({ length: 12 }).map((_, i) => {
                          const colActualTotal = Object.entries(categoryMonthlyMatrix)
                             .filter(([cat]) => categoryTypes[cat] === 'revenue')
                             .reduce((sum, [_, arr]) => sum + arr[i], 0)
                          let colBudgetTotal = 0
                          Object.entries(budgetInputMatrix).forEach(([cat, catObj]) => {
                             if (categoryTypes[cat] === 'revenue') colBudgetTotal += Number(catObj[i] || 0)
                          })

                          let totalRate = ""
                          if (colBudgetTotal > 0) {
                             totalRate = Math.round(((colActualTotal - colBudgetTotal) / colBudgetTotal) * 100) + "%"
                          }

                          return (
                            <TableCell key={`total-rev-${i}`} className="text-right px-1 border-r">
                               <div className="text-[10px] font-semibold text-blue-400 mb-0.5">{colBudgetTotal > 0 ? colBudgetTotal.toLocaleString() : '-'}</div>
                               <div className="text-[12px] font-bold text-blue-700 mb-0.5">{colActualTotal > 0 ? colActualTotal.toLocaleString() : '-'}</div>
                               <div className={`text-[10px] font-bold ${colBudgetTotal > 0 && colActualTotal < colBudgetTotal ? 'text-red-500' : 'text-blue-500'}`}>{totalRate}</div>
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-black bg-blue-100 opacity-100 px-3 sticky right-0 z-20 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-clip-padding">
                           {(() => {
                             let totalMatrixActual = 0
                             Object.entries(categoryMonthlyMatrix).filter(([cat]) => categoryTypes[cat] === 'revenue').forEach(([_, arr]) => {
                               totalMatrixActual += arr.reduce((sum, val) => sum + val, 0)
                             })
                             let revBudgetTotalForYear = 0
                             Object.entries(budgetInputMatrix).forEach(([cat, catObj]) => {
                               if (categoryTypes[cat] === 'revenue') revBudgetTotalForYear += Object.values(catObj).reduce((sum, val) => sum + Number(val), 0)
                             })
                             let finalTotalRate = ""
                             if (revBudgetTotalForYear > 0) {
                               finalTotalRate = Math.round(((totalMatrixActual - revBudgetTotalForYear) / revBudgetTotalForYear) * 100) + "%"
                             }
                             return (
                               <>
                                 <div className="text-xs text-blue-600 font-bold mb-1">{revBudgetTotalForYear > 0 ? revBudgetTotalForYear.toLocaleString() : '-'}</div>
                                 <div className="text-[14px] text-blue-800 mb-1">{totalMatrixActual > 0 ? totalMatrixActual.toLocaleString() : '-'}</div>
                                 <div className={`text-[11px] font-bold ${revBudgetTotalForYear > 0 && totalMatrixActual < revBudgetTotalForYear ? 'text-red-500' : 'text-blue-600'}`}>{finalTotalRate}</div>
                               </>
                             )
                           })()}
                        </TableCell>
                      </TableRow>

                      {/* 지출 총합계 행 */}
                      <TableRow className="bg-red-50 hover:bg-red-50">
                        <TableCell colSpan={2} className="font-black text-red-800 sticky left-0 bg-red-50 z-20 border-r text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">지출 총합계</TableCell>
                        {Array.from({ length: 12 }).map((_, i) => {
                          const colActualTotal = Object.entries(categoryMonthlyMatrix)
                             .filter(([cat]) => categoryTypes[cat] !== 'revenue')
                             .reduce((sum, [_, arr]) => sum + arr[i], 0)
                          let colBudgetTotal = 0
                          Object.entries(budgetInputMatrix).forEach(([cat, catObj]) => {
                             if (categoryTypes[cat] !== 'revenue') colBudgetTotal += Number(catObj[i] || 0)
                          })

                          let totalRate = ""
                          if (colBudgetTotal > 0) {
                             totalRate = Math.round(((colActualTotal - colBudgetTotal) / colBudgetTotal) * 100) + "%"
                          }

                          return (
                            <TableCell key={`total-exp-${i}`} className="text-right px-1 border-r">
                               <div className="text-[10px] font-semibold text-red-400 mb-0.5">{colBudgetTotal > 0 ? colBudgetTotal.toLocaleString() : '-'}</div>
                               <div className="text-[12px] font-bold text-red-700 mb-0.5">{colActualTotal > 0 ? colActualTotal.toLocaleString() : '-'}</div>
                               <div className={`text-[10px] font-bold ${colBudgetTotal > 0 && colActualTotal > colBudgetTotal ? 'text-red-600' : 'text-red-400'}`}>{totalRate}</div>
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-black bg-red-100 opacity-100 px-3 sticky right-0 z-20 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-clip-padding">
                           {(() => {
                             let totalMatrixActual = 0
                             Object.entries(categoryMonthlyMatrix).filter(([cat]) => categoryTypes[cat] !== 'revenue').forEach(([_, arr]) => {
                               totalMatrixActual += arr.reduce((sum, val) => sum + val, 0)
                             })
                             let expBudgetTotalForYear = 0
                             Object.entries(budgetInputMatrix).forEach(([cat, catObj]) => {
                               if (categoryTypes[cat] !== 'revenue') expBudgetTotalForYear += Object.values(catObj).reduce((sum, val) => sum + Number(val), 0)
                             })
                             let finalTotalRate = ""
                             if (expBudgetTotalForYear > 0) {
                               finalTotalRate = Math.round(((totalMatrixActual - expBudgetTotalForYear) / expBudgetTotalForYear) * 100) + "%"
                             }
                             return (
                               <>
                                 <div className="text-xs text-red-600 font-bold mb-1">{expBudgetTotalForYear > 0 ? expBudgetTotalForYear.toLocaleString() : '-'}</div>
                                 <div className="text-[14px] text-red-800 mb-1">{totalMatrixActual > 0 ? totalMatrixActual.toLocaleString() : '-'}</div>
                                 <div className={`text-[11px] font-bold ${expBudgetTotalForYear > 0 && totalMatrixActual > expBudgetTotalForYear ? 'text-red-600' : 'text-red-500'}`}>{finalTotalRate}</div>
                               </>
                             )
                           })()}
                        </TableCell>
                      </TableRow>

                      {/* 순이익 총합계 행 */}
                      <TableRow className="bg-emerald-50 hover:bg-emerald-50">
                        <TableCell colSpan={2} className="font-black text-emerald-800 sticky left-0 bg-emerald-50 z-20 border-r text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">순이익 총합계</TableCell>
                        {Array.from({ length: 12 }).map((_, i) => {
                          const colRevActual = Object.entries(categoryMonthlyMatrix)
                             .filter(([cat]) => categoryTypes[cat] === 'revenue')
                             .reduce((sum, [_, arr]) => sum + arr[i], 0)
                          const colExpActual = Object.entries(categoryMonthlyMatrix)
                             .filter(([cat]) => categoryTypes[cat] !== 'revenue')
                             .reduce((sum, [_, arr]) => sum + arr[i], 0)
                          const colActualTotal = colRevActual - colExpActual

                          let colRevBudget = 0
                          let colExpBudget = 0
                          Object.entries(budgetInputMatrix).forEach(([cat, catObj]) => {
                             if (categoryTypes[cat] === 'revenue') colRevBudget += Number(catObj[i] || 0)
                             else colExpBudget += Number(catObj[i] || 0)
                          })
                          const colBudgetTotal = colRevBudget - colExpBudget

                          let totalRate = ""
                          if (colBudgetTotal !== 0) {
                             totalRate = Math.round(((colActualTotal - colBudgetTotal) / Math.abs(colBudgetTotal)) * 100) + "%"
                          } else if (colActualTotal !== 0) {
                             totalRate = "초과"
                          }

                          return (
                            <TableCell key={`total-net-${i}`} className="text-right px-1 border-r">
                               <div className="text-[10px] font-semibold text-emerald-500 mb-0.5">{colBudgetTotal !== 0 ? colBudgetTotal.toLocaleString() : '-'}</div>
                               <div className="text-[12px] font-bold text-emerald-700 mb-0.5">{colActualTotal !== 0 ? colActualTotal.toLocaleString() : '-'}</div>
                               <div className={`text-[10px] font-bold ${colBudgetTotal !== 0 && colActualTotal < colBudgetTotal ? 'text-red-500' : 'text-emerald-600'}`}>{totalRate}</div>
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-black bg-emerald-100 opacity-100 px-3 sticky right-0 z-20 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-clip-padding">
                           {(() => {
                             let revTotalMatrixActual = 0
                             let expTotalMatrixActual = 0
                             Object.entries(categoryMonthlyMatrix).forEach(([cat, arr]) => {
                               const sum = arr.reduce((acc, val) => acc + val, 0)
                               if (categoryTypes[cat] === 'revenue') revTotalMatrixActual += sum
                               else expTotalMatrixActual += sum
                             })
                             const totalMatrixActual = revTotalMatrixActual - expTotalMatrixActual

                             let revBudgetTotalForYear = 0
                             let expBudgetTotalForYear = 0
                             Object.entries(budgetInputMatrix).forEach(([cat, catObj]) => {
                               const sum = Object.values(catObj).reduce((acc, val) => acc + Number(val), 0)
                               if (categoryTypes[cat] === 'revenue') revBudgetTotalForYear += sum
                               else expBudgetTotalForYear += sum
                             })
                             const budgetTotalForYear = revBudgetTotalForYear - expBudgetTotalForYear

                             let finalTotalRate = ""
                             if (budgetTotalForYear !== 0) {
                               finalTotalRate = Math.round(((totalMatrixActual - budgetTotalForYear) / Math.abs(budgetTotalForYear)) * 100) + "%"
                             } else if (totalMatrixActual !== 0) {
                               finalTotalRate = "초과"
                             }

                             return (
                               <>
                                 <div className="text-xs text-emerald-600 font-bold mb-1">{budgetTotalForYear !== 0 ? budgetTotalForYear.toLocaleString() : '-'}</div>
                                 <div className="text-[14px] text-emerald-800 mb-1">{totalMatrixActual !== 0 ? totalMatrixActual.toLocaleString() : '-'}</div>
                                 <div className={`text-[11px] font-bold ${budgetTotalForYear !== 0 && totalMatrixActual < budgetTotalForYear ? 'text-red-500' : 'text-emerald-700'}`}>{finalTotalRate}</div>
                               </>
                             )
                           })()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
