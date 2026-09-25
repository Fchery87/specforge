export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 20000;

export function normalizeProjectInput(params: {
  title: string;
  description: string;
}): { title: string; description: string } {
  const title = params.title.trim();
  const description = params.description.trim();

  if (!title) {
    throw new Error("Title is required");
  }
  if (title.length > TITLE_MAX) {
    throw new Error(`Title must be <= ${TITLE_MAX} characters`);
  }
  if (description.length > DESCRIPTION_MAX) {
    throw new Error(`Description must be <= ${DESCRIPTION_MAX} characters`);
  }

  return { title, description };
}
