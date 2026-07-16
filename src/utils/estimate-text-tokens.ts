const CHARS_PER_TOKEN = 4

export default (text: string): number => {
  if (!text) {
    return 0
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}
