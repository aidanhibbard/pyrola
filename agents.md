# Conventions

## Components

Vite/Vue projects do not auto-import components by default, so **use explicit `import` statements** for all components used in templates.

```ts
import AppHeader from '@/components/navigation/header/AppHeader.vue'
```

> If the project has added `unplugin-vue-components` (or similar) for auto-import, follow that plugin's own resolver/naming rules instead of the manual pattern below — don't mix both approaches in the same codebase.

### Path-based names

Namespace components with folders; keep the **filename** as a clear, specific PascalCase name. When referring to a component conceptually (e.g. in comments or docs), build the name from folder segments plus filename, duplicate segments removed:

```text
src/components/navigation/header/AppHeader.vue  →  NavigationHeaderAppHeader
src/components/posts/card/PostCard.vue          →  PostsCardPostCard
```

- Use **lowercase folder segments** for namespaces (`navigation/`, `posts/`, `layout/`).
- Use **PascalCase** for component files (`AppHeader.vue`, `PostCard.vue`).
- Prefer filenames that read well with their path (e.g. `AppHeader` under `navigation/header/`, not a vague `Index.vue` unless the path already disambiguates).
- Register the imported component under a local name matching this convention (`import NavigationHeaderAppHeader from ...`) when a file uses multiple components that could otherwise collide.

### Usage in templates and scripts

- **Static usage:** import explicitly, then use the PascalCase tag in templates (`<NavigationHeaderAppHeader />`).
- **Lazy / code-split:** use `defineAsyncComponent`:

```ts
const NavigationHeaderAppHeader = defineAsyncComponent(
  () => import('@/components/navigation/header/AppHeader.vue'),
)
```

- **Dynamic `:is`:** import the component and pass the reference directly to `:is` rather than resolving by string name.
- **Suspense boundaries:** wrap async component trees in `<Suspense>` with an explicit `#fallback` when a component uses `async setup()` or top-level `await`.

### Scope and vendored UI

- These rules apply to **first-party** components (everything under `src/components/` outside generated/vendor trees).
- Do not reorganize or rename `src/components/shadcn/**` or other vendored component sets to satisfy first-party naming; follow upstream / library conventions and customize at call sites or via thin wrappers in a namespaced folder (e.g. `src/components/navigation/header/AppHeader.vue` composing shadcn primitives).

### Client-only concerns (browser APIs, widgets)

This is a client-rendered Vite SPA by default, so there is no server/client split to manage per component. For code that must only run in the browser (e.g. depends on `window`, `document`, third-party widgets):

- Guard access inside `onMounted` / lifecycle hooks rather than at module scope, so the code never runs during any build-time prerendering step.
- If the project uses `vite-plugin-ssr`, `@vitejs/plugin-vue` SSR, or similar for server rendering, treat any such code as needing an explicit client-only boundary (e.g. a wrapper component that only renders after mount) — confirm the project's SSR setup before assuming plain CSR.
- Set page `<title>` / meta tags via `@vueuse/head` (or `unhead`) inside `setup()`; keep this logic in the component/page itself rather than scattering DOM manipulation across the app.

## File naming (TypeScript and modules)

- Use **kebab-case** for essentially all first-party non-Vue source filenames: `my-service.ts`, `pending-team-checkout-payload.ts`, `use-billing.ts`, `team-role.ts`.
- Applies to `src/services/**`, `src/composables`, `src/utils`, `src/router`, `src/stores`, `src/plugins`, and any `types` / `interfaces` directories (for example `src/types/teams/team-role.ts`).
- **Exceptions** where the existing layer conventions take precedence:
  - Vue single-file components (for example under `src/components`, `src/views` or `src/pages`)
- Do not add new `PascalCase.ts` or `camelCase.ts` module names outside those exceptions.

## Imports

- **No dynamic imports.** Use static `import` statements at the top of the file. Do not use `await import()` or dynamic `import()` expressions.
- All imports must be declared at the module level, before any other code.
- This applies to all first-party code: composables, services, components, utilities, and stores.
- **Exception:** Code-splitting for route-level components or heavy third-party libraries that are only needed on specific routes may use dynamic imports, but this should be rare and explicitly justified.

## Vue SFC Block Order

- Vue single-file components must use `<script setup lang="ts">` for script blocks.
- When a Vue file has script logic, put `<script setup lang="ts">` first, then `<template>`, then `<style scoped>` only if needed.
- Do not use plain `<script>`, non-setup scripts, or JavaScript-only script blocks in first-party Vue files.

## Script Setup Content Order

Group `script setup` content in this order:

1. Imports
2. Types and interfaces
3. Generic constants or static data: `const pageName = 'test'`
4. Composables
5. Reactive state (`ref`, `reactive`, `shallowRef`) and then `computed`
   - Such as

   ```ts
   const state = reactive<{ page: number }>({ page: 1 })
   ```
6. Method constants
7. Watchers and lifecycle / event hooks

Keep each group contiguous. Do not interleave methods with computed values or watchers.

## Methods

- Declare component and composable methods as constants.
- Prefer:

```ts
const handleSubmit = async (): Promise<void> => {
  // ...
}
```

- Avoid:

```ts
async function handleSubmit(): Promise<void> {
  // ...
}
```

## Composables

- Name composable files in kebab-case, for example `use-example.ts`.
- Use a **default export** and import it explicitly where needed; Vite has no auto-import for composables out of the box.

```ts
// use-example.ts
export default () => {
  // ...
}
```

```ts
// consumer
import useExample from '@/composables/use-example'

const example = useExample()
```

- Factory-style composables also default-export from the composable file:

```ts
export default createUseWidget()
```

- Keep the composable body ordered as:
  - composables
  - state
  - computed
  - method constants
  - watchers / lifecycle hooks
  - return

## Persisted CRUD forms (client-side data fetching)

For first-party forms that **read and write persisted server state** (settings, billing, entity editors, and similar), treat data fetching as an explicit client-side concern (no build-time SSR to lean on):

- **Shared schemas:** If a change touches a form, review the existing form implementation patterns and use the shadcn Vue MCP before implementing. Define the form validation schema in `src/schemas` (or a shared package if the frontend and backend live in the same repo) when the same payload is submitted to the backend, and use that schema from both the form and the API layer.
- **Data fetching:** Use a small composable wrapping `fetch`/`axios` (or `@tanstack/vue-query` if the project already depends on it) that returns `data`, `status`/`pending`, `error`, and a `refresh` function. Call the fetch inside `onMounted` (or immediately in `setup()` if it should start before the component mounts) rather than at module scope.
- **After a successful mutation** (`POST` / `PUT` / `PATCH` / `DELETE`): reconcile the UI with the server by calling **`await refresh()`** (or the equivalent refetch) on the **same** query/composable instance that backs the read model. Local `data` should match what the user just saved; avoid leaving the form on stale client-only state.
- **Loading:** Use a dedicated `ref` (or the composable's `pending`/`isFetching` where it fits) so the flow is: set loading **`true`** → perform mutation → **`await refresh()`** so data matches the server → set loading **`false`**.
- **Control flow:** Wrap mutation + `refresh()` in **`try` / `catch` / `finally`**. Always clear loading in **`finally`** so it resets whether the mutation or refresh succeeds or throws.
- **Toasts:** On both success and failure, show feedback with **`toast` from `vue-sonner`** (the app uses the shadcn-style **Sonner** toaster). Keep messages short and specific.

## Tables And Filtered Lists

For first-party tables, paginated lists, filters, search, and data browsing flows such as projects, users, teams, and similar:

- Use shadcn Vue table primitives and consult the shadcn Vue MCP before implementing or substantially changing a table.
- Keep component-owned table state in a single `reactive` object where practical, for example page number, query, filters, sort, and user/team scope.
- Fetch the first page in `onMounted` (or via a composable that fires immediately in `setup()`) so the table has an explicit, single entry point for its initial load instead of scattering fetch calls.
- Prefer a small `useApi`-style composable (wrapping `fetch`/`axios`) for simple endpoint-backed tables and filters; use `@tanstack/vue-query` when the project already depends on it and needs caching, retries, or request de-duplication across components.
- Drive refetching by passing computed query params and explicit `watch` sources for the state fields that should refetch.
- Prefer this pattern:

```vue
<script setup lang="ts">
import { reactive, watch } from 'vue'
import useApi from '@/composables/use-api'

// You handle component state.
const state = reactive<{
  page: number
  query: string
}>({
  page: 1,
  query: '',
})

// The composable handles fetching, loading state, and refetches.
const {
  data: posts,
  status,
  error,
  refresh,
} = useApi('/api/posts', {
  query: computed(() => ({
    page: state.page,
    query: state.query,
  })),
})

watch(
  [() => state.page, () => state.query],
  () => refresh(),
)
</script>
```

- When a request should be cancellable, pass an `AbortController`/`signal` through to `fetch` (or the underlying client) so stale requests can be cancelled when params change:

```ts
const controller = new AbortController()

const { data: posts } = useApi('/api/posts', {
  query: computed(() => ({ page: state.page, query: state.query })),
  signal: controller.signal,
})
```

## Styling And shadcn

First-party UI must be built with **shadcn-vue** primitives and **Tailwind utility classes** in templates only.

- Do **not** add `<style>` blocks (scoped or unscoped) to first-party Vue components.
- Do **not** use `@apply` in first-party component code.
- Do **not** use `:deep()` or other CSS overrides to patch shadcn internals — pass supported `class` props, compose wrappers, or consult the shadcn Vue MCP for the correct primitive.
- Prefer shadcn layout patterns (for example sidebar blocks with `SidebarMenuButton`, icons beside labels, `variant="floating"`) over bespoke markup.
- Glass / translucent surfaces: use Tailwind utilities such as `bg-white/85`, `dark:bg-black/85`, `backdrop-blur-xl`, and `border-border/50` on shadcn components — not custom CSS.
- Global base styles and design tokens belong in `src/assets/css/` only (`tailwind.css`, `main.css`).
- Consult the **shadcn Vue MCP** before adding or substantially changing UI.

## Scope

These conventions apply to first-party app code. Do not rewrite vendored-style `shadcn` internals just to force this structure.

## Generated And Vendored Code

- Do not edit generated or vendored-style components directly.
- Prefer customizing behavior at the call site or through first-party wrapper components.
- Use upstream docs, MCP references, or local examples before changing how generated-style primitives are used.

## User Feedback, Loading, And Errors

- For user-triggered async actions, use explicit loading state that makes the UI look intentional while work is in progress.
- Wrap async mutations and user actions in `try` / `catch` / `finally` when failure is possible. Show success and failure feedback with `toast` from `vue-sonner` where the app already uses Sonner.
- Always clear loading state in `finally` so buttons, forms, and controls recover whether the action succeeds or throws.
- Keep toast messages short, specific, and user-facing.

## Error Handling

- **No empty catch blocks.** Every `catch` must either handle the error (log, notify, recover) or re-throw it. Silent failures hide bugs and make debugging difficult.
- **Always notify users of errors.** Use `toast.error()` from `vue-sonner` to inform users when an operation fails. Include a brief title and, when available, the error message in the `description` field.
- **Example pattern:**
  ```ts
  try {
    await someAsyncOperation()
  } catch (error) {
    toast.error('Operation failed', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  ```
- For non-critical errors (e.g., optional features, background tasks), still log or notify rather than silently swallowing the exception.

## Logging

- Do not add client-side logging in first-party app code. Avoid `console.log`, `console.warn`, `console.error`, and similar browser logging outside temporary local debugging that is removed before finishing the task.
- Logging should happen on the backend/API only, where logs can use a scoped server logger and avoid leaking browser/user details.
- Do not prefix log messages with service names such as `[service-name]`.
- If the backend has a logger utility, create a scoped logger per file with `logger.withTag('name')` and use that tagged logger for all logs in the file.
- Keep log messages focused on the event itself, not the file name.

## Types And Interfaces

- Reusable contracts must live in dedicated `types` or `interfaces` directories, not inside services, routes, or components.
- Do not use `any` types. Use precise types, existing inferred types, generics, `unknown` with narrowing, or small local interfaces instead.
- Use:
  - `src/types` and `src/interfaces`
  - A shared package/directory (e.g. `shared/types`) if the frontend and backend live in the same repo and share contracts
- Keep local inline typing minimal. It is fine to use small local param or return annotations for one-off helpers.
- If a type or interface is reused or is part of a public contract, move it into the appropriate `types` or `interfaces` directory.
- Do not export types from service implementation files.
- Do not declare `interface` or `type` aliases in API client files, route handlers, or worker files. Put request bodies, job shapes, and other contracts in the appropriate `types` or `interfaces` directories.

## API Input Validation

- Validate every input crossing an API boundary at runtime before using it, on whichever side owns that boundary. Do not use TypeScript generics as a substitute for validation.
- Define reusable request/response schemas (e.g. with `zod`) in `src/schemas` (or a shared package) when the shape is part of an API contract or shared between the Vue app and its backend.
- For one-off, purely local validation, a small local schema is acceptable, but prefer shared schemas for forms, API contracts, and anything reused across the app.
- When adding or touching forms, the frontend and backend must use the same shared schema wherever practical.

## Exports

- Files should export one thing only.
- The only exception is a barrel file such as `index.ts`.
- Services should not bundle multiple methods in a single implementation file.
- For service modules, put each method in its own file and re-export from a barrel.

## Service/API Client File Structure

- Service and API client filenames must use kebab-case, for example `my-service.ts`. The same kebab-case rule applies to `types` and `interfaces` module filenames (see **File naming (TypeScript and modules)** above).
- Use directories for namespacing related files, for example `src/services/pusher/credits/team-channel.ts`.
- Client modules such as S3 or Pusher clients should default export the configured client instance from a dedicated file rather than exporting getter helpers.

## Environment / config (`import.meta.env`)

- Access Vite env variables via `import.meta.env` **once at module scope** in any file that needs config, immediately after imports. Destructure what you need from that result, and pass values into functions as needed. Do not read `import.meta.env` inside nested helpers, utilities, or deep call chains.
- Only variables prefixed `VITE_` are exposed to client code by Vite; keep secrets out of the client bundle and behind the backend/API instead.
- Resolve config at the top of `<script setup>` or at the start of a composable / store factory (before other setup logic), not inside nested functions or callbacks.