export interface ParsedTicket {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedEffort?: string;
}

/**
 * Parses user story markdown into structured tickets.
 * Looks for H3 headings (### ) as ticket boundaries.
 * Extracts acceptance criteria from bullet lists under "Acceptance Criteria" heading.
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
          l.trim(),
      )
      .join('\n')
      .trim();

    // Extract acceptance criteria (bullet points)
    const criteria: string[] = [];
    if (acIndex !== -1) {
      for (let i = acIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('- ')) {
          criteria.push(line.slice(2).trim());
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

    if (titleLine && (description || criteria.length > 0)) {
      tickets.push({
        title: titleLine,
        description,
        acceptanceCriteria: criteria,
        priority,
        estimatedEffort,
      });
    }
  }

  return tickets;
}
