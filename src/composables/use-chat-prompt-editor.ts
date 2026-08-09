import type { Editor } from '@tiptap/core'
import { ref } from 'vue'
import type { ContextMention } from '@/types/harness/context-mention'

type InsertMentionFn = (mention: ContextMention) => void
type InsertTextFn = (text: string) => void

const editorRef = ref<Editor | null>(null)
const insertMentionRef = ref<InsertMentionFn | null>(null)
const insertTextRef = ref<InsertTextFn | null>(null)

const registerEditor = (
  editor: Editor | null,
  insertMention: InsertMentionFn | null,
  insertText: InsertTextFn | null,
): void => {
  editorRef.value = editor
  insertMentionRef.value = insertMention
  insertTextRef.value = insertText
}

const insertMention = (mention: ContextMention): boolean => {
  const insert = insertMentionRef.value
  if (!insert) {
    return false
  }
  insert(mention)
  return true
}

const insertText = (text: string): boolean => {
  const insert = insertTextRef.value
  if (!insert) {
    return false
  }
  insert(text)
  return true
}

export default () => ({
  editorRef,
  registerEditor,
  insertMention,
  insertText,
})
