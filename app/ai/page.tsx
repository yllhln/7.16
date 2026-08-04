import { siteConfig } from "@/siteConfig";
import AIClient from "./AIClient";

export const metadata = {
  title: "AI | " + siteConfig.title,
};

export default function AIPage() {
  return <AIClient />;
}
