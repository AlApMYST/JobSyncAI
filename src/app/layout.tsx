import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JobSync AI",
  description: "Never miss a placement opportunity again",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={geist.className}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}