"use client";

import { Wand2 } from "lucide-react";
import PromptGenerator from "@/components/PromptGenerator";

export default function PromptGeneratorPage() {
  return (
    <PromptGenerator
      type="image"
      titleKey="nav.imagePrompt"
      descKey="home.imageDesc"
      icon={Wand2}
      storagePrefix="prompt"
      advancedTitleKey="prompt.advancedInstructions"
      placeholderKey="prompt.placeholder"
    />
  );
}
