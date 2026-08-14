import * as monaco from 'monaco-editor'
import {
  isGitHeadModel,
  workingFileUri,
} from '@/utils/monaco-working-uri'

export default (path: string): monaco.editor.ITextModel | null => {
  const model = monaco.editor.getModel(workingFileUri(path))
  if (!model || isGitHeadModel(model)) {
    return null
  }
  return model
}
