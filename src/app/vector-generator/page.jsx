"use client";

import { Palette } from "lucide-react";
import PromptGenerator from "@/components/PromptGenerator";

export default function VectorGeneratorPage() {
  return (
    <PromptGenerator
      type="vector"
      titleKey="nav.vectorPrompt"
      descKey="home.vectorDesc"
      icon={Palette}
      gradient="linear-gradient(135deg, #06b6d4, #0891b2)"
      storagePrefix="vector"
      advancedTitleKey="prompt.vectorInstructions"
      placeholderKey="prompt.vectorPlaceholder"
    />
  );
}
