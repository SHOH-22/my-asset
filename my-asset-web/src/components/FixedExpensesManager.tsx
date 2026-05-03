"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import TransactionForm from "./TransactionForm"

export default function FixedExpensesManager({ accounts }: { accounts: any[] }) {
  const [transfers, setTransfers] = useState<any[]>([])
  const [insurances, setInsurances] = useState<any[]>([])
  const [frequentTxs, setFrequentTxs] = useState<any[]>([])
  const [classifications, setClassifications] = useState<any[]>([])
  
  const [openTransfer, setOpenTransfer] = useState(false)
  const [openInsurance, setOpenInsurance] = useState(false)

  const [editingTransferId, setEditingTransferId] = useState<string | null>(null)
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null)

  const [openFrequent, setOpenFrequent] = useState(false)
  const [editingFrequentId, setEditingFrequentId] = useState<string | null>(null)
  const [fType, setFType] = useState<"expense" | "income" | "transfer">("expense")
  const [fClassId, setFClassId] = useState<string>("")
  const [fDesc, setFDesc] = useState("")
  const [fAmount, setFAmount] = useState("")
  const [fFrom, setFFrom] = useState("")
  const [fTo, setFTo] = useState("")

  // Transfer Form States
  const [tDay, setTDay] = useState("1")
  const [tDesc, setTDesc] = useState("")
  const [tAmount, setTAmount] = useState("")
  const [tFrom, setTFrom] = useState("")
  const [tTo, setTTo] = useState("")
  const [tStart, setTStart] = useState("")
  const [tEnd, setTEnd] = useState("")
  const [tMemo, setTMemo] = useState("")

  // Insurance Form States
  const [iName, setIName] = useState("")
  const [iProvider, setIProvider] = useState("")
  const [iContractor, setIContractor] = useState("")
  const [iInsured, setIInsured] = useState("")
  const [iPremium, setIPremium] = useState("")
  const [iNumber, setINumber] = useState("")
  const [iContractDate, setIContractDate] = useState("")
  const [iPayPeriod, setIPayPeriod] = useState("")
  const [iCoverPeriod, setICoverPeriod] = useState("")
  const [iStatus, setIStatus] = useState("납입중")
  const [iNotes, setINotes] = useState("")

  const loadData = async () => {
    const { data: userAuth } = await supabase.auth.getUser()
    if (!userAuth?.user) return
    
    const [transRes, insRes, freqRes, classRes] = await Promise.all([
      supabase.from("auto_transfers").select("*").eq("owner_id", userAuth.user.id).order('transfer_day_of_month'),
      supabase.from("insurance_policies").select("*").eq("owner_id", userAuth.user.id),
      supabase.from("frequent_transactions").select("*").eq("owner_id", userAuth.user.id).order('created_at', { ascending: false }),
      supabase.from("transaction_classifications").select("*").eq("owner_id", userAuth.user.id)
    ])
    
    setTransfers(transRes.data || [])
    setInsurances(insRes.data || [])
    setFrequentTxs(freqRes.data || [])
    setClassifications(classRes.data || [])
  }

  useEffect(() => { loadData() }, [])

  const handleOpenTransferModal = (t?: any) => {
    if (t && t.id) {
       setEditingTransferId(t.id)
       setTDay(String(t.transfer_day_of_month || 1))
       setTDesc(t.description || "")
       setTAmount(String(t.amount || ""))
       setTFrom(t.withdrawal_account_id || "none")
       setTTo(t.deposit_account_id || "none")
       setTStart(t.start_date || "")
       setTEnd(t.end_date || "")
       setTMemo(t.memo || "")
    } else {
       setEditingTransferId(null)
       setTDay("1"); setTDesc(""); setTAmount(""); setTFrom("none"); setTTo("none")
       setTStart(""); setTEnd(""); setTMemo("")
    }
    setOpenTransfer(true)
  }

  const handleOpenInsuranceModal = (i?: any) => {
    if (i && i.id) {
       setEditingInsuranceId(i.id)
       setIName(i.policy_name || "")
       setIProvider(i.provider || "")
       setIContractor(i.contractor_name || "")
       setIInsured(i.insured_person || "")
       setIPremium(String(i.monthly_premium || ""))
       setINumber(i.policy_number || "")
       setIContractDate(i.contract_date || "")
       setIPayPeriod(i.payment_period || "")
       setICoverPeriod(i.coverage_period || "")
       setIStatus(i.status || (i.is_fully_paid ? "완납" : "납입중"))
       setINotes(i.notes || "")
    } else {
       setEditingInsuranceId(null)
       setIName(""); setIProvider(""); setIContractor(""); setIInsured(""); setIPremium("")
       setINumber(""); setIContractDate(""); setIPayPeriod(""); setICoverPeriod(""); setIStatus("납입중"); setINotes("")
    }
    setOpenInsurance(true)
  }

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tDay || !tDesc || !tAmount) return
    const { data: userAuth } = await supabase.auth.getUser()
    
    const payload = {
      owner_id: userAuth?.user?.id,
      transfer_day_of_month: parseInt(tDay),
      description: tDesc,
      amount: parseInt(tAmount),
      withdrawal_account_id: tFrom && tFrom !== "none" ? tFrom : null,
      deposit_account_id: tTo && tTo !== "none" ? tTo : null,
      start_date: tStart || null,
      end_date: tEnd || null,
      memo: tMemo
    }
    
    if (editingTransferId) {
      const { error } = await supabase.from("auto_transfers").update(payload).eq("id", editingTransferId)
      if (error) { toast.error("이체 수정 실패: " + error.message); return }
      toast.success("자동이체 항목이 성공적으로 수정되었습니다.")
    } else {
      const { error } = await supabase.from("auto_transfers").insert(payload)
      if (error) { toast.error("이체 등록 실패: " + error.message); return }
      toast.success("새 자동이체 항목이 등록되었습니다.")
    }
    setOpenTransfer(false)
    loadData()
  }

  const handleSaveInsurance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!iName || !iPremium) return
    const { data: userAuth } = await supabase.auth.getUser()
    
    const payload = {
      owner_id: userAuth?.user?.id,
      policy_name: iName,
      provider: iProvider,
      contractor_name: iContractor,
      insured_person: iInsured,
      monthly_premium: parseInt(iPremium),
      policy_number: iNumber,
      contract_date: iContractDate || null,
      payment_period: iPayPeriod,
      coverage_period: iCoverPeriod,
      status: iStatus,
      notes: iNotes
    }
    
    if (editingInsuranceId) {
      const { error } = await supabase.from("insurance_policies").update(payload).eq("id", editingInsuranceId)
      if (error) { toast.error("보험 수정 실패: " + error.message); return }
      toast.success("보험 계약 정보가 수정되었습니다.")
    } else {
      const { error } = await supabase.from("insurance_policies").insert(payload)
      if (error) { toast.error("보험 등록 실패: " + error.message); return }
      toast.success("보험 상품이 성공적으로 등록되었습니다.")
    }
    setOpenInsurance(false)
    loadData()
  }

  const handleDeleteTransfer = async (id: string) => {
    if (!confirm("이 자동이체 항목을 완전히 삭제하시겠습니까?")) return
    await supabase.from("auto_transfers").delete().eq("id", id)
    loadData()
  }

  const handleDeleteInsurance = async (id: string) => {
    if (!confirm("이 보험 항목을 완전히 삭제하시겠습니까?")) return
    await supabase.from("insurance_policies").delete().eq("id", id)
    loadData()
  }

  const handleDeleteFrequent = async (id: string) => {
    if (!confirm("이 자주쓰는 거래내역(템플릿)을 삭제하시겠습니까?")) return
    await supabase.from("frequent_transactions").delete().eq("id", id)
    loadData()
    toast.info("템플릿이 삭제되었습니다.")
  }

  const handleOpenFrequentModal = (f: any) => {
    setEditingFrequentId(f.id)
    setFType(f.type)
    setFClassId(f.classification_id || "")
    setFDesc(f.description || "")
    setFAmount(f.amount ? String(f.amount) : "")
    setFFrom(f.from_account_id || "none")
    setFTo(f.to_account_id || "none")
    setOpenFrequent(true)
  }

  const handleSaveFrequentEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fDesc) return
    const payload = {
      type: fType,
      description: fDesc,
      amount: fAmount ? Number(fAmount) : null,
      from_account_id: fFrom && fFrom !== "none" ? fFrom : null,
      to_account_id: fTo && fTo !== "none" ? fTo : null,
      classification_id: fClassId || null
    }
    const { error } = await supabase.from("frequent_transactions").update(payload).eq("id", editingFrequentId)
    if (error) { toast.error("수정 실패: " + error.message); return }
    toast.success("템플릿이 성공적으로 수정되었습니다.")
    setOpenFrequent(false)
    loadData()
  }

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "-"

  return (
    <div className="space-y-4 animate-in fade-in duration-300 w-full mb-10">
       <div className="flex flex-col gap-6 w-full">
         
         {/* 자동이체 관리 탭 */}
         <Card className="shadow-lg shadow-blue-50 border-blue-100 overflow-hidden w-full">
           <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
             <div className="flex items-center justify-between">
               <CardTitle className="text-xl font-bold text-blue-800">📅 자동이체 목록</CardTitle>
               <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
                 <Button size="sm" className="bg-blue-600 hover:bg-blue-700 font-bold shadow-md" onClick={() => handleOpenTransferModal()}>+ 이체 추가</Button>
                 <DialogContent className="bg-white sm:max-w-2xl overflow-y-auto max-h-[90vh]">
                   <DialogHeader><DialogTitle className="text-xl font-bold text-blue-700">{editingTransferId ? "자동이체 내용 수정" : "신규 정기결제 기록"}</DialogTitle></DialogHeader>
                   <form onSubmit={handleSaveTransfer} className="space-y-5 pt-2">
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">지정 출금일</Label>
                         <Input type="number" min="1" max="31" value={tDay} onChange={e=>setTDay(e.target.value)} required placeholder="예: 25"/>
                       </div>
                       <div className="space-y-1 md:col-span-2">
                         <Label className="text-xs font-bold text-slate-500">월 이체 (결제) 금액</Label>
                         <Input type="number" value={tAmount} onChange={e=>setTAmount(e.target.value)} required placeholder="예: 500000"/>
                       </div>
                     </div>
                     <div className="space-y-1">
                       <Label className="text-xs font-bold text-slate-500">항목명 및 목적 (적요)</Label>
                       <Input placeholder="예: 부모님 용돈, 아파트 관리비, 넷플릭스 단골" value={tDesc} onChange={e=>setTDesc(e.target.value)} required />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">계약 시작/최초 납입일</Label>
                         <Input type="date" value={tStart} onChange={e=>setTStart(e.target.value)} />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">만료/만기/종료일</Label>
                         <Input type="date" value={tEnd} onChange={e=>setTEnd(e.target.value)} />
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">출금 통장 (자산)</Label>
                         <Select value={tFrom} onValueChange={(val) => setTFrom(val || "none")}>
                           <SelectTrigger className="bg-white">
                             <SelectValue placeholder="계좌 지정">
                               {tFrom === "none" ? "지정 안함 (메모용)" : accounts.find(a => a.id === tFrom)?.name}
                             </SelectValue>
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="none">지정 안함 (메모용)</SelectItem>
                             {accounts.filter(a => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">입금/비용처 (지출)</Label>
                         <Select value={tTo} onValueChange={(val) => setTTo(val || "none")}>
                           <SelectTrigger className="bg-white">
                             <SelectValue placeholder="분류 지정">
                               {tTo === "none" ? "지정 안함 (메모용)" : accounts.find(a => a.id === tTo)?.name}
                             </SelectValue>
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="none">지정 안함 (메모용)</SelectItem>
                             {accounts.filter(a => a.is_active !== false).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                     <div className="space-y-1">
                       <Label className="text-xs font-bold text-slate-500">수취 타행 계좌번호 / 개인 메모</Label>
                       <Input placeholder="예: 신한은행 110-123-4567 홍길동 (주택청약 납입 계좌)" value={tMemo} onChange={e=>setTMemo(e.target.value)} />
                     </div>
                     <div className="pt-2">
                        <Button type="submit" className="w-full font-bold h-10 shadow-md">항목 {editingTransferId ? "수정하기" : "저장하기"}</Button>
                     </div>
                   </form>
                 </DialogContent>
               </Dialog>
             </div>
           </CardHeader>
           <CardContent className="p-0 overflow-x-auto w-full">
             <Table className="min-w-[1000px] w-full table-fixed">
               <TableHeader className="bg-slate-50">
                 <TableRow className="whitespace-nowrap">
                   <TableHead className="w-[70px] text-center font-black">출금일</TableHead>
                   <TableHead className="font-bold w-[180px] break-words">항목명(목적)</TableHead>
                   <TableHead className="font-bold w-[180px]">출금 → 연결처 경로</TableHead>
                   <TableHead className="text-center font-bold text-blue-600 w-[140px]">이체 갱신 기간</TableHead>
                   <TableHead className="text-right font-black text-blue-700 w-[120px]">이체 금액</TableHead>
                   <TableHead className="font-bold text-slate-500 w-[200px] break-words">참고 메모/타행정보</TableHead>
                   <TableHead className="w-[80px] text-center">도구</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {transfers.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">등록된 내역이 없습니다.</TableCell></TableRow>}
                 {transfers.map(t => (
                   <TableRow key={t.id} className="hover:bg-blue-50/30 transition-colors">
                     <TableCell className="text-center font-black text-blue-700 bg-blue-50/50">{t.transfer_day_of_month}일</TableCell>
                     <TableCell className="font-bold text-slate-800 break-words">{t.description}</TableCell>
                     <TableCell className="text-[12px] text-slate-500 font-bold whitespace-nowrap">
                        {getAccountName(t.withdrawal_account_id)}
                        <span className="text-blue-300 font-extrabold mx-1">{"→"}</span>
                        {getAccountName(t.deposit_account_id)}
                     </TableCell>
                     <TableCell className="text-center font-medium text-[11px] text-slate-600">
                        <div className="leading-tight">{t.start_date ? t.start_date.substring(2) : '시작미정'}</div>
                        <div className="text-slate-300 leading-tight">~</div>
                        <div className="leading-tight">{t.end_date ? t.end_date.substring(2) : '무기한'}</div>
                     </TableCell>
                     <TableCell className="text-right font-black tracking-tight text-blue-800 text-[14px]">{Number(t.amount).toLocaleString()} 원</TableCell>
                     <TableCell className="text-xs text-slate-500 break-words leading-tight">{t.memo || <span className="text-slate-300">-</span>}</TableCell>
                     <TableCell className="text-center whitespace-nowrap">
                       <Button variant="ghost" size="sm" className="h-6 w-8 px-1 text-slate-400 hover:text-blue-600 transition-colors" onClick={() => handleOpenTransferModal(t)}>수정</Button>
                       <Button variant="ghost" size="sm" className="h-6 w-6 px-1 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={() => handleDeleteTransfer(t.id)}>✕</Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </CardContent>
         </Card>

         {/* 보험 관리 탭 */}
         <Card className="shadow-lg shadow-emerald-50 border-emerald-100 overflow-hidden w-full">
           <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 pb-4">
             <div className="flex items-center justify-between">
               <CardTitle className="text-xl font-bold text-emerald-800">🛡️ 보험 목록</CardTitle>
               <Dialog open={openInsurance} onOpenChange={setOpenInsurance}>
                 <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold shadow-md" onClick={() => handleOpenInsuranceModal()}>+ 보험 추가</Button>
                 <DialogContent className="bg-white sm:max-w-2xl overflow-y-auto max-h-[90vh]">
                   <DialogHeader><DialogTitle className="text-xl font-bold text-emerald-700">{editingInsuranceId ? "보험 항목 세부조정" : "든든한 보험 정보 추가"}</DialogTitle></DialogHeader>
                   <form onSubmit={handleSaveInsurance} className="space-y-4 pt-2">
                     <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">보험 상품명</Label>
                         <Input placeholder="예: 무배당 메리츠 실비보험" value={iName} onChange={e=>setIName(e.target.value)} required />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">고유 증권 번호</Label>
                         <Input placeholder="하이픈(-) 포함 원본 기재" className="font-mono text-xs" value={iNumber} onChange={e=>setINumber(e.target.value)} />
                       </div>
                     </div>
                     <div className="grid grid-cols-4 gap-4">
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">가입 보험사명</Label>
                         <Input placeholder="예: 메리츠화재" value={iProvider} onChange={e=>setIProvider(e.target.value)} />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">계약자</Label>
                         <Input placeholder="예: 본인, 부모님" value={iContractor} onChange={e=>setIContractor(e.target.value)} />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">피보험자</Label>
                         <Input placeholder="예: 자녀, 배우자" value={iInsured} onChange={e=>setIInsured(e.target.value)} />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">가입일</Label>
                         <Input type="date" value={iContractDate} onChange={e=>setIContractDate(e.target.value)} />
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">의무 약정 납입 기간</Label>
                         <Input placeholder="예: 20년납, 5년납, 전기납" value={iPayPeriod} onChange={e=>setIPayPeriod(e.target.value)} />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-slate-500">주계약 보장 종료 만기</Label>
                         <Input placeholder="예: 100세만기, 종신, 2030년까지" value={iCoverPeriod} onChange={e=>setICoverPeriod(e.target.value)} />
                       </div>
                     </div>
                     <div className="grid grid-cols-3 gap-4 items-end bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                       <div className="space-y-1 col-span-2">
                         <Label className="text-xs font-bold text-emerald-800">월 지정 납입 보험료</Label>
                         <Input type="number" placeholder="예: 35000" className="border-emerald-200 font-bold" value={iPremium} onChange={e=>setIPremium(e.target.value)} required />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs font-bold text-emerald-800">상태</Label>
                         <Select value={iStatus} onValueChange={(val) => setIStatus(val || "납입중")}>
                            <SelectTrigger className="bg-white border-emerald-200 font-semibold"><SelectValue/></SelectTrigger>
                            <SelectContent>
                               <SelectItem value="납입중">납입중</SelectItem>
                               <SelectItem value="완납">완납</SelectItem>
                               <SelectItem value="정지">정지</SelectItem>
                               <SelectItem value="해지">해지</SelectItem>
                            </SelectContent>
                         </Select>
                       </div>
                     </div>
                     <div className="space-y-1 mt-2">
                       <Label className="text-xs font-bold text-slate-500">주요 특약 / 해지 환급금 메모</Label>
                       <Input placeholder="예: 암진단 5천, 실손 별도 유지 등 중요 참고사항 입력" value={iNotes} onChange={e=>setINotes(e.target.value)} />
                     </div>
                     <div className="pt-2">
                        <Button type="submit" className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 h-10 shadow-md">약관 {editingInsuranceId ? "수정완료" : "저장하기"}</Button>
                     </div>
                   </form>
                 </DialogContent>
               </Dialog>
             </div>
           </CardHeader>
           <CardContent className="p-0 overflow-x-auto w-full">
             <Table className="min-w-[1100px] w-full table-fixed">
               <TableHeader className="bg-slate-50">
                 <TableRow className="whitespace-nowrap">
                   <TableHead className="font-bold w-[220px]">상품명 / 증권번호</TableHead>
                   <TableHead className="font-bold w-[120px]">보험사/가입일</TableHead>
                   <TableHead className="font-bold text-center w-[60px]">계약자</TableHead>
                   <TableHead className="font-bold text-center w-[60px]">피보험자</TableHead>
                   <TableHead className="font-bold text-center w-[120px]">납입/보장 기간</TableHead>
                   <TableHead className="text-right font-black text-emerald-700 w-[120px]">월 납입액</TableHead>
                   <TableHead className="font-bold text-center w-[90px]">상태</TableHead>
                   <TableHead className="font-bold text-slate-500">특약/메모</TableHead>
                   <TableHead className="w-[80px] text-center">도구</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {insurances.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-400">등록된 내역이 없습니다.</TableCell></TableRow>}
                 {insurances.map(i => (
                   <TableRow key={i.id} className={`hover:bg-emerald-50/30 transition-colors ${i.status === '해지' || i.status === '정지' ? 'opacity-50 bg-slate-50' : (i.status === '완납' ? 'bg-emerald-50/10' : '')}`}>
                     <TableCell className="break-words">
                       <div className="font-bold text-slate-800 text-[14px] leading-tight">{i.policy_name}</div>
                       <div className="text-[12px] text-slate-400 font-mono mt-0.5 tracking-tighter">{i.policy_number || <span className="opacity-50">증권번호없음</span>}</div>
                     </TableCell>
                     <TableCell className="break-words">
                       <div className="font-extrabold text-slate-700 leading-tight">{i.provider || "-"}</div>
                       <div className="text-[11px] text-emerald-600 font-bold tracking-tighter mt-0.5">{i.contract_date || "가입일모름"}</div>
                     </TableCell>
                     <TableCell className="text-center">
                       <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-lg text-[11px] font-black tracking-tight whitespace-nowrap">{i.contractor_name || "본인"}</span>
                     </TableCell>
                     <TableCell className="text-center">
                       <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-black tracking-tight whitespace-nowrap">{i.insured_person || "-"}</span>
                     </TableCell>
                     <TableCell className="text-center">
                       <div className="text-[11px] font-bold text-slate-600 leading-tight">{i.payment_period || "-"}</div>
                       <div className="text-[11px] font-extrabold text-blue-500 leading-tight mt-0.5">{i.coverage_period || "-"}</div>
                     </TableCell>
                     <TableCell className={`text-right font-black tracking-tight text-[14px] ${(i.status === '완납' || i.status === '해지' || (i.is_fully_paid && !i.status)) ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                        {Number(i.monthly_premium).toLocaleString()} 원
                     </TableCell>
                     <TableCell className="text-center">
                       {i.status === '완납' && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded text-[11px] font-black whitespace-nowrap">완납 🎉</span>}
                       {i.status === '납입중' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[11px] font-bold whitespace-nowrap">납입중</span>}
                       {(i.status === '정지' || i.status === '해지') && <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[11px] font-bold whitespace-nowrap">{i.status}</span>}
                       {(!i.status && i.is_fully_paid) && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded text-[11px] font-black whitespace-nowrap">완납 🎉</span>}
                       {(!i.status && !i.is_fully_paid) && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[11px] font-bold whitespace-nowrap">납입중</span>}
                     </TableCell>
                     <TableCell className="text-[11px] text-slate-500 leading-tight break-words">
                        {i.notes || <span className="text-slate-300">-</span>}
                     </TableCell>
                     <TableCell className="text-center whitespace-nowrap">
                       <Button variant="ghost" size="sm" className="h-6 w-8 px-1 text-slate-400 hover:text-emerald-600 transition-colors" onClick={() => handleOpenInsuranceModal(i)}>수정</Button>
                       <Button variant="ghost" size="sm" className="h-6 w-6 px-1 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={() => handleDeleteInsurance(i.id)}>✕</Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </CardContent>
         </Card>

         {/* 자주쓰는 거래내역 (템플릿) 관리 */}
         <Card className="shadow-lg shadow-slate-100 border-slate-200 overflow-hidden w-full">
           <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
             <div className="flex items-center justify-between">
               <CardTitle className="text-xl font-bold text-slate-800">⭐ 자주쓰는 거래</CardTitle>
               <TransactionForm trigger={<Button size="sm" className="bg-slate-800 hover:bg-slate-900 font-bold shadow-md">+ 추가</Button>} onSuccess={loadData} />
             </div>
           </CardHeader>
           <CardContent className="p-0 overflow-x-auto w-full">
             <Table className="min-w-[850px] w-full table-fixed">
               <TableHeader className="bg-slate-50">
                 <TableRow className="whitespace-nowrap">
                   <TableHead className="w-[80px] text-center font-bold">유형</TableHead>
                   <TableHead className="w-[80px] text-center font-bold">분류</TableHead>
                   <TableHead className="font-bold w-[250px] break-words">적요 (내역 설명)</TableHead>
                   <TableHead className="font-bold w-[200px]">출금/수익 계정 → 입금/비용 계정</TableHead>
                   <TableHead className="text-right font-black w-[150px]">금액 (등록 시)</TableHead>
                   <TableHead className="w-[80px] text-center">도구</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {frequentTxs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400">등록된 템플릿이 없습니다. (가계부 작성 시 '자주쓰는 거래내역으로 등록' 버튼 클릭)</TableCell></TableRow>}
                 {frequentTxs.map(f => (
                   <TableRow key={f.id} className="hover:bg-slate-50/50 transition-colors">
                     <TableCell className="text-center">
                        {f.type === 'expense' && <span className="text-red-500 font-bold text-[11px] bg-red-50 px-2 py-0.5 rounded">지출</span>}
                        {f.type === 'income' && <span className="text-blue-500 font-bold text-[11px] bg-blue-50 px-2 py-0.5 rounded">수입</span>}
                        {f.type === 'transfer' && <span className="text-slate-600 font-bold text-[11px] bg-slate-100 px-2 py-0.5 rounded">이체</span>}
                     </TableCell>
                     <TableCell className="text-center">
                        <span className="text-slate-600 font-bold text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                          {f.classification_id ? (classifications.find(c => c.id === f.classification_id)?.name || "알수없음") : "미지정"}
                        </span>
                     </TableCell>
                     <TableCell className="font-bold text-slate-800 break-words">{f.description}</TableCell>
                     <TableCell className="text-[12px] text-slate-500 font-bold whitespace-nowrap">
                        {f.from_account_id ? getAccountName(f.from_account_id) : <span className="text-slate-300">미지정</span>}
                        <span className="text-slate-300 font-extrabold mx-1">{"→"}</span>
                        {f.to_account_id ? getAccountName(f.to_account_id) : <span className="text-slate-300">미지정</span>}
                     </TableCell>
                     <TableCell className="text-right font-black tracking-tight text-slate-700 text-[14px]">{f.amount ? `${Number(f.amount).toLocaleString()} 원` : <span className="text-slate-300 font-normal text-[11px]">입력 시 직접 기입</span>}</TableCell>
                     <TableCell className="text-center whitespace-nowrap">
                       <Button variant="ghost" size="sm" className="h-6 w-8 px-1 text-slate-400 hover:text-blue-600 transition-colors" onClick={() => handleOpenFrequentModal(f)}>수정</Button>
                       <Button variant="ghost" size="sm" className="h-6 w-6 px-1 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={() => handleDeleteFrequent(f.id)}>✕</Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </CardContent>
         </Card>

         {/* 템플릿 수정용 모달 */}
         <Dialog open={openFrequent} onOpenChange={setOpenFrequent}>
           <DialogContent className="bg-white sm:max-w-md">
             <DialogHeader><DialogTitle className="text-lg font-bold text-slate-800">템플릿 내용 수정</DialogTitle></DialogHeader>
             <form onSubmit={handleSaveFrequentEdit} className="space-y-4 pt-2">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-slate-500">유형</Label>
                   <Select value={fType} onValueChange={(val: any) => setFType(val)}>
                     <SelectTrigger className="bg-white">
                       <SelectValue>
                         {fType === "expense" ? "지출" : fType === "income" ? "수입" : "이체"}
                       </SelectValue>
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="expense">지출</SelectItem>
                       <SelectItem value="income">수입</SelectItem>
                       <SelectItem value="transfer">이체</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-slate-500">거래 분류</Label>
                   <Select value={fClassId} onValueChange={setFClassId}>
                     <SelectTrigger className="bg-white">
                       <SelectValue placeholder="분류 선택">
                         {fClassId ? classifications.find(c => c.id === fClassId)?.name : "분류 선택"}
                       </SelectValue>
                     </SelectTrigger>
                     <SelectContent>
                       {classifications.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-slate-500">적요 (내역 설명)</Label>
                   <Input value={fDesc} onChange={e=>setFDesc(e.target.value)} required />
                 </div>
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-slate-500">금액 (선택사항)</Label>
                   <Input type="number" value={fAmount} onChange={e=>setFAmount(e.target.value)} placeholder="비워두면 직접 입력" />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-slate-500">출금/수익 계정 (선택)</Label>
                   <Select value={fFrom} onValueChange={(val) => setFFrom(val || "none")}>
                     <SelectTrigger className="bg-white">
                       <SelectValue placeholder="지정 안함">
                         {fFrom && fFrom !== "none" ? accounts.find(a => a.id === fFrom)?.name : "지정 안함"}
                       </SelectValue>
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none">지정 안함</SelectItem>
                       {accounts.filter(a => a.is_active !== false).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-slate-500">입금/비용 계정 (선택)</Label>
                   <Select value={fTo} onValueChange={(val) => setFTo(val || "none")}>
                     <SelectTrigger className="bg-white">
                       <SelectValue placeholder="지정 안함">
                         {fTo && fTo !== "none" ? accounts.find(a => a.id === fTo)?.name : "지정 안함"}
                       </SelectValue>
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none">지정 안함</SelectItem>
                       {accounts.filter(a => a.is_active !== false).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <div className="pt-2">
                  <Button type="submit" className="w-full font-bold h-10 shadow-md">템플릿 수정 완료</Button>
               </div>
             </form>
           </DialogContent>
         </Dialog>

       </div>
    </div>
  )
}
