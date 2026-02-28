import { describe, it, expect } from 'vitest';
import {
  PHASE_DEPENDENCIES,
  getAffectedPhases,
  canGeneratePhase,
  getPhaseOrder,
  getRequiredContext,
  validateDependencyGraph,
  isDownstreamOf,
} from '../dependency-graph';

describe('dependency-graph', () => {
  describe('PHASE_DEPENDENCIES', () => {
    it('should define dependencies for all phases', () => {
      const phases = Object.keys(PHASE_DEPENDENCIES);
      expect(phases).toContain('constitution');
      expect(phases).toContain('brief');
      expect(phases).toContain('prd');
      expect(phases).toContain('domainModel');
      expect(phases).toContain('specs');
      expect(phases).toContain('stories');
      expect(phases).toContain('artifacts');
      expect(phases).toContain('handoff');
    });

    it('constitution should have no dependencies', () => {
      expect(PHASE_DEPENDENCIES.constitution).toEqual([]);
    });

    it('brief should have no dependencies', () => {
      expect(PHASE_DEPENDENCIES.brief).toEqual([]);
    });
  });

  describe('getAffectedPhases', () => {
    it('should return empty array for handoff (no downstream phases)', () => {
      const affected = getAffectedPhases('handoff');
      expect(affected).toEqual([]);
    });

    it('should return all downstream phases for constitution', () => {
      const affected = getAffectedPhases('constitution');
      expect(affected).toContain('prd');
      expect(affected).toContain('domainModel');
      expect(affected).toContain('specs');
      expect(affected).toContain('stories');
      expect(affected).toContain('artifacts');
      expect(affected).toContain('handoff');
      expect(affected.length).toBe(6);
    });

    it('should return correct downstream phases for specs', () => {
      const affected = getAffectedPhases('specs');
      expect(affected).toContain('stories');
      expect(affected).toContain('artifacts');
      expect(affected).toContain('handoff');
      expect(affected.length).toBe(3);
    });
  });

  describe('canGeneratePhase', () => {
    it('should allow constitution generation with no dependencies', () => {
      const result = canGeneratePhase('constitution', {});
      expect(result.canGenerate).toBe(true);
      expect(result.blockedBy).toEqual([]);
    });

    it('should allow brief generation with no dependencies', () => {
      const result = canGeneratePhase('brief', {});
      expect(result.canGenerate).toBe(true);
      expect(result.blockedBy).toEqual([]);
    });

    it('should block specs if dependencies are not ready', () => {
      const result = canGeneratePhase('specs', {
        brief: 'ready',
        prd: 'pending',
        domainModel: 'ready',
        constitution: 'ready',
      });
      expect(result.canGenerate).toBe(false);
      expect(result.blockedBy).toContain('prd');
    });

    it('should allow specs if all dependencies are ready', () => {
      const result = canGeneratePhase('specs', {
        brief: 'ready',
        prd: 'ready',
        domainModel: 'ready',
        constitution: 'ready',
      });
      expect(result.canGenerate).toBe(true);
      expect(result.blockedBy).toEqual([]);
    });
  });

  describe('getPhaseOrder', () => {
    it('should return all 8 phases in correct order', () => {
      const order = getPhaseOrder();
      expect(order.length).toBe(8);
      expect(order[0]).toBe('constitution');
      expect(order[1]).toBe('brief');
      expect(order[2]).toBe('prd');
      expect(order[3]).toBe('domainModel');
      expect(order[4]).toBe('specs');
      expect(order[5]).toBe('stories');
      expect(order[6]).toBe('artifacts');
      expect(order[7]).toBe('handoff');
    });
  });

  describe('getRequiredContext', () => {
    it('should return empty array for constitution', () => {
      expect(getRequiredContext('constitution')).toEqual([]);
    });

    it('should return correct dependencies for specs', () => {
      const context = getRequiredContext('specs');
      expect(context).toContain('prd');
      expect(context).toContain('domainModel');
      expect(context).toContain('constitution');
    });
  });

  describe('validateDependencyGraph', () => {
    it('should detect no cycles in the dependency graph', () => {
      const result = validateDependencyGraph();
      expect(result.valid).toBe(true);
      expect(result.cycles).toEqual([]);
    });
  });

  describe('isDownstreamOf', () => {
    it('should return true for direct dependency', () => {
      expect(isDownstreamOf('prd', 'constitution')).toBe(true);
    });

    it('should return true for transitive dependency', () => {
      expect(isDownstreamOf('specs', 'constitution')).toBe(true);
    });

    it('should return false for unrelated phases', () => {
      expect(isDownstreamOf('constitution', 'brief')).toBe(false);
    });

    it('should return false for upstream phase', () => {
      expect(isDownstreamOf('constitution', 'specs')).toBe(false);
    });
  });
});
