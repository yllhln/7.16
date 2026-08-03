import { siteConfig } from "@/siteConfig";
import PetClient from "./PetClient";

export const metadata = {
  title: (siteConfig.petPageTitle || "AI 宠物") + " | " + siteConfig.title,
};

export default function PetPage() {
  return <PetClient />;
}
