"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
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
  CheckCircle,
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
  const [selectedArtifact, setSelectedArtifact] = useState<any>(null);
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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading content...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="relative">
      {/* Hero Header */}
      <section className="page-header relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-fade opacity-20" />
        <div className="page-container relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Flag className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Admin Console
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            Content <span className="text-primary">Moderation</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Review and moderate user-generated content, artifacts, and templates.
          </p>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="grid gap-4 md:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Artifacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-2">Generated documents</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Flagged Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-500">0</p>
              <p className="text-xs text-muted-foreground mt-2">Requires review</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-2">Constitution templates</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Banned Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-500">0</p>
              <p className="text-xs text-muted-foreground mt-2">Removed content</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Tabs */}
      <section className="page-section page-container border-t-2 border-border">
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
                  <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
                    Generated Artifacts
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    Review user-generated specifications and documents
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            <Card variant="default" className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">Artifact Moderation</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                This feature is coming soon. You'll be able to review all generated artifacts, 
                flag inappropriate content, and moderate user-generated specifications.
              </p>
              <Badge variant="outline">Coming Soon</Badge>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <div className="mb-8">
              <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
                Constitution Templates
              </h2>
              <p className="text-muted-foreground mt-2">
                Review and moderate reusable constitution templates
              </p>
            </div>

            <Card variant="default" className="p-12 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">Template Moderation</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                This feature is coming soon. You'll be able to review user-created constitution 
                templates, approve public templates, and remove inappropriate content.
              </p>
              <Badge variant="outline">Coming Soon</Badge>
            </Card>
          </TabsContent>

          <TabsContent value="filters">
            <div className="mb-8">
              <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
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
                    <Ban className="w-5 h-5 text-red-500" />
                    <CardTitle>Banned Words</CardTitle>
                  </div>
                  <CardDescription>
                    Words and phrases that will be automatically flagged
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-8 bg-muted/50 rounded-lg text-center">
                    <p className="text-muted-foreground">
                      Content filtering configuration coming soon
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card variant="default">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Gavel className="w-5 h-5 text-yellow-500" />
                    <CardTitle>Moderation Rules</CardTitle>
                  </div>
                  <CardDescription>
                    Automated moderation policies and thresholds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <span className="text-sm">Auto-flag profanity</span>
                    <Badge>Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <span className="text-sm">Auto-flag spam patterns</span>
                    <Badge>Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <span className="text-sm">Manual review required</span>
                    <Badge variant="outline">Disabled</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Guidelines Section */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Moderation Guidelines
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <CardTitle>Allowed Content</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Software specifications
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Technical documentation
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Code and architecture plans
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Project requirements
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <CardTitle>Prohibited Content</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-red-500">✗</span>
                  Hate speech or harassment
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">✗</span>
                  Spam or advertising
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">✗</span>
                  Malicious code or exploits
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">✗</span>
                  Inappropriate or offensive material
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-blue-500" />
                </div>
                <CardTitle>Report Process</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">1.</span>
                  Content is flagged or reported
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">2.</span>
                  Admin reviews within 24 hours
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">3.</span>
                  Decision: Approve, Edit, or Remove
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">4.</span>
                  Appeal process available
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        MODERATION
      </div>
    </main>
  );
}