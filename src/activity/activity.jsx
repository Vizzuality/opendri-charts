import { h, Component } from 'preact'
import cx from 'classnames'

import _max from 'lodash/max'
import _mean from 'lodash/mean'

import { mountComponent, chunk, monthLength } from 'utils'

import { FACETS, GRANULARITIES, MONTH_NAMES } from 'src/constants'

import Tabs from 'components/tabs'
import Dropdown from './components/dropdown'
import Histogram from './components/histogram'

import appStyles from 'src/styles'
import styles from './activity.scss'

import histogramUsers from '../../public/mocks/histogram-users.json'

class DailyActivity extends Component {
  constructor (props) {
    super(props)
    this.updateFacet = this.updateFacet.bind(this)
    this.updateGranularity = this.updateGranularity.bind(this)
    this.state = this.formatState(props)
  }

  formatState (props) {
    return {
      granularity: GRANULARITIES.Daily,
      facet: FACETS.Features,
      data: props.data,
      range: props.range || []
    }
  }

  getUsers (data) {
    return histogramUsers // .slice(0, 6)
      .map(d => [d, _max(d)])
  }

  parseDate (d) {
    const date = new Date(d)
    const day = date.getDate() - 1
    const month = date.getMonth()
    const year = date.getFullYear()
    return {
      day,
      month,
      year
    }
  }

  formatFeatures (data) {
    const [from, to] = this.state.range

    return data.buildings.recency
      .sort((a, b) => a.day - b.day)
      .filter(d => d.day >= from && d.day < to)
      .map(({ day, count_day }) => ({
        day, value: count_day
      }))
  }

  getFeatures () {
    return this.formatFeatures(this.state.data)
  }

  // groups days by week and returns the average of each week
  groupByWeek (data) {
    return data.reduce((acc, [days, max]) => {
      const weeks = chunk(days, 7).map(d => _mean(d))
      acc.push([weeks, max])
      return acc
    }, [])
  }

  // groups days by month and returns the average of each Monthly
  groupByMonth (data) {
    return data.map(([d, max]) => [[_mean(d)], max])
  }

  updateGranularity (granularity) {
    this.setState({
      ...this.state,
      granularity
    })
  }

  updateFacet (facet) {
    this.setState({
      ...this.state,
      facet
    })
  }

  getData () {
    const { facet, granularity } = this.state
    const dataKey = FACETS[facet]
    let groupedData = this[`get${dataKey}`]()
    switch (granularity) {
      case GRANULARITIES.Weekly:
        return this.groupByWeek(groupedData)
      case GRANULARITIES.Monthly:
        return this.groupByMonth(groupedData)
    }

    return groupedData
  }

  render () {
    const { facet, granularity } = this.state
    const data = this.getData()

    return (
      <div class={cx(styles.activity)}>
        <div class={appStyles.heading}>
          <div class={appStyles.title}>
            OSM{' '}
            <Dropdown
              className={styles.dropdown}
              onSelect={this.updateGranularity}
              {...{ options: GRANULARITIES, selected: granularity }}
            />{' '}
            activity
          </div>
          <Tabs
            className={styles.tabs}
            onClick={this.updateFacet}
            {...{ tabs: FACETS, selected: facet }}
          />
        </div>
        <Histogram className={styles.histogram} {...{ data }} />
      </div>
    )
  }
}

export default function topContributors (selector, options) {
  return mountComponent(DailyActivity, selector, options)
}
