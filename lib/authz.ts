export function canAccessProject(
  projectUserId: string,
  identitySubject: string
): boolean {
  return projectUserId === identitySubject;
}
