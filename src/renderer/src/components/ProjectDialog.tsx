import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { MemberRole } from '../../../shared/api'
import type { Project } from '../../../shared/schema'
import { canManageMembers, membershipFor } from '../utils/cloudAccess'
import { deleteProject, updateProject } from '../utils/projectHelpers'
import { useAppStore } from '../store/useAppStore'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']

interface ProjectDialogProps {
  onClose: () => void
  project?: Project
}

export default function ProjectDialog({ onClose, project }: ProjectDialogProps): JSX.Element {
  const { data, persist, setActiveView, activeView } = useAppStore()
  const isEdit = Boolean(project)
  const [name, setName] = useState(project?.name ?? '')
  const [color, setColor] = useState(project?.color ?? COLORS[0])
  const [icon, setIcon] = useState(project?.icon ?? '')
  const [inviteRole, setInviteRole] = useState<MemberRole>('editor')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [openInvites, setOpenInvites] = useState<Array<{ id: string; role: string; expiresAt: string }>>(
    []
  )
  const membership = project ? membershipFor(data, project.id) : null
  const cloud = data.settings.profileMode === 'cloud' && Boolean(data.settings.cloudUserId)

  useEffect(() => {
    if (project) {
      setName(project.name)
      setColor(project.color)
      setIcon(project.icon ?? '')
      void window.tododesk.cloudListInvites(project.id).then(setOpenInvites)
    }
  }, [project])

  const handleSave = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return

    const current = useAppStore.getState().data
    if (isEdit && project) {
      await persist(updateProject(current, project.id, { name: trimmed, color, icon: icon.trim() }))
    } else {
      const created = {
        id: uuidv4(),
        name: trimmed,
        color,
        icon: icon.trim(),
        sortOrder: current.projects.length,
        archived: false
      }
      await persist({ ...current, projects: [...current.projects, created] })
      setActiveView(`project:${created.id}`)
    }

    onClose()
  }

  const handleDelete = async (): Promise<void> => {
    if (!project) return
    if (!confirm(`Удалить проект «${project.name}»? Задачи переместятся во Входящие.`)) return

    const current = useAppStore.getState().data
    await persist(deleteProject(current, project.id))
    if (activeView === `project:${project.id}`) setActiveView('inbox')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-elevated p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? 'Редактировать проект' : 'Новый проект'}</h3>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSave()
          }}
          placeholder="Название проекта"
          autoFocus
          className="mt-4 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <div className="mt-3">
          <p className="mb-1 text-xs text-gray-500">Иконка (эмодзи)</p>
          <input
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            placeholder="📁"
            maxLength={4}
            className="w-20 rounded-lg border border-surface-border bg-surface px-3 py-2 text-center text-lg"
          />
        </div>

        <div className="mt-4 flex gap-2">
          {COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setColor(value)}
              className="h-7 w-7 rounded-full border-2 transition"
              style={{
                backgroundColor: value,
                borderColor: color === value ? '#fff' : 'transparent'
              }}
            />
          ))}
        </div>

        {isEdit && cloud && project && (
          <div className="mt-5 rounded-lg border border-surface-border p-3">
            <p className="mb-2 text-sm font-medium">Участники</p>
            {membership ? (
              <ul className="mb-3 space-y-1 text-sm text-gray-300">
                {membership.members.map((member) => (
                  <li key={member.userId} className="flex items-center justify-between gap-2">
                    <span>
                      {member.displayName}{' '}
                      <span className="text-xs text-gray-500">{member.role}</span>
                    </span>
                    {canManageMembers(data, project.id) &&
                      member.role !== 'owner' &&
                      member.userId !== data.settings.cloudUserId && (
                        <button
                          type="button"
                          className="text-xs text-red-300"
                          onClick={async () => {
                            const result = await window.tododesk.cloudRemoveMember(
                              project.id,
                              member.userId
                            )
                            if (result.ok) await window.tododesk.cloudPullNow()
                          }}
                        >
                          Исключить
                        </button>
                      )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-xs text-gray-500">Проект ещё не опубликован в облаке.</p>
            )}
            {(!membership || canManageMembers(data, project.id)) && (
              <div className="flex flex-wrap gap-2">
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as MemberRole)}
                  className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm"
                >
                  <option value="editor">Редактор</option>
                  <option value="admin">Админ</option>
                  <option value="viewer">Наблюдатель</option>
                </select>
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={async () => {
                    setInviteBusy(true)
                    const result = await window.tododesk.cloudInvite(project.id, inviteRole)
                    setInviteBusy(false)
                    if (!result.ok) {
                      alert(result.error ?? 'Не удалось создать ссылку')
                      return
                    }
                    const link = result.url ?? result.appUrl ?? ''
                    setInviteUrl(link)
                    if (link) void navigator.clipboard.writeText(link)
                    await persist(useAppStore.getState().data)
                    await window.tododesk.cloudPullNow()
                  }}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white"
                >
                  Пригласить
                </button>
              </div>
            )}
            {inviteUrl && (
              <p className="mt-2 break-all text-xs text-gray-500">Ссылка скопирована: {inviteUrl}</p>
            )}
            {openInvites.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-gray-400">
                {openInvites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-2">
                    <span>
                      {invite.role} до {new Date(invite.expiresAt).toLocaleDateString('ru-RU')}
                    </span>
                    <button
                      type="button"
                      className="text-red-300"
                      onClick={async () => {
                        const result = await window.tododesk.cloudRevokeInvite(project.id, invite.id)
                        if (result.ok) {
                          setOpenInvites(await window.tododesk.cloudListInvites(project.id))
                        }
                      }}
                    >
                      Отозвать
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-lg border border-red-800/60 px-4 py-2 text-sm text-red-300 hover:bg-red-950/40"
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm text-gray-300"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              {isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}