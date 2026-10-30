import { compactNumber } from '../../utils/format'
import { Icon, type IconName } from './Icon'
import { Bone } from './States'
import { Tooltip } from './Tooltip'

export type StatTone = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'grey'

/** Dashboard count: icon well, label, big value (compact above 999, exact on hover), caption. */
export function StatCard({ label, value, caption, tone, icon, dot }: {
  label: string
  /** undefined while loading. Strings (e.g. "164h 30m") are shown as given. */
  value: number | string | undefined
  caption: string
  tone: StatTone
  icon: IconName
  dot: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className={`stat-well ${tone}`}>
          <Icon name={icon} size={22} />
        </div>
        <div>
          <div className="stat-label">{label}</div>
          {value === undefined ? (
            <Bone w={48} h={24} />
          ) : typeof value === 'number' && value >= 1000 ? (
            <Tooltip content={value.toLocaleString()}>
              <div className="stat-value" tabIndex={0}>{compactNumber(value)}</div>
            </Tooltip>
          ) : (
            <div className="stat-value">{value}</div>
          )}
        </div>
      </div>
      <div className="stat-caption">
        <span className="dot" style={{ background: dot }} />
        {caption}
      </div>
    </div>
  )
}
