export const HOME_CHAT_SLUG = '_home_'

export const isHomeChatSlug = (slug: string | null | undefined): boolean =>
  slug === HOME_CHAT_SLUG

/** Synthetic workbench project id when no fleet project is active. */
export const HOME_WORKSPACE_ID = HOME_CHAT_SLUG
