"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface VoiceSettingsProps {
  onSettingsChange: (settings: VoiceSettings) => void;
  currentSettings: VoiceSettings;
}

export interface VoiceSettings {
  silenceThreshold: number;
  silenceTimeout: number;
  smoothingTimeConstant: number;
}

export const environmentPresets = {
  quiet: {
    name: "Quiet Room",
    description: "For office or home",
    settings: {
      silenceThreshold: -65,
      silenceTimeout: 600,
      smoothingTimeConstant: 0.6,
    },
  },
  moderate: {
    name: "Coffee Shop",
    description: "For cafes or restaurants",
    settings: {
      silenceThreshold: -58,
      silenceTimeout: 800,
      smoothingTimeConstant: 0.7,
    },
  },
  noisy: {
    name: "Street",
    description: "For outdoor or noisy places",
    settings: {
      silenceThreshold: -50,
      silenceTimeout: 1000,
      smoothingTimeConstant: 0.8,
    },
  },
} as const;

export const defaultVoiceSettings = environmentPresets.quiet.settings;

export function VoiceSettings({ onSettingsChange, currentSettings }: VoiceSettingsProps) {
  const [currentMode, setCurrentMode] = React.useState(() => {
    const mode = Object.entries(environmentPresets).find(
      ([_, preset]) => 
        preset.settings.silenceThreshold === currentSettings.silenceThreshold &&
        preset.settings.silenceTimeout === currentSettings.silenceTimeout &&
        preset.settings.smoothingTimeConstant === currentSettings.smoothingTimeConstant
    );
    return mode ? mode[1].name : environmentPresets.quiet.name;
  });

  const handlePresetClick = (preset: typeof environmentPresets[keyof typeof environmentPresets]) => {
    onSettingsChange(preset.settings);
    setCurrentMode(preset.name);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="fixed top-6 right-6 h-auto p-0 "
        >
          <div className="text-[9px] font-medium tracking-[0.2em] uppercase text-neutral-400">
            {currentMode}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-[250px] bg-white backdrop-blur-sm border-none shadow-none rounded-xl"
      >
        {Object.entries(environmentPresets).map(([key, preset]) => (
          <DropdownMenuItem
            key={key}
            className={cn(
              "flex flex-col items-start py-3 cursor-pointer",
              "transition-colors rounded-lg mx-1",
              "first:mt-1 last:mb-1"
            )}
            onClick={() => handlePresetClick(preset)}
          >
            <div className="text-[12px] font-medium tracking-[0.2em] uppercase text-neutral-900">
              {preset.name}
            </div>
            <div className="text-[10px] tracking-[0.1em] uppercase text-neutral-400 mt-1">
              {preset.description}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 