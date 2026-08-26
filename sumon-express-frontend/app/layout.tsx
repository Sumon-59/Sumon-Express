import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext"; // ✅ ADD THIS

import { AuthProvider } from "@/context/AuthContext"; // ✅ ADD THIS
import Navbar from "@/components/Navbar"; // ✅ ADD THIS
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sumon Express — Online Shopping in Bangladesh",
  description:
    "Shop electronics, accessories and more with cash on delivery across Bangladesh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <AuthProvider>
          <CartProvider>
            <Navbar />
            <div className="flex-1">{children}</div>
            <footer className="border-t bg-card">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground">
                <span>© {new Date().getFullYear()} Sumon Express</span>
                <span>Cash on delivery across Bangladesh</span>
              </div>
            </footer>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
