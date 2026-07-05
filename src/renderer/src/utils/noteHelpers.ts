import { v4 as uuidv4 } from 'uuid'
import type { DataPayload, Note } from '../../../shared/schema'

function nowIso(): string {
  return new Date().toISOString()
}

export function createNote(data: DataPayload, title: string, content = ''): DataPayload {
  const note: Note = {
    id: uuidv4(),
    title,
    content,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
  return { ...data, notes: [note, ...data.notes] }
}

export function updateNote(
  data: DataPayload,
  noteId: string,
  patch: Partial<Pick<Note, 'title' | 'content'>>
): DataPayload {
  return {
    ...data,
    notes: data.notes.map((note) =>
      note.id === noteId ? { ...note, ...patch, updatedAt: nowIso() } : note
    )
  }
}

export function deleteNote(data: DataPayload, noteId: string): DataPayload {
  return { ...data, notes: data.notes.filter((note) => note.id !== noteId) }
}