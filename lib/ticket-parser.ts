export interface ParsedTicket {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedEffort?: string;
  sliceType?: 'tracer_bullet' | 'wide_refactor';
  blockedBy?: string[];
  filesToTouch?: string[];
}

/**
 * Parses user story markdown into structured tickets.
 * Looks for H3 headings (### ) as ticket boundaries.
 * Extracts acceptance criteria, priority, effort, blocking dependencies,
 * slice types, and target files.
 */
export function parseTicketsFromMarkdown(markdown: string): ParsedTicket[] {
  const tickets: ParsedTicket[] = [];
  // Split by H3 headings
  const sections = markdown.split(/^### /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const titleLine = lines[0]?.trim();

    // Skip sections that don't look like user stories
    if (!titleLine || titleLine.startsWith('#')) continue;

    // Extract description (lines between title and acceptance criteria)
    const acIndex = lines.findIndex((l) =>
      /acceptance\s+criteria/i.test(l) || /\*\*acceptance/i.test(l),
    );
    const description = lines
      .slice(1, acIndex !== -1 ? acIndex : undefined)
      .filter(
        (l) =>
          !l.startsWith('**Priority') &&
          !l.startsWith('**Effort') &&
          !l.startsWith('**Blocked by') &&
          !l.startsWith('**Dependencies') &&
          !l.startsWith('**Slice Type') &&
          !l.startsWith('**Type:') &&
          !l.startsWith('**Files to touch') &&
          !l.startsWith('**Target Files') &&
          l.trim(),
      )
      .join('\n')
      .trim();

    // Extract acceptance criteria (bullet points)
    const criteria: string[] = [];
    if (acIndex !== -1) {
      for (let i = acIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
          criteria.push(line.slice(6).trim());
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          criteria.push(line.slice(2).trim());
        } else if (/^\d+\.\s+/.test(line)) {
          criteria.push(line.replace(/^\d+\.\s+/, '').trim());
        } else if (line.startsWith('**') || line.startsWith('##')) {
          break;
        }
      }
    }

    // Extract priority
    const priorityMatch = section.match(
      /\*\*Priority:\*\*\s*(critical|high|medium|low)/i,
    );
    const priority = (
      priorityMatch?.[1]?.toLowerCase() ?? 'medium'
    ) as ParsedTicket['priority'];

    // Extract effort
    const effortMatch = section.match(/\*\*Effort:\*\*\s*(\S+)/i);
    const estimatedEffort = effortMatch?.[1];

    // Extract slice type (tracer_bullet vs wide_refactor)
    const sliceMatch = section.match(
      /\*\*(?:Slice\s+Type|Type):\*\*\s*(tracer[_\s-]?bullet|wide[_\s-]?refactor)/i,
    );
    let sliceType: ParsedTicket['sliceType'] = 'tracer_bullet';
    if (sliceMatch) {
      sliceType = sliceMatch[1].toLowerCase().includes('wide')
        ? 'wide_refactor'
        : 'tracer_bullet';
    }

    // Extract blocked by / dependencies
    const blockedByMatch = section.match(
      /\*\*(?:Blocked\s+by|Dependencies):\*\*\s*([^\n]+)/i,
    );
    let blockedBy: string[] | undefined;
    if (blockedByMatch) {
      const rawBlockers = blockedByMatch[1].trim();
      if (
        !/^(none|n\/a|nil|empty|no\s+blockers)/i.test(rawBlockers)
      ) {
        blockedBy = rawBlockers
          .split(/[,;]|\band\b/i)
          .map((b) => b.replace(/^\[|\]$/g, '').trim())
          .filter(Boolean);
      }
    }

    // Extract files to touch
    const filesMatch = section.match(
      /\*\*(?:Files\s+to\s+touch|Target\s+Files):\*\*\s*([^\n]+)/i,
    );
    let filesToTouch: string[] | undefined;
    if (filesMatch) {
      const rawFiles = filesMatch[1].trim();
      if (!/^(none|n\/a)/i.test(rawFiles)) {
        filesToTouch = rawFiles
          .split(/[,;]/)
          .map((f) => f.replace(/[`*]/g, '').trim())
          .filter(Boolean);
      }
    }

    if (titleLine && (description || criteria.length > 0)) {
      tickets.push({
        title: titleLine,
        description,
        acceptanceCriteria: criteria,
        priority,
        estimatedEffort,
        sliceType,
        blockedBy,
        filesToTouch,
      });
    }
  }

  return tickets;
}
