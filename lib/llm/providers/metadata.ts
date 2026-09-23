import React from "react";
import {
  Brain,
  Sparkles,
  Globe,
  Zap,
  Cpu,
  GitBranch,
  Layers,
  Hexagon,
  Triangle,
  Circle,
  Box,
  Square,
  Star,
  Command,
  Hash,
  Terminal,
} from "lucide-react";

export const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  anthropic: Brain,
  openai: Sparkles,
  google: Globe,
  deepseek: Zap,
  mistral: Cpu,
  openrouter: GitBranch,
  groq: Layers,
  zai: Hexagon,
  minimax: Triangle,
  cerebras: Circle,
  ai21: Box,
  cohere: Square,
  stability: Star,
  fireworks: Command,
  together: Hash,
  replicate: Terminal,
  github: Layers,
  vercel: Triangle,
  chutes: Layers,
};

export function getProviderIcon(providerId: string): React.ComponentType<{ className?: string }> {
  return PROVIDER_ICONS[providerId] || Globe;
}

export const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  anthropic: "Direct access to Claude models, including Pro and Max",
  openai: "GPT models for fast, capable general AI tasks",
  google: "Gemini models for fast, structured responses",
  deepseek: "Advanced reasoning models at competitive pricing",
  mistral: "European AI models with excellent performance",
  openrouter: "Access all supported models from one provider",
  groq: "Ultra-fast inference for popular open source models",
  zai: "Curated models including Claude, GPT, Gemini and more",
  minimax: "Multilingual models optimized for long context",
  cerebras: "High-performance inference with CS-3 systems",
  ai21: "Jamba models for enterprise applications",
  cohere: "Command models for natural language tasks",
  stability: "Image generation and creative AI models",
  fireworks: "Fast inference for open source models",
  together: "Inference platform for open source LLMs",
  replicate: "API for running machine learning models",
  github: "AI models for coding assistance via GitHub Copilot",
  vercel: "Unified access to AI models with smart routing",
  chutes: "Decentralized AI inference at competitive prices",
};

export function getProviderDescription(providerId: string): string {
  return PROVIDER_DESCRIPTIONS[providerId] || `AI models via ${providerId}`;
}

export const POPULAR_PROVIDER_IDS = [
  "zai",
  "anthropic",
  "github",
  "openai",
  "google",
  "openrouter",
  "vercel",
];
