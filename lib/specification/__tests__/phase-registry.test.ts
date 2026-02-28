import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerPhase,
  unregisterPhase,
  getPhaseDefinition,
  getAllPhases,
  getPhasesInOrder,
  getRequiredPhases,
  getVisiblePhases,
  validatePhaseRegistry,
  clearPhaseRegistry,
  registerDefaultPhases,
  type PhaseDefinition,
} from '../phase-registry';

describe('phase-registry', () => {
  beforeEach(() => {
    clearPhaseRegistry();
  });

  describe('registerPhase', () => {
    it('should register a phase', () => {
      const phase: PhaseDefinition = {
        id: 'test-phase',
        name: 'Test Phase',
        description: 'A test phase',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      registerPhase(phase);
      expect(getPhaseDefinition('test-phase')).toEqual(phase);
    });

    it('should throw error for duplicate phase ID', () => {
      const phase: PhaseDefinition = {
        id: 'test-phase',
        name: 'Test Phase',
        description: 'A test phase',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      registerPhase(phase);
      expect(() => registerPhase(phase)).not.toThrow(); // Should overwrite
    });

    it('should throw error for unknown dependency', () => {
      const phase: PhaseDefinition = {
        id: 'test-phase',
        name: 'Test Phase',
        description: 'A test phase',
        artifactType: 'test',
        sections: [],
        dependencies: ['unknown-phase'],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      expect(() => registerPhase(phase)).toThrow('depends on unknown phase');
    });

    it('should throw error for self-dependency', () => {
      const phase: PhaseDefinition = {
        id: 'test-phase',
        name: 'Test Phase',
        description: 'A test phase',
        artifactType: 'test',
        sections: [],
        dependencies: ['test-phase'],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      expect(() => registerPhase(phase)).toThrow('would create a dependency cycle');
    });

    it('should throw error for circular dependency', () => {
      const phaseA: PhaseDefinition = {
        id: 'phase-a',
        name: 'Phase A',
        description: 'Phase A',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      const phaseB: PhaseDefinition = {
        id: 'phase-b',
        name: 'Phase B',
        description: 'Phase B',
        artifactType: 'test',
        sections: [],
        dependencies: ['phase-a'],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      registerPhase(phaseA);
      registerPhase(phaseB);

      const phaseC: PhaseDefinition = {
        id: 'phase-c',
        name: 'Phase C',
        description: 'Phase C',
        artifactType: 'test',
        sections: [],
        dependencies: ['phase-b'],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      registerPhase(phaseC);

      // Now try to make phaseA depend on phaseC (creating a cycle)
      const phaseAUpdated: PhaseDefinition = {
        ...phaseA,
        dependencies: ['phase-c'],
      };

      expect(() => registerPhase(phaseAUpdated)).toThrow('would create a dependency cycle');
    });
  });

  describe('unregisterPhase', () => {
    it('should unregister a phase', () => {
      const phase: PhaseDefinition = {
        id: 'test-phase',
        name: 'Test Phase',
        description: 'A test phase',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      registerPhase(phase);
      expect(unregisterPhase('test-phase')).toBe(true);
      expect(getPhaseDefinition('test-phase')).toBeUndefined();
    });

    it('should throw error when unregistering a phase with dependents', () => {
      const phaseA: PhaseDefinition = {
        id: 'phase-a',
        name: 'Phase A',
        description: 'Phase A',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      const phaseB: PhaseDefinition = {
        id: 'phase-b',
        name: 'Phase B',
        description: 'Phase B',
        artifactType: 'test',
        sections: [],
        dependencies: ['phase-a'],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      registerPhase(phaseA);
      registerPhase(phaseB);

      expect(() => unregisterPhase('phase-a')).toThrow('phase "phase-b" depends on it');
    });
  });

  describe('getPhasesInOrder', () => {
    it('should return phases in topological order', () => {
      const phaseA: PhaseDefinition = {
        id: 'phase-a',
        name: 'Phase A',
        description: 'Phase A',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      const phaseB: PhaseDefinition = {
        id: 'phase-b',
        name: 'Phase B',
        description: 'Phase B',
        artifactType: 'test',
        sections: [],
        dependencies: ['phase-a'],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      const phaseC: PhaseDefinition = {
        id: 'phase-c',
        name: 'Phase C',
        description: 'Phase C',
        artifactType: 'test',
        sections: [],
        dependencies: ['phase-b'],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      registerPhase(phaseA);
      registerPhase(phaseB);
      registerPhase(phaseC);

      const ordered = getPhasesInOrder();
      expect(ordered.map((p) => p.id)).toEqual(['phase-a', 'phase-b', 'phase-c']);
    });
  });

  describe('getRequiredPhases', () => {
    it('should filter only required phases', () => {
      const requiredPhase: PhaseDefinition = {
        id: 'required',
        name: 'Required',
        description: 'Required phase',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      const optionalPhase: PhaseDefinition = {
        id: 'optional',
        name: 'Optional',
        description: 'Optional phase',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: false,
        isHidden: false,
        validators: [],
      };

      registerPhase(requiredPhase);
      registerPhase(optionalPhase);

      const required = getRequiredPhases();
      expect(required).toHaveLength(1);
      expect(required[0].id).toBe('required');
    });
  });

  describe('getVisiblePhases', () => {
    it('should filter only visible phases', () => {
      const visiblePhase: PhaseDefinition = {
        id: 'visible',
        name: 'Visible',
        description: 'Visible phase',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      const hiddenPhase: PhaseDefinition = {
        id: 'hidden',
        name: 'Hidden',
        description: 'Hidden phase',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: true,
        validators: [],
      };

      registerPhase(visiblePhase);
      registerPhase(hiddenPhase);

      const visible = getVisiblePhases();
      expect(visible).toHaveLength(1);
      expect(visible[0].id).toBe('visible');
    });
  });

  describe('validatePhaseRegistry', () => {
    it('should detect no cycles in valid registry', () => {
      const phaseA: PhaseDefinition = {
        id: 'phase-a',
        name: 'Phase A',
        description: 'Phase A',
        artifactType: 'test',
        sections: [],
        dependencies: [],
        isRequired: true,
        isHidden: false,
        validators: [],
      };

      registerPhase(phaseA);

      const result = validatePhaseRegistry();
      expect(result.valid).toBe(true);
      expect(result.cycles).toHaveLength(0);
    });
  });

  describe('registerDefaultPhases', () => {
    it('should register all 8 default phases', () => {
      registerDefaultPhases();
      const phases = getAllPhases();
      expect(phases).toHaveLength(8);

      const phaseIds = phases.map((p) => p.id);
      expect(phaseIds).toContain('constitution');
      expect(phaseIds).toContain('brief');
      expect(phaseIds).toContain('prd');
      expect(phaseIds).toContain('domainModel');
      expect(phaseIds).toContain('specs');
      expect(phaseIds).toContain('stories');
      expect(phaseIds).toContain('artifacts');
      expect(phaseIds).toContain('handoff');
    });

    it('should have correct dependencies for specs phase', () => {
      registerDefaultPhases();
      const specs = getPhaseDefinition('specs');
      expect(specs?.dependencies).toContain('prd');
      expect(specs?.dependencies).toContain('domainModel');
      expect(specs?.dependencies).toContain('constitution');
    });

    it('should have validators assigned', () => {
      registerDefaultPhases();
      const constitution = getPhaseDefinition('constitution');
      expect(constitution?.validators).toContain('semantic-constitution');

      const specs = getPhaseDefinition('specs');
      expect(specs?.validators).toContain('completeness-checker');
      expect(specs?.validators).toContain('api-schema-validator');
      expect(specs?.validators).toContain('security-coverage');
    });
  });
});
