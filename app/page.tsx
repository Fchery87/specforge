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
} from "lucide-react";
import { motion, useScroll, useTransform, useSpring, useVelocity } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    icon: Layers,
    title: "Multi-Phase Generation",
    description: "Brief → PRD → Specs → Stories → Artifacts → Handoff.",
  },
  {
    icon: Cpu,
    title: "Any LLM Logic",
    description: "GPT-4, Claude 3, Gemini, or Local Llama.",
  },
  {
    icon: Archive,
    title: "Zero Truncation",
    description: "Full outputs. ZIP export. No cutoffs.",
  },
  {
    icon: Terminal,
    title: "Git-Ready",
    description: "Repo structures pre-built for commit.",
  },
];

const workflowSteps = [
  { step: "01", title: "Brief", bg: "bg-background" },
  { step: "02", title: "Specs", bg: "bg-background" },
  { step: "03", title: "Stories", bg: "bg-background" },
  { step: "04", title: "Code", bg: "bg-primary text-black" },
];

const techStack = [
  "Next.js 15",
  "Convex",
  "Clerk",
  "TypeScript",
  "Tailwind",
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
    <div
      ref={containerRef}
      className="relative"
    >
      
      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center border-b-2 border-border overflow-hidden">
        <motion.div
           style={{ scale: heroScale, opacity: heroOpacity }}
           className="text-center z-10"
         >
           {/* ... status badge ... */}
           
           <div className="flex items-center justify-center mb-4">
            <div className="px-4 py-1 border border-primary text-primary uppercase text-sm font-bold tracking-widest animate-pulse">
              System Online v2.0
            </div>
          </div>

           <motion.h1 
             style={{ skewX }}
             className="text-v-hero font-bold leading-[0.8] uppercase tracking-tighter text-foreground text-center"
           >
             Forging <br /> <span className="text-primary">Reality</span>
           </motion.h1>
           
          <p className="mt-8 text-xl md:text-3xl text-muted-foreground uppercase tracking-tight max-w-3xl mx-auto px-4">
            From Request to Repository. <br />
            The Ultimate Agentic Workflow Engine.
          </p>
          <div className="mt-12 flex flex-col md:flex-row gap-6 justify-center items-center">
            <Button size="lg" className="text-xl h-20 px-12" asChild>
              <Link href="/dashboard">
                Initialise Protocol <ArrowRight className="ml-3 w-6 h-6" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-xl h-20 px-12"
              asChild
            >
              <Link href="#steps">View Architecture</Link>
            </Button>
          </div>
        </motion.div>

        {/* Decorative Grid BG */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
      </section>

      {/* Stats Marquee */}
      <div className="border-b-2 border-border bg-primary text-black py-4 overflow-hidden">
        <Marquee speed={100} className="font-bold text-4xl uppercase tracking-tighter">
          <span className="mx-8">Zero Truncation</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Multi-Agent Core</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Instant Specs</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Context Awareness</span>
          <span className="mx-8">•</span>
          <span className="mx-8">Live Preview</span>
          <span className="mx-8">•</span>
        </Marquee>
      </div>

      {/* Features Grid */}
      <section className="py-32 px-6 lg:px-12 border-b-2 border-border">
        <div className="max-w-[95vw] mx-auto">
          <div className="mb-20">
            <h2 className="text-v-h2 uppercase font-bold leading-none tracking-tighter text-left">
              Core <span className="text-muted-foreground">Modules</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border-2 border-border">
            {features.map((feature, i) => (
              <Card
                key={i}
                className="border-0 bg-background h-full flex flex-col justify-between"
              >
                <CardHeader>
                  <feature.icon className="w-12 h-12 text-primary mb-4" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-lg">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Steps - Massive Numbers */}
      <section id="steps" className="py-32 bg-background border-b-2 border-border">
        <div className="max-w-[95vw] mx-auto px-6">
          <h2 className="text-v-h2 uppercase font-bold leading-none tracking-tighter mb-24 text-right">
            Sequence
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {workflowSteps.map((step, i) => (
              <div
                key={i}
                className={`relative p-8 h-96 flex flex-col justify-between border-2 border-border transition-all hover:bg-primary hover:text-black group ${step.bg}`}
              >
                <div className="text-[10rem] font-bold leading-none opacity-20 group-hover:opacity-100 transition-opacity absolute top-0 right-0 -mr-4 -mt-8 text-foreground group-hover:text-black">
                  {step.step}
                </div>
                <div className="z-10 mt-auto">
                  <h3 className="text-4xl font-bold uppercase tracking-tight">
                    {step.title}
                  </h3>
                  <div className="h-1 w-12 bg-primary mt-4 group-hover:bg-black" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Marquee */}
      <section className="py-24 border-b-2 border-border overflow-hidden">
        <div className="mb-12 px-6 text-center">
          <span className="text-xl uppercase font-bold tracking-widest text-muted-foreground border border-border px-4 py-2">
            Powering The Engine
          </span>
        </div>
        <Marquee speed={60} reverse>
          {techStack.map((tech) => (
            <div
              key={tech}
              className="mx-12 text-6xl md:text-8xl font-bold uppercase text-muted-foreground/30 hover:text-primary transition-colors cursor-default"
            >
              {tech}
            </div>
          ))}
        </Marquee>
      </section>

      {/* Footer CTA */}
      <section className="py-40 px-6 flex flex-col items-center justify-center text-center bg-background">
        <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-8 max-w-5xl">
          Ready to deploy your ideas?
        </h2>
        <Button size="lg" className="h-24 px-12 text-2xl" asChild>
          <Link href="/dashboard">Execute Protocol // Start</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-border py-12 px-6 bg-background">
        <div className="max-w-[95vw] mx-auto flex flex-col md:flex-row justify-between items-end gap-8">
          <div>
            <div className="text-4xl font-bold uppercase tracking-tighter mb-2">
              SpecForge
            </div>
            <p className="text-muted-foreground uppercase tracking-widest text-sm">
              Advanced Agentic Framework
            </p>
          </div>
          <div className="flex gap-8 text-lg font-bold uppercase tracking-tight">
            <Link href="#" className="hover:text-primary">
              Terms
            </Link>
            <Link href="#" className="hover:text-primary">
              Privacy
            </Link>
            <Link href="https://github.com" className="hover:text-primary">
              GitHub
            </Link>
          </div>
        </div>
        <div className="text-[20vw] font-bold leading-none text-muted opacity-10 text-center pointer-events-none select-none mt-[-5vw]">
          BUILD
        </div>
      </footer>
    </div>
  );
}
