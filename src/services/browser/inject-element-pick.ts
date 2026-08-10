import type CdpClient from '@/services/browser/cdp-client'

type PickPayload = {
  x: number
  y: number
}

const INSTALL_SCRIPT = `(() => {
  if (window.__pyrolaPickHandler) {
    return 'already';
  }
  window.__pyrolaPick = null;
  window.__pyrolaPickHandler = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.__pyrolaPick = {
      x: event.clientX,
      y: event.clientY,
    };
  };
  document.addEventListener('click', window.__pyrolaPickHandler, true);
  return 'ok';
})()`

const READ_SCRIPT = `(() => {
  const pick = window.__pyrolaPick;
  if (!pick || typeof pick.x !== 'number' || typeof pick.y !== 'number') {
    return null;
  }
  window.__pyrolaPick = null;
  return { x: pick.x, y: pick.y };
})()`

const CLEANUP_SCRIPT = `(() => {
  if (window.__pyrolaPickHandler) {
    document.removeEventListener('click', window.__pyrolaPickHandler, true);
    window.__pyrolaPickHandler = null;
  }
  window.__pyrolaPick = null;
  return 'ok';
})()`

type EvaluateResult = {
  result?: {
    value?: unknown
  }
}

const evaluate = async (
  client: CdpClient,
  expression: string,
): Promise<unknown> => {
  // Page-target CDP: omit flattened session id.
  const raw = (await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: false,
  })) as EvaluateResult
  return raw.result?.value
}

export const installElementPickListener = async (
  client: CdpClient,
): Promise<void> => {
  await evaluate(client, INSTALL_SCRIPT)
}

export const readElementPick = async (
  client: CdpClient,
): Promise<PickPayload | null> => {
  const value = await evaluate(client, READ_SCRIPT)
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  if (typeof record.x !== 'number' || typeof record.y !== 'number') {
    return null
  }
  return { x: record.x, y: record.y }
}

export const cleanupElementPickListener = async (
  client: CdpClient,
): Promise<void> => {
  await evaluate(client, CLEANUP_SCRIPT)
}
