"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import FixedExpensesManager from "@/components/FixedExpensesManager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import TransactionForm from "@/components/TransactionForm"
import AccountsManager from "@/components/AccountsManager"
import BudgetManager from "@/components/BudgetManager"
import BudgetStatusWidget from "@/components/BudgetStatusWidget"
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react"

const formatLocal = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Dashboard() {
  const today = new Date()
  const startOfMonth = formatLocal(new Date(today.getFullYear(), today.getMonth(), 1))
  const endOfMonth = formatLocal(new Date(today.getFullYear(), today.getMonth() + 1, 0))

  const [user, setUser] = useState<any>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [classifications, setClassifications] = useState<any[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({}) // 전체 잔액 (자산/부채)
  const [periodBalances, setPeriodBalances] = useState<Record<string, number>>({}) // 기간 잔액 (수익/비용)
  const [visibleLimit, setVisibleLimit] = useState(20)
  
  const [startDate, setStartDate] = useState(startOfMonth)
  const [endDate, setEndDate] = useState(endOfMonth)

  const [dateUnit, setDateUnit] = useState<"month" | "year">("month")
  const [referenceDate, setReferenceDate] = useState(today)

  const updateDateRange = (date: Date, unit: "month" | "year") => {
    if (unit === "month") {
      const start = formatLocal(new Date(date.getFullYear(), date.getMonth(), 1))
      const end = formatLocal(new Date(date.getFullYear(), date.getMonth() + 1, 0))
      setStartDate(start)
      setEndDate(end)
    } else {
      const start = formatLocal(new Date(date.getFullYear(), 0, 1))
      const end = formatLocal(new Date(date.getFullYear(), 11, 31))
      setStartDate(start)
      setEndDate(end)
    }
  }

  const handlePrev = () => {
    const newDate = new Date(referenceDate)
    if (dateUnit === "month") newDate.setMonth(newDate.getMonth() - 1)
    else newDate.setFullYear(newDate.getFullYear() - 1)
    setReferenceDate(newDate)
    updateDateRange(newDate, dateUnit)
  }

  const handleNext = () => {
    const newDate = new Date(referenceDate)
    if (dateUnit === "month") newDate.setMonth(newDate.getMonth() + 1)
    else newDate.setFullYear(newDate.getFullYear() + 1)
    setReferenceDate(newDate)
    updateDateRange(newDate, dateUnit)
  }

  const handleToday = () => {
    const now = new Date()
    setReferenceDate(now)
    updateDateRange(now, dateUnit)
  }

  const handleUnitChange = (unit: "month" | "year") => {
    setDateUnit(unit)
    updateDateRange(referenceDate, unit)
  }

  const handleStartDateChange = (val: string) => {
    setStartDate(val)
    const parsed = new Date(val)
    if (!isNaN(parsed.getTime())) setReferenceDate(parsed)
  }

  const handleEndDateChange = (val: string) => {
    setEndDate(val)
  }

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        window.location.href = '/login'
      } else {
        setUser(session.user)
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [])

  const fetchData = async () => {
    if (!user) return
    try {
      const { data: accs } = await supabase.from("accounts").select("*").eq("owner_id", user.id)
      if (accs) setAccounts(accs)

      const { data: classData } = await supabase.from("transaction_classifications").select("*").eq("owner_id", user.id)
      if (classData) setClassifications(classData)

    // 1. 기간 리스트 조회 (Pagination 적용)
    const { data: txs } = await supabase.from("transactions")
      .select(`
        id, transaction_date, description, payment_method_id, classification_id,
        journal_entries ( account_id, amount, accounts ( name, type ) )
      `)
      .eq("creator_id", user.id)
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .order("transaction_date", { ascending: false })
      .limit(visibleLimit)
    
    if (txs) {
      const formatted = txs.map((tx: any) => {
        const outEntry = tx.journal_entries.find((e: any) => e.amount < 0)
        const inEntry = tx.journal_entries.find((e: any) => e.amount > 0)
        
        const isIncome = outEntry?.accounts?.type === "revenue"
        const displayAmount = isIncome && outEntry ? Math.abs(outEntry.amount) : (outEntry ? outEntry.amount : 0)

        const className = classData?.find((c: any) => c.id === tx.classification_id)?.name || '일반'

        return {
          id: tx.id,
          date: tx.transaction_date,
          description: tx.description,
          classification: className,
          account: tx.payment_method_id 
            ? accs?.find((a:any) => a.id === tx.payment_method_id)?.name 
            : (outEntry ? outEntry.accounts.name : '알수없음'),
          category: inEntry ? inEntry.accounts.name : '알수없음',
          amount: displayAmount,
          isIncome,
          outAccountId: tx.payment_method_id || outEntry?.account_id,
          inAccountId: inEntry?.account_id
        }
      })
      setTransactions(formatted)
    }

    // 2. 전체 자산/부채 합계를 구하기 위해 '과거부터 endDate까지'의 분개장 모두 로드
    const { data: allTxs } = await supabase.from("transactions").select("id").eq("creator_id", user.id).lte("transaction_date", endDate)
    if (allTxs && allTxs.length > 0) {
      const txIds = allTxs.map(t => t.id)
      const { data: jEs } = await supabase.from("journal_entries").select("account_id, amount").in("transaction_id", txIds)
      
      const bal: Record<string, number> = {}
      if (jEs) {
        jEs.forEach((je: any) => {
          bal[je.account_id] = (bal[je.account_id] || 0) + Number(je.amount)
        })
      }
      setBalances(bal)
    } else {
      setBalances({})
    }

    // 3. 특정 기간의 손익(수익/비용) 합계를 구하기 위해 'startDate부터 endDate까지' 전체 트랜잭션 아이디 로드 (기간 내 발생한 전체 수익/비용)
    const { data: pAllTxs } = await supabase.from("transactions").select("id").eq("creator_id", user.id).gte("transaction_date", startDate).lte("transaction_date", endDate)
    if (pAllTxs && pAllTxs.length > 0) {
      const pTxIds = pAllTxs.map(t => t.id)
      const { data: pjEs } = await supabase.from("journal_entries").select("account_id, amount").in("transaction_id", pTxIds)
      
      const pBal: Record<string, number> = {}
      if (pjEs) {
        pjEs.forEach((je: any) => {
          pBal[je.account_id] = (pBal[je.account_id] || 0) + Number(je.amount)
        })
      }
      setPeriodBalances(pBal)
    } else {
      setPeriodBalances({})
    }

    } catch (err) {
      console.error("Data fetch failed:", err)
    }
  }

  const deleteTransaction = async (id: string) => {
    if (!confirm("정말 이 내역을 삭제하시겠습니까?")) return
    await supabase.from("transactions").delete().eq("id", id)
    fetchData()
  }

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, startDate, endDate, visibleLimit])

  let totalAssets = 0
  let totalLiabilities = 0
  let periodRevenues = 0
  let periodExpenses = 0

  accounts.forEach(acc => {
    if (acc.type === "asset") totalAssets += (balances[acc.id] || 0)
    else if (acc.type === "liability") totalLiabilities -= (balances[acc.id] || 0) 
    else if (acc.type === "revenue") periodRevenues -= (periodBalances[acc.id] || 0)
    else if (acc.type === "expense") periodExpenses += (periodBalances[acc.id] || 0)
  })

  // 자산 총액이나 전체 수익 계산
  const netWorth = totalAssets - totalLiabilities
  const periodNetIncome = periodRevenues - periodExpenses

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }))
  }

  const toggleAllNodes = () => {
    if (Object.keys(expandedNodes).length > 0) {
      setExpandedNodes({})
    } else {
      const allIds: Record<string, boolean> = {}
      accounts.forEach(a => {
         const gName = a.sub_category || a.group_type || "미분류"
         allIds[`${a.type}-${gName}`] = true
      })
      setExpandedNodes(allIds)
    }
  }

  const renderAccountTree = (accountList: any[], balMap: Record<string, number>, type: string) => {
    const filtered = accountList.filter(a => a.type === type && (balMap[a.id] || 0) !== 0)
    if (filtered.length === 0) return <div className="text-sm text-slate-400 pl-4 py-2">내역이 없습니다.</div>

    const grouped: Record<string, { total: number, items: any[] }> = {}
    filtered.forEach(a => {
      const gName = a.sub_category || a.group_type || "미분류"
      if (!grouped[gName]) grouped[gName] = { total: 0, items: [] }
      grouped[gName].items.push(a)
      grouped[gName].total += Math.abs(balMap[a.id] || 0)
    })

    return Object.entries(grouped).map(([gName, data]) => {
      const nodeId = `${type}-${gName}`
      const isExpanded = expandedNodes[nodeId]
      return (
        <div key={nodeId} className="flex flex-col mb-2 bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
          <div 
            className="flex justify-between items-center p-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => toggleNode(nodeId)}
          >
            <div className="flex items-center space-x-2 font-bold text-slate-800">
               <span className="text-slate-400 w-4 flex justify-center">{isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</span>
               <span>{gName}</span>
            </div>
            <span className="text-sm font-black text-slate-700 tracking-tight">{data.total.toLocaleString()} 원</span>
          </div>

          {isExpanded && (
            <div className="bg-slate-50 border-t border-slate-100 p-2 space-y-1">
              {data.items.map(a => (
                <div key={a.id} className="flex justify-between items-center pl-7 pr-2 py-1.5 rounded-md hover:bg-slate-100">
                  <div className="flex items-center space-x-2">
                     <span className={`w-1.5 h-1.5 rounded-full shadow-sm ${type==='revenue' ? 'bg-blue-400' : type==='expense' ? 'bg-red-400' : type==='asset' ? 'bg-emerald-400' : 'bg-orange-400'}`}></span>
                     <span className="text-[13px] font-semibold text-slate-600">{a.name}</span>
                  </div>
                  <span className="text-[13px] font-bold text-slate-500 tracking-tight">{Math.abs(balMap[a.id] || 0).toLocaleString()} 원</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    })
  }

  if (isCheckingAuth) {
    return <div className="p-8 flex justify-center text-slate-500 font-bold">인증 정보 확인 중...</div>
  }

  return (
    <div className="flex-1 space-y-4 p-3 md:p-8 pt-4 md:pt-6 w-full max-w-7xl mx-auto font-sans overflow-x-hidden">
        {/* 상단 헤더 영역 */}
        <div className="flex flex-col mb-4 gap-3 md:gap-4">
          
          {/* 데스크탑 레이아웃 */}
          <div className="hidden md:flex flex-row items-center justify-between relative w-full py-1">
            <h2 className="text-3xl font-bold tracking-tight">{user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자'}의 자산관리</h2>
            
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
              {/* Date Selector */}
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full" onClick={handlePrev}><ChevronLeft size={18}/></Button>
                <div className="flex items-center justify-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                    <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="border-0 bg-transparent text-sm h-8 cursor-pointer focus-visible:ring-0 px-1 w-[130px]" />
                    <span className="text-slate-400 font-bold text-sm">~</span>
                    <Input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} className="border-0 bg-transparent text-sm h-8 cursor-pointer focus-visible:ring-0 px-1 w-[130px]" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full" onClick={handleNext}><ChevronRight size={18}/></Button>
              </div>

              {/* Toggles and Today */}
              <div className="absolute left-full ml-4 flex items-center space-x-2 whitespace-nowrap">
                <div className="bg-slate-100 p-0.5 rounded-md flex">
                  <button onClick={() => handleUnitChange('month')} className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${dateUnit === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>월</button>
                  <button onClick={() => handleUnitChange('year')} className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${dateUnit === 'year' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>년</button>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm bg-white" onClick={handleToday}>오늘</Button>
              </div>
            </div>

            {/* Add Transaction Button */}
            <div>
              <TransactionForm onSuccess={fetchData} />
            </div>
          </div>

          {/* 모바일 레이아웃 */}
          <div className="flex flex-col md:hidden space-y-3">
            <h2 className="text-xl font-bold tracking-tight">{user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자'}의 자산관리</h2>
            
            <div className="flex items-center justify-center space-x-1 w-full">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full" onClick={handlePrev}><ChevronLeft size={18}/></Button>
              <div className="flex items-center justify-center gap-1 bg-white px-2 py-1.5 rounded-lg border shadow-sm flex-1 max-w-[280px]">
                  <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="border-0 bg-transparent text-[13px] h-7 cursor-pointer focus-visible:ring-0 px-0 w-[105px] text-center" />
                  <span className="text-slate-400 font-bold text-sm">~</span>
                  <Input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} className="border-0 bg-transparent text-[13px] h-7 cursor-pointer focus-visible:ring-0 px-0 w-[105px] text-center" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full" onClick={handleNext}><ChevronRight size={18}/></Button>
            </div>

            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <div className="bg-slate-100 p-0.5 rounded-md flex">
                  <button onClick={() => handleUnitChange('month')} className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${dateUnit === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>월</button>
                  <button onClick={() => handleUnitChange('year')} className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${dateUnit === 'year' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>년</button>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-[11px] font-bold px-2 shadow-sm" onClick={handleToday}>오늘</Button>
              </div>
              <TransactionForm onSuccess={fetchData} />
            </div>
          </div>

        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 !h-auto gap-1 p-1">
            <TabsTrigger value="list" className="text-[12px] sm:text-sm px-1 py-2 !h-9 sm:!h-10">💰 현황/내역</TabsTrigger>
            <TabsTrigger value="analytics" className="text-[12px] sm:text-sm px-1 py-2 !h-9 sm:!h-10">📈 손익/대차</TabsTrigger>
            <TabsTrigger value="budget" className="data-[state=active]:text-blue-700 data-[state=active]:font-bold text-[12px] sm:text-sm px-1 py-2 !h-9 sm:!h-10">📊 예산/결산</TabsTrigger>
            <TabsTrigger value="fixed" className="data-[state=active]:text-teal-700 data-[state=active]:font-bold text-[12px] sm:text-sm px-1 py-2 !h-9 sm:!h-10">💸 고정/보험 관리</TabsTrigger>
          </TabsList>
        <TabsContent value="list" className="space-y-4 mt-2">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">순자산 총액</CardTitle>
                <span className="text-muted-foreground text-lg">💰</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{netWorth.toLocaleString()} 원</div>
                <p className="text-xs text-muted-foreground mt-1">자산에서 부채를 차감한 누적 내역</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 자산 잔고</CardTitle>
                <span className="text-muted-foreground text-lg">💳</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{totalAssets.toLocaleString()} 원</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium pt-0.5 text-green-700">조회 기간 수익</CardTitle>
                <span className="text-muted-foreground text-lg">🛍️</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{periodRevenues.toLocaleString()} 원</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium pt-0.5 text-red-700">조회 기간 지출</CardTitle>
                <span className="text-muted-foreground text-lg">🧾</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{periodExpenses.toLocaleString()} 원</div>
              </CardContent>
            </Card>
          </div>

          {/* 상단 나란히 배치: 예산현황 위젯과 자산잔고장 */}
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 mb-4">
            <BudgetStatusWidget accounts={accounts} periodBalances={periodBalances} startDate={startDate} />
            <Card className="rounded-xl border bg-slate-50/50">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle>자산 현황</CardTitle>
                  <CardDescription>통장, 카드 등 분류별 실시간 잔액</CardDescription>
                </div>
                <AccountsManager onSuccess={fetchData} />
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {accounts.filter(a => (a.type === "asset" || a.type === "liability") && a.is_active !== false).length === 0 && (
                    <div className="text-sm text-muted-foreground text-center">활성화된 자산 계정이 없습니다.</div>
                  )}
                  {accounts.filter(a => (a.type === "asset" || a.type === "liability") && a.is_active !== false).map((acc) => {
                    const isLiability = acc.type === "liability"
                    let displayBal = balances[acc.id] || 0
                    if (isLiability) displayBal = -displayBal

                    return (
                    <div key={acc.id} className="flex items-center">
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{acc.name}</p>
                        <p className="text-xs text-muted-foreground font-semibold">{acc.group_type}</p>
                      </div>
                      <div className={`text-sm font-bold tracking-tight ${isLiability ? 'text-red-500' : 'text-blue-600'}`}>
                        {isLiability && displayBal > 0 ? '-' : ''}{displayBal.toLocaleString()} 원
                      </div>
                    </div>
                  )})}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 하단 풀 사이즈 거래 내역 */}
          <Card className="rounded-xl border w-full">
            <CardHeader>
              <CardTitle>수입/지출 내역</CardTitle>
              <CardDescription>지정된 기간({startDate} ~ {endDate}) 간의 상세 거래 목록</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-0">
              <div className="px-6 pb-6 overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                      <TableHead>거래일</TableHead>
                      <TableHead>분류</TableHead>
                      <TableHead>설명 (적요)</TableHead>
                      <TableHead>출처</TableHead>
                      <TableHead>출금/입금처</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">이 기간 동안의 거래 내역이 존재하지 않습니다.</TableCell></TableRow>
                    ) : transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell><Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold">{tx.classification}</Badge></TableCell>
                        <TableCell className="font-medium">{tx.description}</TableCell>
                        <TableCell>{tx.account}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.category}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${tx.isIncome ? 'text-blue-600' : (tx.amount < 0 ? 'text-red-500' : 'text-slate-800')}`}>
                          {tx.isIncome ? '+' : (tx.amount < 0 ? '-' : '')}{Math.abs(tx.amount).toLocaleString()} 원
                        </TableCell>
                        <TableCell className="flex items-center justify-end space-x-1">
                          <TransactionForm editData={tx} onSuccess={fetchData} trigger={<Button variant="outline" size="sm" className="h-7 text-xs px-2 text-slate-600">수정</Button>} />
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-red-400 hover:text-red-700 hover:bg-red-50" onClick={() => deleteTransaction(tx.id)}>삭제</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {transactions.length >= visibleLimit && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" className="w-full md:w-[300px] border-slate-300 font-bold text-slate-600 hover:bg-slate-50" onClick={() => setVisibleLimit(prev => prev + 20)}>
                      더보기 (Load More)
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 w-full">
          <div className="flex justify-end items-center space-x-2 px-1 mb-2 mt-4 md:mt-0">
            <Button variant="outline" size="sm" onClick={toggleAllNodes} className="h-7 text-xs bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
              {Object.keys(expandedNodes).length > 0 ? "➖ 전체 접기" : "➕ 전체 펼치기"}
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            
            <Card className="border-green-100 border-2 shadow-lg">
              <CardHeader className="bg-green-50/50 border-b border-green-100 pb-4">
                <CardTitle className="text-xl font-black text-green-800">📊 손익계산서</CardTitle>
                <CardDescription>기간 : <span className="font-extrabold text-slate-800">{startDate} ~ {endDate}</span></CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-lg font-bold text-slate-800 border-b pb-2 px-1">
                    <span className="flex items-center"><span className="text-blue-500 mr-2 text-xl">🟢</span>수입</span>
                    <span className="text-blue-600 font-black">{periodRevenues.toLocaleString()} 원</span>
                  </div>
                  <div className="pl-2">
                    {renderAccountTree(accounts, periodBalances, 'revenue')}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-lg font-bold text-slate-800 border-b pb-2 px-1">
                    <span className="flex items-center"><span className="text-red-500 mr-2 text-xl">🔴</span>지출</span>
                    <span className="text-red-500 font-black">{periodExpenses.toLocaleString()} 원</span>
                  </div>
                  <div className="pl-2">
                    {renderAccountTree(accounts, periodBalances, 'expense')}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 mt-4 border-t-2 border-slate-200 px-1">
                  <div className="flex flex-col flex-1 pr-2">
                    <span className="text-xl font-black text-slate-800">순이익</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 break-keep">이 기간 발생한 순이익은 대차대조표의 순자산으로 귀속됩니다.</span>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap text-xl sm:text-2xl tracking-tight shadow-sm px-3 py-1 rounded-xl font-black ${periodNetIncome >= 0 ? 'bg-green-100 text-green-700 border-green-200 border' : 'bg-red-100 text-red-600 border-red-200 border'}`}>
                    {periodNetIncome > 0 ? '+' : ''}{periodNetIncome.toLocaleString()} 원
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-100 border-2 shadow-lg">
              <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                <CardTitle className="text-xl font-black text-blue-800">🏦 대차대조표</CardTitle>
                <CardDescription>기준일 : <span className="font-extrabold text-slate-800">{endDate}</span></CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-lg font-bold text-slate-800 border-b pb-2 px-1">
                    <span className="flex items-center"><span className="text-emerald-500 mr-2 text-xl">💎</span>자산</span>
                    <span className="text-blue-700 font-black">{totalAssets.toLocaleString()} 원</span>
                  </div>
                  <div className="pl-2">
                    {renderAccountTree(accounts, balances, 'asset')}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-lg font-bold text-slate-800 border-b pb-2 px-1">
                    <span className="flex items-center"><span className="text-orange-500 mr-2 text-xl">💳</span>부채</span>
                    <span className="text-red-500 font-black">{totalLiabilities.toLocaleString()} 원</span>
                  </div>
                  <div className="pl-2">
                    {renderAccountTree(accounts, balances, 'liability')}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 mt-4 border-t-2 border-slate-200 px-1">
                  <div className="flex flex-col flex-1 pr-2">
                    <span className="text-xl font-black text-slate-800">순자산</span>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap text-xl sm:text-2xl tracking-tighter shadow-sm px-3 py-1 rounded-xl font-black ${netWorth >= 0 ? 'bg-blue-100 text-blue-700 border-blue-200 border' : 'bg-red-100 text-red-600 border-red-200 border'}`}>
                    {netWorth.toLocaleString()} 원
                  </span>
                </div>
              </CardContent>
            </Card>
            
          </div>
          </TabsContent>

          <TabsContent value="budget" className="w-full mt-4">
             <BudgetManager accounts={accounts} periodBalances={periodBalances} startDate={startDate} />
          </TabsContent>

          <TabsContent value="fixed" className="w-full mt-4">
             <FixedExpensesManager accounts={accounts} />
          </TabsContent>
        </Tabs>
    </div>
  )
}
