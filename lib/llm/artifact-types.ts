export function getArtifactTypeForPhase(phaseId: string): string {
  switch (phaseId) {
    case "brief":
      return "brief";
    case "prd":
      return "prd";
    case "specs":
      return "spec";
    case "stories":
      return "stories";
    case "artifacts":
      return "artifacts";
    case "handoff":
      return "handoff";
    default:
      return "doc";
  }
}
