/** Lowercase and treat -, _, / as spaces so hyphenated ids match spaced queries. */
const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export default normalizeSearchText
