const { ODRI, fetch, process } = window

function mountViz (data) {
  const from = new Date(2009, 1, 1)
  const to = new Date()
  // const to = new Date(2011, 11, 1)
  ODRI.activity('#activity', { data, range: [from, to], height: '500px' })
  ODRI.compareMap('#compare-map', {
    width: '100%',
    height: '500px',
    settings: {
      default_feature_type: 'highways'
    }
  })
  ODRI.contributors('#contributors', { data })
}

function timeoutPromise (timeout, err, promise) {
  return new Promise(function (resolve, reject) {
    promise.then(resolve, reject)
    setTimeout(reject.bind(null, err), timeout)
  })
}

document.addEventListener('DOMContentLoaded', function () {
  const url = `./mocks/histogram-features.json`
  // const url = `${process.env.SANDBOX_ENDPOINT}/HTI`
  timeoutPromise(2000, new Error('Server timed out!'), fetch(url))
    .then(r => r.json())
    .then(mountViz)
})
