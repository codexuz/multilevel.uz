import { qs, request } from './http'
import type { Paged, Part, QuestionGroup, Skill, SpeakingPart, Test, TestSummary, WritingTask } from '~/types/ielts'

/**
 * The same API the erp-lms IELTS app calls (services/ielts.ts there), at this app's addresses:
 * the builder's library and tests under /api/admin, the open papers under /api/tests.
 */
type Params = Record<string, unknown>
const get = <T>(url: string, params?: Params) => request<T>({ url: `${url}${qs(params)}` })
const send = <T>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', content?: unknown) => request<T>({ url, method, content })

/** Writing the library and building tests from it (admins). */
export const libraryAPI = {
  parts: (p: Params = {}) => get<Paged<Part>>('/admin/parts', p),
  part: (id: string) => get<Part>(`/admin/parts/${id}`),
  createPart: (data: Params) => send<Part>('/admin/parts', 'POST', data),
  updatePart: (id: string, data: Params) => send<Part>(`/admin/parts/${id}`, 'PATCH', data),
  deletePart: (id: string) => send<{ deleted: boolean, archived?: boolean }>(`/admin/parts/${id}`, 'DELETE'),
  createGroup: (partId: string, data: Params) => send<Part>(`/admin/parts/${partId}/groups`, 'POST', data),
  updateGroup: (groupId: string, data: Params) => send<Part>(`/admin/groups/${groupId}`, 'PUT', data),
  deleteGroup: (groupId: string) => send<Part>(`/admin/groups/${groupId}`, 'DELETE'),
  reorderGroups: (partId: string, ids: string[]) => send<Part>(`/admin/parts/${partId}/order`, 'PUT', { ids }),

  writingTasks: (p: Params = {}) => get<Paged<WritingTask>>('/admin/writing-tasks', p),
  writingTask: (id: string) => get<WritingTask>(`/admin/writing-tasks/${id}`),
  createWritingTask: (data: Params) => send<WritingTask>('/admin/writing-tasks', 'POST', data),
  updateWritingTask: (id: string, data: Params) => send<WritingTask>(`/admin/writing-tasks/${id}`, 'PATCH', data),
  deleteWritingTask: (id: string) => send(`/admin/writing-tasks/${id}`, 'DELETE'),

  speakingParts: (p: Params = {}) => get<Paged<SpeakingPart>>('/admin/speaking-parts', p),
  speakingPart: (id: string) => get<SpeakingPart>(`/admin/speaking-parts/${id}`),
  createSpeakingPart: (data: Params) => send<SpeakingPart>('/admin/speaking-parts', 'POST', data),
  updateSpeakingPart: (id: string, data: Params) => send<SpeakingPart>(`/admin/speaking-parts/${id}`, 'PUT', data),
  deleteSpeakingPart: (id: string) => send(`/admin/speaking-parts/${id}`, 'DELETE'),

  tests: (p: Params = {}) => get<Paged<TestSummary>>('/admin/tests', p),
  test: (id: string) => get<Test>(`/admin/tests/${id}`),
  createTest: (data: Params) => send<Test>('/admin/tests', 'POST', data),
  updateTest: (id: string, data: Params) => send<Test>(`/admin/tests/${id}`, 'PATCH', data),
  deleteTest: (id: string) => send(`/admin/tests/${id}`, 'DELETE'),
  publish: (id: string) => send<Test>(`/admin/tests/${id}/publish`, 'POST'),
  unpublish: (id: string) => send<Test>(`/admin/tests/${id}/unpublish`, 'POST'),
  archive: (id: string) => send<Test>(`/admin/tests/${id}/archive`, 'POST'),
  duplicate: (id: string) => send<Test>(`/admin/tests/${id}/duplicate`, 'POST'),
  exportTest: (id: string) => get<any>(`/admin/tests/${id}/export`),
  importTest: (payload: unknown) => send<Test>('/admin/tests/import', 'POST', payload),
  saveSection: (testId: string, skill: Skill, data: Params) => send<Test>(`/admin/tests/${testId}/sections/${skill}`, 'PUT', data),
  removeSection: (testId: string, skill: Skill) => send<Test>(`/admin/tests/${testId}/sections/${skill}`, 'DELETE'),
  addItem: (testId: string, skill: Skill, data: { partId?: string, writingTaskId?: string, speakingPartId?: string }) =>
    send<Test>(`/admin/tests/${testId}/sections/${skill}/items`, 'POST', data),
  removeItem: (testId: string, itemId: string) => send<Test>(`/admin/tests/${testId}/items/${itemId}`, 'DELETE'),
  reorderItems: (testId: string, skill: Skill, ids: string[]) => send<Test>(`/admin/tests/${testId}/sections/${skill}/order`, 'PUT', { ids })
}

export type { QuestionGroup }
