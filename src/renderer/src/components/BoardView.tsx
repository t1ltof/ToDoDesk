import {
  AlignVerticalJustifyCenter,
  Camera,
  Clock,
  Filter,
  GitBranch,
  Grid3x3,
  History,
  Lightbulb,
  Link2,
  ListPlus,
  Lock,
  Maximize,
  Minimize,
  Minus,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Star,
  Trash2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { BoardLink, BoardNode, BoardNodeStyle, Task } from '../../../shared/schema'
import { useAppStore } from '../store/useAppStore'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  addBoardLink,
  addBoardNode,
  alignBoardNodes,
  clampNodePosition,
  createIdeaNode,
  createTaskNode,
  deleteBoardLink,
  deleteBoardNode,
  exportBoardPng,
  filterBoardNodes,
  getBoardNodePreview,
  getBoardSnapshots,
  getNodeStyleClasses,
  gridLayoutBoardNodes,
  isBoardAnimationsEnabled,
  linkPath,
  moveBoardNodes,
  nodesIntersectingRect,
  restoreBoardSnapshot,
  saveBoardSnapshot,
  screenToWorld,
  suggestLinkOnProximity,
  undoBoardHistory,
  updateBoardLink,
  updateBoardNode,
  withBoardHistory,
  worldRectFromScreen
} from '../utils/boardHelpers'
import {
  BOARD_BACKGROUND_PRESETS,
  getBoardCanvasStyle,
  getBoardSurfaceStyle,
  normalizeBoardBackground
} from '../utils/boardBackground'
import { getChildTasks } from '../store/useAppStore'
import { attachmentSrcUrl } from '../utils/attachmentHelpers'
import { createRootTask } from '../utils/taskHelpers'
import BoardAddTaskDialog from './BoardAddTaskDialog'
import BoardInputDialog from './BoardInputDialog'
import BoardNewTaskDialog from './BoardNewTaskDialog'
import clsx from 'clsx'

const CLICK_DRAG_THRESHOLD = 5

type BoardInputDialogState =
  | { kind: 'link'; linkId: string; defaultValue: string }
  | { kind: 'snapshot'; defaultValue: string }
  | null
const MINIMAP_W = 168
const MINIMAP_H = 126

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1

const NODE_STYLES: { value: BoardNodeStyle; label: string }[] = [
  { value: 'card', label: 'Карточка' },
  { value: 'sticker', label: 'Стикер' },
  { value: 'photo', label: 'Фото' },
  { value: 'document', label: 'Документ' }
]

type BoardFilter = 'all' | `project:${string}` | `tag:${string}`

type DragState =
  | { kind: 'pan'; startX: number; startY: number; originPanX: number; originPanY: number }
  | {
      kind: 'marquee'
      startX: number
      startY: number
      endX: number
      endY: number
      additive: boolean
    }
  | {
      kind: 'nodes'
      primaryNodeId: string
      nodeIds: string[]
      initialPositions: Record<string, { x: number; y: number }>
      offsetX: number
      offsetY: number
      startX: number
      startY: number
      moved: boolean
    }

function getProjectColor(
  projects: ReturnType<typeof useAppStore.getState>['data']['projects'],
  projectId: string | null
): string {
  if (!projectId) return '#6b7280'
  return projects.find((p) => p.id === projectId)?.color ?? '#3b82f6'
}

function BoardNodeCard({
  node,
  task,
  selected,
  linkSource,
  onActivate,
  onDelete,
  onDragStart,
  onStyleChange,
  onSubtaskClick,
  linkMode,
  isDragging,
  animatePosition
}: {
  node: BoardNode
  task: Task | null
  selected: boolean
  linkSource: boolean
  linkMode: boolean
  isDragging: boolean
  animatePosition: boolean
  onActivate: (additive: boolean) => void
  onDelete: () => void
  onDragStart: (e: ReactMouseEvent) => void
  onStyleChange: (style: BoardNodeStyle) => void
  onSubtaskClick: (taskId: string) => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(node.title)
  const [notes, setNotes] = useState(node.notes)
  const { persist, data } = useAppStore()

  const saveEdits = async (): Promise<void> => {
    setEditing(false)
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitle(node.title)
      setNotes(node.notes)
      return
    }
    if (trimmedTitle !== node.title || notes !== node.notes) {
      await persist(
        withBoardHistory(data, updateBoardNode(data, node.id, { title: trimmedTitle, notes }))
      )
    }
  }

  const handlePickPhoto = async (): Promise<void> => {
    const picked = await window.tododesk.pickAttachmentFile()
    if (!picked) return
    await persist(
      withBoardHistory(data, updateBoardNode(data, node.id, { imagePath: picked.filePath }))
    )
  }

  const accent = task ? getProjectColor(data.projects, task.projectId) : node.color
  const styleClasses = getNodeStyleClasses(node.style)
  const isAltStyle = node.style !== 'card'
  const preview = task ? getBoardNodePreview(data, task) : null
  const subtasks = task ? getChildTasks(data, task.id) : []
  const visibleSubtasks = subtasks.slice(0, 3)
  const hiddenSubtaskCount = Math.max(0, subtasks.length - 3)

  const handleCardClick = (e: ReactMouseEvent): void => {
    if (editing) return
    const target = e.target as HTMLElement
    if (target.closest('button,input,textarea,select')) return
    onActivate(e.ctrlKey || e.metaKey)
  }

  return (
    <div
      className={clsx(
        'absolute flex flex-col border-2 shadow-lg transition-shadow',
        styleClasses,
        node.style === 'card' && 'rounded-lg',
        node.style === 'sticker' && 'rounded-sm',
        node.style === 'photo' && 'rounded-md',
        node.style === 'document' && 'rounded-none',
        !isDragging && (selected || linkSource)
          ? 'border-amber-400 shadow-amber-900/30'
          : node.style === 'card'
            ? 'border-amber-900/40 shadow-black/40'
            : undefined,
        node.kind === 'idea' && node.style === 'card' ? 'bg-amber-950/90' : '',
        node.kind === 'task' && node.style === 'card' ? 'bg-surface-elevated/95' : '',
        linkMode && 'cursor-pointer'
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        minHeight: node.height,
        transition: animatePosition && !isDragging ? 'left 0.2s ease, top 0.2s ease' : undefined
      }}
      onClick={handleCardClick}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button,input,textarea,select')) return
        if (node.kind === 'idea') setEditing(true)
      }}
    >
      <div
        className={clsx(
          'flex items-center gap-1.5 border-b px-2 py-1.5',
          node.style === 'card' ? 'border-amber-900/30' : 'border-black/10',
          linkMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        )}
        onMouseDown={linkMode ? undefined : onDragStart}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full ring-2 ring-amber-200/30"
          style={{ backgroundColor: accent }}
        />
        <span
          className={clsx(
            'min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide',
            isAltStyle ? 'opacity-80' : 'text-amber-200/80'
          )}
        >
          {node.kind === 'idea' ? 'Идея' : 'Задача'}
        </span>
        <select
          value={node.style}
          onChange={(e) => onStyleChange(e.target.value as BoardNodeStyle)}
          onClick={(e) => e.stopPropagation()}
          className="max-w-[5.5rem] rounded border border-surface-border/60 bg-surface/80 px-1 py-0.5 text-[10px] outline-none"
          title="Стиль блока"
        >
          {NODE_STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="rounded p-0.5 text-gray-500 hover:bg-red-950/50 hover:text-red-400"
          title="Удалить с доски"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {editing ? (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded border border-surface-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
              onKeyDown={(e) => e.key === 'Enter' && void saveEdits()}
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Заметки..."
              className="resize-none rounded border border-surface-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveEdits()}
                className="rounded bg-accent px-2 py-1 text-xs text-white"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setTitle(node.title)
                  setNotes(node.notes)
                }}
                className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-surface-border"
              >
                Отмена
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-1">
              <p className={clsx('min-w-0 flex-1 text-sm font-medium leading-snug', isAltStyle ? '' : 'text-gray-100')}>
                {node.title}
              </p>
              {preview && (
                <div className="flex shrink-0 items-center gap-0.5">
                  {preview.overdue && (
                    <span title="Просрочено">
                      <Clock size={12} className="text-red-400" />
                    </span>
                  )}
                  {preview.important && (
                    <span title="Важная">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                    </span>
                  )}
                  {preview.blocked && (
                    <span title="Заблокирована зависимостью">
                      <Lock size={12} className="text-orange-400" />
                    </span>
                  )}
                </div>
              )}
            </div>

            {preview && (preview.dueLabel || preview.tagNames.length > 0 || preview.checklist) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                {preview.dueLabel && (
                  <span
                    className={clsx(
                      'rounded px-1.5 py-0.5',
                      preview.overdue
                        ? 'bg-red-950/50 text-red-300'
                        : isAltStyle
                          ? 'bg-black/10 opacity-80'
                          : 'bg-surface/60 text-gray-400'
                    )}
                  >
                    {preview.dueLabel}
                  </span>
                )}
                {preview.tagNames.map((tagName) => (
                  <span
                    key={tagName}
                    className={clsx(
                      'rounded px-1.5 py-0.5',
                      isAltStyle ? 'bg-black/10 opacity-80' : 'bg-accent/20 text-accent'
                    )}
                  >
                    {tagName}
                  </span>
                ))}
                {preview.checklist && (
                  <span className={clsx(isAltStyle ? 'opacity-70' : 'text-gray-500')}>
                    {preview.checklist.done}/{preview.checklist.total}
                  </span>
                )}
              </div>
            )}

            {preview?.slaLabel && (
              <p
                className={clsx(
                  'text-[10px]',
                  preview.overdue ? 'text-red-400' : isAltStyle ? 'opacity-70' : 'text-gray-500'
                )}
              >
                {preview.slaLabel}
              </p>
            )}

            {node.notes && (
              <p className={clsx('line-clamp-2 text-xs leading-relaxed', isAltStyle ? 'opacity-70' : 'text-gray-400')}>
                {node.notes}
              </p>
            )}

            {node.style === 'photo' && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void handlePickPhoto()
                  }}
                  className="rounded border border-surface-border/60 bg-surface/80 px-2 py-1 text-xs hover:bg-surface-border/60"
                >
                  Выбрать фото
                </button>
                {node.imagePath && (
                  <img
                    src={attachmentSrcUrl(node.imagePath)}
                    alt={node.title}
                    className="max-h-32 w-full rounded object-cover"
                    draggable={false}
                  />
                )}
              </div>
            )}

            {task && (
              <span
                className={clsx(
                  'text-[10px] uppercase tracking-wide',
                  task.status === 'done' ? 'text-green-400' : 'text-gray-500'
                )}
              >
                {task.status === 'done' ? 'Выполнено' : 'Активна'}
              </span>
            )}

            {visibleSubtasks.length > 0 && (
              <div className="flex flex-wrap gap-1 border-t border-black/10 pt-2">
                {visibleSubtasks.map((subtask) => (
                  <button
                    key={subtask.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSubtaskClick(subtask.id)
                    }}
                    className={clsx(
                      'max-w-full truncate rounded-full px-2 py-0.5 text-[10px] transition hover:opacity-90',
                      subtask.status === 'done'
                        ? 'bg-green-950/40 text-green-300 line-through'
                        : isAltStyle
                          ? 'bg-black/10'
                          : 'bg-surface/80 text-gray-300 hover:bg-surface-border'
                    )}
                    title={subtask.title}
                  >
                    {subtask.title}
                  </button>
                ))}
                {hiddenSubtaskCount > 0 && (
                  <span className={clsx('px-1 text-[10px]', isAltStyle ? 'opacity-70' : 'text-gray-500')}>
                    +{hiddenSubtaskCount}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div
        className="pointer-events-none absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-red-700 shadow-md ring-2 ring-red-900/50"
        title="Кнопка"
      />
    </div>
  )
}

function LinkLayer({
  links,
  nodes,
  selectedLinkId,
  onSelectLink,
  onEditLink
}: {
  links: BoardLink[]
  nodes: BoardNode[]
  selectedLinkId: string | null
  onSelectLink: (linkId: string) => void
  onEditLink: (linkId: string) => void
}): JSX.Element {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={BOARD_WIDTH}
      height={BOARD_HEIGHT}
    >
      {links.map((link) => {
        const from = nodeMap.get(link.fromNodeId)
        const to = nodeMap.get(link.toNodeId)
        if (!from || !to) return null
        const path = linkPath(from, to)
        const selected = selectedLinkId === link.id
        const midX = (from.x + to.x) / 2 + (from.width + to.width) / 4
        const midY = (from.y + to.y) / 2
        return (
          <g
            key={link.id}
            className="pointer-events-auto cursor-pointer"
            onClick={() => onSelectLink(link.id)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onEditLink(link.id)
            }}
          >
            <path
              d={path}
              fill="none"
              stroke={selected ? '#fbbf24' : '#dc2626'}
              strokeWidth={selected ? 3 : 2}
              strokeOpacity={0.85}
              strokeDasharray={selected ? undefined : '6 4'}
            />
            {link.label ? (
              <g>
                <rect
                  x={midX - 40}
                  y={midY - 10}
                  width={80}
                  height={20}
                  rx={4}
                  fill="#1c1917"
                  fillOpacity={0.75}
                />
                <text
                  x={midX}
                  y={midY + 4}
                  fill="#fca5a5"
                  fontSize={11}
                  textAnchor="middle"
                >
                  {link.label}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function BoardMinimap({
  nodes,
  pan,
  zoom,
  containerSize,
  onNavigate
}: {
  nodes: BoardNode[]
  pan: { x: number; y: number }
  zoom: number
  containerSize: { width: number; height: number }
  onNavigate: (worldX: number, worldY: number) => void
}): JSX.Element {
  const scaleX = MINIMAP_W / BOARD_WIDTH
  const scaleY = MINIMAP_H / BOARD_HEIGHT

  const viewW = containerSize.width / zoom
  const viewH = containerSize.height / zoom
  const viewX = -pan.x / zoom
  const viewY = -pan.y / zoom

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / MINIMAP_W) * BOARD_WIDTH
    const y = ((e.clientY - rect.top) / MINIMAP_H) * BOARD_HEIGHT
    onNavigate(x, y)
  }

  return (
    <div
      className="absolute bottom-3 right-3 z-20 overflow-hidden rounded-lg border border-amber-900/50 bg-black/60 shadow-xl backdrop-blur-sm"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}
      onClick={handleClick}
      title="Мини-карта — клик для перехода"
    >
      <svg width={MINIMAP_W} height={MINIMAP_H} className="block">
        <rect width={MINIMAP_W} height={MINIMAP_H} fill="#292524" fillOpacity={0.6} />
        {nodes.map((node) => (
          <rect
            key={node.id}
            x={node.x * scaleX}
            y={node.y * scaleY}
            width={Math.max(3, node.width * scaleX)}
            height={Math.max(2, node.height * scaleY)}
            fill={node.kind === 'idea' ? '#d97706' : '#3b82f6'}
            fillOpacity={0.8}
            rx={1}
          />
        ))}
        <rect
          x={viewX * scaleX}
          y={viewY * scaleY}
          width={viewW * scaleX}
          height={viewH * scaleY}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={1.5}
          rx={1}
        />
      </svg>
    </div>
  )
}

export default function BoardView(): JSX.Element {
  const { data, persist, setSelectedTaskId } = useAppStore()

  const persistBoard = useCallback(
    async (next: ReturnType<typeof useAppStore.getState>['data']): Promise<void> => {
      const current = useAppStore.getState().data
      await persist(withBoardHistory(current, next))
    },
    [persist]
  )
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const [pan, setPan] = useState({ x: 80, y: 60 })
  const [zoom, setZoom] = useState(0.55)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [spacePressed, setSpacePressed] = useState(false)
  const [linkMode, setLinkMode] = useState(false)
  const [linkFromId, setLinkFromId] = useState<string | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false)
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all')
  const [boardSearch, setBoardSearch] = useState('')
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [pendingLink, setPendingLink] = useState<{ fromNodeId: string; toNodeId: string } | null>(
    null
  )
  const [inputDialog, setInputDialog] = useState<BoardInputDialogState>(null)
  const suppressNodeClickRef = useRef(false)
  const backgroundMenuRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  const dragRef = useRef(drag)
  const viewInitialized = useRef(false)

  panRef.current = pan
  zoomRef.current = zoom
  dragRef.current = drag

  const allNodes = data.boardNodes

  const filteredNodes = useMemo(() => {
    let nodes = allNodes
    if (boardFilter !== 'all') {
      if (boardFilter.startsWith('project:')) {
        nodes = filterBoardNodes(allNodes, data.tasks, data.taskTags, {
          type: 'project',
          projectId: boardFilter.replace('project:', '')
        })
      } else {
        nodes = filterBoardNodes(allNodes, data.tasks, data.taskTags, {
          type: 'tag',
          tagId: boardFilter.replace('tag:', '')
        })
      }
    }
    const q = boardSearch.trim().toLowerCase()
    if (!q) return nodes
    return nodes.filter(
      (node) =>
        node.title.toLowerCase().includes(q) ||
        node.notes.toLowerCase().includes(q)
    )
  }, [allNodes, boardFilter, boardSearch, data.tasks, data.taskTags])

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes])
  const links = data.boardLinks.filter(
    (l) => visibleNodeIds.has(l.fromNodeId) && visibleNodeIds.has(l.toNodeId)
  )

  const boardBackground = normalizeBoardBackground(data.settings.boardBackgroundColor)
  const boardCanvasStyle = getBoardCanvasStyle(boardBackground)
  const boardSurfaceStyle = getBoardSurfaceStyle(boardBackground)

  const existingTaskIds = new Set(
    allNodes.filter((n) => n.taskId).map((n) => n.taskId as string)
  )

  const showHint = useCallback((text: string) => {
    setHint(text)
    window.setTimeout(() => setHint(null), 2500)
  }, [])

  const getViewportCenter = useCallback((): { x: number; y: number } => {
    const el = containerRef.current
    if (!el) return { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 }
    const rect = el.getBoundingClientRect()
    return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, pan.x, pan.y, zoom)
  }, [pan.x, pan.y, zoom])

  const clampPan = useCallback(
    (nextPan: { x: number; y: number }, nextZoom: number) => {
      const el = containerRef.current
      if (!el) return nextPan
      const rect = el.getBoundingClientRect()
      const boardW = BOARD_WIDTH * nextZoom
      const boardH = BOARD_HEIGHT * nextZoom
      const minX = Math.min(0, rect.width - boardW)
      const minY = Math.min(0, rect.height - boardH)
      return {
        x: Math.min(0, Math.max(minX, nextPan.x)),
        y: Math.min(0, Math.max(minY, nextPan.y))
      }
    },
    []
  )

  const applyZoom = useCallback(
    (delta: number, anchorX?: number, anchorY?: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ax = anchorX ?? rect.width / 2
      const ay = anchorY ?? rect.height / 2
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta))
      if (nextZoom === zoom) return

      const world = screenToWorld(rect.left + ax, rect.top + ay, rect, pan.x, pan.y, zoom)
      const nextPan = {
        x: ax - world.x * nextZoom,
        y: ay - world.y * nextZoom
      }
      setZoom(nextZoom)
      setPan(clampPan(nextPan, nextZoom))
    },
    [clampPan, pan.x, pan.y, zoom]
  )

  const navigateToWorld = useCallback(
    (worldX: number, worldY: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPan(
        clampPan(
          {
            x: rect.width / 2 - worldX * zoom,
            y: rect.height / 2 - worldY * zoom
          },
          zoom
        )
      )
    },
    [clampPan, zoom]
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setSpacePressed(true)
      }
      if (e.key === 'Escape') {
        setLinkMode(false)
        setLinkFromId(null)
        setSelectedLinkId(null)
        setPendingLink(null)
        setSelectedNodeIds(new Set())
      }
      if (e.key === 'Delete' && selectedLinkId) {
        void persistBoard(deleteBoardLink(data, selectedLinkId))
        setSelectedLinkId(null)
      }
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') setSpacePressed(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [data, persistBoard, selectedLinkId])

  useEffect(() => {
    const onFsChange = (): void => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!backgroundMenuOpen) return

    const onPointerDown = (e: MouseEvent): void => {
      if (!backgroundMenuRef.current?.contains(e.target as Node)) {
        setBackgroundMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [backgroundMenuOpen])

  const setBoardBackground = async (color: string): Promise<void> => {
    const nextColor = normalizeBoardBackground(color)
    const current = useAppStore.getState().data
    await persist({
      ...current,
      settings: { ...current.settings, boardBackgroundColor: nextColor }
    })
  }

  const centerView = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    const z = zoomRef.current
    setPan(
      clampPan(
        {
          x: rect.width / 2 - (BOARD_WIDTH * z) / 2,
          y: rect.height / 2 - (BOARD_HEIGHT * z) / 2
        },
        z
      )
    )
  }, [clampPan])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
      if (viewInitialized.current) return
      if (rect.width < 1 || rect.height < 1) return
      viewInitialized.current = true
      centerView()
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [centerView])

  useEffect(() => {
    if (!drag) return

    const onMove = (e: MouseEvent): void => {
      const currentDrag = dragRef.current
      if (!currentDrag) return

      if (currentDrag.kind === 'pan') {
        const next = clampPan(
          {
            x: currentDrag.originPanX + (e.clientX - currentDrag.startX),
            y: currentDrag.originPanY + (e.clientY - currentDrag.startY)
          },
          zoomRef.current
        )
        setPan(next)
        return
      }

      if (currentDrag.kind === 'marquee') {
        setDrag({
          ...currentDrag,
          endX: e.clientX,
          endY: e.clientY
        })
        return
      }

      if (currentDrag.kind !== 'nodes') return

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const world = screenToWorld(
        e.clientX,
        e.clientY,
        rect,
        panRef.current.x,
        panRef.current.y,
        zoomRef.current
      )
      if (
        !currentDrag.moved &&
        Math.hypot(e.clientX - currentDrag.startX, e.clientY - currentDrag.startY) > CLICK_DRAG_THRESHOLD
      ) {
        currentDrag.moved = true
        suppressNodeClickRef.current = true
        dragRef.current = { ...currentDrag, moved: true }
      }

      const primaryInit = currentDrag.initialPositions[currentDrag.primaryNodeId]
      const rawPrimaryX = world.x - currentDrag.offsetX
      const rawPrimaryY = world.y - currentDrag.offsetY
      const dx = rawPrimaryX - primaryInit.x
      const dy = rawPrimaryY - primaryInit.y

      const positions = currentDrag.nodeIds.map((id) => {
        const init = currentDrag.initialPositions[id]
        const node = useAppStore.getState().data.boardNodes.find((n) => n.id === id)
        const clamped = clampNodePosition(init.x + dx, init.y + dy, node?.width, node?.height)
        return { nodeId: id, x: clamped.x, y: clamped.y }
      })

      const current = useAppStore.getState().data
      useAppStore.setState({
        data: moveBoardNodes(current, positions)
      })
    }

    const onUp = (): void => {
      void (async () => {
        const currentDrag = dragRef.current
        if (currentDrag?.kind === 'marquee') {
          const rect = containerRef.current?.getBoundingClientRect()
          if (rect) {
            const worldRect = worldRectFromScreen(
              currentDrag.startX,
              currentDrag.startY,
              currentDrag.endX,
              currentDrag.endY,
              rect,
              panRef.current.x,
              panRef.current.y,
              zoomRef.current
            )
            if (worldRect.width > 4 || worldRect.height > 4) {
              const hits = nodesIntersectingRect(filteredNodes, worldRect)
              const hitIds = hits.map((node) => node.id)
              setSelectedNodeIds((prev) => {
                if (currentDrag.additive) {
                  const next = new Set(prev)
                  for (const id of hitIds) next.add(id)
                  return next
                }
                return new Set(hitIds)
              })
              setSelectedLinkId(null)
              suppressNodeClickRef.current = true
            }
          }
        } else if (currentDrag?.kind === 'nodes' && currentDrag.moved) {
          const current = useAppStore.getState().data
          await persistBoard(current)

          const suggestion = suggestLinkOnProximity(current.boardNodes, currentDrag.primaryNodeId)
          if (suggestion) {
            const alreadyLinked = current.boardLinks.some(
              (link) =>
                (link.fromNodeId === suggestion.fromNodeId &&
                  link.toNodeId === suggestion.toNodeId) ||
                (link.fromNodeId === suggestion.toNodeId &&
                  link.toNodeId === suggestion.fromNodeId)
            )
            if (!alreadyLinked) {
              const fromNode = current.boardNodes.find((n) => n.id === suggestion.fromNodeId)
              const toNode = current.boardNodes.find((n) => n.id === suggestion.toNodeId)
              setPendingLink(suggestion)
              setHint(
                `Связать «${fromNode?.title ?? '?'}» и «${toNode?.title ?? '?'}»?`
              )
            }
          }
        } else if (currentDrag?.kind === 'nodes') {
          await persistBoard(useAppStore.getState().data)
        }
        setDrag(null)
        window.setTimeout(() => {
          suppressNodeClickRef.current = false
        }, 0)
      })()
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [clampPan, drag, filteredNodes, persist])

  const isPanTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    return target === containerRef.current || target === boardRef.current || target.dataset.boardPan === 'true'
  }

  const startPan = (clientX: number, clientY: number): void => {
    setDrag({
      kind: 'pan',
      startX: clientX,
      startY: clientY,
      originPanX: panRef.current.x,
      originPanY: panRef.current.y
    })
  }

  const handleWheel = (e: React.WheelEvent): void => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    applyZoom(delta, e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleCanvasMouseDown = (e: React.MouseEvent): void => {
    const background = isPanTarget(e.target)
    const panButton =
      e.button === 1 ||
      e.button === 2 ||
      (e.button === 0 && spacePressed)

    if (panButton) {
      e.preventDefault()
      startPan(e.clientX, e.clientY)
      return
    }

    if (e.button === 0 && background && !linkMode && !spacePressed) {
      e.preventDefault()
      setDrag({
        kind: 'marquee',
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
        additive: e.shiftKey
      })
      if (!e.shiftKey) {
        setSelectedNodeIds(new Set())
        setSelectedLinkId(null)
        setLinkFromId(null)
      }
    }
  }

  const handleNodeDragStart = (nodeId: string) => (e: ReactMouseEvent): void => {
    if (linkMode || e.button !== 0) return
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    const node = allNodes.find((n) => n.id === nodeId)
    if (!rect || !node) return

    const dragIds =
      selectedNodeIds.has(nodeId) && selectedNodeIds.size > 1
        ? [...selectedNodeIds]
        : [nodeId]

    if (!selectedNodeIds.has(nodeId) || selectedNodeIds.size <= 1) {
      setSelectedNodeIds(new Set(dragIds))
    }

    const initialPositions: Record<string, { x: number; y: number }> = {}
    for (const id of dragIds) {
      const n = allNodes.find((item) => item.id === id)
      if (n) initialPositions[id] = { x: n.x, y: n.y }
    }

    const world = screenToWorld(e.clientX, e.clientY, rect, pan.x, pan.y, zoom)
    setDrag({
      kind: 'nodes',
      primaryNodeId: nodeId,
      nodeIds: dragIds,
      initialPositions,
      offsetX: world.x - node.x,
      offsetY: world.y - node.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    })
  }

  const handleNodeActivate = async (nodeId: string, additive: boolean): Promise<void> => {
    if (suppressNodeClickRef.current) return

    const node = allNodes.find((n) => n.id === nodeId)
    if (!node) return

    if (additive && !linkMode) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev)
        if (next.has(nodeId)) next.delete(nodeId)
        else next.add(nodeId)
        return next
      })
      setSelectedLinkId(null)
      return
    }

    if (!linkMode && node.kind === 'task' && node.taskId) {
      setSelectedTaskId(node.taskId)
    }
    setSelectedNodeIds(new Set([nodeId]))
    setSelectedLinkId(null)

    if (!linkMode) return

    if (!linkFromId) {
      setLinkFromId(nodeId)
      showHint('Выберите второй блок для связи')
      return
    }

    if (linkFromId === nodeId) {
      setLinkFromId(null)
      return
    }

    await persistBoard(addBoardLink(data, linkFromId, nodeId))
    setLinkFromId(null)
    setLinkMode(false)
    showHint('Связь создана')
  }

  const confirmPendingLink = async (): Promise<void> => {
    if (!pendingLink) return
    await persistBoard(addBoardLink(data, pendingLink.fromNodeId, pendingLink.toNodeId))
    setPendingLink(null)
    setHint(null)
    showHint('Связь создана')
  }

  const editLinkLabel = (linkId: string): void => {
    const link = data.boardLinks.find((l) => l.id === linkId)
    if (!link) return
    setInputDialog({ kind: 'link', linkId, defaultValue: link.label })
  }

  const handleInputDialogSubmit = async (value: string): Promise<void> => {
    const dialog = inputDialog
    if (!dialog) return
    const current = useAppStore.getState().data

    if (dialog.kind === 'link') {
      await persistBoard(updateBoardLink(current, dialog.linkId, { label: value }))
    } else if (dialog.kind === 'snapshot') {
      await persistBoard(saveBoardSnapshot(current, value))
      showHint('Снимок сохранён')
    }

    setInputDialog(null)
  }

  const handleAlignSelected = async (): Promise<void> => {
    if (selectedNodeIds.size < 2) return
    const primaryId = [...selectedNodeIds][0]
    await persistBoard(alignBoardNodes(data, [...selectedNodeIds], primaryId))
    showHint('Блоки выровнены')
  }

  const handleGridSelected = async (): Promise<void> => {
    if (selectedNodeIds.size < 2) return
    await persistBoard(gridLayoutBoardNodes(data, [...selectedNodeIds]))
    showHint('Блоки размещены сеткой')
  }

  const handleRestoreSnapshot = async (snapshotId: string): Promise<void> => {
    if (!snapshotId) return
    await persistBoard(restoreBoardSnapshot(data, snapshotId))
    setSelectedNodeIds(new Set())
    setSelectedLinkId(null)
    showHint('Снимок восстановлен')
  }

  const handleExportPng = (): void => {
    exportBoardPng(filteredNodes, links, boardBackground)
    showHint('PNG экспортирован')
  }

  const boardSnapshots = getBoardSnapshots(data)
  const boardAnimations = isBoardAnimationsEnabled(data)
  const draggingNodeIds =
    drag?.kind === 'nodes' ? new Set(drag.nodeIds) : new Set<string>()

  const addIdea = async (): Promise<void> => {
    const center = getViewportCenter()
    const node = createIdeaNode(center.x - 110, center.y - 65)
    await persistBoard(addBoardNode(data, node))
    setSelectedNodeIds(new Set([node.id]))
  }

  const handleUndoBoard = async (): Promise<void> => {
    const current = useAppStore.getState().data
    const restored = undoBoardHistory(current)
    if (!restored) {
      showHint('История доски пуста')
      return
    }
    await persist(restored)
    setSelectedNodeIds(new Set())
    setSelectedLinkId(null)
    showHint('Доска откачена')
  }

  const addTask = async (task: Task): Promise<void> => {
    const current = useAppStore.getState().data
    const center = getViewportCenter()
    const color = getProjectColor(current.projects, task.projectId)
    const node = createTaskNode(task.id, task.title, center.x - 110, center.y - 65, color)
    await persistBoard(addBoardNode(current, node))
    setAddTaskOpen(false)
    setSelectedNodeIds(new Set([node.id]))
  }

  const addNewTask = async (title: string, projectId: string | null): Promise<void> => {
    const current = useAppStore.getState().data
    const center = getViewportCenter()
    let next = createRootTask(current, { title, projectId, dueDate: null })
    const task = next.tasks[next.tasks.length - 1]
    const color = getProjectColor(next.projects, projectId)
    const node = createTaskNode(task.id, task.title, center.x - 110, center.y - 65, color)
    next = addBoardNode(next, node)
    await persistBoard(next)
    setNewTaskOpen(false)
    setSelectedNodeIds(new Set([node.id]))
    setSelectedTaskId(task.id)
  }

  const resetView = (): void => {
    setZoom(0.55)
    zoomRef.current = 0.55
    requestAnimationFrame(() => centerView())
  }

  const toggleFullscreen = async (): Promise<void> => {
    const el = sectionRef.current
    if (!el) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen()
    }
  }

  const deleteNode = async (nodeId: string): Promise<void> => {
    const current = useAppStore.getState().data
    await persistBoard(deleteBoardNode(current, nodeId))
    setSelectedNodeIds((prev) => {
      if (!prev.has(nodeId)) return prev
      const next = new Set(prev)
      next.delete(nodeId)
      return next
    })
    if (linkFromId === nodeId) setLinkFromId(null)
  }

  const activeProjects = data.projects.filter((p) => !p.archived)
  const boardFilterProjectId = boardFilter.startsWith('project:')
    ? boardFilter.replace('project:', '')
    : null

  useEffect(() => {
    setSelectedTaskId(null)
  }, [boardFilter, setSelectedTaskId])

  return (
    <section
      ref={sectionRef}
      className={clsx(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        fullscreen && 'fixed inset-0 z-50 h-screen w-screen'
      )}
      style={boardCanvasStyle}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-surface-border bg-surface-elevated px-4 py-3">
        <h2 className="mr-2 text-lg font-semibold">Доска задач</h2>

        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-gray-500" />
          <select
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value as BoardFilter)}
            className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
          >
            <option value="all">Все блоки</option>
            {activeProjects.length > 0 && (
              <optgroup label="Проекты">
                {activeProjects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            {data.tags.length > 0 && (
              <optgroup label="Теги">
                {data.tags.map((t) => (
                  <option key={t.id} value={`tag:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <input
          type="search"
          value={boardSearch}
          onChange={(e) => setBoardSearch(e.target.value)}
          placeholder="Поиск блоков..."
          className="w-40 rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
        />

        <button
          type="button"
          onClick={() => void addIdea()}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-border/60"
        >
          <Lightbulb size={16} />
          Идея
        </button>
        <button
          type="button"
          onClick={() => setNewTaskOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-border/60"
        >
          <Plus size={16} />
          Новая задача
        </button>
        <button
          type="button"
          onClick={() => setAddTaskOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-border/60"
        >
          <ListPlus size={16} />
          Из списка
        </button>
        <button
          type="button"
          onClick={() => {
            setLinkMode((v) => !v)
            setLinkFromId(null)
            if (!linkMode) showHint('Кликните по двум блокам для связи')
          }}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm',
            linkMode
              ? 'border-amber-500 bg-amber-950/50 text-amber-200'
              : 'border-surface-border hover:bg-surface-border/60'
          )}
        >
          <Link2 size={16} />
          Связать
        </button>

        {selectedNodeIds.size > 1 && (
          <>
            <button
              type="button"
              onClick={() => void handleAlignSelected()}
              className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-border/60"
              title="Выровнять по верхнему краю первого блока"
            >
              <AlignVerticalJustifyCenter size={16} />
              Выровнять
            </button>
            <button
              type="button"
              onClick={() => void handleGridSelected()}
              className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-border/60"
              title="Разместить выбранные блоки сеткой"
            >
              <Grid3x3 size={16} />
              Сетка
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => void handleUndoBoard()}
          disabled={data.boardHistory.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-border/60 disabled:cursor-not-allowed disabled:opacity-40"
          title="Откатить последнее изменение доски"
        >
          <RotateCcw size={16} />
          Откатить доску
        </button>

        <button
          type="button"
          onClick={() => setInputDialog({ kind: 'snapshot', defaultValue: '' })}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-border/60"
          title="Сохранить снимок доски"
        >
          <Save size={16} />
          Снимок
        </button>

        {boardSnapshots.length > 0 && (
          <div className="flex items-center gap-1.5">
            <History size={14} className="text-gray-500" />
            <select
              value=""
              onChange={(e) => void handleRestoreSnapshot(e.target.value)}
              className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
              title="Восстановить снимок"
            >
              <option value="">Восстановить…</option>
              {[...boardSnapshots]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.name} ({new Date(snapshot.createdAt).toLocaleString('ru-RU')})
                  </option>
                ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={handleExportPng}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-border/60"
          title="Экспорт доски в PNG"
        >
          <Camera size={16} />
          PNG
        </button>

        <div className="ml-auto flex items-center gap-1">
          <div className="relative" ref={backgroundMenuRef}>
            <button
              type="button"
              onClick={() => setBackgroundMenuOpen((open) => !open)}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm',
                backgroundMenuOpen
                  ? 'border-amber-500 bg-amber-950/40'
                  : 'border-surface-border hover:bg-surface-border/60'
              )}
              title="Цвет фона доски"
            >
              <Palette size={16} />
              <span
                className="h-4 w-4 rounded-full border border-white/20"
                style={{ backgroundColor: boardBackground }}
              />
            </button>

            {backgroundMenuOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-surface-border bg-surface-elevated p-3 shadow-xl">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Фон доски
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {BOARD_BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      title={preset.label}
                      onClick={() => {
                        void setBoardBackground(preset.color)
                        setBackgroundMenuOpen(false)
                      }}
                      className={clsx(
                        'h-8 w-8 rounded-lg border-2 transition',
                        boardBackground === preset.color
                          ? 'border-white scale-105'
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: preset.color }}
                    />
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <span>Свой цвет</span>
                  <input
                    type="color"
                    value={boardBackground}
                    onChange={(e) => void setBoardBackground(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-surface-border bg-transparent"
                  />
                </label>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => applyZoom(-ZOOM_STEP)}
            className="rounded-lg border border-surface-border p-1.5 hover:bg-surface-border/60"
            title="Отдалить"
          >
            <Minus size={16} />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-gray-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => applyZoom(ZOOM_STEP)}
            className="rounded-lg border border-surface-border p-1.5 hover:bg-surface-border/60"
            title="Приблизить"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-lg border border-surface-border p-1.5 hover:bg-surface-border/60"
            title="Сбросить вид"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="rounded-lg border border-surface-border p-1.5 hover:bg-surface-border/60"
            title="На весь экран"
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </header>

      {(hint || pendingLink) && (
        <div className="absolute left-1/2 top-20 z-10 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-amber-950/90 px-4 py-2 text-sm text-amber-100 shadow-lg">
          <span>{hint}</span>
          {pendingLink && (
            <>
              <button
                type="button"
                onClick={() => void confirmPendingLink()}
                className="rounded bg-amber-600 px-3 py-1 text-xs font-medium hover:bg-amber-500"
              >
                Связать
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingLink(null)
                  setHint(null)
                }}
                className="rounded px-3 py-1 text-xs text-amber-200/70 hover:bg-amber-900/50"
              >
                Отмена
              </button>
            </>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        data-board-pan="true"
        className={clsx(
          'relative min-h-0 w-full flex-1 overflow-hidden',
          drag?.kind === 'pan'
            ? 'cursor-grabbing'
            : drag?.kind === 'marquee'
              ? 'cursor-crosshair'
              : spacePressed
                ? 'cursor-grab'
                : 'cursor-default'
        )}
        style={boardCanvasStyle}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={boardRef}
          data-board-pan="true"
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            ...boardSurfaceStyle
          }}
        >
          <LinkLayer
            links={links}
            nodes={filteredNodes}
            selectedLinkId={selectedLinkId}
            onSelectLink={(id) => {
              setSelectedLinkId(id)
              setSelectedNodeIds(new Set())
            }}
            onEditLink={(id) => void editLinkLabel(id)}
          />

          {filteredNodes.length === 0 && allNodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="max-w-md rounded-xl border border-amber-900/30 bg-black/20 p-8 text-center text-amber-100/70">
                <GitBranch className="mx-auto mb-3 text-amber-600" size={32} />
                <p className="text-lg font-medium text-amber-100">Пустая доска</p>
                <p className="mt-2 text-sm">
                  Добавьте идеи или задачи, перетаскивайте блоки и связывайте их нитями.
                  Колёсико мыши — масштаб, перетаскивание фона — перемещение по доске.
                </p>
              </div>
            </div>
          )}

          {filteredNodes.length === 0 && allNodes.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-900/30 bg-black/30 px-6 py-5 text-center">
                <p className="text-sm text-amber-100/70">Нет блоков по выбранному фильтру</p>
                {boardFilterProjectId && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAddTaskOpen(true)}
                      className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-1.5 text-sm hover:bg-surface-border/60"
                    >
                      Добавить из проекта
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTaskOpen(true)}
                      className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-1.5 text-sm hover:bg-surface-border/60"
                    >
                      Новая задача
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {filteredNodes.map((node) => {
            const task = node.taskId ? data.tasks.find((t) => t.id === node.taskId) ?? null : null
            return (
              <BoardNodeCard
                key={node.id}
                node={node}
                task={task}
                selected={selectedNodeIds.has(node.id)}
                linkSource={linkFromId === node.id}
                isDragging={draggingNodeIds.has(node.id)}
                animatePosition={boardAnimations}
                onActivate={(additive) => void handleNodeActivate(node.id, additive)}
                onDelete={() => void deleteNode(node.id)}
                onDragStart={handleNodeDragStart(node.id)}
                onStyleChange={(style) =>
                  void persistBoard(updateBoardNode(data, node.id, { style }))
                }
                onSubtaskClick={(taskId) => setSelectedTaskId(taskId)}
                linkMode={linkMode}
              />
            )
          })}
        </div>

        {drag?.kind === 'marquee' && containerRef.current && (() => {
          const rect = containerRef.current!.getBoundingClientRect()
          const left = Math.min(drag.startX, drag.endX) - rect.left
          const top = Math.min(drag.startY, drag.endY) - rect.top
          const width = Math.abs(drag.endX - drag.startX)
          const height = Math.abs(drag.endY - drag.startY)
          return (
            <div
              className="pointer-events-none absolute z-30 border-2 border-dashed border-amber-400 bg-amber-400/10"
              style={{ left, top, width, height }}
            />
          )
        })()}

        <BoardMinimap
          nodes={filteredNodes}
          pan={pan}
          zoom={zoom}
          containerSize={containerSize}
          onNavigate={navigateToWorld}
        />
      </div>

      <footer className="shrink-0 border-t border-surface-border bg-surface-elevated px-4 py-1.5 text-xs text-gray-500">
        Рамка — выделение · Shift + рамка — добавить к выделению · Ctrl + клик — несколько блоков · Пробел + перетаскивание — панорама · Колёсико — масштаб
        {selectedNodeIds.size > 1 && (
          <span className="ml-2 text-amber-400">Выбрано: {selectedNodeIds.size}</span>
        )}
        {selectedLinkId && (
          <button
            type="button"
            onClick={() => void persistBoard(deleteBoardLink(data, selectedLinkId))}
            className="ml-3 text-red-400 hover:underline"
          >
            Удалить связь
          </button>
        )}
      </footer>

      {newTaskOpen && (
        <BoardNewTaskDialog
          onClose={() => setNewTaskOpen(false)}
          onCreate={(title, projectId) => void addNewTask(title, projectId)}
          defaultProjectId={boardFilterProjectId}
        />
      )}

      {addTaskOpen && (
        <BoardAddTaskDialog
          onClose={() => setAddTaskOpen(false)}
          onSelect={(task) => void addTask(task)}
          existingTaskIds={existingTaskIds}
          filterProjectId={boardFilterProjectId}
        />
      )}

      <BoardInputDialog
        open={inputDialog !== null}
        title={inputDialog?.kind === 'snapshot' ? 'Снимок доски' : 'Подпись связи'}
        label={inputDialog?.kind === 'snapshot' ? 'Название снимка' : 'Текст на нити'}
        defaultValue={inputDialog?.defaultValue ?? ''}
        placeholder={
          inputDialog?.kind === 'snapshot' ? 'Например: до реорганизации' : 'зависит от, следующий шаг...'
        }
        submitLabel={inputDialog?.kind === 'snapshot' ? 'Сохранить' : 'Сохранить'}
        onClose={() => setInputDialog(null)}
        onSubmit={(value) => void handleInputDialogSubmit(value)}
      />
    </section>
  )
}