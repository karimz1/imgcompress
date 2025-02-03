export const pluralize = (count: number, singular: string, plural: string): string =>
    count === 1 ? singular : plural;
  