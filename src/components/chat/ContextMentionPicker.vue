<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { AtSignIcon, FileIcon, CodeIcon, SearchIcon } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/shadcn/ui/popover'
import useMcpServers from '@/composables/use-mcp-servers'
import mcpRuntime from '@/services/mcp/mcp-runtime'
import normalizeCodegraphResult from '@/services/codegraph/normalize-codegraph-result'
import { CODEGRAPH_SERVER_ID } from '@/types/codegraph/managed-codegraph'
import type { CodebaseToolSpan } from '@/types/codegraph/codebase-tool-result'
import type { ContextMention } from '@/types/harness/context-mention'

type PickerKind = 'file' | 'symbol' | 'codebase'

const emit = defineEmits<{
  select: [mention: ContextMention]
}>()

const mcp = useMcpServers()

const query = ref('')
const open = ref(false)
const kind = ref<PickerKind>('file')
const symbolResults = ref<CodebaseToolSpan[]>([])
const searching = ref(false)

let symbolSearchTimer: ReturnType<typeof setTimeout> | null = null
let symbolSearchGeneration = 0

const codegraphConnected = computed(
  () => mcp.serverStates.value[CODEGRAPH_SERVER_ID]?.status === 'connected',
)

const trimmedQuery = computed(() => query.value.trim())

const codebaseQuery = computed(() => {
  const raw = trimmedQuery.value
  const stripped = raw.replace(/^codebase\s+/i, '').trim()
  return stripped.length > 0 ? stripped : raw
})

const resetPicker = (): void => {
  open.value = false
  query.value = ''
  kind.value = 'file'
  symbolResults.value = []
  searching.value = false
}

const handleSelectFile = (): void => {
  const path = trimmedQuery.value
  if (!path) {
    return
  }
  emit('select', { type: 'file', path })
  resetPicker()
}

const handleSelectSymbol = (span: CodebaseToolSpan): void => {
  const name = span.symbol?.trim() || trimmedQuery.value
  if (!name || !span.path) {
    return
  }
  const mention: ContextMention = {
    type: 'symbol',
    path: span.path,
    name,
    startLine: span.startLine,
    endLine: span.endLine,
  }
  if (span.snippet) {
    mention.content = span.snippet
  }
  emit('select', mention)
  resetPicker()
}

const handleSelectCodebase = (): void => {
  const nextQuery = codebaseQuery.value
  if (!nextQuery) {
    return
  }
  emit('select', { type: 'codebase', query: nextQuery })
  resetPicker()
}

const runSymbolSearch = async (searchQuery: string): Promise<void> => {
  const generation = ++symbolSearchGeneration
  if (!codegraphConnected.value || searchQuery.length === 0) {
    symbolResults.value = []
    searching.value = false
    return
  }

  searching.value = true
  try {
    const raw = await mcpRuntime.callTool(CODEGRAPH_SERVER_ID, 'codegraph_search', {
      query: searchQuery,
    })
    if (generation !== symbolSearchGeneration) {
      return
    }
    const normalized = normalizeCodegraphResult.tool(raw)
    symbolResults.value = normalized.results.slice(0, 20)
  } catch (error) {
    if (generation !== symbolSearchGeneration) {
      return
    }
    symbolResults.value = []
    toast.error('Symbol search failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    if (generation === symbolSearchGeneration) {
      searching.value = false
    }
  }
}

const handleOpenChange = (nextOpen: boolean): void => {
  open.value = nextOpen
  if (!nextOpen) {
    if (symbolSearchTimer !== null) {
      clearTimeout(symbolSearchTimer)
      symbolSearchTimer = null
    }
    query.value = ''
    kind.value = 'file'
    symbolResults.value = []
    searching.value = false
  }
}

const handleKindSelect = (nextKind: PickerKind): void => {
  kind.value = nextKind
  symbolResults.value = []
  if (nextKind === 'symbol' && trimmedQuery.value) {
    runSymbolSearch(trimmedQuery.value).catch((error) => {
      toast.error('Symbol search failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  }
}

watch(trimmedQuery, (value) => {
  if (/^codebase\s+/i.test(value) && kind.value !== 'codebase') {
    kind.value = 'codebase'
  }
})

watch(
  [trimmedQuery, kind, open, codegraphConnected],
  ([value, activeKind, isOpen, connected]) => {
    if (symbolSearchTimer !== null) {
      clearTimeout(symbolSearchTimer)
      symbolSearchTimer = null
    }
    if (!isOpen || activeKind !== 'symbol') {
      return
    }
    if (!connected || value.length === 0) {
      symbolResults.value = []
      searching.value = false
      return
    }
    symbolSearchTimer = setTimeout(() => {
      runSymbolSearch(value).catch((error) => {
        toast.error('Symbol search failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }, 250)
  },
)
</script>

<template>
  <Popover :open="open" @update:open="handleOpenChange">
    <PopoverTrigger as-child>
      <Button
        size="sm"
        variant="ghost"
        class="h-7 gap-1 px-2 text-xs text-muted-foreground"
        title="Add context"
      >
        <AtSignIcon class="size-3.5 shrink-0" />
        Context
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-80 p-2" align="start">
      <div class="mb-2 flex gap-1">
        <Button
          size="sm"
          :variant="kind === 'file' ? 'secondary' : 'ghost'"
          class="h-7 flex-1 gap-1 px-2 text-xs"
          @click="handleKindSelect('file')"
        >
          <FileIcon class="size-3.5 shrink-0" />
          File
        </Button>
        <Button
          size="sm"
          :variant="kind === 'symbol' ? 'secondary' : 'ghost'"
          class="h-7 flex-1 gap-1 px-2 text-xs"
          @click="handleKindSelect('symbol')"
        >
          <CodeIcon class="size-3.5 shrink-0" />
          Symbol
        </Button>
        <Button
          size="sm"
          :variant="kind === 'codebase' ? 'secondary' : 'ghost'"
          class="h-7 flex-1 gap-1 px-2 text-xs"
          @click="handleKindSelect('codebase')"
        >
          <SearchIcon class="size-3.5 shrink-0" />
          Codebase
        </Button>
      </div>

      <Input
        v-model="query"
        class="h-8"
        :placeholder="
          kind === 'file'
            ? 'File path…'
            : kind === 'symbol'
              ? 'Symbol name…'
              : 'Codebase query…'
        "
        @keydown.enter.prevent="
          kind === 'file'
            ? handleSelectFile()
            : kind === 'codebase'
              ? handleSelectCodebase()
              : undefined
        "
      />

      <div class="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
        <template v-if="kind === 'file'">
          <p class="px-1 text-xs text-muted-foreground">
            Type a path to attach as file context.
          </p>
          <Button
            v-if="trimmedQuery"
            variant="ghost"
            class="h-8 w-full justify-start px-2"
            @click="handleSelectFile"
          >
            File: {{ trimmedQuery }}
          </Button>
        </template>

        <template v-else-if="kind === 'symbol'">
          <p
            v-if="!codegraphConnected"
            class="px-1 py-3 text-center text-xs text-muted-foreground"
          >
            CodeGraph is not connected. Start it from MCP to search symbols.
          </p>
          <p
            v-else-if="searching"
            class="px-1 py-3 text-center text-xs text-muted-foreground"
          >
            Searching symbols…
          </p>
          <p
            v-else-if="!trimmedQuery"
            class="px-1 py-3 text-center text-xs text-muted-foreground"
          >
            Type a symbol name to search.
          </p>
          <p
            v-else-if="symbolResults.length === 0"
            class="px-1 py-3 text-center text-xs text-muted-foreground"
          >
            No symbols match.
          </p>
          <Button
            v-for="(span, index) in symbolResults"
            :key="`${span.path}:${span.startLine}:${span.symbol ?? ''}:${index}`"
            variant="ghost"
            class="h-auto w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left"
            @click="handleSelectSymbol(span)"
          >
            <span class="truncate font-medium">
              {{ span.symbol ?? trimmedQuery }}
            </span>
            <span class="w-full truncate text-xs text-muted-foreground">
              {{ span.path }}:{{ span.startLine }}
            </span>
          </Button>
        </template>

        <template v-else>
          <p class="px-1 text-xs text-muted-foreground">
            Attach a codebase search query (type codebase plus your question).
          </p>
          <Button
            v-if="codebaseQuery"
            variant="ghost"
            class="h-8 w-full justify-start px-2"
            @click="handleSelectCodebase"
          >
            Codebase: {{ codebaseQuery }}
          </Button>
        </template>
      </div>
    </PopoverContent>
  </Popover>
</template>
