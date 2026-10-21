/**
 * A weak spot (from insights, or a weekly goal built on one) in the reader's language: its name (a
 * task type or a criterion) and what the numbers say.
 */
export interface SpotNumbers { key: string, share?: number, total?: number, average?: number, taskNumber?: number | null }

export function useSpotText() {
  const { t } = useI18n()
  const spotLabel = (kind: 'TYPE' | 'CRITERION', key: string) => (kind === 'TYPE' ? questionTypeLabel(key) : t(`criterion.${key}`))
  function spotDetail(kind: 'TYPE' | 'CRITERION', skill: string, f: SpotNumbers) {
    if (kind === 'TYPE') return t('insights.typeDetail', { share: f.share ?? 0, total: f.total ?? 0 })
    const avg = t('insights.criterionDetail', { average: f.average ?? 0 })
    return f.taskNumber ? `${avg}; ${t('insights.lowestTask', { task: partName(skill, f.taskNumber) })}` : avg
  }
  return { spotLabel, spotDetail }
}
