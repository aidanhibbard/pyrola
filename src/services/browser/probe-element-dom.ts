import type CdpClient from '@/services/browser/cdp-client'

const MAX_ATTRIBUTES = 40
const MAX_ATTR_VALUE_LENGTH = 200
const MAX_OUTER_HTML_LENGTH = 12 * 1024
const MAX_INNER_TEXT_LENGTH = 500
const MAX_ANCESTOR_PATH_LENGTH = 1024
const TRUNCATION_MARKER = '...[truncated]'

type ElementDomProbe = {
  xpath: string
  cssSelector: string | null
  attributes: Record<string, string>
  computedStyles: Record<string, string>
  outerHTML: string | null
  innerText: string | null
  pageUrl: string | null
  ancestorPath: string | null
}

const ELEMENT_PROBE_FN = `function() {
  var MAX_ATTRIBUTES = ${MAX_ATTRIBUTES};
  var MAX_ATTR_VALUE_LENGTH = ${MAX_ATTR_VALUE_LENGTH};
  var MAX_OUTER_HTML_LENGTH = ${MAX_OUTER_HTML_LENGTH};
  var MAX_INNER_TEXT_LENGTH = ${MAX_INNER_TEXT_LENGTH};
  var MAX_ANCESTOR_PATH_LENGTH = ${MAX_ANCESTOR_PATH_LENGTH};
  var TRUNCATION_MARKER = ${JSON.stringify(TRUNCATION_MARKER)};
  var STYLE_KEYS = [
    'display',
    'position',
    'color',
    'backgroundColor',
    'fontSize',
    'fontFamily',
    'width',
    'height',
    'margin',
    'padding',
    'visibility'
  ];

  function truncate(text, maxLength) {
    var value = String(text || '');
    if (value.length <= maxLength) {
      return value;
    }
    return value.slice(0, maxLength) + TRUNCATION_MARKER;
  }

  function xpathFor(el) {
    if (!el || el.nodeType !== 1) {
      return '';
    }
    if (el.id) {
      return '//*[@id="' + String(el.id).replace(/"/g, '\\\\"') + '"]';
    }
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1) {
      var tag = (node.tagName || '').toLowerCase();
      if (!tag) {
        break;
      }
      var index = 1;
      var sibling = node.previousElementSibling;
      while (sibling) {
        if ((sibling.tagName || '').toLowerCase() === tag) {
          index += 1;
        }
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(tag + '[' + index + ']');
      if (node === document.documentElement) {
        break;
      }
      node = node.parentElement;
    }
    return '/' + parts.join('/');
  }

  function cssSelectorFor(el) {
    if (!el || el.nodeType !== 1) {
      return null;
    }
    if (el.id) {
      return '#' + CSS.escape(el.id);
    }
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      var tag = (node.tagName || '').toLowerCase();
      if (!tag) {
        break;
      }
      var part = tag;
      if (node.classList && node.classList.length > 0) {
        var cls = node.classList.item(0);
        if (cls) {
          part += '.' + CSS.escape(cls);
        }
      }
      var parent = node.parentElement;
      if (parent) {
        var same = 0;
        var idx = 0;
        for (var i = 0; i < parent.children.length; i++) {
          var child = parent.children[i];
          if ((child.tagName || '').toLowerCase() === tag) {
            same += 1;
            if (child === node) {
              idx = same;
            }
          }
        }
        if (same > 1) {
          part += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(part);
      node = parent;
      if (parts.length >= 5) {
        break;
      }
    }
    return parts.length > 0 ? parts.join(' > ') : null;
  }

  function ancestorPathFor(el) {
    if (!el || el.nodeType !== 1) {
      return null;
    }
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1) {
      var tag = (node.tagName || '').toLowerCase();
      if (!tag) {
        break;
      }
      var part = tag;
      if (node.id) {
        part += '#' + String(node.id);
      }
      if (node.classList && node.classList.length > 0) {
        for (var c = 0; c < node.classList.length; c++) {
          var className = node.classList.item(c);
          if (className) {
            part += '.' + className;
          }
        }
      }
      parts.push(part);
      if (tag === 'body' || tag === 'html') {
        break;
      }
      node = node.parentElement;
    }
    return truncate(parts.join(' > '), MAX_ANCESTOR_PATH_LENGTH);
  }

  var attributes = {};
  var attrs = this.attributes || [];
  for (var a = 0; a < attrs.length && Object.keys(attributes).length < MAX_ATTRIBUTES; a++) {
    var attr = attrs[a];
    if (!attr || !attr.name) {
      continue;
    }
    attributes[attr.name] = String(attr.value || '').slice(0, MAX_ATTR_VALUE_LENGTH);
  }

  var computedStyles = {};
  var style = window.getComputedStyle(this);
  for (var s = 0; s < STYLE_KEYS.length; s++) {
    var key = STYLE_KEYS[s];
    computedStyles[key] = String(style[key] || '');
  }

  var outerHTML = truncate(this.outerHTML || '', MAX_OUTER_HTML_LENGTH);
  var innerText = truncate(this.innerText || '', MAX_INNER_TEXT_LENGTH);
  var pageUrl = typeof location !== 'undefined' && location.href
    ? String(location.href)
    : null;

  return {
    xpath: xpathFor(this),
    cssSelector: cssSelectorFor(this),
    attributes: attributes,
    computedStyles: computedStyles,
    outerHTML: outerHTML || null,
    innerText: innerText || null,
    pageUrl: pageUrl,
    ancestorPath: ancestorPathFor(this)
  };
}`

const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

const probeElementDom = async (
  client: CdpClient,
  sessionId: string,
  objectId: string,
): Promise<ElementDomProbe> => {
  const result = (await client.send(
    'Runtime.callFunctionOn',
    {
      objectId,
      functionDeclaration: ELEMENT_PROBE_FN,
      returnByValue: true,
    },
    sessionId,
  )) as { result?: { value?: unknown }; exceptionDetails?: unknown }

  if (result.exceptionDetails) {
    throw new Error('Failed to inspect browser element DOM properties')
  }

  const value = result.result?.value
  if (!value || typeof value !== 'object') {
    throw new Error('Browser element DOM probe returned no value')
  }

  const record = value as Record<string, unknown>
  const xpath = typeof record.xpath === 'string' ? record.xpath : ''
  if (!xpath) {
    throw new Error('Browser element DOM probe missing xpath')
  }

  const attributes =
    record.attributes &&
    typeof record.attributes === 'object' &&
    !Array.isArray(record.attributes)
      ? (record.attributes as Record<string, string>)
      : {}

  const computedStyles =
    record.computedStyles &&
    typeof record.computedStyles === 'object' &&
    !Array.isArray(record.computedStyles)
      ? (record.computedStyles as Record<string, string>)
      : {}

  return {
    xpath,
    cssSelector: typeof record.cssSelector === 'string' ? record.cssSelector : null,
    attributes,
    computedStyles,
    outerHTML: asNullableString(record.outerHTML),
    innerText: asNullableString(record.innerText),
    pageUrl: asNullableString(record.pageUrl),
    ancestorPath: asNullableString(record.ancestorPath),
  }
}

export default probeElementDom
