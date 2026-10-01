"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FilmsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/browse");
  }, [router]);
  return null;
}
