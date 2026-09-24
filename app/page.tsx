"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee";
import {
  ArrowRight,
  Layers,
  Cpu,
  Archive,
  Terminal,
  ShieldCheck,
  Code2,
  FileCheck2,
  GitFork,
  Zap,
} from "lucide-react";
import { motion, useScroll, useTransform, useSpring, useVelocity } from "motion/react";
import { useRef } from "react";

const features = [
  {
    icon: FileCheck2,
    title: "Evidence-Backed Specs",
    description: "Every requirement links to interview answers and commit-pinned files. Stable claim IDs track change impact when code or answers shift.",
  },
  {
    icon: GitFork,
    title: "Vertical Tracer Bullets",
    description: "Decompose stories into end-to-end vertical slices. Explicit blocking dependency graphs give AI agents the exact execution order.",
  },
  {
    icon: Code2,
    title: "Live Schema Validator",
    description: "Extract and validate JSON or YAML schemas and OpenAPI contracts directly in your browser. Catch syntax breaks before writing code.",
  },
  {
    icon: Terminal,
    title: "In-Browser Editor",
    description: "Refine specifications with split-screen markdown editing, live token metrics, and automatic ticket re-parsing on save.",
  },
  {
    icon: ShieldCheck,
    title: "Stress-Test Grilling",
    description: "Challenge requirements with 10 targeted failure-mode questions. Pin down race conditions, boundary rules, and non-goals early.",
  },
  {
    icon: Cpu,
    title: "Agent-Native Handoff",
    description: "Export structured ZIP packages, SKILL.md guides, and AGENTS.md rules built for Claude Code, Cursor, Codex, and Aider.",
  },
];

const workflowSteps = [
  { step: "00", title: "Constitution", subtitle: "Invariants & Boundaries", bg: "bg-background" },
  { step: "01", title: "Brief", subtitle: "Evidence Sources & Scope", bg: "bg-background" },
  { step: "02", title: "PRD", subtitle: "Traceable Requirements", bg: "bg-background" },
  { step: "03", title: "Domain", subtitle: "Entities & State Rules", bg: "bg-background" },
  { step: "04", title: "Specs", subtitle: "Deep Interfaces & Seams", bg: "bg-background" },
  { step: "05", title: "Tracer Bullets", subtitle: "Blocking Story Graphs", bg: "bg-background" },
  { step: "06", title: "Artifacts", subtitle: "Live Schema Validation", bg: "bg-background" },
  { step: "07", title: "Handoff", subtitle: "Agent ZIP & SKILL Export", bg: "bg-primary text-black" },
];

const techStack = [
  "Next.js 16",
  "Turbopack",
  "Convex",
  "Clerk",
  "TypeScript",
  "Tailwind CSS",
  "Framer Motion",
  "Gemini",
];

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress, scrollY } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 1.1]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  const skewX = useTransform(smoothVelocity, [-2000, 2000], [-15, 15]);

  return (
    <div ref={containerRef} className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center border-b-2 border-border overflow-hidden px-6 py-24">
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity }}
          className="text-center z-10 max-w-5xl mx-auto"
        >
          <div className="flex items-center justify-center mb-6">
            <div className="px-4 py-1.5 border border-primary text-primary uppercase text-xs font-bold tracking-widest">
              SpecForge 2.0 Active
            </div>
          </div>

          <motion.h1
            style={{ skewX }}
            className="text-v-hero font-bold leading-[0.85] uppercase tracking-tighter text-foreground text-center"
          >
            Forging <br /> <span className="text-primary">Truth</span>
          </motion.h1>

          <p className="mt-8 text-xl md:text-2xl text-muted-foreground uppercase tracking-tight max-w-3xl mx-auto">
            Specification engineering for AI agents and engineering teams.
            Ground every requirement in verified evidence and commit-pinned code.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="text-lg h-16 px-10" asChild>
              <Link href="/dashboard">
                Open Command Center <ArrowRight className="ml-3 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg h-16 px-10" asChild>
              <Link href="/dashboard/quick">
                <Zap className="mr-2 w-5 h-5 text-primary" />
                Try Quick Spec
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Decorative Grid Background */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
      </section>

      {/* Marquee Banner */}
      <div className="border-b-2 border-border bg-primary text-black py-4 overflow-hidden">
        <Marquee speed={90} className="font-bold text-3xl uppercase tracking-tighter">
          <span className="mx-8">Evidence-Backed Specifications</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Vertical Tracer Bullets</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Live Schema Validation</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Stress-Test Grilling</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Agent-Native Handoff</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Commit-Pinned Verification</span>
          <span className="mx-8">•</span>
        </Marquee>
      </div>

      {/* Features Grid */}
      <section className="py-28 px-6 lg:px-12 border-b-2 border-border">
        <div className="max-w-[95vw] mx-auto">
          <div className="mb-16">
            <h2 className="text-v-h2 uppercase font-bold leading-none tracking-tighter text-left">
              Engineered <span className="text-muted-foreground">Capabilities</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border-2 border-border">
            {features.map((feature, i) => (
              <Card
                key={i}
                className="border-0 bg-background h-full flex flex-col justify-between p-8"
              >
                <CardHeader className="p-0 mb-6">
                  <feature.icon className="w-10 h-10 text-primary mb-4" />
                  <CardTitle className="text-2xl font-bold tracking-tight">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <CardDescription className="text-base text-muted-foreground leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Steps */}
      <section id="steps" className="py-28 bg-background border-b-2 border-border">
        <div className="max-w-[95vw] mx-auto px-6">
          <h2 className="text-v-h2 uppercase font-bold leading-none tracking-tighter mb-20 text-right">
            The 8-Phase Pipeline
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {workflowSteps.map((step, i) => (
              <div
                key={i}
                className={`relative p-8 h-80 flex flex-col justify-between border-2 border-border transition-all hover:bg-primary hover:text-black group ${step.bg}`}
              >
                <div className="text-[8rem] font-bold leading-none opacity-20 group-hover:opacity-100 transition-opacity absolute top-0 right-0 -mr-2 -mt-4 text-foreground group-hover:text-black select-none pointer-events-none">
                  {step.step}
                </div>
                <div className="z-10 mt-auto">
                  <h3 className="text-3xl font-bold uppercase tracking-tight mb-2">
                    {step.title}
                  </h3>
                  {step.subtitle && (
                    <p className="text-sm uppercase tracking-widest font-bold text-muted-foreground group-hover:text-black/70">
                      {step.subtitle}
                    </p>
                  )}
                  <div className="h-1 w-12 bg-primary mt-4 group-hover:bg-black" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Marquee */}
      <section className="py-20 border-b-2 border-border overflow-hidden">
        <div className="mb-10 px-6 text-center">
          <span className="text-sm uppercase font-bold tracking-widest text-muted-foreground border border-border px-4 py-2">
            Built for Modern Engineering Stacks
          </span>
        </div>
        <Marquee speed={50} reverse>
          {techStack.map((tech) => (
            <div
              key={tech}
              className="mx-10 text-5xl md:text-7xl font-bold uppercase text-muted-foreground/30 hover:text-primary transition-colors cursor-default"
            >
              {tech}
            </div>
          ))}
        </Marquee>
      </section>

      {/* Footer CTA */}
      <section className="py-32 px-6 flex flex-col items-center justify-center text-center bg-background">
        <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-6 max-w-4xl">
          Build specifications that your AI agents and engineers can trust.
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mb-10">
          Zero drift. Complete traceability from interview questions to generated code contracts.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" className="h-20 px-12 text-xl" asChild>
            <Link href="/dashboard">Launch SpecForge</Link>
          </Button>
          <Button size="lg" variant="outline" className="h-20 px-12 text-xl" asChild>
            <Link href="/dashboard/quick">Generate a Quick Spec</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
