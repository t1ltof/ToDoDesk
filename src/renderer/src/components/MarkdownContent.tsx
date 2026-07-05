import { renderMarkdown } from '../utils/markdown'
import clsx from 'clsx'

interface MarkdownContentProps {
  text: string
  className?: string
}

export default function MarkdownContent({ text, className }: MarkdownContentProps): JSX.Element {
  return (
    <div className={clsx('markdown-content text-sm text-gray-300', className)}>
      {renderMarkdown(text)}
    </div>
  )
}