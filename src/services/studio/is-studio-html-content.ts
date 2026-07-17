export default (content: string): boolean => {
  const trimmed = content.trimStart()
  if (/^<!DOCTYPE\s/i.test(trimmed)) {
    return true
  }
  if (/^<html[\s>]/i.test(trimmed)) {
    return true
  }
  if (/<script[\s>]/i.test(content)) {
    return true
  }
  const tagCount = (content.match(/<[a-z][\w-]*[\s>]/gi) ?? []).length
  return tagCount > 8
}
