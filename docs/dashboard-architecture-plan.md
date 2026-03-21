# SpecForge Dashboard Enhancement - Architectural Implementation Plan

## Executive Summary

This plan details the architecture for transforming the SpecForge user dashboard from a static project list into an intelligent, real-time command center. The implementation leverages existing Convex infrastructure while adding strategic capabilities for search, analytics, and real-time collaboration.

**Key Principles:**
- Build on existing data models (projects, phases, artifacts, generationTasks)
- Leverage Convex's reactive queries for real-time features
- Progressive enhancement: Quick wins first, advanced features later
- Performance-first: Cache expensive aggregations, use pagination

---

## 1. Architecture Overview

### 1.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Dashboard                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │   Personal   │ │   Pinned     │ │    Activity Feed         │ │
│  │   Analytics  │ │   Projects   │ │    (Real-time)           │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Search & Filter Bar                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Project Grid with Progress                    │ │
│  │         ┌─────────┐  ┌─────────┐  ┌─────────┐             │ │
│  │         │Project 1│  │Project 2│  │Project 3│             │ │
│  │         │[████░░] │  │[██████] │  │[░░░░░░] │             │ │
│  │         └─────────┘  └─────────┘  └─────────┘             │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Templates & Quick Start                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Convex Backend Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌────────────────────────────┐ │
│  │   Queries   │ │  Mutations  │ │    Scheduled Functions     │ │
│  │  • getStats │ │  • pinProj  │ │  • updateUserAnalytics     │ │
│  │  • search   │ │  • addTag   │ │  • cleanupOldNotifications │ │
│  │  • activity │ │  • markRead │ │  • computeProjectMetrics   │ │
│  └─────────────┘ └─────────────┘ └────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Database Schema                         │ │
│  │  ┌─────────┐ ┌─────────────┐ ┌─────────────────────────┐  │ │
│  │  │ projects│ │userAnalytics│ │    notifications        │  │ │
│  │  │ phases  │ │ userPrefs   │ │    projectMetrics       │  │ │
│  │  │artifacts│ │   tags      │ │                         │  │ │
│  │  └─────────┘ └─────────────┘ └─────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Convex (serverless functions + database)
- **State Management**: Convex reactive queries + React hooks
- **Search**: Fuse.js (client-side) or Algolia (production scale)
- **Charts**: Recharts or Tremor (for analytics visualizations)
- **Real-time**: Convex subscriptions (built-in)
- **Icons**: Lucide React

---

## 2. Data Model Extensions

### 2.1 Schema Additions (convex/schema.ts)

```typescript
// 1. User Preferences & Settings
userPreferences: defineTable({
  userId: v.string(),
  pinnedProjectIds: v.array(v.id('projects')),
  dashboardLayout: v.optional(v.object({
    showAnalytics: v.boolean(),
    showActivityFeed: v.boolean(),
    defaultSort: v.union(
      v.literal('updatedAt'),
      v.literal('createdAt'),
      v.literal('title'),
      v.literal('progress')
    ),
    defaultFilter: v.optional(v.string()),
  })),
  theme: v.optional(v.union(v.literal('light'), v.literal('dark'), v.literal('system'))),
  emailNotifications: v.optional(v.object({
    generationComplete: v.boolean(),
    driftDetected: v.boolean(),
    weeklyDigest: v.boolean(),
  })),
  updatedAt: v.number(),
}).index('by_user', ['userId']),

// 2. Aggregated User Analytics (updated by scheduled job)
userAnalytics: defineTable({
  userId: v.string(),
  period: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
  periodStart: v.number(),
  tokensUsed: v.number(),
  estimatedCost: v.number(), // in USD
  specsGenerated: v.number(),
  phasesCompleted: v.number(),
  successRate: v.number(), // 0-100
  timeSavedMinutes: v.number(), // calculated metric
  lastUpdatedAt: v.number(),
}).index('by_user_period', ['userId', 'period', 'periodStart']),

// 3. Notification System
notifications: defineTable({
  userId: v.string(),
  type: v.union(
    v.literal('generation_complete'),
    v.literal('generation_failed'),
    v.literal('drift_detected'),
    v.literal('phase_stale'),
    v.literal('verification_complete'),
    v.literal('system_announcement')
  ),
  title: v.string(),
  message: v.string(),
  metadata: v.optional(v.object({
    projectId: v.optional(v.id('projects')),
    phaseId: v.optional(v.string()),
    artifactId: v.optional(v.id('artifacts')),
    actionUrl: v.optional(v.string()),
  })),
  read: v.boolean(),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
}).index('by_user', ['userId'])
  .index('by_user_read', ['userId', 'read'])
  .index('by_created', ['createdAt']),

// 4. Project Tags for Filtering
projectTags: defineTable({
  projectId: v.id('projects'),
  tag: v.string(), // e.g., "mobile", "api", "urgent"
  createdAt: v.number(),
}).index('by_project', ['projectId'])
  .index('by_tag', ['tag']),

// 5. Computed Project Metrics (cached for performance)
projectMetrics: defineTable({
  projectId: v.id('projects'),
  // Progress tracking
  totalPhases: v.number(),
  completedPhases: v.number(),
  completionPercentage: v.number(),
  currentPhaseId: v.optional(v.string()),
  
  // Health indicators
  healthScore: v.number(), // 0-100
  stalenessFlags: v.array(v.object({
    phaseId: v.string(),
    isStale: v.boolean(),
    reason: v.optional(v.string()),
  })),
  verificationStatus: v.union(
    v.literal('passed'),
    v.literal('failed'),
    v.literal('warning'),
    v.literal('not_checked')
  ),
  
  // Activity tracking
  lastActivityAt: v.number(),
  lastActivityType: v.optional(v.string()),
  
  // Analytics
  totalTokensUsed: v.number(),
  estimatedCost: v.number(),
  generationCount: v.number(),
  
  updatedAt: v.number(),
}).index('by_project', ['projectId'])
  .index('by_user_activity', ['projectId', 'lastActivityAt']), // For sorting

// 6. Dashboard Activity Feed (user-specific)
dashboardActivity: defineTable({
  userId: v.string(),
  projectId: v.id('projects'),
  phaseId: v.optional(v.string()),
  artifactId: v.optional(v.id('artifacts')),
  type: v.union(
    v.literal('project_created'),
    v.literal('phase_started'),
    v.literal('phase_completed'),
    v.literal('generation_started'),
    v.literal('generation_completed'),
    v.literal('generation_failed'),
    v.literal('drift_detected'),
    v.literal('verification_complete'),
    v.literal('project_updated')
  ),
  message: v.string(),
  metadata: v.optional(v.object({
    phaseName: v.optional(v.string()),
    artifactType: v.optional(v.string()),
    success: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
  })),
  createdAt: v.number(),
}).index('by_user', ['userId'])
  .index('by_user_created', ['userId', 'createdAt']),
```

### 2.2 Index Strategy

| Index | Purpose | Query Pattern |
|-------|---------|---------------|
| `userPreferences.by_user` | Fast lookup of user settings | `userPreferences.get(userId)` |
| `userAnalytics.by_user_period` | Time-series analytics queries | Filter by user + date range |
| `notifications.by_user_read` | Unread count badge | Count where `read = false` |
| `projectMetrics.by_user_activity` | Sort projects by recent activity | Sort by `lastActivityAt DESC` |
| `dashboardActivity.by_user_created` | Activity feed pagination | Cursor-based pagination |

---

## 3. API Layer Specification

### 3.1 New Query Functions (convex/userDashboard.ts)

```typescript
// Get user's dashboard statistics
export const getUserStats = query({
  args: {
    period: v.union(v.literal('7d'), v.literal('30d'), v.literal('90d')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    // Get pre-computed analytics
    const analytics = await ctx.db
      .query('userAnalytics')
      .withIndex('by_user_period', (q) => 
        q.eq('userId', identity.subject)
      )
      .filter((q) => q.gte(q.field('periodStart'), getPeriodStart(args.period)))
      .collect();
    
    // Aggregate totals
    const totals = analytics.reduce((acc, curr) => ({
      tokensUsed: acc.tokensUsed + curr.tokensUsed,
      estimatedCost: acc.estimatedCost + curr.estimatedCost,
      specsGenerated: acc.specsGenerated + curr.specsGenerated,
      phasesCompleted: acc.phasesCompleted + curr.phasesCompleted,
    }), { tokensUsed: 0, estimatedCost: 0, specsGenerated: 0, phasesCompleted: 0 });
    
    // Calculate weighted success rate
    const totalAttempts = analytics.reduce((sum, a) => sum + a.specsGenerated, 0);
    const weightedSuccessRate = totalAttempts > 0
      ? analytics.reduce((sum, a) => sum + (a.successRate * a.specsGenerated), 0) / totalAttempts
      : 0;
    
    return {
      ...totals,
      successRate: Math.round(weightedSuccessRate),
      timeSavedMinutes: totals.specsGenerated * 45, // Assume 45 min saved per spec
    };
  },
});

// Get paginated activity feed
export const getActivityFeed = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    const limit = args.limit ?? 20;
    
    let query = ctx.db
      .query('dashboardActivity')
      .withIndex('by_user_created', (q) => 
        q.eq('userId', identity.subject)
      )
      .order('desc');
    
    if (args.cursor) {
      query = query.startingAfter(args.cursor as unknown as DocumentByName<...>);
    }
    
    const activities = await query.take(limit);
    
    return {
      activities,
      nextCursor: activities.length === limit ? activities[activities.length - 1]._id : null,
    };
  },
});

// Search projects with filters
export const searchProjects = query({
  args: {
    query: v.optional(v.string()),
    status: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    dateRange: v.optional(v.object({
      from: v.number(),
      to: v.number(),
    })),
    sortBy: v.optional(v.union(
      v.literal('updatedAt'),
      v.literal('createdAt'),
      v.literal('title'),
      v.literal('lastActivity')
    )),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    // Base query: user's projects
    let projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect();
    
    // Apply text filter (client-side for now, use Fuse.js on frontend)
    if (args.status?.length) {
      projects = projects.filter(p => args.status!.includes(p.status));
    }
    
    if (args.dateRange) {
      projects = projects.filter(p => 
        p.updatedAt >= args.dateRange!.from && 
        p.updatedAt <= args.dateRange!.to
      );
    }
    
    // Tag filtering requires join
    if (args.tags?.length) {
      const projectIds = new Set(projects.map(p => p._id));
      const tags = await ctx.db
        .query('projectTags')
        .filter((q) => 
          q.and(
            q.eq(q.field('tag'), args.tags![0]),
            projectIds.has(q.field('projectId'))
          )
        )
        .collect();
      const taggedProjectIds = new Set(tags.map(t => t.projectId));
      projects = projects.filter(p => taggedProjectIds.has(p._id));
    }
    
    // Sort
    const sortKey = args.sortBy ?? 'updatedAt';
    projects.sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      return (b as any)[sortKey] - (a as any)[sortKey];
    });
    
    // Pagination
    const limit = args.limit ?? 20;
    const startIndex = args.cursor ? parseInt(args.cursor) : 0;
    const paginated = projects.slice(startIndex, startIndex + limit);
    
    // Enrich with metrics
    const enriched = await Promise.all(
      paginated.map(async (project) => {
        const metrics = await ctx.db
          .query('projectMetrics')
          .withIndex('by_project', (q) => q.eq('projectId', project._id))
          .unique();
        
        return {
          ...project,
          metrics: metrics ?? null,
        };
      })
    );
    
    return {
      projects: enriched,
      total: projects.length,
      nextCursor: startIndex + limit < projects.length ? String(startIndex + limit) : null,
    };
  },
});

// Get project with full progress details
export const getProjectWithProgress = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }
    
    const [phases, metrics, tags] = await Promise.all([
      ctx.db
        .query('phases')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .collect(),
      ctx.db
        .query('projectMetrics')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .unique(),
      ctx.db
        .query('projectTags')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .collect(),
    ]);
    
    return {
      project,
      phases,
      metrics,
      tags: tags.map(t => t.tag),
    };
  },
});
```

### 3.2 New Mutation Functions

```typescript
// convex/userPreferences.ts

export const pinProject = mutation({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    // Verify ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }
    
    let prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();
    
    if (!prefs) {
      prefs = await ctx.db.insert('userPreferences', {
        userId: identity.subject,
        pinnedProjectIds: [args.projectId],
        updatedAt: Date.now(),
      });
    } else {
      const current = prefs.pinnedProjectIds || [];
      if (current.length >= 5) {
        throw new Error('Maximum 5 pinned projects allowed');
      }
      if (!current.includes(args.projectId)) {
        await ctx.db.patch(prefs._id, {
          pinnedProjectIds: [...current, args.projectId],
          updatedAt: Date.now(),
        });
      }
    }
    
    return { success: true };
  },
});

export const unpinProject = mutation({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();
    
    if (prefs) {
      await ctx.db.patch(prefs._id, {
        pinnedProjectIds: prefs.pinnedProjectIds.filter(
          id => id !== args.projectId
        ),
        updatedAt: Date.now(),
      });
    }
    
    return { success: true };
  },
});

// convex/notifications.ts

export const markNotificationsAsRead = mutation({
  args: {
    notificationIds: v.optional(v.array(v.id('notifications'))),
    markAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    if (args.markAll) {
      const unread = await ctx.db
        .query('notifications')
        .withIndex('by_user_read', (q) => 
          q.eq('userId', identity.subject).eq('read', false)
        )
        .collect();
      
      await Promise.all(
        unread.map(n => 
          ctx.db.patch(n._id, { read: true, readAt: Date.now() })
        )
      );
    } else if (args.notificationIds) {
      for (const id of args.notificationIds) {
        const notification = await ctx.db.get(id);
        if (notification && notification.userId === identity.subject) {
          await ctx.db.patch(id, { read: true, readAt: Date.now() });
        }
      }
    }
    
    return { success: true };
  },
});
```

### 3.3 Scheduled Functions (Background Jobs)

```typescript
// convex/scheduledJobs.ts

// Update user analytics (runs hourly)
export const updateUserAnalytics = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    // Get all generation tasks from last hour
    const recentTasks = await ctx.db
      .query('generationTasks')
      .filter((q) => q.gte(q.field('updatedAt'), hourAgo))
      .collect();
    
    // Group by user
    const byUser = groupBy(recentTasks, t => {
      // Need to look up project to get userId
      return t.projectId; // Simplified - actual impl needs join
    });
    
    // Update analytics for each user
    for (const [userId, tasks] of Object.entries(byUser)) {
      const tokens = tasks.reduce((sum, t) => 
        sum + (t.tokensGenerated || 0), 0
      );
      
      const completed = tasks.filter(t => t.status === 'completed').length;
      const failed = tasks.filter(t => t.status === 'failed').length;
      
      await ctx.db.insert('userAnalytics', {
        userId,
        period: 'daily',
        periodStart: getStartOfHour(now),
        tokensUsed: tokens,
        estimatedCost: calculateCost(tokens),
        specsGenerated: completed,
        phasesCompleted: 0, // Track separately
        successRate: completed / (completed + failed) * 100,
        timeSavedMinutes: completed * 45,
        lastUpdatedAt: now,
      });
    }
  },
});

// Compute project metrics (runs every 15 minutes)
export const computeProjectMetrics = internalAction({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query('projects').collect();
    
    for (const project of projects) {
      const phases = await ctx.db
        .query('phases')
        .withIndex('by_project', (q) => q.eq('projectId', project._id))
        .collect();
      
      const completed = phases.filter(p => p.status === 'ready').length;
      const total = phases.length;
      
      // Check staleness
      const staleFlags = phases
        .filter(p => p.isStale)
        .map(p => ({
          phaseId: p.phaseId,
          isStale: true,
          reason: p.staleReason || 'Upstream changes detected',
        }));
      
      // Get verification results
      const verification = await ctx.db
        .query('verificationResults')
        .withIndex('by_project', (q) => q.eq('projectId', project._id))
        .order('desc')
        .first();
      
      const existing = await ctx.db
        .query('projectMetrics')
        .withIndex('by_project', (q) => q.eq('projectId', project._id))
        .unique();
      
      const metrics = {
        totalPhases: total,
        completedPhases: completed,
        completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        currentPhaseId: phases.find(p => p.status === 'generating')?.phaseId,
        healthScore: calculateHealthScore(phases, verification),
        stalenessFlags: staleFlags,
        verificationStatus: verification?.status ?? 'not_checked',
        lastActivityAt: project.updatedAt,
        lastActivityType: getLastActivityType(phases),
        totalTokensUsed: 0, // Aggregate from generationTasks
        estimatedCost: 0,
        generationCount: phases.reduce((sum, p) => sum + (p.status === 'ready' ? 1 : 0), 0),
        updatedAt: Date.now(),
      };
      
      if (existing) {
        await ctx.db.patch(existing._id, metrics);
      } else {
        await ctx.db.insert('projectMetrics', {
          projectId: project._id,
          ...metrics,
        });
      }
    }
  },
});

// Schedule definitions
export const scheduleAnalyticsUpdate = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(60 * 60 * 1000, internal.scheduledJobs.updateUserAnalytics, {});
  },
});

export const scheduleMetricsCompute = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(15 * 60 * 1000, internal.scheduledJobs.computeProjectMetrics, {});
  },
});
```

---

## 4. Frontend Component Architecture

### 4.1 Dashboard Page Structure

```typescript
// app/(auth)/dashboard/page.tsx - Refactored

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { PersonalAnalytics } from '@/components/dashboard/personal-analytics';
import { PinnedProjects } from '@/components/dashboard/pinned-projects';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { DashboardSearch } from '@/components/dashboard/dashboard-search';
import { ProjectGrid } from '@/components/dashboard/project-grid';
import { TemplateGallery } from '@/components/dashboard/template-gallery';
import { NotificationBell } from '@/components/dashboard/notification-bell';

export default function DashboardPage() {
  return (
    <main className="relative">
      <DashboardHeader />
      
      {/* Analytics Overview */}
      <section className="page-section page-container">
        <PersonalAnalytics />
      </section>
      
      {/* Pinned Projects */}
      <section className="page-section page-container border-t-2 border-border">
        <PinnedProjects />
      </section>
      
      {/* Activity Feed */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ProjectGrid />
          </div>
          <div className="lg:col-span-1">
            <ActivityFeed />
          </div>
        </div>
      </section>
      
      {/* Templates */}
      <section className="page-section page-container border-t-2 border-border">
        <TemplateGallery />
      </section>
    </main>
  );
}
```

### 4.2 Key Component Specifications

#### PersonalAnalytics Component

```typescript
// components/dashboard/personal-analytics.tsx

'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, FileText, Clock, DollarSign } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, subtitle, trend, trendValue, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && trendValue && (
          <div className={`flex items-center text-xs mt-1 ${
            trend === 'up' ? 'text-green-500' : 
            trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PersonalAnalytics() {
  const stats = useQuery(api.userDashboard.getUserStats, { period: '30d' });
  
  if (stats === undefined) {
    return <PersonalAnalyticsSkeleton />;
  }
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Specs Generated"
        value={stats.specsGenerated}
        subtitle="Last 30 days"
        icon={<FileText className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Success Rate"
        value={`${stats.successRate}%`}
        subtitle="Generation success"
        trend={stats.successRate > 80 ? 'up' : 'neutral'}
        trendValue={stats.successRate > 80 ? 'Excellent' : 'Good'}
        icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Time Saved"
        value={`${Math.round(stats.timeSavedMinutes / 60)}h`}
        subtitle={`${stats.timeSavedMinutes} minutes total`}
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Est. Cost"
        value={`$${stats.estimatedCost.toFixed(2)}`}
        subtitle={`${stats.tokensUsed.toLocaleString()} tokens`}
        icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}
```

#### ProjectGrid with Progress

```typescript
// components/dashboard/project-grid.tsx

'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { DashboardSearch } from './dashboard-search';
import { ProjectCard } from './project-card';
import { FilterChips } from './filter-chips';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function ProjectGrid() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: [] as string[],
    tags: [] as string[],
    dateRange: null as { from: number; to: number } | null,
  });
  const [cursor, setCursor] = useState<string | null>(null);
  
  const result = useQuery(api.userDashboard.searchProjects, {
    query: searchQuery || undefined,
    status: filters.status.length > 0 ? filters.status : undefined,
    tags: filters.tags.length > 0 ? filters.tags : undefined,
    dateRange: filters.dateRange || undefined,
    sortBy: 'updatedAt',
    cursor: cursor || undefined,
    limit: 20,
  });
  
  const projects = result?.projects ?? [];
  const hasMore = result?.nextCursor !== null;
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <DashboardSearch 
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search projects..."
        />
        <FilterChips 
          selected={filters}
          onChange={setFilters}
        />
      </div>
      
      {result === undefined ? (
        <ProjectGridSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState searchQuery={searchQuery} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard 
                key={project._id}
                project={project}
                metrics={project.metrics}
              />
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                onClick={() => setCursor(result.nextCursor)}
                disabled={!result}
              >
                {result === undefined && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

#### ProjectCard with Progress Bar

```typescript
// components/dashboard/project-card.tsx

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, 
  Pin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: any; // Type from generated API
  metrics: any | null;
}

const PHASE_ORDER = ['brief', 'constitution', 'prd', 'techSpec', 'userStories', 'handoff'];
const PHASE_LABELS: Record<string, string> = {
  brief: 'Brief',
  constitution: 'Constitution',
  prd: 'PRD',
  techSpec: 'Tech Spec',
  userStories: 'Stories',
  handoff: 'Handoff',
};

export function ProjectCard({ project, metrics }: ProjectCardProps) {
  const pinProject = useMutation(api.userPreferences.pinProject);
  const unpinProject = useMutation(api.userPreferences.unpinProject);
  
  const progress = metrics?.completionPercentage ?? 0;
  const healthScore = metrics?.healthScore ?? 0;
  
  // Determine health status
  const getHealthStatus = () => {
    if (metrics?.stalenessFlags?.length > 0) {
      return { label: 'Stale', variant: 'warning', icon: RefreshCw };
    }
    if (metrics?.verificationStatus === 'failed') {
      return { label: 'Issues', variant: 'destructive', icon: AlertCircle };
    }
    if (progress === 100) {
      return { label: 'Complete', variant: 'success', icon: CheckCircle2 };
    }
    return null;
  };
  
  const health = getHealthStatus();
  
  return (
    <Card className="group relative hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate pr-8">
              {project.title}
            </CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              {project.description}
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => pinProject({ projectId: project._id })}>
                <Pin className="mr-2 h-4 w-4" />
                Pin Project
              </DropdownMenuItem>
              <DropdownMenuItem>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {health && (
          <Badge 
            variant={health.variant as any}
            className="absolute top-4 right-12"
          >
            <health.icon className="mr-1 h-3 w-3" />
            {health.label}
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Phase Pipeline */}
        <div className="flex gap-1">
          {PHASE_ORDER.map((phaseId, idx) => {
            const isCompleted = idx < (metrics?.completedPhases ?? 0);
            const isCurrent = phaseId === metrics?.currentPhaseId;
            
            return (
              <div
                key={phaseId}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  isCompleted && 'bg-green-500',
                  isCurrent && 'bg-primary animate-pulse',
                  !isCompleted && !isCurrent && 'bg-muted'
                )}
                title={PHASE_LABELS[phaseId]}
              />
            );
          })}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{project.status}</span>
          <span>Updated {formatRelativeTime(project.updatedAt)}</span>
        </div>
      </CardContent>
      
      <Link 
        href={`/project/${project._id}`}
        className="absolute inset-0 z-0"
        aria-label={`Open ${project.title}`}
      />
    </Card>
  );
}
```

### 4.3 Real-Time Activity Feed

```typescript
// components/dashboard/activity-feed.tsx

'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  FileText,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const ACTIVITY_ICONS = {
  project_created: FileText,
  phase_started: Play,
  phase_completed: CheckCircle,
  generation_started: Loader2,
  generation_completed: CheckCircle,
  generation_failed: XCircle,
  drift_detected: AlertTriangle,
  verification_complete: CheckCircle,
  project_updated: FileText,
};

const ACTIVITY_COLORS = {
  project_created: 'text-blue-500',
  phase_started: 'text-yellow-500',
  phase_completed: 'text-green-500',
  generation_started: 'text-primary animate-spin',
  generation_completed: 'text-green-500',
  generation_failed: 'text-red-500',
  drift_detected: 'text-orange-500',
  verification_complete: 'text-green-500',
  project_updated: 'text-blue-500',
};

export function ActivityFeed() {
  const feed = useQuery(api.userDashboard.getActivityFeed, { limit: 20 });
  
  // Group by time
  const grouped = groupByTime(feed?.activities ?? []);
  
  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-4">
          {Object.entries(grouped).map(([timeGroup, activities]) => (
            <div key={timeGroup} className="mb-6">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {timeGroup}
              </h4>
              <div className="space-y-3">
                {activities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.type];
                  const colorClass = ACTIVITY_COLORS[activity.type];
                  
                  return (
                    <div
                      key={activity._id}
                      className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn('mt-0.5', colorClass)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">
                          {activity.message}
                        </p>
                        {activity.metadata?.phaseName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {activity.metadata.phaseName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatRelativeTime(activity.createdAt)}
                        </p>
                      </div>
                      {activity.metadata?.actionUrl && (
                        <Link
                          href={activity.metadata.actionUrl}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function groupByTime(activities: any[]) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  return activities.reduce((groups, activity) => {
    const age = now - activity.createdAt;
    let group = 'Older';
    
    if (age < oneDay) group = 'Today';
    else if (age < 2 * oneDay) group = 'Yesterday';
    else if (age < 7 * oneDay) group = 'This Week';
    
    if (!groups[group]) groups[group] = [];
    groups[group].push(activity);
    return groups;
  }, {} as Record<string, any[]>);
}
```

### 4.4 Notification System

```typescript
// components/dashboard/notification-bell.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  
  const notifications = useQuery(api.notifications.getUnreadCount);
  const unreadCount = notifications?.count ?? 0;
  
  const markAsRead = useMutation(api.notifications.markNotificationsAsRead);
  
  const recentNotifications = useQuery(
    api.notifications.listNotifications,
    { limit: 10 }
  );
  
  const handleMarkAllRead = async () => {
    await markAsRead({ markAll: true });
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-80">
          {recentNotifications?.notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications?.notifications.map((notification) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onMarkAsRead={() => 
                    markAsRead({ notificationIds: [notification._id] })
                  }
                />
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Link
            href="/notifications"
            className="block text-center text-sm text-muted-foreground hover:text-foreground py-2"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Critical path - all other features depend on this**

#### Schema & Data Layer
- [ ] Add `userPreferences` table to schema
- [ ] Add `projectMetrics` table to schema  
- [ ] Add `notifications` table to schema
- [ ] Add `projectTags` table to schema
- [ ] Add `dashboardActivity` table to schema
- [ ] Add `userAnalytics` table to schema
- [ ] Create indexes for performance

#### Background Jobs
- [ ] Create `computeProjectMetrics` scheduled function
- [ ] Create `updateUserAnalytics` scheduled function
- [ ] Create notification triggers in generation actions
- [ ] Set up cron schedules in Convex dashboard

#### Testing
- [ ] Unit tests for all new queries
- [ ] Unit tests for mutations
- [ ] Integration tests for scheduled jobs

**Success Criteria:**
- All tables created and indexed
- Background jobs running without errors
- Test coverage > 80%

---

### Phase 2: Quick Wins (Week 2-3)
**High impact, low complexity features**

#### Pinned Projects
- [ ] Create `pinProject` / `unpinProject` mutations
- [ ] Create `PinnedProjects` component
- [ ] Add pin/unpin UI to project cards
- [ ] Store pinned order in userPreferences

#### Time-Based Grouping
- [ ] Create `getProjectsByTimeGroup` query
- [ ] Add grouping logic (Today/Yesterday/This Week/Older)
- [ ] Update ProjectGrid to show grouped sections
- [ ] Add "Jump to" navigation

#### Enhanced Activity Feed
- [ ] Create activity feed from existing generationTasks
- [ ] Add `getActivityFeed` query
- [ ] Build `ActivityFeed` component with time grouping
- [ ] Add real-time updates via Convex subscriptions

#### Quick Actions Menu
- [ ] Add dropdown menu to project cards
- [ ] Implement "Duplicate Project" action
- [ ] Implement "Quick Generate" action (jump to specific phase)
- [ ] Add keyboard shortcuts (optional)

**Success Criteria:**
- Users can pin/unpin projects
- Projects grouped by time
- Activity feed showing real data
- Quick actions working on all project cards

---

### Phase 3: Core Features (Week 3-5)
**Medium complexity, high value features**

#### Smart Search & Filters
- [ ] Implement client-side search with Fuse.js
- [ ] Add `DashboardSearch` component with debouncing
- [ ] Create `FilterChips` component for status/tags
- [ ] Add date range picker for filters
- [ ] Implement pagination (cursor-based)

#### Project Progress Visualization
- [ ] Create `ProjectCard` with progress bar
- [ ] Add phase pipeline visualization (mini timeline)
- [ ] Show completion percentage badges
- [ ] Add "Continue where you left off" indicator
- [ ] Create project detail progress view

#### Health Indicators
- [ ] Integrate staleness detection from phases table
- [ ] Add verification status badges
- [ ] Create health score calculation
- [ ] Show warnings for stale phases
- [ ] Add drift detection alerts

#### Personal Analytics Widget
- [ ] Build `PersonalAnalytics` component
- [ ] Connect to `getUserStats` query
- [ ] Add trend indicators (up/down arrows)
- [ ] Create skeleton loading states
- [ ] Add time period selector (7d/30d/90d)

**Success Criteria:**
- Search filters working with < 300ms response
- Progress bars accurate to phase level
- Health badges showing correct status
- Analytics widget displaying real data

---

### Phase 4: Advanced Features (Week 5-7)
**Complex features with higher development time**

#### Real-Time Activity Feed
- [ ] Set up Convex subscriptions for live updates
- [ ] Add WebSocket connection handling
- [ ] Implement optimistic updates
- [ ] Add activity aggregation (group rapid events)
- [ ] Create activity detail views

#### Notifications Center
- [ ] Build `NotificationBell` component
- [ ] Create notification triggers for all events
- [ ] Add notification preferences UI
- [ ] Implement email notifications (optional)
- [ ] Add notification history page

#### Template Gallery
- [ ] Create `TemplateGallery` component
- [ ] Fetch top templates by usage
- [ ] Add template preview modal
- [ ] Implement "Start from Template" flow
- [ ] Add template categorization

#### Advanced Analytics
- [ ] Add charts (Recharts or Tremor)
- [ ] Create usage trends over time
- [ ] Add cost breakdown by provider
- [ ] Implement project comparison
- [ ] Add export functionality (CSV/PDF)

**Success Criteria:**
- Activity feed updates in real-time (< 1s latency)
- Notifications delivered for all key events
- Template gallery showing top templates
- Charts rendering performance data

---

### Phase 5: Polish & Optimization (Week 7-8)
**Performance, testing, and refinement**

#### Performance Optimization
- [ ] Add React.memo to all list items
- [ ] Implement virtual scrolling for large lists
- [ ] Add query caching with React Query
- [ ] Optimize image loading
- [ ] Add service worker for offline support (optional)

#### Testing
- [ ] E2E tests for critical flows
- [ ] Performance benchmarks
- [ ] Load testing for concurrent users
- [ ] Accessibility audit (WCAG 2.1)
- [ ] Cross-browser testing

#### Error Handling
- [ ] Add error boundaries
- [ ] Implement retry logic for failed queries
- [ ] Add offline state handling
- [ ] Create error reporting (Sentry integration)

#### Mobile Responsiveness
- [ ] Test on mobile devices
- [ ] Optimize touch targets
- [ ] Add pull-to-refresh
- [ ] Optimize for small screens

**Success Criteria:**
- Dashboard loads in < 1 second
- All tests passing
- 0 critical accessibility issues
- Mobile experience polished

---

## 6. Notably Missing Infrastructure

### 6.1 Full-Text Search

**Problem:** Convex doesn't support native text search.

**Solution Options:**

1. **Client-Side Search (Recommended for MVP)**
   - Use Fuse.js for fuzzy matching
   - Load all projects client-side (works for < 500 projects)
   - Pros: Simple, no external deps, instant results
   - Cons: Doesn't scale to thousands of projects

2. **Production-Scale Search**
   - Integrate Algolia or Typesense
   - Sync project data via webhooks
   - Pros: Scalable, advanced features (faceting, typo tolerance)
   - Cons: Additional cost, complexity

**Implementation:**
```typescript
// lib/search.ts
import Fuse from 'fuse.js';

const fuseOptions = {
  keys: ['title', 'description'],
  threshold: 0.3,
  includeScore: true,
};

export function createProjectSearch(projects: any[]) {
  return new Fuse(projects, fuseOptions);
}
```

### 6.2 Background Job Infrastructure

**Problem:** Need to compute metrics and analytics asynchronously.

**Solution:** Use Convex scheduled functions (already available)

**Implementation Details:**
- Run `computeProjectMetrics` every 15 minutes
- Run `updateUserAnalytics` every hour
- Use internal actions to bypass auth for system jobs
- Add monitoring to track job success/failure rates

### 6.3 Real-Time Infrastructure

**Problem:** Activity feed and notifications need real-time updates.

**Solution:** Convex's built-in reactive queries handle this automatically.

**Key Points:**
- Components using `useQuery` automatically re-render when data changes
- No WebSocket setup required
- Optimistic updates via `useMutation` for instant UI feedback

### 6.4 Caching Layer

**Problem:** Dashboard queries can be expensive with many projects.

**Solution:** Multi-level caching strategy

1. **Convex Query Caching:** Automatic (uses HTTP caching)
2. **Client-Side Caching:** React Query or SWR
3. **Computed Metrics:** Pre-calculate in `projectMetrics` table

**Implementation:**
```typescript
// Use React Query for additional caching
import { useQuery as useTanStackQuery } from '@tanstack/react-query';

function useUserStats(period: string) {
  return useTanStackQuery({
    queryKey: ['userStats', period],
    queryFn: () => fetchUserStats(period),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Backend (Convex functions):**
```typescript
// convex/__tests__/userDashboard.test.ts
import { test, expect } from 'vitest';
import { testApi } from '../test-helper';

test('getUserStats returns correct totals', async () => {
  // Setup: Create test data
  const t = testApi();
  
  // Execute
  const stats = await t.query(api.userDashboard.getUserStats, { period: '30d' });
  
  // Assert
  expect(stats.tokensUsed).toBeGreaterThan(0);
  expect(stats.successRate).toBeBetween(0, 100);
});
```

**Frontend (Components):**
```typescript
// components/__tests__/personal-analytics.test.tsx
import { render, screen } from '@testing-library/react';
import { PersonalAnalytics } from '../dashboard/personal-analytics';

test('renders analytics cards', async () => {
  render(<PersonalAnalytics />);
  
  expect(await screen.findByText('Specs Generated')).toBeInTheDocument();
  expect(await screen.findByText('Success Rate')).toBeInTheDocument();
});
```

### 7.2 Integration Tests

**Dashboard Flow:**
1. Create project → Verify appears in dashboard
2. Pin project → Verify pinned section updates
3. Generate artifact → Verify activity feed updates
4. Search projects → Verify filtering works

### 7.3 Performance Tests

**Benchmarks:**
- Dashboard initial load: < 1 second
- Search response time: < 300ms
- Activity feed update latency: < 1 second
- Render 100 projects: < 100ms

---

## 8. Success Metrics

### 8.1 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard Load Time | < 1s | Lighthouse Performance Score |
| Search Response | < 300ms | React Query timing |
| Real-time Latency | < 1s | Time from event to UI update |
| Test Coverage | > 80% | Vitest coverage report |
| Bundle Size | < 200KB | webpack-bundle-analyzer |

### 8.2 User Engagement Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard Usage | 80% of active users | Track page views |
| Search Usage | 40% of users | Track search queries |
| Pinned Projects | 2.5 avg per user | Track pin actions |
| Activity Feed Views | 60% scroll feed | Intersection Observer |
| Feature Adoption | 50% use filters | Track filter usage |

### 8.3 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| User Retention | +15% week-over-week | Mixpanel/Amplitude |
| Time to Value | -30% (faster project creation) | Time tracking |
| Support Tickets | -20% (self-service via dashboard) | Zendesk/Intercom |
| NPS Score | > 50 | In-app surveys |

---

## 9. Risk Assessment & Mitigation

### 9.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Search performance degrades | High | Medium | Implement pagination + virtual scrolling |
| Real-time updates overwhelm | Medium | Low | Add debouncing + rate limiting |
| Background jobs fail silently | High | Low | Add monitoring + alerting |
| Schema migrations break data | Critical | Low | Write migration scripts + test on staging |

### 9.2 User Experience Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Dashboard feels overwhelming | Medium | Medium | Progressive disclosure + onboarding |
| Users don't discover features | Medium | Medium | Tooltips + feature highlights |
| Performance on slow networks | High | Medium | Skeleton loaders + optimistic UI |

---

## 10. Appendix

### A. File Structure

```
app/(auth)/dashboard/
├── page.tsx                    # Main dashboard page
├── layout.tsx                  # Dashboard layout
├── loading.tsx                 # Loading state
├── error.tsx                   # Error boundary

components/dashboard/
├── personal-analytics.tsx      # Stats widget
├── pinned-projects.tsx         # Pinned projects row
├── activity-feed.tsx           # Real-time activity
├── dashboard-search.tsx        # Search input
├── filter-chips.tsx            # Filter UI
├── project-grid.tsx            # Project listing
├── project-card.tsx            # Individual project card
├── template-gallery.tsx        # Template showcase
├── notification-bell.tsx       # Notification dropdown
├── quick-actions.tsx           # Context menu actions
└── health-indicator.tsx        # Status badges

convex/
├── schema.ts                   # Extended schema
├── userDashboard.ts            # Dashboard queries
├── userPreferences.ts          # User settings mutations
├── notifications.ts            # Notification system
├── projectMetrics.ts           # Metrics computation
├── dashboardActivity.ts        # Activity tracking
├── userAnalytics.ts            # Analytics aggregation
└── scheduledJobs.ts            # Background tasks

lib/
├── search.ts                   # Search utilities
├── analytics.ts                # Analytics helpers
└── notifications.ts            # Notification triggers
```

### B. Dependencies to Add

```json
{
  "dependencies": {
    "fuse.js": "^7.0.0",
    "recharts": "^2.10.0",
    "@tanstack/react-query": "^5.0.0",
    "date-fns": "^3.0.0"
  }
}
```

### C. Environment Variables

```bash
# Optional: For production search
ALGOLIA_APP_ID=xxx
ALGOLIA_API_KEY=xxx
ALGOLIA_INDEX_NAME=projects

# Optional: For error tracking
SENTRY_DSN=xxx

# Required: Convex
CONVEX_DEPLOYMENT=xxx
```

---

## 11. Conclusion

This implementation plan provides a comprehensive roadmap for transforming the SpecForge dashboard into a powerful command center. By following the phased approach:

1. **Phase 1** establishes the data foundation
2. **Phase 2** delivers immediate user value
3. **Phase 3** adds core productivity features
4. **Phase 4** enables real-time collaboration
5. **Phase 5** ensures production readiness

The architecture leverages Convex's strengths (reactive queries, serverless functions) while adding strategic capabilities for search, analytics, and notifications. The modular component design allows for iterative delivery and easy maintenance.

**Next Steps:**
1. Review and approve the plan with stakeholders
2. Set up development branch for Phase 1
3. Begin schema migrations
4. Schedule weekly check-ins to track progress

**Estimated Total Effort:** 8 weeks (2 developers)
**ROI Timeline:** 4 weeks to see user engagement improvements

---

*Document Version: 1.0*
*Last Updated: 2024*
*Author: AI Architecture Team*
