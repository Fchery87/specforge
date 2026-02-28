import { describe, it, expect } from 'vitest';
import {
  exportToSif,
  validateSif,
  type ExportProject,
  type ExportPhase,
  type ExportArtifact,
} from '../sif-exporter';
import { SIF_SCHEMA_URL, SIF_SCHEMA_VERSION } from '../sif-schema';

describe('sif-exporter', () => {
  const mockProject: ExportProject = {
    _id: 'project123' as any,
    title: 'Test Project',
    description: 'A test project for SIF export',
    createdAt: 1704067200000,
    updatedAt: 1706659200000,
    userId: 'user456',
  };

  const mockPhases: ExportPhase[] = [
    {
      _id: 'phase1' as any,
      projectId: 'project123' as any,
      phaseId: 'constitution',
      status: 'ready',
    },
    {
      _id: 'phase2' as any,
      projectId: 'project123' as any,
      phaseId: 'brief',
      status: 'ready',
    },
  ];

  const mockArtifacts: ExportArtifact[] = [
    {
      _id: 'artifact1' as any,
      projectId: 'project123' as any,
      phaseId: 'constitution',
      type: 'constitution',
      title: 'Project Constitution',
      content: '# Constitution\n\nProject standards and constraints.',
      sections: [{ name: 'Standards', tokens: 100, model: 'gpt-4' }],
      provenance: {
        modelId: 'gpt-4',
        modelProvider: 'openai',
        promptHash: 'abc123',
        temperature: 0.7,
        generatedAt: 1704067200000,
        specforgeVersion: '2.0.0',
      },
    },
    {
      _id: 'artifact2' as any,
      projectId: 'project123' as any,
      phaseId: 'brief',
      type: 'brief',
      title: 'Project Brief',
      content: '# Brief\n\nProject overview and goals.',
      sections: [{ name: 'Overview', tokens: 50, model: 'gpt-4' }],
    },
  ];

  describe('exportToSif', () => {
    it('should export a valid SIF document', () => {
      const sif = exportToSif(mockProject, mockPhases, mockArtifacts, {
        userId: 'user456',
      });

      expect(sif.$schema).toBe(SIF_SCHEMA_URL);
      expect(sif.version).toBe(SIF_SCHEMA_VERSION);
      expect(sif.project.title).toBe('Test Project');
      expect(sif.project.description).toBe('A test project for SIF export');
      expect(sif.phases).toHaveLength(2);
      expect(sif.dependencyGraph).toBeDefined();
      expect(sif.metadata.exportedBy).toBe('user456');
    });

    it('should include artifacts in phases', () => {
      const sif = exportToSif(mockProject, mockPhases, mockArtifacts, {
        userId: 'user456',
      });

      const constitutionPhase = sif.phases.find((p) => p.id === 'constitution');
      expect(constitutionPhase).toBeDefined();
      expect(constitutionPhase?.artifacts).toHaveLength(1);
      expect(constitutionPhase?.artifacts[0].type).toBe('constitution');
      expect(constitutionPhase?.artifacts[0].contentHash).toBeDefined();
    });

    it('should include provenance data when available', () => {
      const sif = exportToSif(mockProject, mockPhases, mockArtifacts, {
        userId: 'user456',
      });

      const constitutionPhase = sif.phases.find((p) => p.id === 'constitution');
      const artifact = constitutionPhase?.artifacts[0];
      expect(artifact?.provenance).toBeDefined();
      expect(artifact?.provenance?.modelId).toBe('gpt-4');
      expect(artifact?.provenance?.modelProvider).toBe('openai');
    });

    it('should exclude hidden artifacts by default', () => {
      const hiddenArtifact: ExportArtifact = {
        ...mockArtifacts[0],
        _id: 'hidden1' as any,
        phaseId: 'brief',
        isHidden: true,
      };

      const sif = exportToSif(mockProject, mockPhases, [...mockArtifacts, hiddenArtifact], {
        userId: 'user456',
      });

      const briefPhase = sif.phases.find((p) => p.id === 'brief');
      expect(briefPhase?.artifacts).toHaveLength(1);
      expect(briefPhase?.artifacts[0].id).toBe('artifact2');
    });

    it('should include hidden artifacts when includeHidden is true', () => {
      const hiddenArtifact: ExportArtifact = {
        ...mockArtifacts[0],
        _id: 'hidden1' as any,
        phaseId: 'brief',
        isHidden: true,
      };

      const sif = exportToSif(mockProject, mockPhases, [...mockArtifacts, hiddenArtifact], {
        userId: 'user456',
        includeHidden: true,
      });

      const briefPhase = sif.phases.find((p) => p.id === 'brief');
      expect(briefPhase?.artifacts).toHaveLength(2);
    });

    it('should calculate L0 conformance level by default', () => {
      const sif = exportToSif(mockProject, mockPhases, mockArtifacts, {
        userId: 'user456',
      });

      expect(sif.metadata.conformanceLevel).toBe('L0');
    });

    it('should calculate L1 conformance level with constitution and semantic validation', () => {
      const sif = exportToSif(mockProject, mockPhases, mockArtifacts, {
        userId: 'user456',
        constitution: { lockedConstraints: {} },
        semanticValidationPassed: true,
      });

      expect(sif.metadata.conformanceLevel).toBe('L1');
    });

    it('should calculate L2 conformance level with all validations passed', () => {
      const sif = exportToSif(mockProject, mockPhases, mockArtifacts, {
        userId: 'user456',
        constitution: { lockedConstraints: {} },
        semanticValidationPassed: true,
        conformanceChecksPassed: true,
      });

      expect(sif.metadata.conformanceLevel).toBe('L2');
    });

    it('should include drift reports when available', () => {
      const phasesWithDrift: ExportPhase[] = [
        {
          ...mockPhases[0],
          driftReport: {
            driftDetected: true,
            driftSummary: 'Architecture drift detected',
            checkedAt: 1706659200000,
          },
        },
      ];

      const sif = exportToSif(mockProject, phasesWithDrift, mockArtifacts, {
        userId: 'user456',
      });

      expect(sif.phases[0].driftReport).toBeDefined();
      expect(sif.phases[0].driftReport?.driftDetected).toBe(true);
      expect(sif.phases[0].driftReport?.driftSummary).toBe('Architecture drift detected');
    });
  });

  describe('validateSif', () => {
    it('should validate a correct SIF document', () => {
      const sif = exportToSif(mockProject, mockPhases, mockArtifacts, {
        userId: 'user456',
      });

      const result = validateSif(sif);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object input', () => {
      const result = validateSif('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SIF must be an object');
    });

    it('should detect missing required fields', () => {
      const result = validateSif({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing $schema');
      expect(result.errors).toContain('Missing version');
      expect(result.errors).toContain('Missing project');
      expect(result.errors).toContain('Missing or invalid phases array');
    });

    it('should detect invalid phase structure', () => {
      const result = validateSif({
        $schema: SIF_SCHEMA_URL,
        version: SIF_SCHEMA_VERSION,
        project: { title: 'Test', description: 'Test' },
        phases: [{ invalid: true }],
        dependencyGraph: {},
        metadata: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Phase 0'))).toBe(true);
    });
  });
});
