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
  Lock, 
  ArrowLeft,
  FileText,
  User,
  FolderOpen,
  Key,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_COLORS: Record<string, string> = {
  'user_suspended': 'bg-red-500/10 text-red-500 border-red-500',
  'project_deleted': 'bg-orange-500/10 text-orange-500 border-orange-500',
  'projects_bulk_deleted': 'bg-orange-500/10 text-orange-500 border-orange-500',
  'credential_updated': 'bg-blue-500/10 text-blue-500 border-blue-500',
  'feature_flag_updated': 'bg-purple-500/10 text-purple-500 border-purple-500',
  'system_config_updated': 'bg-green-500/10 text-green-500 border-green-500',
};

const TARGET_ICONS: Record<string, React.ReactNode> = {
  'user': <User className="w-4 h-4" />,
  'project': <FolderOpen className="w-4 h-4" />,
  'credential': <Key className="w-4 h-4" />,
  'system': <Settings className="w-4 h-4" />,
  'model': <FileText className="w-4 h-4" />,
};

export default function SecurityPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [targetFilter, setTargetFilter] = useState<string | null>(null);
  
  // Get audit logs
  const auditLogs = useQuery(
    api.admin.getAuditLogs,
    isLoaded && isSignedIn 
      ? { 
          limit: 100,
          action: actionFilter || undefined,
          targetType: targetFilter as any || undefined,
        } 
      : "skip"
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
          <p className="text-muted-foreground">Please sign in to access security logs</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (auditLogs === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading security data...</span>
        </div>
      </main>
    );
  }

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Get unique actions for filter
  const uniqueActions = [...new Set(auditLogs.map((log: any) => log.action))];

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
              <Lock className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Admin Console
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            Security <span className="text-primary">& Audit Logs</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Monitor security events, audit trails, and administrative actions.
          </p>
        </div>
      </section>

      {/* Security Overview */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="grid gap-4 md:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{auditLogs.length}</p>
              <p className="text-xs text-muted-foreground mt-2">Logged actions</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                User Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {auditLogs.filter((l: any) => l.targetType === 'user').length}
              </p>
              <p className="text-xs text-muted-foreground mt-2">User-related events</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Project Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {auditLogs.filter((l: any) => l.targetType === 'project').length}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Project-related events</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                System Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {auditLogs.filter((l: any) => l.targetType === 'system').length}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Configuration changes</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Filters */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <Select value={actionFilter || 'all'} onValueChange={(v) => setActionFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={targetFilter || 'all'} onValueChange={(v) => setTargetFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Targets</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="credential">Credential</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="model">Model</SelectItem>
            </SelectContent>
          </Select>

          {(actionFilter || targetFilter) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setActionFilter(null);
                setTargetFilter(null);
              }}
            >
              Clear Filters
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            className="ml-auto"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </section>

      {/* Audit Log Table */}
      <section className="page-section page-container">
        <Card variant="default">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-secondary/30 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Actor</div>
                <div className="col-span-2">Action</div>
                <div className="col-span-2">Target</div>
                <div className="col-span-4">Details</div>
              </div>

              {/* Log Rows */}
              {auditLogs.length > 0 ? (
                auditLogs.map((log: any) => (
                  <div 
                    key={log.id}
                    className="grid grid-cols-12 gap-4 p-4 items-start hover:bg-secondary/20 transition-colors"
                  >
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{formatTime(log.createdAt)}</span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm truncate" title={log.actorId}>
                          {log.actorId.slice(0, 12)}...
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "capitalize text-xs",
                          ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground'
                        )}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        {TARGET_ICONS[log.targetType] || <FileText className="w-4 h-4" />}
                        <Badge variant="secondary" className="capitalize text-xs">
                          {log.targetType}
                        </Badge>
                      </div>
                    </div>

                    <div className="col-span-4">
                      <p className="text-sm text-muted-foreground break-all">
                        {log.targetId ? (
                          <span className="font-mono">{log.targetId.slice(0, 20)}...</span>
                        ) : (
                          <span>System</span>
                        )}
                      </p>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.details.length > 100 ? log.details.slice(0, 100) + '...' : log.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">No Audit Logs</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {actionFilter || targetFilter
                      ? "No logs match your current filters. Try adjusting your search criteria."
                      : "No audit events have been logged yet. Actions will appear here when admins perform operations."
                    }
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Security Tips */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Security Guidelines
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <CardTitle>Best Practices</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Review audit logs regularly
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Rotate API keys periodically
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Monitor for suspicious activity
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                </div>
                <CardTitle>Warning Signs</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  Multiple failed auth attempts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  Unusual API usage patterns
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  Bulk deletions or modifications
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Key className="w-5 h-5 text-blue-500" />
                </div>
                <CardTitle>Compliance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  All actions are logged and immutable
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  Export logs for compliance audits
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  GDPR data export available
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        SECURITY
      </div>
    </main>
  );
}