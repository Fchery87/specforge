/**
 * Maps phaseId to artifact type for database storage
 */
export function mapPhaseToArtifactType(
  phaseId: string,
):
  | 'brief'
  | 'constitution'
  | 'prd'
  | 'domainModel'
  | 'spec'
  | 'techSpec'
  | 'userStories'
  | 'handoff' {
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
      return 'techSpec';
    case 'stories':
      return 'userStories';
    case 'artifacts':
      return 'handoff';
    case 'handoff':
      return 'handoff';
    default:
      return 'handoff';
  }
}
