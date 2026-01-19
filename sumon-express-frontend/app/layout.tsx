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
  title: "Sumon Express",
  description: "E-commerce frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* ✅ ONLY THIS WRAP IS NEW */}
        <AuthProvider>
          <CartProvider>
          <Navbar />
          {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
