import { tool } from 'ai'
import { z } from 'zod'
import {
  gateToolPermission,
  type PermissionGateContext,
} from '@/services/harness/gate-tool-permission'
import { browserNavigateCapability } from '@/services/harness/permission-policy'
import { toModelOutputWithImageParts } from '@/services/harness/tool-result-image-parts'
import withToolExamples from '@/services/harness/with-tool-examples'
import {
  browserLock,
  browserRequest,
  browserSetPolicy,
  browserStart,
  browserStatus,
  browserUnlock,
} from '@/services/pyrola/pyrola-tauri'

export type BrowserToolContext = PermissionGateContext & {
  chatId: string
  supportsVision: boolean
}

const hostFromUrl = (url: string): string => {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

const ensureBrowser = async (ctx: BrowserToolContext): Promise<void> => {
  if (!(ctx.settings['agent.browser.enabled'] ?? false)) {
    throw new Error(
      'Browser tools are disabled. Enable agent.browser.enabled in Settings.',
    )
  }
  await browserSetPolicy({
    allowedDomains: ctx.settings['agent.browser.allowedDomains'] ?? [],
    deniedDomains: ctx.settings['agent.browser.deniedDomains'] ?? [],
  })
  const status = await browserStatus()
  if (!status.running) {
    await browserStart()
  }
}

const req = async (
  ctx: BrowserToolContext,
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> => {
  await ensureBrowser(ctx)
  return browserRequest({
    method,
    params,
    chatId: ctx.chatId,
  })
}

const perceptionNote = (supportsVision: boolean): string =>
  supportsVision
    ? 'Use browser_snapshot for refs, then act. Use browser_take_screenshot to verify visual layout.'
    : 'browser_snapshot is your only perception — do not request screenshots to "see" the page. Use browser_highlight for text confirmation.'

export default (ctx: BrowserToolContext) => {
  const vision = ctx.supportsVision

  return {
    browser_tabs: tool({
      description:
        'List, select, or close tabs in the shared app-global browser. Close requires holding the tab lock.',
      inputSchema: z.object({
        action: z.enum(['list', 'select', 'close']),
        tabId: z.string().optional(),
      }),
      execute: async ({ action, tabId }, { toolCallId }) => {
        if (action === 'list') {
          return req(ctx, 'tabs.list')
        }
        if (!tabId) {
          return { error: 'tabId is required for select/close' }
        }
        if (action === 'select') {
          return req(ctx, 'tabs.select', { tabId })
        }
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_tabs',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Close browser tab ${tabId}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'tabs.close', { tabId })
      },
    }),

    browser_navigate: tool({
      description: withToolExamples(
        `Open or navigate a tab in the shared browser. ${perceptionNote(vision)}`,
        [{ url: 'https://example.com' }],
      ),
      inputSchema: z.object({
        url: z.string().describe('Absolute URL to open'),
        tabId: z.string().optional().describe('Existing tab id; omit to open a new tab'),
      }),
      execute: async ({ url, tabId }, { toolCallId }) => {
        const host = hostFromUrl(url)
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_navigate',
          kind: 'browser',
          action: 'browser.navigate',
          capability: browserNavigateCapability(host),
          title: `Navigate to ${host}`,
          detail: url,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser navigate denied' }
        }
        return req(ctx, 'navigate', { url, ...(tabId ? { tabId } : {}) })
      },
    }),

    browser_lock: tool({
      description: withToolExamples(
        'Lock or unlock a browser tab for this chat. Required before interact tools. Fail-fast if another chat holds the lock.',
        [
          { action: 'lock', tabId: 'tab_1' },
          { action: 'unlock', tabId: 'tab_1' },
        ],
      ),
      inputSchema: z.object({
        action: z.enum(['lock', 'unlock']).describe('Acquire or release the chat lock'),
        tabId: z.string().describe('Tab id from browser_tabs or navigate'),
      }),
      execute: async ({ action, tabId }) => {
        await ensureBrowser(ctx)
        if (action === 'lock') {
          return browserLock(tabId, ctx.chatId)
        }
        await browserUnlock(tabId, ctx.chatId)
        return { ok: true }
      },
    }),

    browser_snapshot: tool({
      description: withToolExamples(
        `Accessibility snapshot with opaque refs for the tab. ${perceptionNote(vision)}`,
        [{ tabId: 'tab_1' }],
      ),
      inputSchema: z.object({
        tabId: z.string().describe('Tab to snapshot'),
      }),
      execute: async ({ tabId }) => req(ctx, 'snapshot', { tabId }),
    }),

    browser_take_screenshot: tool({
      description: vision
        ? 'Capture a screenshot of the tab or element (ref). Image is sent to the model.'
        : 'Capture a screenshot to disk for the UI. Returns path/meta only — use browser_snapshot to perceive the page.',
      inputSchema: z.object({
        tabId: z.string(),
        fullPage: z.boolean().optional(),
        ref: z.string().optional(),
      }),
      execute: async ({ tabId, fullPage, ref }) => {
        const result = (await req(ctx, 'screenshot', {
          tabId,
          fullPage: fullPage ?? false,
          ...(ref ? { ref } : {}),
        })) as Record<string, unknown>

        if (vision && typeof result.path === 'string') {
          return {
            ...result,
            imageParts: [{ mimeType: 'image/png', path: result.path }],
          }
        }

        return {
          ...result,
          note: vision
            ? undefined
            : 'Text-only model: screenshot saved for UI only. Use browser_snapshot — do not try to view this image.',
        }
      },
      toModelOutput: async ({ toolCallId, output }) =>
        toModelOutputWithImageParts({
          toolCallId,
          output,
          supportsVision: vision,
        }),
    }),

    browser_click: tool({
      description: withToolExamples('Click an element by snapshot ref. Requires tab lock.', [
        { tabId: 'tab_1', ref: 'e12' },
      ]),
      inputSchema: z.object({
        tabId: z.string().describe('Locked tab id'),
        ref: z.string().describe('Opaque ref from browser_snapshot'),
      }),
      execute: async ({ tabId, ref }, { toolCallId }) => {
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_click',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Click ${ref}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'click', { tabId, ref })
      },
    }),

    browser_hover: tool({
      description: 'Hover an element by snapshot ref. Requires tab lock.',
      inputSchema: z.object({
        tabId: z.string(),
        ref: z.string(),
      }),
      execute: async ({ tabId, ref }, { toolCallId }) => {
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_hover',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Hover ${ref}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'hover', { tabId, ref })
      },
    }),

    browser_type: tool({
      description: withToolExamples('Type text into an element by ref. Requires tab lock.', [
        { tabId: 'tab_1', ref: 'e8', text: 'hello@example.com' },
      ]),
      inputSchema: z.object({
        tabId: z.string().describe('Locked tab id'),
        ref: z.string().describe('Opaque ref from browser_snapshot'),
        text: z.string().describe('Text to type'),
      }),
      execute: async ({ tabId, ref, text }, { toolCallId }) => {
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_type',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Type into ${ref}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'type', { tabId, ref, text })
      },
    }),

    browser_fill: tool({
      description: withToolExamples('Fill an input by ref (replace value). Requires tab lock.', [
        { tabId: 'tab_1', ref: 'e8', value: 'hello@example.com' },
      ]),
      inputSchema: z.object({
        tabId: z.string().describe('Locked tab id'),
        ref: z.string().describe('Opaque ref from browser_snapshot'),
        value: z.string().describe('Replacement input value'),
      }),
      execute: async ({ tabId, ref, value }, { toolCallId }) => {
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_fill',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Fill ${ref}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'fill', { tabId, ref, value })
      },
    }),

    browser_select_option: tool({
      description: 'Select option(s) in a select element by ref. Requires tab lock.',
      inputSchema: z.object({
        tabId: z.string(),
        ref: z.string(),
        values: z.array(z.string()),
      }),
      execute: async ({ tabId, ref, values }, { toolCallId }) => {
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_select_option',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Select option on ${ref}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'selectOption', { tabId, ref, values })
      },
    }),

    browser_press_key: tool({
      description: 'Press a key in the tab. Requires tab lock.',
      inputSchema: z.object({
        tabId: z.string(),
        key: z.string(),
      }),
      execute: async ({ tabId, key }, { toolCallId }) => {
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_press_key',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Press key ${key}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'pressKey', { tabId, key })
      },
    }),

    browser_scroll: tool({
      description: 'Scroll the page or an element into view. Requires tab lock.',
      inputSchema: z.object({
        tabId: z.string(),
        ref: z.string().optional(),
        direction: z.enum(['up', 'down', 'left', 'right']).optional(),
        amount: z.number().optional(),
      }),
      execute: async ({ tabId, ref, direction, amount }, { toolCallId }) => {
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_scroll',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: 'Scroll browser',
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'scroll', {
          tabId,
          ...(ref ? { ref } : {}),
          ...(direction ? { direction } : {}),
          ...(amount != null ? { amount } : {}),
        })
      },
    }),

    browser_drag: tool({
      description: 'Drag from one ref to another. Requires tab lock.',
      inputSchema: z.object({
        tabId: z.string(),
        fromRef: z.string(),
        toRef: z.string(),
      }),
      execute: async ({ tabId, fromRef, toRef }, { toolCallId }) => {
        const allowed = await gateToolPermission({
          ctx,
          toolCallId,
          name: 'browser_drag',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Drag ${fromRef} → ${toRef}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser interact denied' }
        }
        return req(ctx, 'drag', { tabId, fromRef, toRef })
      },
    }),

    browser_highlight: tool({
      description: 'Highlight an element by ref (text confirmation for grounding).',
      inputSchema: z.object({
        tabId: z.string(),
        ref: z.string(),
      }),
      execute: async ({ tabId, ref }) => req(ctx, 'highlight', { tabId, ref }),
    }),

    browser_get_bounding_box: tool({
      description: 'Get bounding box for a snapshot ref.',
      inputSchema: z.object({
        tabId: z.string(),
        ref: z.string(),
      }),
      execute: async ({ tabId, ref }) => req(ctx, 'getBoundingBox', { tabId, ref }),
    }),
  }
}
