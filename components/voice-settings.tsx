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
  onOpenChange?: (open: boolean) => void;
}

export interface VoiceSettings {
  silenceThreshold: number;
  silenceTimeout: number;
  smoothingTimeConstant: number;
}

export const environmentPresets = {
  quiet: {
    name: "Hotel Mode",
    description: "For quiet indoor spaces like hotels and museums",
    settings: {
      silenceThreshold: -65,
      silenceTimeout: 400,
      smoothingTimeConstant: 0.3,
    },
  },
  moderate: {
    name: "Cafe Mode",
    description: "For moderately noisy places like cafes and restaurants",
    settings: {
      silenceThreshold: -58,
      silenceTimeout: 600,
      smoothingTimeConstant: 0.4,
    },
  },
  noisy: {
    name: "Crowd Mode",
    description: "For high noise areas with loud conversations and ambient sounds",
    settings: {
      silenceThreshold: -50,
      silenceTimeout: 600,
      smoothingTimeConstant: 0.5,
    },
  },
} as const;

export const defaultVoiceSettings = environmentPresets.moderate.settings;

export function VoiceSettings({ onSettingsChange, currentSettings, onOpenChange }: VoiceSettingsProps) {
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
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto p-0"
        >
          <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-900 font-light">
            {currentMode}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-[280px] border-none pl-0 rounded-xl bg-white/80 backdrop-blur-sm"
        sideOffset={8}
      >
        {Object.entries(environmentPresets).map(([key, preset]) => (
          <DropdownMenuItem
            key={key}
            className={cn(
              "flex flex-col items-start py-3 cursor-pointer",
              "transition-colors rounded-lg mx-1",
              "first:mt-1 last:mb-1 hover:bg-neutral-100"
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