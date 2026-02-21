"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
export default function BottomNav() {
  const params = useParams();
  const tenant = params?.tenant ?? "";
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white">
      <div className="mx-auto flex h-14 max-w-md items-center justify-around px-4 text-xs">
        <Link href={`/${tenant}/goods`}>홈</Link>
        <Link href={`/${tenant}/order/new`}>주문</Link>
        <Link href={`/${tenant}/auth`}>마이</Link>
      </div>
    </nav>
  );
}
