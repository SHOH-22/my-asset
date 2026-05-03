"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErrorMsg(error.message)
    } else {
      router.push("/") // 로그인 완료되면 대시보드로 이동
    }
    setLoading(false)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")
    
    // Supabase 회원가입 호출
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })
    
    if (authError) {
      setErrorMsg(authError.message)
    } else {
      // 가입된 계정의 프로필 테이블을 생성합니다. (원래는 DB Trigger로 자동화하는 것이 좋음, 현재는 명시적 삽입)
      if (authData.user) {
        await supabase.from('profiles').insert([
          { id: authData.user.id, full_name: name }
        ])
      }
      alert("회원가입이 완료되었습니다! (이메일 인증이 꺼져있다면 즉시 로그인 가능합니다)")
      if (authData.session) {
        router.push("/")
      }
    }
    setLoading(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    if (error) {
      setErrorMsg(error.message)
    } else {
      alert("비밀번호 재설정 링크가 이메일로 발송되었습니다. 이메일함을 확인해주세요.")
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-blue-600">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold tracking-tight">MyAsset</CardTitle>
          <CardDescription>나만의 스마트한 자산 및 복식부기 가계부</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
              <TabsTrigger value="reset">비밀번호 찾기</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일 주소</Label>
                  <Input id="email" type="email" placeholder="example@email.com" required onChange={(e)=>setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input id="password" type="password" required onChange={(e)=>setPassword(e.target.value)} />
                </div>
                {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "확인 중..." : "로그인"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">이름 (또는 닉네임)</Label>
                  <Input id="name" placeholder="홍길동" required onChange={(e)=>setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일 계정</Label>
                  <Input id="signup-email" type="email" placeholder="you@example.com" required onChange={(e)=>setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">안전한 비밀번호 (6자 이상)</Label>
                  <Input id="signup-password" type="password" required minLength={6} onChange={(e)=>setPassword(e.target.value)} />
                </div>
                {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
                <Button type="submit" className="w-full" variant="secondary" disabled={loading}>
                  {loading ? "처리 중..." : "새 계정 만들기"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">가입한 이메일 주소</Label>
                  <Input id="reset-email" type="email" placeholder="example@email.com" required onChange={(e)=>setEmail(e.target.value)} />
                  <p className="text-xs text-slate-500 mt-1">입력하신 이메일로 재설정 링크를 보내드립니다.</p>
                </div>
                {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "처리 중..." : "비밀번호 재설정 링크 받기"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
