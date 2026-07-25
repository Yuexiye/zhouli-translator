import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "新三国台词翻译器｜现代白话 → 新三国风味",
  description:
    "把现代中文翻译成曹操、刘备、诸葛亮、关羽、张飞、司马懿等角色的台词风格。三档强度，一键生成古风卡片，微信整活利器。",
  keywords: ["新三国", "新三国体", "台词翻译器", "AI翻译", "网络梗", "曹操", "诸葛亮", "刘备", "关羽", "张飞", "司马懿", "整活", "DeepSeek"],
  openGraph: {
    title: "新三国台词翻译器",
    description: "把现代白话，译成新三国角色台词。",
    type: "website",
    locale: "zh_CN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          href="/fonts/zhouli-serif-ui-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/zhouli-serif-ui-500.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/zhouli-serif-ui-600.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
      <a href="/xinsanguo" className="xinsanguo-top-entry">新三国翻译器</a>
      {children}
    </body>
    </html>
  );
}
