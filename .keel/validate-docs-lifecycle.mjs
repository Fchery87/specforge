#!/usr/bin/env node
/**
 * keel docs lifecycle validator.
 *
 * Reads only markdown under the configured docs directory, so it is
 * language and framework agnostic. Node builtins only, no install step.
 *
 * Usage:
 *   node validate-docs-lifecycle.mjs [root] [--check <id>] [--list] [--version]
 *
 * Configuration comes from <root>/.keel/config.md. Every key falls back to a
 * default, so a repo with no config file still validates.
 */

import { existsSync, realpathSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, normalize, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION = "1.0.1";

const DEFAULT_CONFIG = {
	roadmap: "docs/roadmap.md",
	plans: "docs/plans",
	specs: "docs/specs",
	contracts: "off",
};

const CONTRACTS_DEFAULT_PATH = "docs/architecture/contracts.md";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Parse `key: value` lines out of .keel/config.md. Markdown headings, blank
 * lines, and comments are ignored, so the file stays readable to a human.
 *
 * @param {string} markdown
 * @returns {Record<string, string>}
 */
export function parseConfig(markdown) {
	const values = {};
	for (const line of markdown.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("<!--")) continue;
		const match = trimmed.match(/^([A-Za-z][\w-]*)\s*:\s*(.+?)\s*$/);
		if (match) values[match[1].toLowerCase()] = match[2];
	}
	return values;
}

/**
 * @param {string} root
 * @returns {Promise<typeof DEFAULT_CONFIG>}
 */
async function loadConfig(root) {
	const configPath = join(root, ".keel", "config.md");
	if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
	const parsed = parseConfig(await readFile(configPath, "utf8"));
	const config = { ...DEFAULT_CONFIG };
	for (const key of Object.keys(DEFAULT_CONFIG)) {
		if (parsed[key]) config[key] = parsed[key];
	}
	return config;
}

/** Strip a trailing separator so join() results stay stable. */
function dirValue(value) {
	return value.replace(/[/\\]+$/, "");
}

/**
 * `off` disables the contract checks. `on` selects the conventional path.
 * Anything else is treated as an explicit path.
 *
 * @param {string} value
 * @returns {string | null}
 */
function contractsPathFor(value) {
	const normalized = value.trim().toLowerCase();
	if (normalized === "off" || normalized === "false" || normalized === "none") return null;
	if (normalized === "on" || normalized === "true") return CONTRACTS_DEFAULT_PATH;
	return value.trim();
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

async function markdownFiles(directory) {
	if (!existsSync(directory)) return [];
	return (await readdir(directory, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => join(directory, entry.name))
		.sort();
}

async function readFiles(paths) {
	return Promise.all(paths.map(async (path) => ({ path, text: await readFile(path, "utf8") })));
}

function planLinks(markdown) {
	const links = new Set();
	for (const match of markdown.matchAll(/\[[^\]]+\]\((plans\/[^)]+\.md)\)/g)) {
		links.add(match[1]);
	}
	return links;
}

/**
 * Read every input the checks need, once. Missing files become null or an
 * empty list rather than a thrown error, which is what lets the same script
 * run against a repo mid-setup.
 */
async function loadWorld(root, config) {
	const docsDir = resolve(root, "docs");
	const roadmapPath = resolve(root, config.roadmap);
	const plansDir = resolve(root, dirValue(config.plans));
	const specsDir = resolve(root, dirValue(config.specs));
	const contractsRelative = contractsPathFor(config.contracts);
	const contractsPath = contractsRelative ? resolve(root, contractsRelative) : null;

	const roadmapText = existsSync(roadmapPath) ? await readFile(roadmapPath, "utf8") : null;
	const plans = await readFiles(await markdownFiles(plansDir));
	const specs = await readFiles(await markdownFiles(specsDir));

	const linkSet = roadmapText ? planLinks(roadmapText) : new Set();
	const links = [...linkSet].map((link) => {
		const target = resolve(docsDir, normalize(link));
		const insidePlans = target.startsWith(`${plansDir}${sep}`);
		return { link, resolves: insidePlans && existsSync(target) };
	});

	let contractsText = null;
	let contractsMissing = false;
	if (contractsPath) {
		if (existsSync(contractsPath)) contractsText = await readFile(contractsPath, "utf8");
		else contractsMissing = true;
	}

	return {
		root,
		roadmapPath,
		roadmapText,
		plansDir,
		plans,
		specs,
		links,
		linkSet,
		contractsPath,
		contractsText,
		contractsMissing,
	};
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * @typedef {{ path: string, message: string }} Finding
 * @typedef {{ id: string, describe: string, optional?: boolean, run: (world: any) => Finding[] }} Check
 */

/** @type {Check[]} */
export const CHECKS = [
	{
		id: "roadmap-exists",
		describe: "a repo with live plans has a roadmap to link them from",
		run: (world) => {
			if (world.roadmapText !== null || world.plans.length === 0) return [];
			return [{ path: world.roadmapPath, message: `expected a roadmap at ${relative(world.root, world.roadmapPath)}` }];
		},
	},
	{
		id: "plan-links-resolve",
		describe: "every plan link in the roadmap points at a file that exists",
		run: (world) =>
			world.links
				.filter(({ resolves }) => !resolves)
				.map(({ link }) => ({ path: world.roadmapPath, message: `plan link does not exist: ${link}` })),
	},
	{
		id: "plan-status-and-deletion",
		describe: "plans declare a status early, and a completed plan is deleted",
		run: (world) => {
			const findings = [];
			for (const { path, text } of world.plans) {
				const statusLine = text
					.split(/\r?\n/)
					.slice(0, 5)
					.find((line) => /^\*\*Status:\*\*/i.test(line.trim()));
				if (!statusLine) {
					findings.push({ path, message: "expected a **Status:** line within the first 5 lines" });
					continue;
				}
				if (/\b(?:complete|completed|done|landed)\b/i.test(statusLine)) {
					findings.push({ path, message: "completed plans must be deleted" });
				}
			}
			return findings;
		},
	},
	{
		id: "live-plan-linked",
		describe: "every live plan is reachable from the roadmap",
		run: (world) => {
			if (world.roadmapText === null) return [];
			const findings = [];
			for (const { path, text } of world.plans) {
				const statusLine = text
					.split(/\r?\n/)
					.slice(0, 5)
					.find((line) => /^\*\*Status:\*\*/i.test(line.trim()));
				if (!statusLine) continue;
				if (/\b(?:complete|completed|done|landed)\b/i.test(statusLine)) continue;
				const link = `plans/${basename(path)}`;
				if (!world.linkSet.has(link)) {
					findings.push({ path, message: `live plan is not linked from ${relative(world.root, world.roadmapPath)}` });
				}
			}
			return findings;
		},
	},
	{
		id: "spec-deletion-inventory",
		describe: "every spec states what the change makes obsolete",
		run: (world) =>
			world.specs
				.filter(({ text }) => !/^##\s+Deletion inventory\s*$/im.test(text))
				.map(({ path }) => ({ path, message: "expected a Deletion inventory section" })),
	},
	{
		id: "contracts-file-exists",
		describe: "the configured contracts file is present",
		optional: true,
		run: (world) =>
			world.contractsMissing
				? [{ path: world.contractsPath, message: `expected a contracts file at ${relative(world.root, world.contractsPath)}` }]
				: [],
	},
	{
		id: "contract-status-agreement",
		describe: "the contract summary table agrees with each contract section",
		optional: true,
		run: (world) => {
			if (world.contractsText === null) return [];
			const findings = [];
			const summaries = contractSummary(world.contractsText);
			const sections = contractSections(world.contractsText);
			for (const [name, summary] of summaries) {
				const section = sections.get(name);
				if (!section) {
					findings.push({ path: world.contractsPath, message: `${name}: summary has no matching contract section` });
					continue;
				}
				if (summary.status !== section.status) {
					findings.push({
						path: world.contractsPath,
						message: `${name}: summary is ${summary.status} but section is ${section.status}`,
					});
				}
			}
			return findings;
		},
	},
	{
		id: "contract-deadline",
		describe: "an open contract has not passed its settle-by phase",
		optional: true,
		run: (world) => {
			if (world.contractsText === null || world.roadmapText === null) return [];
			const findings = [];
			const summaries = contractSummary(world.contractsText);
			const sections = contractSections(world.contractsText);
			const phases = roadmapPhases(world.roadmapText);
			const highestStartedPhase = Math.max(
				0,
				...phases.filter(({ state }) => /landed|active/.test(state)).map(({ number }) => number),
			);
			for (const [name, summary] of summaries) {
				const section = sections.get(name);
				if (!section || summary.status !== "open") continue;
				const deadlineText = `${summary.settleBy} ${section.body}`;
				const deadline = Number.parseInt(deadlineText.match(/(?:start of )?Phase\s+(\d+)/i)?.[1] ?? "", 10);
				if (Number.isInteger(deadline) && highestStartedPhase > deadline) {
					findings.push({
						path: world.contractsPath,
						message: `${name}: open deadline has passed (Phase ${deadline} is landed)`,
					});
				}
			}
			return findings;
		},
	},
	{
		id: "contract-section-in-summary",
		describe: "every contract section appears in the summary table",
		optional: true,
		run: (world) => {
			if (world.contractsText === null) return [];
			const summaries = contractSummary(world.contractsText);
			return [...contractSections(world.contractsText).keys()]
				.filter((name) => !summaries.has(name))
				.map((name) => ({ path: world.contractsPath, message: `${name}: contract section is missing from the summary table` }));
		},
	},
];

function contractSummary(markdown) {
	const contracts = new Map();
	for (const line of markdown.split(/\r?\n/)) {
		const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
		if (cells.length < 4 || cells[0] === "Contract" || /^-+$/.test(cells[0])) continue;
		const status = cells[1].match(/\b(open|settled)\b/i)?.[1].toLowerCase();
		if (status) contracts.set(cells[0].replaceAll("*", "").trim(), { status, settleBy: cells[3] });
	}
	return contracts;
}

function contractSections(markdown) {
	const sections = new Map();
	const matches = [...markdown.matchAll(/^#\s+\d+\.\s+(.+?)\s+[—-]\s+(open|settled)\s*$/gim)];
	for (let index = 0; index < matches.length; index += 1) {
		const match = matches[index];
		const end = matches[index + 1]?.index ?? markdown.length;
		sections.set(match[1].trim(), {
			status: match[2].toLowerCase(),
			body: markdown.slice(match.index, end),
		});
	}
	return sections;
}

function roadmapPhases(markdown) {
	const phases = [];
	for (const line of markdown.split(/\r?\n/)) {
		const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
		if (cells.length < 3 || !/^\d+(?:[a-z])?$/i.test(cells[0])) continue;
		const number = Number.parseInt(cells[0], 10);
		const state = cells[2].replaceAll("*", "").toLowerCase();
		phases.push({ number, state });
	}
	return phases;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} root
 * @param {{ only?: string }} [options]
 * @returns {Promise<Finding[]>}
 */
export async function validate(root, options = {}) {
	const config = await loadConfig(root);
	const contractsEnabled = contractsPathFor(config.contracts) !== null;
	const world = await loadWorld(root, config);

	const findings = [];
	for (const check of CHECKS) {
		if (check.optional && !contractsEnabled) continue;
		if (options.only && check.id !== options.only) continue;
		findings.push(...check.run(world));
	}
	return findings;
}

function parseArgs(argv) {
	const options = { root: null, only: null, list: false, version: false };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--list") options.list = true;
		else if (arg === "--version") options.version = true;
		else if (arg === "--check") options.only = argv[++index];
		else if (arg.startsWith("--check=")) options.only = arg.slice("--check=".length);
		else if (!arg.startsWith("-") && options.root === null) options.root = arg;
	}
	return options;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.version) {
		console.log(VERSION);
		return;
	}
	if (options.list) {
		for (const check of CHECKS) {
			console.log(`${check.id}${check.optional ? " (optional)" : ""}: ${check.describe}`);
		}
		return;
	}
	if (options.only && !CHECKS.some((check) => check.id === options.only)) {
		console.error(`unknown check: ${options.only}`);
		process.exitCode = 2;
		return;
	}

	const root = resolve(options.root ?? process.cwd());
	const findings = await validate(root, { only: options.only });

	if (findings.length > 0) {
		console.error(findings.map(({ path, message }) => `- ${basename(path)}: ${message}`).join("\n"));
		process.exitCode = 1;
	} else {
		console.log("Documentation lifecycle validation passed.");
	}
}

const invokedPath = process.argv[1];
if (invokedPath && existsSync(invokedPath) && import.meta.url === pathToFileURL(realpathSync(invokedPath)).href) {
	await main();
}
