"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AccountsManager({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [classifications, setClassifications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 신규 추가 폼
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("expense") 
  const [newGroup, setNewGroup] = useState("")
  const [newLinkedAccount, setNewLinkedAccount] = useState("none")
  const [newMemo, setNewMemo] = useState("")

  // 이름 수정 상태
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editGroup, setEditGroup] = useState("")
  const [editMemo, setEditMemo] = useState("")

  const [newClassificationName, setNewClassificationName] = useState("")
  const [editingClassificationId, setEditingClassificationId] = useState<string | null>(null)
  const [editClassificationName, setEditClassificationName] = useState("")

  const handleEditInit = (a: any) => {
    setEditingId(a.id)
    setEditName(a.name)
    setEditGroup(a.group_type || "")
    setEditMemo(a.memo || "")
  }

  const handleEditSave = async (id: string) => {
    if (!editName.trim()) return
    const { error } = await supabase.from("accounts").update({ name: editName, group_type: editGroup || null, memo: editMemo || null }).eq("id", id)
    if (error) toast.error(`이름 변경 실패: ${error.message}`)
    else {
      toast.success("카테고리/계정 이름이 변경되었습니다. 기존에 입력된 거래에도 즉시 새 이름이 뜹니다!")
      setEditingId(null)
      loadAccounts()
      if (onSuccess) onSuccess()
    }
  }

  const loadAccounts = async () => {
    const { data: userAuth } = await supabase.auth.getUser()
    if (!userAuth?.user) return
    const { data } = await supabase.from("accounts").select("*").eq("owner_id", userAuth.user.id).order('type')
    const sortedData = (data || []).sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type)
      const groupA = a.group_type || ""
      const groupB = b.group_type || ""
      if (groupA !== groupB) return groupA.localeCompare(groupB)
      const nameA = a.name || ""
      const nameB = b.name || ""
      return nameA.localeCompare(nameB)
    })
    setAccounts(sortedData)

    let { data: classData } = await supabase.from("transaction_classifications").select("*").eq("owner_id", userAuth.user.id).order('created_at')
    if (!classData || classData.length === 0) {
       const defaults = [
          { owner_id: userAuth.user.id, name: '일반' },
          { owner_id: userAuth.user.id, name: '고정' }
       ]
       await supabase.from("transaction_classifications").insert(defaults)
       const res = await supabase.from("transaction_classifications").select("*").eq("owner_id", userAuth.user.id).order('created_at')
       classData = res.data
    }
    setClassifications(classData || [])
  }

  useEffect(() => {
    if (open) loadAccounts()
  }, [open])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newType) return
    setLoading(true)
    const { data: userAuth } = await supabase.auth.getUser()
    
    let group = newGroup
    if (!group) {
        if (newType === 'asset') group = '기타자산'
        if (newType === 'liability') group = '기타부채'
        if (newType === 'revenue') group = '기타수익'
        if (newType === 'expense') group = '기타지출'
        if (newType === 'transfer') group = '기타이체'
    }

    const { error } = await supabase.from("accounts").insert([
      { 
        owner_id: userAuth?.user?.id, 
        name: newName, 
        type: newType, 
        group_type: group,
        sub_category: null,
        linked_account_id: newType === 'asset' && newLinkedAccount !== 'none' ? newLinkedAccount : null,
        memo: (newType === 'asset' || newType === 'liability') ? (newMemo || null) : null
      }
    ])

    if (error) toast.error(`항목 추가 실패: ${error.message}`)
    else {
      toast.success(`'${newName}' 항목이 성공적으로 추가되었습니다.`)
      setNewName("")
      setNewGroup("")
      setNewMemo("")
      setNewLinkedAccount("none")
      loadAccounts()
      if (onSuccess) onSuccess()
    }
    setLoading(false)
  }

  const handleToggleActive = async (account: any) => {
    const newState = account.is_active === false ? true : false
    const { error } = await supabase.from("accounts").update({ is_active: newState }).eq("id", account.id)
    if (error) toast.error(`상태 변경 실패: ${error.message}`)
    else {
      toast.success(`'${account.name}' 항목이 ${newState ? '다시 활성화' : '숨김(비활성)'} 처리되었습니다.`)
      loadAccounts()
      if (onSuccess) onSuccess()
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`정말 '${name}' 항목을 삭제하시겠습니까?\n이 항목이 이미 사용된 장부가 있다면 삭제가 취소될 수 있습니다.`)) return
    const { error } = await supabase.from("accounts").delete().eq("id", id)
    if (error) toast.error("삭제할 수 없습니다. (이미 장부에 누적 기록이 있는 계정입니다.)")
    else {
      toast.info("항목이 목록에서 삭제되었습니다.")
      loadAccounts()
      if (onSuccess) onSuccess()
    }
  }

  const handleAddClassification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassificationName.trim()) return
    setLoading(true)
    const { data: userAuth } = await supabase.auth.getUser()
    const { error } = await supabase.from("transaction_classifications").insert([{ owner_id: userAuth?.user?.id, name: newClassificationName }])
    if (error) toast.error(`항목 추가 실패: ${error.message}`)
    else {
      toast.success(`'${newClassificationName}' 항목이 추가되었습니다.`)
      setNewClassificationName("")
      loadAccounts()
    }
    setLoading(false)
  }

  const handleEditClassInit = (c: any) => {
    setEditingClassificationId(c.id)
    setEditClassificationName(c.name)
  }

  const handleEditClassSave = async (id: string) => {
    if (!editClassificationName.trim()) return
    const { error } = await supabase.from("transaction_classifications").update({ name: editClassificationName }).eq("id", id)
    if (error) toast.error(`변경 실패: ${error.message}`)
    else {
      toast.success("이름이 변경되었습니다.")
      setEditingClassificationId(null)
      loadAccounts()
    }
  }

  const handleDeleteClass = async (id: string, name: string) => {
    if (!confirm(`정말 '${name}' 분류를 삭제하시겠습니까?`)) return
    const { error } = await supabase.from("transaction_classifications").delete().eq("id", id)
    if (error) toast.error("삭제 실패 (이미 사용 중일 수 있습니다).")
    else {
      toast.info("삭제되었습니다.")
      loadAccounts()
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 shadow-sm font-bold border-slate-300 text-slate-700 hover:bg-slate-50" type="button" onClick={() => setOpen(true)}>⚙️ 계정 및 카테고리 관리</Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-4xl w-[95vw] sm:w-full bg-white max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold">자산 현황 및 분류 관리</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">나의 새로운 통장, 체크카드 목록과 세부 카테고리를 맞춤 설정합니다.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="assets" className="w-full min-w-0 overflow-x-hidden" onValueChange={(val) => {
           if (val === 'assets') setNewType('asset')
           else if (val === 'categories') setNewType('expense')
        }}>
          <TabsList className="flex flex-wrap w-full h-auto gap-1 p-1 mb-2 bg-slate-100 rounded-lg">
            <TabsTrigger value="assets" className="flex-1 min-w-[80px] text-[11px] sm:text-sm py-2">🏦 자산/부채 관리</TabsTrigger>
            <TabsTrigger value="categories" className="flex-1 min-w-[80px] text-[11px] sm:text-sm py-2">🏷️ 수입/지출/이체 분류</TabsTrigger>
            <TabsTrigger value="classifications" className="flex-1 min-w-[80px] text-[11px] sm:text-sm py-2">📑 거래 참고</TabsTrigger>
          </TabsList>
          
          <TabsContent value="assets" className="border rounded-md mt-2 p-2 sm:p-4 space-y-4 w-full min-w-0 overflow-x-hidden">
            <form onSubmit={handleAdd} className="flex flex-col gap-3 bg-slate-50 p-3 sm:p-4 border rounded-xl shadow-sm">
              <div className="flex flex-col md:flex-row gap-3 md:items-end w-full min-w-0">
                <div className="space-y-1 w-full md:w-[140px] min-w-0">
                  <Label className="text-xs font-bold text-slate-500">계정 유형</Label>
                  <Select value={newType} onValueChange={(val) => setNewType(val || "asset")}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="통장/현금 (자산)">
                        {newType === 'asset' ? '통장/현금 (자산)' : newType === 'liability' ? '신용카드 (부채)' : '통장/현금 (자산)'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">통장/현금 (자산)</SelectItem>
                      <SelectItem value="liability">신용카드 (부채)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <Label className="text-xs font-bold text-slate-500">대분류 (그룹명)</Label>
                  <Input value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="예: 은행명, 카드사명" className="w-full" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <Label className="text-xs font-bold text-slate-500">계정명</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 주거래통장, 생활비카드" required className="w-full" />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px] min-w-0">
                  <Label className="text-xs font-bold text-slate-500 whitespace-nowrap">계좌정보/메모 (선택)</Label>
                  <Input value={newMemo} onChange={e => setNewMemo(e.target.value)} placeholder="예: 국민 110-123-4567" className="w-full" />
                </div>
              </div>
              
              {newType === 'asset' && (
                <div className="flex flex-col md:flex-row gap-3 items-center pt-3 border-t border-slate-200 mt-1">
                   <Label className="text-xs font-bold text-blue-600 whitespace-nowrap min-w-max">체크카드 통장 연동 설정 (선택사항)</Label>
                   <Select value={newLinkedAccount} onValueChange={(val) => setNewLinkedAccount(val || "none")}>
                     <SelectTrigger className="w-full md:w-[240px] bg-white text-xs h-8">
                       <SelectValue placeholder="일반 통장 (연동 없음)">
                         {newLinkedAccount === 'none' ? '일반/오프라인 계좌 (연동 없음)' : accounts.find(a => String(a.id) === newLinkedAccount)?.name}
                       </SelectValue>
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none">일반/오프라인 계좌 (연동 기능 미사용)</SelectItem>
                       {accounts.filter(a => a.type === 'asset' && !a.linked_account_id).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                   <span className="text-xs text-slate-500 leading-tight">이 항목이 기록될 때 실제 돈은 여기서 가리키는 원본 통장에서 함께 차감/계산됩니다.</span>
                </div>
              )}
              <Button className="w-full mt-1" type="submit" disabled={loading}>+ 자산/부채 계정 추가하기</Button>
            </form>

            <div className="rounded-md border overflow-x-auto w-full min-w-0">
              <Table className="min-w-max relative">
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>유형</TableHead>
                    <TableHead>대분류(그룹명)</TableHead>
                    <TableHead>계정명</TableHead>
                    <TableHead className="w-[280px]">메모/계좌정보</TableHead>
                    <TableHead className="text-right">도구</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {accounts.filter(a => a.type === "asset" || a.type === "liability").length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-4">항목이 없습니다.</TableCell></TableRow> : null}
                {accounts.filter(a => a.type === "asset" || a.type === "liability").map(a => (
                  <TableRow key={a.id} className={a.is_active === false ? 'opacity-40 bg-slate-100' : ''}>
                    <TableCell>{a.type === 'asset' ? <span className="text-blue-600 font-bold">자산</span> : <span className="text-slate-500 font-bold">부채</span>}</TableCell>
                    <TableCell>{editingId === a.id ? (
                      <Input className="h-7 w-[100px] text-sm" value={editGroup} onChange={e => setEditGroup(e.target.value)} placeholder="대분류" />
                    ) : (a.group_type || "-")}</TableCell>
                    <TableCell className="font-semibold text-base flex items-center">
                      {editingId === a.id ? (
                        <div className="flex items-center space-x-1">
                           <Input className="h-7 w-[140px] text-sm" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                           <Button size="sm" className="h-7 px-2" onClick={() => handleEditSave(a.id)}>저장</Button>
                           <Button variant="ghost" size="sm" className="h-7 px-1 text-slate-400" onClick={() => setEditingId(null)}>취소</Button>
                        </div>
                      ) : (
                        <>
                          {a.name}
                          {a.linked_account_id && <span className="ml-2 text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-md">연동 카드</span>}
                          {a.is_active === false && <span className="ml-2 text-[10px] font-bold text-white bg-slate-500 px-1.5 py-0.5 rounded-md">숨김</span>}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm break-keep">
                      {editingId === a.id ? (
                        <Input className="h-7 w-[260px] text-sm" value={editMemo} onChange={e => setEditMemo(e.target.value)} placeholder="메모/계좌번호" />
                      ) : (a.memo || "-")}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId !== a.id && (
                        <>
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 mr-1 text-slate-500" onClick={() => handleEditInit(a)}>수정</Button>
                          <Button variant="outline" size="sm" className="h-6 text-xs px-2 mr-1" onClick={() => handleToggleActive(a)}>
                            {a.is_active === false ? "복구" : "비활성"}
                          </Button>
                          <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={() => handleDelete(a.id, a.name)}>삭제</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="border rounded-md mt-2 p-2 sm:p-4 space-y-4 w-full min-w-0 overflow-x-hidden">
            <form onSubmit={handleAdd} className="flex flex-col gap-3 bg-slate-50 p-3 sm:p-4 border rounded-xl shadow-sm">
              <div className="flex flex-col md:flex-row gap-3 md:items-end w-full min-w-0">
                <div className="space-y-1 w-full md:w-[140px] min-w-0">
                  <Label className="text-xs font-bold text-slate-500">분류 유형</Label>
                  <Select value={newType} onValueChange={(val) => setNewType(val || "expense")}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="지출">
                        {newType === 'expense' ? '지출' : newType === 'revenue' ? '수입' : '이체'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">지출</SelectItem>
                      <SelectItem value="revenue">수입</SelectItem>
                      <SelectItem value="transfer">이체</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <Label className="text-xs font-bold text-slate-500">대분류 (그룹명)</Label>
                  <Input value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="예: 식비, 저축, 주거" className="w-full" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <Label className="text-xs font-bold text-slate-500">분류명</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 배달음식, 청약저축" required className="w-full" />
                </div>
              </div>
              <Button className="w-full mt-1 bg-slate-800" type="submit" disabled={loading}>+ 수입/지출 분류 추가하기</Button>
            </form>

            <div className="rounded-md border overflow-x-auto w-full min-w-0">
              <Table className="min-w-max relative">
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>수입/지출/이체</TableHead>
                    <TableHead>대분류(그룹명)</TableHead>
                    <TableHead>분류명</TableHead>
                    <TableHead className="text-right">도구</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {accounts.filter(a => a.type === "expense" || a.type === "revenue" || a.type === "transfer").length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-4">항목이 없습니다.</TableCell></TableRow> : null}
                {accounts.filter(a => a.type === "expense" || a.type === "revenue" || a.type === "transfer").map(a => (
                  <TableRow key={a.id} className={a.is_active === false ? 'opacity-40 bg-slate-100' : ''}>
                    <TableCell>{a.type === 'revenue' ? <span className="text-green-600 font-bold">수입</span> : a.type === 'expense' ? <span className="text-red-500 font-bold">지출</span> : <span className="text-slate-600 font-bold">이체</span>}</TableCell>
                    <TableCell>{editingId === a.id ? (
                      <Input className="h-7 w-[100px] text-sm" value={editGroup} onChange={e => setEditGroup(e.target.value)} placeholder="대분류" />
                    ) : (a.group_type || "-")}</TableCell>
                    <TableCell className="font-semibold text-base flex items-center">
                      {editingId === a.id ? (
                        <div className="flex items-center space-x-1">
                           <Input className="h-7 w-[140px] text-sm" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                           <Button size="sm" className="h-7 px-2" onClick={() => handleEditSave(a.id)}>저장</Button>
                           <Button variant="ghost" size="sm" className="h-7 px-1 text-slate-400" onClick={() => setEditingId(null)}>취소</Button>
                        </div>
                      ) : (
                        <>
                          {a.name}
                          {a.is_active === false && <span className="ml-2 text-[10px] font-bold text-white bg-slate-500 px-1.5 py-0.5 rounded-md">숨김</span>}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId !== a.id && (
                        <>
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 mr-1 text-slate-500" onClick={() => handleEditInit(a)}>수정</Button>
                          <Button variant="outline" size="sm" className="h-6 text-xs px-2 mr-1" onClick={() => handleToggleActive(a)}>
                            {a.is_active === false ? "복구" : "비활성"}
                          </Button>
                          <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={() => handleDelete(a.id, a.name)}>삭제</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </TabsContent>



          <TabsContent value="classifications" className="border rounded-md mt-2 p-2 sm:p-4 space-y-4 w-full min-w-0 overflow-x-hidden">
            <form onSubmit={handleAddClassification} className="flex flex-col sm:flex-row gap-2 mb-4 w-full min-w-0">
              <Input placeholder="새 거래분류 이름 (예: 정기구독)" value={newClassificationName} onChange={e => setNewClassificationName(e.target.value)} required className="flex-1 min-w-0" />
              <Button type="submit" disabled={loading} className="font-bold bg-slate-800 w-full sm:w-auto shrink-0">분류 추가</Button>
            </form>
            <div className="rounded-md border overflow-x-auto w-full min-w-0">
              <Table className="min-w-max relative">
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>거래분류명</TableHead>
                    <TableHead className="text-right">도구</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {classifications.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center py-4">항목이 없습니다.</TableCell></TableRow> : null}
                {classifications.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold text-base">
                      {editingClassificationId === c.id ? (
                        <div className="flex items-center space-x-1">
                           <Input className="h-7 w-[140px] text-sm" value={editClassificationName} onChange={e => setEditClassificationName(e.target.value)} autoFocus />
                           <Button size="sm" className="h-7 px-2" onClick={() => handleEditClassSave(c.id)}>저장</Button>
                           <Button variant="ghost" size="sm" className="h-7 px-1 text-slate-400" onClick={() => setEditingClassificationId(null)}>취소</Button>
                        </div>
                      ) : (
                        c.name
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingClassificationId !== c.id && (
                        <>
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 mr-1 text-slate-500" onClick={() => handleEditClassInit(c)}>수정</Button>
                          <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={() => handleDeleteClass(c.id, c.name)}>삭제</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    </>
  )
}
