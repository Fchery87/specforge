"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Shield, 
  Users, 
  ArrowLeft,
  Search,
  User,
  FolderOpen,
  FileText,
  Clock,
  MoreHorizontal,
  Ban,
  Eye,
  Activity,
  ChevronDown,
  ChevronUp,
  Key
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserStats {
  userId: string;
  configs: Array<{
    provider: string;
    defaultModel: string;
    useSystem: boolean;
  }>;
  projectCount: number;
  artifactCount: number;
  lastActive: number | null;
}

export default function UserManagementPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  
  // Get all users
  const users = useQuery(
    api.admin.listAllUsers,
    isLoaded && isSignedIn ? { search: searchQuery || undefined, limit: 50 } : "skip"
  );

  // Get stats
  const stats = useQuery(
    api.admin.getSystemStats,
    isLoaded && isSignedIn ? {} : "skip"
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
          <p className="text-muted-foreground">Please sign in to access user management</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (users === undefined || stats === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading user data...</span>
        </div>
      </main>
    );
  }

  // Format relative time
  const formatRelativeTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  // Format date
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
              <Users className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Admin Console
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            User <span className="text-primary">Directory</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Manage user accounts, view activity, and monitor platform usage.
          </p>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="page-section page-container">
        <div className="grid gap-4 md:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                With LLM Config
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalUsersWithConfig}</p>
              <p className="text-xs text-muted-foreground mt-1">Active configurations</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalProjects}</p>
              <p className="text-xs text-muted-foreground mt-1">Across all users</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Artifacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalArtifacts}</p>
              <p className="text-xs text-muted-foreground mt-1">Generated documents</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Search Bar */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users by ID or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {users.length} users
          </p>
        </div>
      </section>

      {/* Users Table */}
      <section className="page-section page-container">
        <Card variant="default">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-secondary/30 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-4">User</div>
                <div className="col-span-2">Projects</div>
                <div className="col-span-2">Artifacts</div>
                <div className="col-span-2">Last Active</div>
                <div className="col-span-2">Actions</div>
              </div>

              {/* User Rows */}
              {users.length > 0 ? (
                users.map((user: UserStats) => (
                  <div key={user.userId}>
                    <div 
                      className={cn(
                        "grid grid-cols-12 gap-4 p-4 items-center transition-colors hover:bg-secondary/20 cursor-pointer",
                        expandedUser === user.userId && "bg-secondary/20"
                      )}
                      onClick={() => setExpandedUser(expandedUser === user.userId ? null : user.userId)}
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate font-mono text-sm">
                            {user.userId.slice(0, 16)}...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.configs.length} LLM config{user.configs.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="col-span-2 flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{user.projectCount}</span>
                      </div>

                      <div className="col-span-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{user.artifactCount}</span>
                      </div>

                      <div className="col-span-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className={cn(
                          "text-sm",
                          !user.lastActive && "text-muted-foreground"
                        )}>
                          {formatRelativeTime(user.lastActive)}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setExpandedUser(user.userId);
                            }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Suspend User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedUser(expandedUser === user.userId ? null : user.userId);
                          }}
                        >
                          {expandedUser === user.userId ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedUser === user.userId && (
                      <div className="px-4 pb-4 bg-secondary/10">
                        <div className="pt-4 pl-14 grid gap-6 md:grid-cols-2">
                          {/* LLM Configurations */}
                          <div>
                            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                              <Key className="w-4 h-4" />
                              LLM Configurations
                            </h4>
                            <div className="space-y-2">
                              {user.configs.map((config, idx) => (
                                <div 
                                  key={idx}
                                  className="p-3 bg-background border border-border rounded-lg"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <Badge variant="outline" className="capitalize">
                                      {config.provider}
                                    </Badge>
                                    {config.useSystem && (
                                      <Badge variant="secondary" className="text-xs">
                                        System
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Model: {config.defaultModel}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Activity Summary */}
                          <div>
                            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                              <Activity className="w-4 h-4" />
                              Activity Summary
                            </h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-3 bg-background border border-border rounded-lg">
                                <span className="text-sm">Projects Created</span>
                                <span className="font-bold">{user.projectCount}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-background border border-border rounded-lg">
                                <span className="text-sm">Artifacts Generated</span>
                                <span className="font-bold">{user.artifactCount}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-background border border-border rounded-lg">
                                <span className="text-sm">Last Active</span>
                                <span className="font-medium text-sm">
                                  {formatDate(user.lastActive)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">No Users Found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {searchQuery 
                      ? "No users match your search criteria. Try a different query."
                      : "No users have registered yet. Users will appear here once they sign up."
                    }
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        USERS
      </div>
    </main>
  );
}