import { h, Component } from 'preact'
import cx from 'classnames'
import max from 'lodash/max'
import trunc from 'lodash/truncate'
import { parse, format, addDays } from 'date-fns'

import { mountComponent, percent } from 'utils'
import { percentWidth } from 'variables.scss'

import appStyles from 'styles.scss'
import styles from './contributors.scss'

class TopContributors extends Component {
  constructor (props) {
    super(props)

    this.formatContributors = this.formatContributors.bind(this)
  }

  formatContributors () {
    const { data, numUsers } = this.props
    const top = numUsers || 10

    // API doesn't support overall statistics for users across feature types
    // (ie, % of contributions can't be calculated across feature types, as we'd need all users ids, not the first 100)
    // const users = VALID_FEATURE_TYPES.reduce(
    //   (allUsers, users) => allUsers.concat(data[users].top_users),
    //   []
    // )
    // so, we'll just us ebuildings for now
    const featureUsers = data.buildings
    const users = featureUsers.top_users

    const allContributions = featureUsers.total_feature_value
    const maxContributions = max(users.map(c => c.feature_value))

    const allUsers = users.map(c => ({
      name: c.osm_name,
      contributions: c.feature_value,
      percent: percent(c.feature_value, maxContributions, 1),
      percentContrib: percent(c.feature_value, allContributions, 1)
    }))

    const topUsers = allUsers.slice(0, top)
    const topUsersSum = topUsers.reduce(
      (sum, c) => (sum += c.contributions),
      0
    )

    return {
      topUsers,
      remaining: featureUsers.users_length - top,
      remainingPercent: percent(
        allContributions - topUsersSum,
        allContributions,
        1
      )
    }
  }

  render () {
    const { width, data } = this.props
    const { topUsers, remaining, remainingPercent } = this.formatContributors()

    const subtitles = []
    if (data.min_date !== undefined) {
      const dates = [data.min_date, data.max_date]
        .map(d => parseInt(d * 1000))
        .map(d => parse(d))
        .map(d => addDays(d, 1))
        .map(d => format(d, 'MMM Do, YYYY'))
        .join(' to ')
      subtitles.push(dates)
    }
    if (data.country_name !== undefined) {
      subtitles.push(`Area: ${data.country_name}`)
    }

    return (
      <div style={{ width }} class={cx(styles.contributors, appStyles.viz)}>
        <div class={cx(styles['header'], appStyles.heading)}>
          <div class={cx(styles.title, appStyles.title)}>
            Top contributors (buildings)
            {this.props.apiUrl !== undefined &&
              <a
                target="_blank"
                className={appStyles.download}
                href={this.props.apiUrl}
              >
                Download data
              </a>}
          </div>
          {subtitles.length &&
            <div class={appStyles.subtitle}>
              {subtitles.join('. ')}
            </div>}
        </div>
        <ul class={styles['list']}>
          {topUsers.map(c =>
            <li class={styles['list-items']}>
              <span
                title={c.name}
                class={cx(styles['name'], { [styles['local']]: c.local })}
              >
                <a
                  target="_blank"
                  href={`http://www.openstreetmap.org/user/${c.name}`}
                >
                  {trunc(c.name, { length: 10 })}
                </a>
              </span>
              <div class={cx(styles['percent'])}>
                <div
                  style={{
                    width: `calc(${Math.round(c.percent)}% - ${percentWidth})`
                  }}
                  class={cx(styles['percent-bar'])}
                />
                <span class={cx(styles['percent-nr'])}>
                  {c.percentContrib}%
                </span>
              </div>
            </li>
          )}
        </ul>
        <div class={styles['remaining']}>
          + {remaining} More ({remainingPercent}% of total)
        </div>
      </div>
    )
  }
}

export default function topContributors (selector, options) {
  return mountComponent(TopContributors, selector, options)
}
