import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "Haolin Wang — Machine Learning & Quantitative Research",
 description: "Haolin Wang is a Ph.D. student at Georgia Tech working on computer vision, quantitative evaluation, temporal analysis, digital twins, and reproducible research tools.",
 icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="en"><body>{children}</body></html>;
}
