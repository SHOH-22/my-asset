"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface Props {
  onSuccess?: () => void
  editData?: any
  trigger?: React.ReactNode
}

export default function TransactionForm({ onSuccess, editData, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)

  const [accounts, setAccounts] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [insurances, setInsurances] = useState<any[]>([])
  const [template, setTemplate] = useState<string>("none")
  
  const [classifications, setClassifications] = useState<any[]>([])
  const [classificationId, setClassificationId] = useState("")
  const [transferCategoryId, setTransferCategoryId] = useState("")
  const [frequentTxs, setFrequentTxs] = useState<any[]>([])
  const [frequentTemplate, setFrequentTemplate] = useState<string>("none")

  const loadAccounts = async () => {
    const { data: userAuth } = await supabase.auth.getUser()
    if (!userAuth?.user) {
      toast.error("접근 권한이 없습니다. 다시 로그인해주세요.")
      return
    }

    let { data, error: selectError } = await supabase.from("accounts").select("*").eq("owner_id", userAuth.user.id)
    if (selectError) toast.error("계정 조회 실패: " + selectError.message)

    if (!data || data.length === 0) {
      const defaultAccounts = [
        { owner_id: userAuth.user.id, name: "식비", type: "expense", group_type: "지출" },
        { owner_id: userAuth.user.id, name: "주거/통신", type: "expense", group_type: "지출" },
        { owner_id: userAuth.user.id, name: "교통수단", type: "expense", group_type: "지출" },
        { owner_id: userAuth.user.id, name: "급여", type: "revenue", group_type: "수입" },
        { owner_id: userAuth.user.id, name: "일반예금", type: "asset", group_type: "현금/예금" },
        { owner_id: userAuth.user.id, name: "신용카드", type: "liability", group_type: "카드대금" }
      ]
      const { error: insertError } = await supabase.from("accounts").insert(defaultAccounts)
      if (insertError) toast.error("기본 계정 생성 실패: " + insertError.message)
      
      const res = await supabase.from("accounts").select("*").eq("owner_id", userAuth.user.id)
      data = res.data
    }
    
    setAccounts(data || [])

    const [{data: tData}, {data: iData}, {data: cData}, {data: fData}] = await Promise.all([
      supabase.from("auto_transfers").select("*").eq("owner_id", userAuth.user.id),
      supabase.from("insurance_policies").select("*").eq("owner_id", userAuth.user.id),
      supabase.from("transaction_classifications").select("*").eq("owner_id", userAuth.user.id),
      supabase.from("frequent_transactions").select("*").eq("owner_id", userAuth.user.id)
    ])
    setTransfers(tData || [])
    setInsurances(iData || [])
    setClassifications(cData || [])
    setFrequentTxs(fData || [])

    if (cData && cData.length > 0) {
       const normalCl = cData.find(c => c.name === '일반')
       setClassificationId(normalCl ? normalCl.id : cData[0].id)
    }

    // 만약 데이터 수정(Edit) 모드라면 초기값 세팅
    if (editData && data) {
        setDate(editData.date)
        setAmount(String(Math.abs(editData.amount)))
        setDescription(editData.description)
        setFromAccount(editData.outAccountId || "")
        setToAccount(editData.inAccountId || "")
        
        const outAcc = data.find(x => x.id === editData.outAccountId)
        const inAcc = data.find(x => x.id === editData.inAccountId)
        
        if (outAcc && outAcc.type === 'revenue') setType('income')
        else if (outAcc && inAcc && (outAcc.type === 'asset' || outAcc.type === 'liability') && (inAcc.type === 'asset' || inAcc.type === 'liability')) setType('transfer')
        else setType('expense')

        if (editData.classification_id) setClassificationId(editData.classification_id)
        if (editData.transfer_category_id) setTransferCategoryId(editData.transfer_category_id)
    }
  }

  useEffect(() => {
    if (open) loadAccounts()
  }, [open])

  const [fromAccount, setFromAccount] = useState("")
  const [toAccount, setToAccount] = useState("")

  const applyTemplate = (val: string) => {
    setTemplate(val)
    if (val === "none") {
      setDescription(""); setAmount(""); setFromAccount(""); setToAccount("");
      return
    }
    
    if (val.startsWith("t_")) {
      const tId = val.replace("t_", "")
      const trans = transfers.find(t => t.id === tId)
      if (trans) {
         const fromAcc = accounts.find(a => a.id === trans.withdrawal_account_id)
         const toAcc = accounts.find(a => a.id === trans.deposit_account_id)
         if (fromAcc && toAcc && fromAcc.type === 'asset' && toAcc.type === 'asset') setType('transfer')
         else setType('expense')

         setDescription(trans.description || "")
         setAmount(String(trans.amount || ""))
         setFromAccount(trans.withdrawal_account_id || "")
         setToAccount(trans.deposit_account_id || "")

         // 이달의 이체일로 세팅
         if (trans.transfer_day_of_month) {
            const today = new Date()
            let tDay = trans.transfer_day_of_month > 31 ? 31 : trans.transfer_day_of_month
            let targetDate = new Date(today.getFullYear(), today.getMonth(), tDay)
            setDate(targetDate.toISOString().split("T")[0])
         }
      }
    } else if (val.startsWith("i_")) {
      const iId = val.replace("i_", "")
       const ins = insurances.find(i => i.id === iId)
       if (ins) {
          setType("expense")
          setDescription(`${ins.policy_name} (${ins.insured_person || ins.contractor_name || "본인"})`)
         setAmount(String(ins.monthly_premium || ""))
         setFromAccount("")
         setToAccount("")
         setDate(new Date().toISOString().split("T")[0])
      }
    }
  }

  const applyFrequentTemplate = (val: string) => {
    setFrequentTemplate(val)
    if (val === "none") {
      setDescription(""); setAmount(""); setFromAccount(""); setToAccount("");
      return
    }
    const freq = frequentTxs.find(f => f.id === val.replace("f_", ""))
    if (freq) {
      setType(freq.type as any)
      setDescription(freq.description || "")
      setAmount(freq.amount ? String(freq.amount) : "")
      setFromAccount(freq.from_account_id || "")
      setToAccount(freq.to_account_id || "")
      if (freq.classification_id) setClassificationId(freq.classification_id)
      if (freq.transfer_category_id) setTransferCategoryId(freq.transfer_category_id)
      setDate(new Date().toISOString().split("T")[0])
    }
  }

  const assets = accounts.filter(a => (a.type === "asset" || a.type === "liability") && (a.is_active !== false || a.id === fromAccount || a.id === toAccount))
  const expenses = accounts.filter(a => a.type === "expense" && (a.is_active !== false || a.id === toAccount))
  const revenues = accounts.filter(a => a.type === "revenue" && (a.is_active !== false || a.id === fromAccount))

  const activeInsurances = insurances.filter(i => i.status === '납입중' || (!i.status && !i.is_fully_paid))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromAccount || !toAccount || !amount || !description) {
      toast.error("모든 항목을 올바르게 선택/입력해주세요.")
      return
    }

    setLoading(true)
    const { data: userAuth } = await supabase.auth.getUser()
    
    let txId = editData?.id
    const numAmount = Number(amount)

    let actualFromAccount = fromAccount
    let paymentMethodId = null

    // 체크카드 등 연동 계좌를 선택한 경우 실제 회계상 차감되는 출금 통장을 변경
    const selectedFrom = accounts.find(a => a.id === fromAccount)
    if (selectedFrom && selectedFrom.linked_account_id) {
       actualFromAccount = selectedFrom.linked_account_id
       paymentMethodId = selectedFrom.id
    }

    if (editData) {
      // 📝 기존 내역 수정 (Update)
      const { error: txError } = await supabase.from("transactions").update({
        transaction_date: date,
        description: description,
        payment_method_id: paymentMethodId,
        classification_id: classificationId || null,
        transfer_category_id: type === 'transfer' ? (transferCategoryId || null) : null
      }).eq("id", editData.id)

      if (txError) { toast.error(`내역 수정 오류: ${txError.message}`); setLoading(false); return }
      
      // 분개장은 기존 것을 날리고 새로 씀
      await supabase.from("journal_entries").delete().eq("transaction_id", editData.id)
    } else {
      // 🆕 신규 내역 추가 (Insert)
      const { data: txData, error: txError } = await supabase.from("transactions").insert([{
        creator_id: userAuth?.user?.id,
        transaction_date: date,
        description: description,
        payment_method_id: paymentMethodId,
        classification_id: classificationId || null,
        transfer_category_id: type === 'transfer' ? (transferCategoryId || null) : null
      }]).select()

      if (txError) { toast.error(`내역 기록 오류: ${txError.message}`); setLoading(false); return }
      txId = txData[0].id
    }

    // 통장 잔고/분개 매핑 (실제 돈은 연동 원본 통장에서 나감)
    const entries = [
      { transaction_id: txId, account_id: actualFromAccount, amount: -numAmount },
      { transaction_id: txId, account_id: toAccount, amount: numAmount }
    ]

    const { error: entryError } = await supabase.from("journal_entries").insert(entries)

    if (entryError) {
      toast.error(`분개장 기록 오류: ${entryError.message}`)
    } else {
      toast.success(editData ? "내역이 수정되었습니다." : "장부에 기록되었습니다!")
      setOpen(false)
      if (!editData) {
        setAmount(""); setDescription(""); setFromAccount(""); setToAccount("");
      }
      if (onSuccess) onSuccess()
    }
    setLoading(false)
  }

  const handleSaveFrequent = async () => {
    if (!description) {
      toast.error("적요(내역 설명)는 반드시 기입해야 저장 가능합니다.")
      return
    }
    const { data: userAuth } = await supabase.auth.getUser()
    const payload = {
       owner_id: userAuth?.user?.id,
       type: type,
       description: description,
       amount: amount ? Number(amount) : null,
       from_account_id: fromAccount || null,
       to_account_id: toAccount || null,
       classification_id: classificationId || null,
       transfer_category_id: type === 'transfer' ? (transferCategoryId || null) : null
    }
    const { error } = await supabase.from("frequent_transactions").insert(payload)
    if (error) toast.error("템플릿 저장 실패: " + error.message)
    else {
      toast.success("자주쓰는 거래내역으로 등록되었습니다!")
      loadAccounts()
    }
  }

  return (
    <>
      <div className="inline-block" onClick={() => setOpen(true)}>
        {trigger ? trigger : (
          <Button className="bg-blue-600 hover:bg-blue-700 font-bold" type="button">
            + 새로운 거래 기록
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(val) => {
         setOpen(val); 
         if (!val && !editData) {
            setAmount(""); setDescription(""); setFromAccount(""); setToAccount(""); setTemplate("none"); setFrequentTemplate("none"); setTransferCategoryId("");
         }
      }}>
        <DialogContent className="sm:max-w-md bg-white shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editData ? '거래 내역 수정' : '가계부 작성 (복식부기)'}</DialogTitle>
            <DialogDescription>{editData ? '기존에 작성된 거래를 수정하고 장부를 재작성합니다.' : '원인과 결과를 나누어 튼튼하게 기록합니다.'}</DialogDescription>
          </DialogHeader>

          <Tabs value={type} onValueChange={(v: any) => {setType(v); setFromAccount(""); setToAccount("");}} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="expense">지출</TabsTrigger>
              <TabsTrigger value="income">수입</TabsTrigger>
              <TabsTrigger value="transfer">자산이체</TabsTrigger>
            </TabsList>
          </Tabs>

          {!editData && (
            <div className="mb-4 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500">💡 고정지출/보험</Label>
                <Select value={template} onValueChange={(val) => {setTemplate(val||"none"); setFrequentTemplate("none"); applyTemplate(val||"none");}}>
                  <SelectTrigger className="bg-white border-blue-200 text-xs h-9">
                    <SelectValue placeholder="선택 안함">
                      {template === "none" ? "선택 안함" : (
                        template.startsWith("t_") 
                        ? transfers.find(t => t.id === template.replace("t_", ""))?.description 
                        : insurances.find(i => i.id === template.replace("i_", ""))?.policy_name
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안함</SelectItem>
                    {transfers.length > 0 && <SelectGroup><SelectLabel className="text-blue-500 text-xs">고정 자동이체</SelectLabel>
                      {transfers.map(t => <SelectItem key={`t_${t.id}`} value={`t_${t.id}`}>{t.description}</SelectItem>)}
                    </SelectGroup>}
                    {activeInsurances.length > 0 && <SelectGroup><SelectLabel className="text-emerald-600 text-xs">납입중인 보험료</SelectLabel>
                      {activeInsurances.map(i => <SelectItem key={`i_${i.id}`} value={`i_${i.id}`}>{i.policy_name}</SelectItem>)}
                    </SelectGroup>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500">⭐ 자주쓰는 거래내역</Label>
                <Select value={frequentTemplate} onValueChange={(val) => {setFrequentTemplate(val||"none"); setTemplate("none"); applyFrequentTemplate(val||"none");}}>
                  <SelectTrigger className="bg-white border-blue-200 text-xs h-9">
                    <SelectValue placeholder="선택 안함">
                      {frequentTemplate === "none" ? "선택 안함" : frequentTxs.find(f => f.id === frequentTemplate.replace("f_", ""))?.description}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안함</SelectItem>
                    {frequentTxs.length > 0 && <SelectGroup><SelectLabel className="text-blue-600 text-xs">내 템플릿</SelectLabel>
                      {frequentTxs.map(f => <SelectItem key={`f_${f.id}`} value={`f_${f.id}`}>{f.description}</SelectItem>)}
                    </SelectGroup>}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-slate-800">거래 발생일</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-800">거래 분류</Label>
                <Select value={classificationId} onValueChange={(val) => { if (val) setClassificationId(val) }}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="분류 선택">
                      {classificationId ? classifications.find(c => c.id === classificationId)?.name : "분류 선택"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {classifications.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-800">총 금액 (원)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-800">내역 설명 (적요)</Label>
              <Input placeholder="어디서 무엇을 하셨나요? (예: 인터넷 요금 결제)" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-${type === 'transfer' ? '3' : '2'} gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200`}>
              <div className="space-y-2">
                <Label className="text-slate-600 font-bold">{type === "income" ? "어떤 수익인가요? (카테고리)" : "어디서 나갔나요? (출금 계좌)"}</Label>
                <Select value={fromAccount} onValueChange={(val) => setFromAccount(val || "")}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="계정 선택">
                      {fromAccount ? (() => { const a = accounts.find(a => String(a.id) === String(fromAccount)); return a ? `[${a.group_type || '미분류'}] ${a.name}` : "계정 선택"; })() : "계정 선택"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {type === "income" 
                      ? (revenues.length > 0 ? revenues.map(a => <SelectItem key={a.id} value={String(a.id)}>[{a.group_type || '미분류'}] {a.name}</SelectItem>) : <SelectItem value="empty" disabled>항목 없음</SelectItem>)
                      : (assets.length > 0 ? assets.map(a => <SelectItem key={a.id} value={String(a.id)}>[{a.group_type || '미분류'}] {a.name}</SelectItem>) : <SelectItem value="empty" disabled>항목 없음</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-bold">{type === "expense" ? "어디에 썼나요? (지출 카테고리)" : "어디로 입금됐나요? (입금 계좌)"}</Label>
                <Select value={toAccount} onValueChange={(val) => setToAccount(val || "")}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="계정 선택">
                      {toAccount ? (() => { const a = accounts.find(a => String(a.id) === String(toAccount)); return a ? `[${a.group_type || '미분류'}] ${a.name}` : "계정 선택"; })() : "계정 선택"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {type === "expense" 
                      ? (expenses.length > 0 ? expenses.map(a => <SelectItem key={a.id} value={String(a.id)}>[{a.group_type || '미분류'}] {a.name}</SelectItem>) : <SelectItem value="empty" disabled>항목 없음</SelectItem>)
                      : (assets.length > 0 ? assets.map(a => <SelectItem key={a.id} value={String(a.id)}>[{a.group_type || '미분류'}] {a.name}</SelectItem>) : <SelectItem value="empty" disabled>항목 없음</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {type === 'transfer' && (
                <div className="space-y-2">
                  <Label className="text-slate-600 font-bold">어떤 목적의 이체인가요?</Label>
                  <Select value={transferCategoryId} onValueChange={(val) => setTransferCategoryId(val || "")}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="선택 안함">
                        {transferCategoryId ? (() => { const a = accounts.find(a => String(a.id) === String(transferCategoryId)); return a ? `[${a.group_type || '미분류'}] ${a.name}` : "선택 안함"; })() : "선택 안함"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.type === 'transfer').length > 0 ? accounts.filter(a => a.type === 'transfer').map(a => <SelectItem key={a.id} value={String(a.id)}>[{a.group_type || '미분류'}] {a.name}</SelectItem>) : <SelectItem value="empty" disabled>항목 없음</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <Button type="submit" className="w-full font-bold bg-blue-600 shadow-md" disabled={loading}>
                {loading ? "저장 중..." : (editData ? "수정 내용 저장하기" : "장부에 기록하기")}
              </Button>
              {!editData && (
                 <Button type="button" variant="outline" className="w-full font-bold text-slate-600 border-slate-300" onClick={handleSaveFrequent}>
                   ⭐ 자주쓰는 거래내역으로 등록
                 </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
