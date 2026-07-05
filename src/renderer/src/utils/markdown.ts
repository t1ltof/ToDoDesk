import { createElement, type ReactNode } from 'react'

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; text: string; href: string }

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }

    if (match[2]) tokens.push({ type: 'bold', value: match[2] })
    else if (match[3]) tokens.push({ type: 'italic', value: match[3] })
    else if (match[4]) tokens.push({ type: 'code', value: match[4] })
    else if (match[5] && match[6]) tokens.push({ type: 'link', text: match[5], href: match[6] })

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }]
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return parseInline(text).map((token, index) => {
    const key = `${keyPrefix}-${index}`
    if (token.type === 'bold') {
      return createElement('strong', { key, className: 'font-semibold text-gray-100' }, token.value)
    }
    if (token.type === 'italic') {
      return createElement('em', { key, className: 'italic text-gray-300' }, token.value)
    }
    if (token.type === 'code') {
      return createElement(
        'code',
        {
          key,
          className: 'rounded bg-surface px-1 py-0.5 font-mono text-xs text-amber-200'
        },
        token.value
      )
    }
    if (token.type === 'link') {
      return createElement(
        'a',
        {
          key,
          href: token.href,
          target: '_blank',
          rel: 'noreferrer',
          className: 'text-blue-300 underline hover:text-blue-200'
        },
        token.text
      )
    }
    return createElement('span', { key }, token.value)
  })
}

export function renderMarkdown(text: string): ReactNode[] {
  if (!text.trim()) return []

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const nodes: ReactNode[] = []
  let listItems: string[] = []
  let listStart = 0

  const flushList = (): void => {
    if (listItems.length === 0) return
    nodes.push(
      createElement(
        'ul',
        { key: `list-${listStart}`, className: 'my-2 list-disc space-y-1 pl-5' },
        listItems.map((item, index) =>
          createElement('li', { key: `li-${listStart}-${index}` }, renderInline(item, `li-${listStart}-${index}`))
        )
      )
    )
    listItems = []
  }

  lines.forEach((line, lineIndex) => {
    const checkboxMatch = line.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/)
    if (checkboxMatch) {
      flushList()
      const checked = checkboxMatch[1].toLowerCase() === 'x'
      nodes.push(
        createElement(
          'div',
          { key: `cb-${lineIndex}`, className: 'my-1 flex items-start gap-2' },
          createElement('span', { className: 'mt-0.5 text-gray-500' }, checked ? '☑' : '☐'),
          createElement('span', { className: checked ? 'text-gray-500 line-through' : undefined }, ...renderInline(checkboxMatch[2], `cb-text-${lineIndex}`))
        )
      )
      return
    }

    const listMatch = line.match(/^\s*-\s+(.+)$/)
    if (listMatch) {
      if (listItems.length === 0) listStart = lineIndex
      listItems.push(listMatch[1])
      return
    }

    flushList()

    if (!line.trim()) {
      nodes.push(createElement('div', { key: `sp-${lineIndex}`, className: 'h-2' }))
      return
    }

    nodes.push(
      createElement('p', { key: `p-${lineIndex}`, className: 'my-1 leading-relaxed' }, ...renderInline(line, `p-${lineIndex}`))
    )
  })

  flushList()
  return nodes
}