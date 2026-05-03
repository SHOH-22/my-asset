"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
  const pathname = usePathname()
  if (pathname === '/login') return null

  return (
    <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-8">
          <div className="flex flex-col items-center justify-center">
             <span className="font-bold text-lg sm:text-xl text-blue-600 tracking-tight cursor-default">💰 MyAsset</span>
          </div>
          <div className="flex space-x-1">
            <Link href="/">
              <span className={`flex items-center px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[13px] sm:text-sm font-bold transition-all bg-blue-50 text-blue-700 shadow-sm border border-blue-100`}>📊 <span className="hidden sm:inline ml-1">통합 자산 대시보드</span><span className="sm:hidden ml-1">대시보드</span></span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
