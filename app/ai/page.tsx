import { siteConfig } from "@/siteConfig";
import VTuberWidget from "@/components/VTuberWidget";

export const metadata = {
  title: "AI | " + siteConfig.title,
};

export default function AIPage() {
  return <VTuberWidget />;
}
