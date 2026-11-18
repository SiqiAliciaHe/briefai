import "./globals.css";

export const metadata = {
  title: "BriefAI 需求助手",
  description: "把一句模糊的需求，变成技能方拿到就能开工的需求单",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
