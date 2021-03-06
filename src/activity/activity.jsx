import { h, Component } from 'preact'
import cx from 'classnames'
import { stripUnit } from 'polished'

import _maxBy from 'lodash/maxBy'
import _minBy from 'lodash/minBy'
import _mean from 'lodash/mean'
import _meanBy from 'lodash/meanBy'
import _chunk from 'lodash/chunk'
import _reduce from 'lodash/reduce'
import _map from 'lodash/map'
import startCase from 'lodash/startCase'

import { mountComponent, monthLength, toTime } from 'utils'

import {
  FACETS,
  GRANULARITIES,
  VALID_FEATURE_TYPES,
  ACTIVITY_HELP_URL
} from 'src/constants'

import Tabs from 'components/tabs'
import Dropdown from './components/dropdown'
import Histogram from './components/histogram'

import sassVars from 'variables.scss'
import appStyles from 'src/styles'
import styles from './activity.scss'
import Tooltip from 'components/tooltip'

class DailyActivity extends Component {
  constructor (props) {
    super(props)
    this.updateFacet = this.updateFacet.bind(this)
    this.updateGranularity = this.updateGranularity.bind(this)
    this.state = this.formatState(props)
  }

  formatState (props) {
    return {
      granularity:
        (props.granularity && startCase(props.granularity)) ||
        GRANULARITIES.Daily,
      facet:
        (props.precision === 13 && props.facet && startCase(props.facet)) ||
        FACETS.Features,
      data: props.data,
      precision: props.precision || 13,
      range: props.range || [new Date(), new Date()]
    }
  }

  getFacets () {
    if (parseInt(this.props.precision) !== 13) {
      return {}
    }

    return FACETS
  }

  parseDate (d) {
    const date = new Date(d)
    const day = date.getDate() - 1
    const month = date.getMonth()
    const year = date.getFullYear()
    return {
      day,
      month,
      year,
      len: monthLength(month, year)
    }
  }

  formatData (data, getCount, getCountObj) {
    const months = 12
    const { range } = this.state
    const beginning = new Date(0).getTime()
    const today = new Date().getTime()
    const timeFrom = toTime(range[0])
    const timeTo = toTime(range[1])
    const fromStamp = timeFrom > 0 ? Math.min(timeFrom, timeTo) : beginning
    const toStamp = timeTo > 0 ? Math.max(timeFrom, timeTo) : today

    const filteredValues = data
      .sort((a, b) => a.day - b.day)
      .filter(d => d && d.day >= fromStamp && d.day < toStamp)
    const nonZero = d => Boolean(Math.abs(getCount(d)))

    const nonZeroValues = filteredValues.length
      ? filteredValues.filter(nonZero)
      : []

    const max = nonZeroValues.length
      ? getCount(_maxBy(nonZeroValues, getCount))
      : 0

    const min = nonZeroValues.length
      ? getCount(_minBy(nonZeroValues, getCount))
      : 0

    const formattedData = [
      filteredValues.reduce((result, item) => {
        const { day, month, year, len } = this.parseDate(item.day)
        result[year] = !result[year] ? new Array(months) : result[year]
        result[year][month] =
          result[year][month] ||
          new Array(len).fill({ aggr: 0, rawDict: {} }, 0, len)
        result[year][month].forEach((d, i) => {
          if (i + 1 === day) {
            result[year][month][i] = getCountObj(item)
          }
        })

        return result
      }, {}),
      [min, max]
    ]
    return formattedData
  }

  stdDeviation (data, mean, getData = d => d) {
    const diffs = data.map(d => Math.pow(getData(d) - mean, 2))
    return Math.sqrt(_mean(diffs))
  }

  aggregateFeatures (data, valuesKey, countKey, aggrKey) {
    const getCount = d => d[countKey]
    const getValues = d => d[valuesKey]
    const distAvgToStdDevByFeatureType = _reduce(
      data,
      (result, dataValue, dataKey) => {
        const values = (getValues(dataValue) && getValues(dataValue)) || []

        const mean = _meanBy(getValues(dataValue), getCount)
        const stdev = this.stdDeviation(values, mean, getCount) || 1

        result[dataKey] = values.map(value => ({
          day: value.day,
          [countKey]: {
            aggr: (getCount(value) - mean) / stdev,
            raw: getCount(value)
          }
        }))
        return result
      },
      {}
    )

    // aggregate all feature types
    const aggregated = _reduce(
      distAvgToStdDevByFeatureType,
      (r, items, featureType) => {
        items.forEach(item => {
          const { day } = item
          r[day] = {
            sum: r[day]
              ? r[day].sum + item[countKey].aggr
              : item[countKey].aggr,
            count: r[day] ? r[day].count + 1 : 1,
            rawSum: r[day]
              ? r[day].rawSum + item[countKey].raw
              : item[countKey].raw,
            rawDict: r[day] ? r[day].rawDict : {}
          }

          r[day].rawDict[featureType] = item[countKey].raw
        })
        return r
      },
      {}
    )
    Object.keys(aggregated).forEach(day => {
      aggregated[day].aggr = aggregated[day].sum
    })

    const aggregatedObj = _map(aggregated, (aggregatedCountContainer, day) => ({
      day: Number(day),
      [countKey]: {
        aggr: aggregatedCountContainer[aggrKey],
        rawDict: aggregatedCountContainer.rawDict
      }
    }))

    return aggregatedObj
  }

  filterValidFeatureTypes (data) {
    const filtered = {}
    Object.keys(data).forEach(key => {
      if (VALID_FEATURE_TYPES.indexOf(key) > -1) {
        filtered[key] = data[key]
      }
    })
    return filtered
  }

  getFeatures () {
    const count = 'count_features'
    const key = 'activity_count'
    const aggr = 'aggr'
    const getCount = d => d[count].aggr
    const getCountObj = d => d[count]

    return this.formatData(
      this.aggregateFeatures(
        this.filterValidFeatureTypes(this.state.data),
        key,
        count,
        aggr
      ),
      getCount,
      getCountObj
    )
  }

  getUsers (data) {
    const count = 'count_users'
    const key = 'activity_users'
    const aggr = 'rawSum'
    const getCount = d => d[count].aggr
    const getCountObj = d => d[count]
    const formattedData = this.formatData(
      this.aggregateFeatures(
        this.filterValidFeatureTypes(this.state.data),
        key,
        count,
        aggr
      ),
      getCount,
      getCountObj
    )
    return formattedData
  }

  groupBy (data, predicate) {
    return _reduce(
      data,
      (years, months, year) => {
        years[year] = years[year] || months.map(predicate)
        return years
      },
      {}
    )
  }

  getGroupedItem (d) {
    const grouped = {
      aggr: _meanBy(d, d => d.aggr),
      rawDict: {}
    }
    VALID_FEATURE_TYPES.forEach(featureType => {
      const mean = _meanBy(
        d,
        d => (d.rawDict[featureType] ? d.rawDict[featureType] : 0)
      )
      if (mean > 0) {
        const roundedMean = Math.round(mean)
        grouped.rawDict[featureType] = roundedMean === 0 ? '<1' : roundedMean
      }
    })
    return grouped
  }

  // groups days by week and returns the average of each week
  groupByWeek ([data, max]) {
    return [
      this.groupBy(data, days => _chunk(days, 7).map(this.getGroupedItem)),
      max
    ]
  }

  // groups days by month and returns the average of each Monthly
  groupByMonth ([data, max]) {
    return [this.groupBy(data, days => [this.getGroupedItem(days)]), max]
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
    // getFeatures or getUsers
    let groupedData = this[`get${dataKey}`]()
    switch (granularity) {
      case GRANULARITIES.Weekly:
        return this.groupByWeek(groupedData)
      case GRANULARITIES.Monthly:
        return this.groupByMonth(groupedData)
    }

    return groupedData
  }

  renderYAxisLegend (facet) {
    if (facet === FACETS.Features) {
      return (
        <div className={styles.axisHelp}>
          <Tooltip>
            <span data-tooltip="Index of normalized OSM activity that includes edits of
            different types of map features. For more information click '+info'">
              Normalized OSM activity
            </span>
          </Tooltip>
          <a target="_blank" href={ACTIVITY_HELP_URL}>
            +info
          </a>
        </div>
      )
    } else if (facet === FACETS.Users) {
      return (
        <div className={styles.axisHelp}>
          <Tooltip>
            <span data-tooltip="Average number of active users per time period">
              Active users
            </span>
          </Tooltip>
        </div>
      )
    }
  }

  render () {
    const margin = stripUnit(sassVars.monthMargin)
    const { facet, granularity } = this.state
    const [data, [min, max]] = this.getData()
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
            {this.props.apiUrl !== undefined && (
              <a
                target="_blank"
                className={appStyles.download}
                href={this.props.apiUrl}
              >
                Download data
              </a>
            )}
          </div>
          <Tabs
            className={styles.tabs}
            onClick={this.updateFacet}
            {...{ tabs: this.getFacets(), selected: facet }}
          />
        </div>
        {this.state.data.country_name !== undefined && (
          <div class={appStyles.subtitle}>
            Area: {this.state.data.country_name}
          </div>
        )}
        <div className={styles.axis} />
        {this.renderYAxisLegend(facet)}
        <Histogram
          className={styles.histogram}
          {...{ data, min, max, margin, facet }}
        />
      </div>
    )
  }
}

export default function topContributors (selector, options) {
  return mountComponent(DailyActivity, selector, options)
}
