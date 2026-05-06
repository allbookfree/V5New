"use client";

import { Video } from "lucide-react";
import PromptGenerator from "@/components/PromptGenerator";

export default function VideoGeneratorPage() {
  return (
    <PromptGenerator
      type="video"
      titleKey="nav.videoPrompt"
      descKey="home.videoDesc"
      icon={Video}
      gradient="linear-gradient(135deg, #f97316, #ef4444)"
      storagePrefix="video"
      advancedTitleKey="prompt.videoInstructions"
      placeholderKey="prompt.videoPlaceholder"
    />
  );
}
