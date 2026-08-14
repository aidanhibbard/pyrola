export type SearchReplaceOptions = {
  matchCase: boolean
  wholeWord: boolean
  regex: boolean
}

export type SearchReplaceLocation = {
  lineNumber: number
  startColumn?: number
  endColumn?: number
}

export type SearchReplaceResult = {
  content: string
  count: number
}
