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
        url: "og-editor.png",
        width: 1536,
        height: 1024,
        alt: "Vitae Studio with direct document editing, rich text controls, and draggable CV sections.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vitae Studio",
    description:
      "Your experience, beautifully composed — privately in your browser.",
    images: ["og-editor.png"],
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
