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
  'user_suspended': 'bg-brick/10 text-brick border-brick',
  'project_deleted': 'bg-amber/10 text-amber border-amber',
  'projects_bulk_deleted': 'bg-amber/10 text-amber border-amber',
  'credential_updated': 'bg-slate/10 text-slate border-slate',
  'feature_flag_updated': 'bg-slate/10 text-slate border-slate',
  'system_config_updated': 'bg-sage/10 text-sage border-sage',
};

const TARGET_ICONS: Record<string, React.ReactNode> = {
  'user': <User className="size-4" />,
  'project': <FolderOpen className="size-4" />,
  'credential': <Key className="size-4" />,
  'system': <Settings className="size-4" />,
  'model': <FileText className="size-4" />,
};

export default function SecurityPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [targetFilter, setTargetFilter] = useState<'user' | 'project' | 'credential' | 'system' | 'model' | null>(null);

  // Get audit logs
  const auditLogs = useQuery(
    api.admin.getAuditLogs,
    isLoaded && isSignedIn
      ? {
          limit: 100,
          action: actionFilter || undefined,
          targetType: targetFilter || undefined,
        }
      : "skip"
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
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
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
  const uniqueActions = [...new Set(auditLogs.map((log) => log.action))];

  return (
    <main>
      {/* Hero Header */}
      <section className="page-header">
        <div className="page-container">
          <span className="text-label text-dim">Admin Console</span>
          <h1 className="mt-2 text-heading font-medium text-ink">Security & Audit Logs</h1>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-muted-foreground">Monitor security events, audit trails, and administrative actions.</p>
        </div>
      </section>

      {/* Security Overview */}
      <section className="page-section page-container border-t border-line">
        <div className="grid gap-4 md:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{auditLogs.length}</p>
              <p className="text-caption text-muted-foreground mt-2">Logged actions</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                User Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">
                {auditLogs.filter((l) => l.targetType === 'user').length}
              </p>
              <p className="text-caption text-muted-foreground mt-2">User-related events</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Project Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">
                {auditLogs.filter((l) => l.targetType === 'project').length}
              </p>
              <p className="text-caption text-muted-foreground mt-2">Project-related events</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                System Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">
                {auditLogs.filter((l) => l.targetType === 'system').length}
              </p>
              <p className="text-caption text-muted-foreground mt-2">Configuration changes</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Filters */}
      <section className="page-section page-container border-t border-line">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-ui font-medium">Filters:</span>
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

          <Select value={targetFilter || 'all'} onValueChange={(v) => setTargetFilter(v === 'all' ? null : (v as 'user' | 'project' | 'credential' | 'system' | 'model'))}>
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
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
        </div>
      </section>

      {/* Audit Log Table */}
      <section className="page-section page-container">
        <Card variant="default">
          <CardContent className="p-0">
            <div className="divide-y divide-line">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-raised/30 text-ui font-medium text-muted-foreground">
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Actor</div>
                <div className="col-span-2">Action</div>
                <div className="col-span-2">Target</div>
                <div className="col-span-4">Details</div>
              </div>

              {/* Log Rows */}
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div 
                    key={log.id}
                    className="grid grid-cols-12 gap-4 p-4 items-start hover:bg-raised/20 transition-colors"
                  >
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-muted-foreground" />
                        <span className="text-ui">{formatTime(log.createdAt)}</span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <User className="size-4 text-muted-foreground" />
                        <span className="font-mono text-ui truncate" title={log.actorId}>
                          {log.actorId.slice(0, 12)}...
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "capitalize text-caption",
                          ACTION_COLORS[log.action] || 'bg-raised text-muted-foreground'
                        )}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        {TARGET_ICONS[log.targetType] || <FileText className="size-4" />}
                        <Badge variant="secondary" className="capitalize text-caption">
                          {log.targetType}
                        </Badge>
                      </div>
                    </div>

                    <div className="col-span-4">
                      <p className="text-ui text-muted-foreground break-all">
                        {log.targetId ? (
                          <span className="font-mono">{log.targetId.slice(0, 20)}...</span>
                        ) : (
                          <span>System</span>
                        )}
                      </p>
                      {log.details && (
                        <p className="text-caption text-muted-foreground mt-1">
                          {log.details.length > 100 ? log.details.slice(0, 100) + '...' : log.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <Shield className="size-12 mx-auto mb-4 opacity-30" />
                  <h3 className="text-title font-medium mb-2">No Audit Logs</h3>
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
      <section className="page-section page-container border-t border-line">
        <div className="mb-8">
          <h2 className="text-title font-bold">
            Security Guidelines
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-sage/10 flex items-center justify-center">
                  <CheckCircle className="size-5 text-sage" />
                </div>
                <CardTitle>Best Practices</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-ui text-muted-foreground">
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
                <div className="size-10 rounded-lg bg-amber/10 flex items-center justify-center">
                  <AlertCircle className="size-5 text-amber" />
                </div>
                <CardTitle>Warning Signs</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-ui text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-amber">•</span>
                  Multiple failed auth attempts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber">•</span>
                  Unusual API usage patterns
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber">•</span>
                  Bulk deletions or modifications
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-slate/10 flex items-center justify-center">
                  <Key className="size-5 text-slate" />
                </div>
                <CardTitle>Compliance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-ui text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-slate">•</span>
                  All actions are logged and immutable
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate">•</span>
                  Export logs for compliance audits
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate">•</span>
                  GDPR data export available
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

    </main>
  );
}