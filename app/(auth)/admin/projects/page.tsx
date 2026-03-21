"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, 
  Shield, 
  FolderOpen, 
  ArrowLeft,
  Search,
  Trash2,
  Eye,
  MoreHorizontal,
  Filter,
  Download,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
  Clock,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProjectStatus = 'draft' | 'active' | 'complete';

interface Project {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export default function ProjectManagementPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  
  // Get all projects
  const projects = useQuery(
    api.admin.listAllProjects,
    isLoaded && isSignedIn 
      ? { 
          search: searchQuery || undefined, 
          status: statusFilter || undefined,
          limit: 100 
        } 
      : "skip"
  );

  // Delete mutation
  const deleteProject = useMutation(api.admin.deleteProjectAsAdmin);
  const bulkDeleteProjects = useMutation(api.admin.bulkDeleteProjects);

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
          <p className="text-muted-foreground">Please sign in to access project management</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (projects === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading project data...</span>
        </div>
      </main>
    );
  }

  // Toggle project selection
  const toggleProject = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  // Toggle all projects
  const toggleAll = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map((p: Project) => p.id)));
    }
  };

  // Handle single delete
  const handleDelete = async () => {
    if (!projectToDelete) return;
    
    try {
      await deleteProject({ 
        projectId: projectToDelete.id as any, 
        reason: deleteReason 
      });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      setDeleteReason("");
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;
    
    try {
      await bulkDeleteProjects({ 
        projectIds: Array.from(selectedProjects) as any[],
        reason: "Bulk delete by admin"
      });
      setSelectedProjects(new Set());
    } catch (err) {
      console.error('Failed to delete projects:', err);
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get status color
  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-muted text-muted-foreground';
      case 'active':
        return 'bg-primary/20 text-primary border-primary';
      case 'complete':
        return 'bg-green-500/20 text-green-500 border-green-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
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
              <FolderOpen className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Admin Console
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            Project <span className="text-primary">Control Center</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            View, manage, and moderate all projects across the platform.
          </p>
        </div>
      </section>

      {/* Bulk Actions Bar */}
      {selectedProjects.size > 0 && (
        <section className="page-section page-container">
          <div className="flex items-center justify-between p-4 bg-primary/10 border-2 border-primary rounded-lg">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-primary" />
              <span className="font-medium">
                {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedProjects(new Set())}
              >
                Clear Selection
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Filters & Search */}
      <section className={cn(
        "page-section page-container",
        selectedProjects.size === 0 && "border-t-2 border-border"
      )}>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-[300px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <div className="flex gap-1">
                {(['draft', 'active', 'complete'] as ProjectStatus[]).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                    className="capitalize"
                  >
                    {status}
                  </Button>
                ))}
                {statusFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStatusFilter(null)}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {projects.length} projects
          </p>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="page-section page-container">
        {projects.length > 0 ? (
          <div className="space-y-4">
            {/* Header Row */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={toggleAll}
                >
                  {selectedProjects.size === projects.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="col-span-4">Project</div>
              <div className="col-span-2">Owner</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Last Updated</div>
              <div className="col-span-2">Actions</div>
            </div>

            {/* Project Cards */}
            {projects.map((project: Project) => (
              <Card 
                key={project.id}
                variant="default"
                className={cn(
                  "transition-all",
                  selectedProjects.has(project.id) && "border-primary bg-primary/5"
                )}
              >
                <CardContent className="p-4">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <Checkbox
                        checked={selectedProjects.has(project.id)}
                        onCheckedChange={() => toggleProject(project.id)}
                      />
                    </div>

                    <div className="col-span-4 min-w-0">
                      <Link 
                        href={`/project/${project.id}`}
                        className="block hover:underline"
                      >
                        <p className="font-medium truncate">{project.title}</p>
                      </Link>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {project.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {formatDate(project.createdAt)}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm truncate">
                          {project.userId.slice(0, 8)}...
                        </span>
                      </div>
                    </div>

                    <div className="col-span-1">
                      <Badge 
                        variant="outline" 
                        className={cn("capitalize", getStatusColor(project.status))}
                      >
                        {project.status}
                      </Badge>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{formatRelativeTime(project.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <Link href={`/project/${project.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setProjectToDelete(project);
                            setDeleteDialogOpen(true);
                          }}>
                            <Trash2 className="w-4 h-4 mr-2 text-destructive" />
                            <span className="text-destructive">Delete Project</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card variant="default" className="p-12 text-center">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">No Projects Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter
                ? "No projects match your current filters. Try adjusting your search criteria."
                : "No projects have been created yet. Projects will appear here once users start creating them."
              }
            </p>
          </Card>
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{projectToDelete?.title}</strong>? 
              This action cannot be undone and will permanently delete all associated data including 
              phases, artifacts, and tickets.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for deletion (optional)</label>
              <Input
                placeholder="e.g., Violates terms of service, spam, etc."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        PROJECTS
      </div>
    </main>
  );
}