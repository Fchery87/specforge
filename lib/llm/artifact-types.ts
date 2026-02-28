export function getArtifactTypeForPhase(phaseId: string): string {
  switch (phaseId) {
    case 'constitution':
      return 'constitution';
    case 'brief':
      return 'brief';
    case 'prd':
      return 'prd';
    case 'domainModel':
      return 'domainModel';
    case 'specs':
      return 'spec';
    case 'stories':
      return 'stories';
    case 'artifacts':
      return 'artifacts';
    case 'handoff':
      return 'handoff';
    default:
      return 'doc';
  }
}
