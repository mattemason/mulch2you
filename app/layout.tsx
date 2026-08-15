import type { Metadata, Viewport } from "next";
import { Anton, Barlow, Geist_Mono } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const anton = Anton({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mulch2You — we deliver, you benefit",
  description:
    "Connects arborists with a full truck of wood chip to gardeners who want it. Free mulch for gardens, no tip fees for tree crews.",
};

export const viewport: Viewport = {
  themeColor: "#385020",
  // Suppliers use this outdoors on a phone; let them zoom.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      className={`${barlow.variable} ${anton.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
