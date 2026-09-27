import { describe, expect, it, vi } from 'vitest';
import {
  getSavedStageReportHandler,
  getStageReportHandler,
  saveStageReportHandler,
} from '../stageReports';

/**
 * A context that honours the index predicates and the ordering, unlike the simpler mocks elsewhere in
 * this folder that return every row regardless. The behaviour under test is which rows the module
 * picks, so a mock that ignores the filter would make these tests assert nothing.
 */
const INDEX_FIELDS: Record<string, Record<string, string[]>> = {
  artifacts: { by_phase: ['projectId', 'phaseId'] },
  artifactVersions: { by_artifact_version: ['artifactId', 'version'] },
  claims: { by_artifact: ['artifactId'] },
  evidenceLinks: { by_claim: ['claimId'] },
  tickets: { by_project_phase: ['projectId', 'phaseId'] },
  stageReports: { by_project_stage: ['projectId', 'stageId'] },
};

interface Row {
  _id: string;
  [key: string]: unknown;
}

function makeCtx(seed: Record<string, Row[]>, userId = 'owner') {
  const tables: Record<string, Map<string, Row>> = {};
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = new Map(rows.map((row) => [row._id, row]));
  }
  const ensure = (name: string) => (tables[name] ??= new Map());

  let nextId = 1;

  const ctx = {
    auth: {
      getUserIdentity: async () => (userId ? { subject: userId } : null),
    },
    db: {
      get: async (id: string) => {
        for (const table of Object.values(tables)) {
          const row = table.get(id);
          if (row) return row;
        }
        return null;
      },
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        const _id = `${tableName}_${nextId++}`;
        ensure(tableName).set(_id, { _id, ...doc });
        return _id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const table of Object.values(tables)) {
          const row = table.get(id);
          if (row) {
            table.set(id, { ...row, ...patch });
            return;
          }
        }
        throw new Error(`patch: ${id} not found`);
      },
      query: (tableName: string) => {
        const rows = () => Array.from(ensure(tableName).values());

        const build = (filters: Array<[string, unknown]>, order?: 'asc' | 'desc') => {
          const matched = () =>
            rows().filter((row) =>
              filters.every(([field, value]) => row[field] === value)
            );
          const sorted = () => {
            const result = matched();
            if (order !== 'desc') return result;
            return [...result].reverse();
          };
          return {
            first: async () => sorted()[0] ?? null,
            collect: async () => sorted(),
            order: (direction: 'asc' | 'desc') => build(filters, direction),
          };
        };

        return {
          withIndex: (indexName: string, predicate: (q: unknown) => unknown) => {
            const filters: Array<[string, unknown]> = [];
            const recorder = {
              eq: (field: string, value: unknown) => {
                filters.push([field, value]);
                return recorder;
              },
            };
            predicate(recorder);

            const fields = INDEX_FIELDS[tableName]?.[indexName];
            if (!fields) throw new Error(`unknown index ${tableName}.${indexName}`);

            // Ordering is by the index's own fields, so a desc read gives the highest last key first,
            // which is what "the latest version" means for by_artifact_version.
            const sorted = build(filters, 'desc');
            return {
              first: async () => sorted.first(),
              collect: async () => sorted.collect(),
              order: (direction: 'asc' | 'desc') => {
                const ordered = build(filters, direction);
                if (direction !== 'desc' || fields.length < 2) return ordered;
                const key = fields[fields.length - 1];
                const matched = rows().filter((row) =>
                  filters.every(([field, value]) => row[field] === value)
                );
                const byKey = [...matched].sort(
                  (a, b) => Number(b[key]) - Number(a[key])
                );
                return {
                  first: async () => byKey[0] ?? null,
                  collect: async () => byKey,
                  order: () => ordered,
                };
              },
            };
          },
        };
      },
    },
    __tables: tables,
  };

  return ctx;
}

const CLAIM_HEADER = '\n\n## Requirement Traceability\n\n';
const TRACED_CLAIM =
  '- **C-014** [confirmed; reviewed]: A requirement. — Evidence: lib/authz.ts (4f2a91c, supports)';
const UNTRACED_CLAIM = '- **C-015** [unresolved; pending]: A requirement. — Evidence not captured';

function seedFor({
  latestVersionContent,
  claims = [],
  tickets = [],
  versions = [{ _id: 'av1', artifactId: 'a1', version: 1, content: '## Requirements\n\nOld prose.' }],
}: {
  latestVersionContent?: string;
  claims?: Row[];
  tickets?: Row[];
  versions?: Row[];
}) {
  const content = latestVersionContent ?? '## Requirements\n\nProse.';
  return {
    projects: [{ _id: 'p1', userId: 'owner' }],
    artifacts: [
      { _id: 'a1', projectId: 'p1', phaseId: 'prd', content: 'stale artifact content' },
    ],
    artifactVersions: [
      ...versions,
      ...(content
        ? [{ _id: 'avLatest', artifactId: 'a1', version: 9, content }]
        : []),
    ],
    claims,
    evidenceLinks: [],
    tickets,
  };
}

describe('getStageReport', () => {
  it('measures the latest artifact version rather than the artifact content', async () => {
    const ctx = makeCtx(
      seedFor({ latestVersionContent: '## Requirements\n\n' + TRACED_CLAIM })
    );

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    // The artifact's own content is the stale string; the version is what was measured.
    expect(result.artifactVersionIds).toEqual(['avLatest']);
    // Traceability reads the claim records, not claims written into the markdown, so this stage has
    // none even though its text contains a claim bullet.
    expect(result.report.traceability).toEqual({ total: 0, traced: 0, untraced: 0 });
  });

  it('reads coverage and length from the text while traceability reads the claim records', async () => {
    const ctx = makeCtx(
      seedFor({
        latestVersionContent: `## Requirements\n\n${TRACED_CLAIM}`,
        claims: [
          {
            _id: 'c1',
            projectId: 'p1',
            artifactId: 'a1',
            phaseId: 'prd',
            claimId: 'C-014',
            decisionStatus: 'confirmed',
            reviewStatus: 'current',
            text: 'a',
          },
        ],
      })
    );
    ctx.__tables.evidenceLinks.set('el1', {
      _id: 'el1',
      projectId: 'p1',
      claimId: 'c1',
      sourceId: 'es1',
      supportStatus: 'supports',
    });
    ctx.__tables.evidenceSources = new Map([
      ['es1', { _id: 'es1', projectId: 'p1', locator: 'lib/authz.ts', revisionLabel: '4f2a91c' }],
    ]);

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    // Coverage finds the section in the text…
    expect(result.report.coverage.sections).toBe(1);
    // …and traceability counts the stored claim against the same artifact.
    expect(result.report.traceability).toEqual({ total: 1, traced: 1, untraced: 0 });
  });

  it('records the version it measured, so the report cannot describe an unseen revision', async () => {
    const ctx = makeCtx(seedFor({}));

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    expect(result.artifactVersionIds).toEqual(['avLatest']);
  });

  it('reports counts of zero rather than a percentage for a stage with no claims', async () => {
    const ctx = makeCtx(seedFor({}));

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    expect(result.report.traceability).toEqual({ total: 0, traced: 0, untraced: 0 });
  });

  it('counts an untraced claim as untraced and a traced one as traced', async () => {
    const ctx = makeCtx(
      seedFor({
        latestVersionContent: '## Requirements\n\nx',
        claims: [
          { _id: 'c1', projectId: 'p1', artifactId: 'a1', phaseId: 'prd', claimId: 'C-014', decisionStatus: 'confirmed', reviewStatus: 'current', text: 'a' },
          { _id: 'c2', projectId: 'p1', artifactId: 'a1', phaseId: 'prd', claimId: 'C-015', decisionStatus: 'unresolved', reviewStatus: 'needs_review', text: 'b' },
        ],
        tickets: [],
      })
    );
    // One link for the first claim only, so exactly one has evidence.
    ctx.__tables.evidenceLinks.set('el1', {
      _id: 'el1',
      projectId: 'p1',
      claimId: 'c1',
      sourceId: 'es1',
      supportStatus: 'supports',
    });
    ctx.__tables.evidenceSources = new Map([
      ['es1', { _id: 'es1', projectId: 'p1', locator: 'lib/authz.ts', revisionLabel: '4f2a91c' }],
    ]);

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    expect(result.report.traceability).toEqual({ total: 2, traced: 1, untraced: 1 });
  });

  it('ignores a retired claim', async () => {
    const ctx = makeCtx({
      ...seedFor({
        latestVersionContent: '## Requirements\n\nx',
        claims: [
          { _id: 'c1', projectId: 'p1', artifactId: 'a1', phaseId: 'prd', claimId: 'C-1', decisionStatus: 'confirmed', reviewStatus: 'current', text: 'a', retiredAt: 123 },
        ],
      }),
    });

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    expect(result.report.traceability.total).toBe(0);
  });

  it('gathers criteria and their classes from the stage tickets', async () => {
    const ctx = makeCtx(
      seedFor({
        latestVersionContent: '## Requirements\n\nx',
        tickets: [
          {
            _id: 't1',
            projectId: 'p1',
            phaseId: 'prd',
            acceptanceCriteria: ['Returns 204.', 'Should be fast.'],
            acceptanceCriteriaQuality: ['observable', 'unobservable'],
          },
        ],
      })
    );

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    expect(result.report.testability).toEqual({
      total: 2,
      observable: 1,
      unobservable: 1,
      vague: 0,
      unclassified: 0,
    });
  });

  it('reads a legacy ticket with no stored classes as unclassified', async () => {
    const ctx = makeCtx(
      seedFor({
        latestVersionContent: '## Requirements\n\nx',
        tickets: [
          {
            _id: 't1',
            projectId: 'p1',
            phaseId: 'prd',
            acceptanceCriteria: ['Returns 204.'],
          },
        ],
      })
    );

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    expect(result.report.testability.unclassified).toBe(1);
  });

  it('recomputes when a newer artifact version lands', async () => {
    const ctx = makeCtx(seedFor({ latestVersionContent: '## Requirements\n\nshort' }));
    const args = { projectId: 'p1' as never, stageId: 'requirements' };

    const before = await getStageReportHandler(ctx as never, args);

    // A new revision, longer than the one before it.
    ctx.__tables.artifactVersions.set('av2', {
      _id: 'av2',
      artifactId: 'a1',
      version: 10,
      content: '## Requirements\n\none two three four five six seven eight nine ten',
    });

    const after = await getStageReportHandler(ctx as never, args);

    // The read path holds nothing, so a new revision is picked up with no invalidation.
    expect(after.artifactVersionIds).toEqual(['av2']);
    expect(after.report.length.words).toBeGreaterThan(before.report.length.words);
  });

  it('rejects a read by a user who does not own the project', async () => {
    const ctx = makeCtx(seedFor({}), 'someone-else');

    await expect(
      getStageReportHandler(ctx as never, {
        projectId: 'p1' as never,
        stageId: 'requirements',
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it('rejects an unauthenticated read', async () => {
    const ctx = makeCtx(seedFor({}), '');

    await expect(
      getStageReportHandler(ctx as never, {
        projectId: 'p1' as never,
        stageId: 'requirements',
      })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('reports an unknown stage as empty rather than throwing', async () => {
    const ctx = makeCtx(seedFor({}));

    const result = await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'not-a-stage',
    });

    expect(result.report.traceability.total).toBe(0);
    expect(result.artifactVersionIds).toEqual([]);
  });
});

describe('saveStageReport', () => {
  it('stores a row a later read can return', async () => {
    const ctx = makeCtx(seedFor({ latestVersionContent: '## Requirements\n\nx' }));
    const args = { projectId: 'p1' as never, stageId: 'requirements' };

    await saveStageReportHandler(ctx as never, args);
    const saved = await getSavedStageReportHandler(ctx as never, args);

    expect(saved).not.toBeNull();
    expect(saved?.stageId).toBe('requirements');
    expect(saved?.artifactVersionIds).toEqual(['avLatest']);
  });

  it('upserts rather than appending, so a project has one row per stage', async () => {
    const ctx = makeCtx(seedFor({ latestVersionContent: '## Requirements\n\nx' }));
    const args = { projectId: 'p1' as never, stageId: 'requirements' };

    await saveStageReportHandler(ctx as never, args);
    const first = await getSavedStageReportHandler(ctx as never, args);

    await saveStageReportHandler(ctx as never, args);
    const second = await getSavedStageReportHandler(ctx as never, args);

    expect(ctx.__tables.stageReports?.size).toBe(1);
    expect(second?._id).toBe(first?._id);
  });

  it('rejects a write by a user who does not own the project', async () => {
    const ctx = makeCtx(seedFor({}), 'someone-else');

    await expect(
      saveStageReportHandler(ctx as never, {
        projectId: 'p1' as never,
        stageId: 'requirements',
      })
    ).rejects.toThrow(/Forbidden/);
  });
});

describe('the module never writes on the read path', () => {
  it('leaves the stageReports table untouched when a report is read', async () => {
    // Convex queries are read-only, so this is a structural fact rather than a choice. Asserting it
    // stops a later change from moving the write into the read path and failing at runtime instead.
    const ctx = makeCtx(seedFor({ latestVersionContent: '## Requirements\n\nx' }));
    const patch = vi.spyOn(ctx.db, 'patch');
    const insert = vi.spyOn(ctx.db, 'insert');

    await getStageReportHandler(ctx as never, {
      projectId: 'p1' as never,
      stageId: 'requirements',
    });

    expect(patch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(ctx.__tables.stageReports?.size ?? 0).toBe(0);
  });
});
