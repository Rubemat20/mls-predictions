import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MLS Playoff Chances",
  description:
    "Live MLS playoff probability predictor for the Eastern and Western Conferences.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
