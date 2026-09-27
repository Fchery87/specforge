"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Shield, 
  Flag, 
  ArrowLeft,
  FileText,
  Search,
  Check,
  CheckCircle,
  X,
  XCircle,
  AlertTriangle,
  Eye,
  Ban,
  RefreshCw,
  Filter,
  Gavel
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ModerationPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [selectedArtifact, setSelectedArtifact] = useState<Doc<'artifacts'> | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  
  // Get all artifacts for moderation
  const artifacts = useQuery(
    api.admin.listAllProjects,
    isLoaded && isSignedIn ? { limit: 100 } : "skip"
  );

  // Show loading while Clerk auth is initializing
  if (!isLoaded) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  // Show message if not signed in
  if (!isSignedIn) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Please sign in to access content moderation</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (artifacts === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading content...</span>
        </div>
      </main>
    );
  }

  return (
    <main>
      {/* Hero Header */}
      <section className="page-header">
        <div className="page-container">
          <span className="text-label text-dim">Admin Console</span>
          <h1 className="mt-2 text-heading font-medium text-ink">Content Moderation</h1>
          <p className="mt-3 max-w-xl text-body leading-relaxed text-muted-foreground">Review and moderate user-generated content, artifacts, and templates.</p>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="page-section page-container border-t border-line">
        <div className="grid gap-4 md:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Total Artifacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">0</p>
              <p className="text-caption text-muted-foreground mt-2">Generated documents</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Flagged Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold text-warning">0</p>
              <p className="text-caption text-muted-foreground mt-2">Requires review</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">0</p>
              <p className="text-caption text-muted-foreground mt-2">Constitution templates</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Banned Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold text-destructive">0</p>
              <p className="text-caption text-muted-foreground mt-2">Removed content</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Tabs */}
      <section className="page-section page-container border-t border-line">
        <Tabs defaultValue="artifacts" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="filters">Content Filters</TabsTrigger>
          </TabsList>

          <TabsContent value="artifacts">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-title font-bold">
                    Generated Artifacts
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    Review user-generated specifications and documents
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="size-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            <Card variant="default" className="p-12 text-center">
              <FileText className="size-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-title font-medium mb-2">Artifact Moderation</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                This feature is coming soon. You'll be able to review all generated artifacts, 
                flag inappropriate content, and moderate user-generated specifications.
              </p>
              <Badge variant="outline">Coming Soon</Badge>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <div className="mb-8">
              <h2 className="text-title font-bold">
                Constitution Templates
              </h2>
              <p className="text-muted-foreground mt-2">
                Review and moderate reusable constitution templates
              </p>
            </div>

            <Card variant="default" className="p-12 text-center">
              <Shield className="size-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-title font-medium mb-2">Template Moderation</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                This feature is coming soon. You'll be able to review user-created constitution 
                templates, approve public templates, and remove inappropriate content.
              </p>
              <Badge variant="outline">Coming Soon</Badge>
            </Card>
          </TabsContent>

          <TabsContent value="filters">
            <div className="mb-8">
              <h2 className="text-title font-bold">
                Content Filters
              </h2>
              <p className="text-muted-foreground mt-2">
                Configure banned words and automatic content filtering
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card variant="default">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Ban className="size-5 text-destructive" />
                    <CardTitle>Banned Words</CardTitle>
                  </div>
                  <CardDescription>
                    Words and phrases that will be automatically flagged
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-8 bg-raised/50 rounded-lg text-center">
                    <p className="text-muted-foreground">
                      Content filtering configuration coming soon
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card variant="default">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Gavel className="size-5 text-warning" />
                    <CardTitle>Moderation Rules</CardTitle>
                  </div>
                  <CardDescription>
                    Automated moderation policies and thresholds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-raised/30 rounded-lg">
                    <span className="text-ui">Auto-flag profanity</span>
                    <Badge>Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-raised/30 rounded-lg">
                    <span className="text-ui">Auto-flag spam patterns</span>
                    <Badge>Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-raised/30 rounded-lg">
                    <span className="text-ui">Manual review required</span>
                    <Badge variant="outline">Disabled</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Guidelines Section */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8">
          <h2 className="text-title font-bold">
            Moderation Guidelines
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle className="size-5 text-success" />
                </div>
                <CardTitle>Allowed Content</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-ui text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                  Software specifications
                </li>
                <li className="flex items-start gap-2">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                  Technical documentation
                </li>
                <li className="flex items-start gap-2">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                  Code and architecture plans
                </li>
                <li className="flex items-start gap-2">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                  Project requirements
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <XCircle className="size-5 text-destructive" />
                </div>
                <CardTitle>Prohibited Content</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-ui text-muted-foreground">
                <li className="flex items-start gap-2">
                  <X aria-hidden className="mt-1 size-4 shrink-0 text-destructive" />
                  Hate speech or harassment
                </li>
                <li className="flex items-start gap-2">
                  <X aria-hidden className="mt-1 size-4 shrink-0 text-destructive" />
                  Spam or advertising
                </li>
                <li className="flex items-start gap-2">
                  <X aria-hidden className="mt-1 size-4 shrink-0 text-destructive" />
                  Malicious code or exploits
                </li>
                <li className="flex items-start gap-2">
                  <X aria-hidden className="mt-1 size-4 shrink-0 text-destructive" />
                  Inappropriate or offensive material
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <AlertTriangle className="size-5 text-info" />
                </div>
                <CardTitle>Report Process</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-ui text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-info">1.</span>
                  Content is flagged or reported
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-info">2.</span>
                  Admin reviews within 24 hours
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-info">3.</span>
                  Decision: Approve, Edit, or Remove
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-info">4.</span>
                  Appeal process available
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

    </main>
  );
}