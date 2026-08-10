import slugify from 'slugify'

export default (value: string): string =>
  slugify(value, { lower: true, strict: true }) || 'untitled'
