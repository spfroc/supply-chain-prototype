import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "政采供应链 · 企业采购样板",
  description: "面向政企客户的协议采购、订单履约与运营管理交互样板。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
