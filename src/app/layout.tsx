import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Agentic Onboarding for ONDC Sellers",
  description:
    "Case-study demo: an agentic onboarding flow that extracts, maps and checks a seller's catalog, with a human gate on every value that is legal or financial. Personal project, not affiliated with ONDC.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-[14px] leading-[1.5]">
        <TopNav />
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
