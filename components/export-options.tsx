"use client";

import { useState } from "react";
import { Download, FileCode, Bot, FileText, Archive, Loader2, Check, Clipboard } from "lucide-react";
import { formatForClaudeCode, formatForCursor } from "@/lib/export/clipboard-formats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { generateSkillMd, type SkillMdInput } from "@/lib/export/skill-formatter";
import { generateAgentsMd, type AgentsMdInput } from "@/lib/export/agents-formatter";

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: typeof FileText;
  format: "zip" | "skill" | "agents" | "markdown" | "clipboard-claude" | "clipboard-cursor";
  available: boolean;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "zip",
    label: "Project ZIP",
    description: "Complete project with all artifacts and documentation",
    icon: Archive,
    format: "zip",
    available: true,
  },
  {
    id: "skill",
    label: "Agent Skill (SKILL.md)",
    description: "For Claude Code, Cursor, and other AI agents",
    icon: Bot,
    format: "skill",
    available: true,
  },
  {
    id: "agents",
    label: "Agent Guide (AGENTS.md)",
    description: "Project context for AI development assistance",
    icon: FileCode,
    format: "agents",
    available: true,
  },
  {
    id: "copy-claude",
    label: "Copy for Claude Code",
    description: "Copy spec to clipboard for CLAUDE.md or agent context",
    icon: Clipboard,
    format: "clipboard-claude" as const,
    available: true,
  },
  {
    id: "copy-cursor",
    label: "Copy for Cursor",
    description: "Copy spec to clipboard for .cursorrules",
    icon: Clipboard,
    format: "clipboard-cursor" as const,
    available: true,
  },
  {
    id: "markdown",
    label: "Markdown Bundle",
    description: "All artifacts as markdown files",
    icon: FileText,
    format: "markdown",
    available: false, // Placeholder for future
  },
];

interface ExportOptionsPanelProps {
  project: {
    _id: string;
    title: string;
    description: string;
    createdAt: number;
    zipStorageId?: string;
  };
  artifacts: {
    brief?: string;
    constitution?: string;
    prd?: string;
    techSpec?: string;
    userStories?: string;
    handoff?: string;
  };
  onDownloadZip: () => void;
  isDownloadingZip: boolean;
}

export function ExportOptionsPanel({
  project,
  artifacts,
  onDownloadZip,
  isDownloadingZip,
}: ExportOptionsPanelProps) {
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  async function handleExport(option: ExportOption) {
    if (!option.available) {
      toast.info("Coming Soon", {
        description: `${option.label} export will be available in a future update.`,
      });
      return;
    }

    setExportingFormat(option.id);

    try {
      switch (option.format) {
        case "zip":
          await onDownloadZip();
          break;

        case "skill": {
          const skillContent = generateSkillMd({
            project: {
              _id: project._id,
              title: project.title,
              description: project.description,
              createdAt: project.createdAt,
            },
            artifacts,
          });
          downloadFile(
            skillContent,
            `${kebabCase(project.title)}-skill.md`,
            "text/markdown"
          );
          toast.success("SKILL.md Downloaded", {
            description: "Import this file into Claude Code, Cursor, or other AI agents.",
          });
          break;
        }

        case "agents": {
          const agentsContent = generateAgentsMd({
            project: {
              _id: project._id,
              title: project.title,
              description: project.description,
              createdAt: project.createdAt,
            },
            artifacts,
          });
          downloadFile(agentsContent, "AGENTS.md", "text/markdown");
          toast.success("AGENTS.md Downloaded", {
            description: "Place this file in your project root for AI context.",
          });
          break;
        }

        case "clipboard-claude": {
          const skillContent = generateSkillMd({
            project: {
              _id: project._id,
              title: project.title,
              description: project.description,
              createdAt: project.createdAt,
            },
            artifacts,
          });
          const formatted = formatForClaudeCode({ title: project.title, content: skillContent });
          await navigator.clipboard.writeText(formatted);
          toast.success("Copied to Clipboard", {
            description: "Paste into your CLAUDE.md or agent context.",
          });
          break;
        }

        case "clipboard-cursor": {
          const skillContent = generateSkillMd({
            project: {
              _id: project._id,
              title: project.title,
              description: project.description,
              createdAt: project.createdAt,
            },
            artifacts,
          });
          const formatted = formatForCursor({ title: project.title, content: skillContent });
          await navigator.clipboard.writeText(formatted);
          toast.success("Copied to Clipboard", {
            description: "Paste into your .cursorrules file.",
          });
          break;
        }

        case "markdown":
          // Placeholder
          break;
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export Failed", {
        description: "Please try again.",
      });
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Options
        </CardTitle>
        <CardDescription>
          Choose your preferred export format for this project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {EXPORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isExporting = exportingFormat === option.id;
          const isZipDownloading = option.format === "zip" && isDownloadingZip;
          const isLoading = isExporting || isZipDownloading;

          return (
            <Button
              key={option.id}
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4 text-left"
              onClick={() => handleExport(option)}
              disabled={isLoading}
            >
              <div className="flex items-start gap-4 w-full">
                <div className="mt-1">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {option.label}
                    {!option.available && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        Soon
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {option.description}
                  </div>
                </div>
                {option.available && !isLoading && (
                  <Check className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </div>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Downloads content as a file
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Converts a string to kebab-case
 */
function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}
