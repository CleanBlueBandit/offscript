import type { Metadata } from "next";
import "./globals.css";
import "./research.css";
import "./decision-handoff.css";
export const metadata: Metadata = {
  title: "Offscript — Find the unexpected",
  icons: { icon: "/favicon.svg" },
  description:
    "A creative workshop for ideas that refuse to be obvious. Explore 100 perspectives, remix ingredients, and build something worth showing.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
