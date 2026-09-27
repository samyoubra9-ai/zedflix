"use client";

import { AccountGate } from "@/components/account";
import { Catalog } from "../films/page";

export default function SeriesPage() {
  return (
    <AccountGate>
      <Catalog kind="show" title="Séries" />
    </AccountGate>
  );
}
