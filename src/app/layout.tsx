import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Flairify | Your fashion fairy assistant",
  description:
    "Share your wardrobe once. Find pieces that work with your life—and see the look on you.",
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
