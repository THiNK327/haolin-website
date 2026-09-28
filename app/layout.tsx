import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "Haolin Wang — Machine Learning & Quantitative Research",
 description: "Haolin Wang is a Ph.D. student at Georgia Tech working on computer vision, quantitative evaluation, temporal analysis, digital twins, and reproducible research tools.",
 metadataBase: new URL("https://haolinwang.com"),
 openGraph: {
  type: "website",
  url: "https://haolinwang.com/",
  siteName: "Haolin Wang",
  title: "Haolin Wang — Digital Twins, Computer Vision & Automation",
  description: "Explore my research, projects, and interactive examples. I’m a Ph.D. student at Georgia Tech working with data, computer vision, digital twins, and automation.",
  images: [{ url: "https://haolinwang.com/social-preview.png", width: 1200, height: 630, type: "image/png", alt: "Haolin Wang — Ph.D. student at Georgia Tech. Digital twins, computer vision, data analysis, and automation." }],
 },
 twitter: {
  card: "summary_large_image",
  title: "Haolin Wang — Digital Twins, Computer Vision & Automation",
  description: "Explore my research, projects, and interactive examples.",
  images: ["https://haolinwang.com/social-preview.png"],
 },
 icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="en"><body>{children}</body></html>;
}
