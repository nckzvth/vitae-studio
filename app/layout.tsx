import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nckzvth.github.io/vitae-studio/"),
  title: "Vitae Studio — CSV to beautifully composed CV",
  description:
    "A private, local-first studio for importing, designing, and exporting a polished CV from flexible CSV data.",
  applicationName: "Vitae Studio",
  icons: { icon: "./favicon.svg", shortcut: "./favicon.svg" },
  openGraph: {
    title: "Vitae Studio",
    description:
      "Your experience, beautifully composed — privately in your browser.",
    type: "website",
    images: [
      {
        url: "og.png",
        width: 1731,
        height: 909,
        alt: "Vitae Studio turns structured CSV rows into a beautifully composed CV.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vitae Studio",
    description:
      "Your experience, beautifully composed — privately in your browser.",
    images: ["og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
