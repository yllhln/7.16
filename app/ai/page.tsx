import { siteConfig } from "@/siteConfig";
import AIClient from "./AIClient";

// 🌟 服务端渲染，支持 metadata（和 app/music/page.tsx 是一样的写法惯例）
export const metadata = {
  title: "AI | " + siteConfig.title,
};

export default function AIPage() {
  return <AIClient />;
}
