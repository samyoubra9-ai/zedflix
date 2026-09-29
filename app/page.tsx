import type { Metadata } from "next";
import { Vitrine } from "@/components/vitrine";

export const metadata: Metadata = {
  title: "Minuit — Films, séries & TV live",
  description:
    "Minuit : films et séries en VF sur mobile et Android TV. Demandez un compte avec 3 jours d’essai (un essai par appareil).",
  openGraph: {
    title: "Minuit",
    description: "Le salon, en VF. Mobile & Android TV.",
    type: "website",
  },
};

export default function Home() {
  return <Vitrine />;
}
