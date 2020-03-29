const init = (data) => {

  // var data = JSON.stringify(data)
  const defaultState = { 
    data, 
    filters: {region: ['Global'], subregion: [], metric: ['cases']},
    debug: false,
    // debug: true,
    plot: { target: (id = 'plot') => { return document.getElementById(id) },
    config: undefined },
    listeners: []
  }
  return function App (state = defaultState) {
    this.log = output => console.info(output)
    this.state = state
    this.updateTimestamp = (timeString = `${new Date(this.state.data.Global.lastUpdated).toLocaleString(undefined, {dateStyle: 'full', timeStyle: 'full'})}`, className = '.last-updated') => { document.querySelector(className).innerText = `Last updated: ${timeString}` }
    this.updateState = (newState) => {
      if(!(JSON.stringify(this.state) === JSON.stringify({ ...this.state, ...newState }))) {
        if(this.state.debug) {
        this.log('=== Current State ===')
        this.log(this.state)
        this.log('=== State update ===')
        this.log(newState)
      }
        this.state = { ...this.state, ...newState }
        if(this.state.debug) {
          this.log('=== New State ===')
          this.log(this.state)
        }
        this.state.listeners.forEach(thisListener => thisListener());
        return this.state
      } else {
        return this.state
      }
    }
    this.setFilters = (type, filters) => {
      switch(type) {
        case 'region':
          return this.updateState( { filters: { ...this.state.filters, region: [ filters ] } } )
        case 'metric':
          return this.updateState( { filters: { ...this.state.filters, metric: [ ...filters ] } } )
        default:
          return this.state
      }
    }
    this.updatePlot = (id, type) => { 
      let thisPlotConfig = this.getPlotConfig(type, this.state.filters)
      let newState = this.updateState( { plot: { ...this.state.plot, ... { config: { data: thisPlotConfig[0], layout: thisPlotConfig[1]} } } } ) 
      this.state.plot.target(id)
      Plotly.newPlot(this.state.plot.target(id), newState.plot.config.data, newState.plot.config.layout, { responsive: true }).then(() => console.info('Chart updated')).catch(err => console.error(err)) // Handle this error some other way later
      document.querySelector('div.table').remove()
      document.getElementById(id).append(this.generateTable(newState.plot.config.data, { title: newState.plot.config.layout.title.text }))
      document.getElementsByTagName('body')[0].setAttribute('style', `height: ${Math.max( document.body.scrollHeight, document.body.offsetHeight, document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight )}px;`)
    }
    this.getPlotConfig = (type = 'bar', filters = this.state.filters, plotLayout = undefined) => {
      plotLayout = { title: `Count of ${[filters.metric.slice(0, -1).join(', '), filters.metric.slice(-1)[0]].join(filters.metric.length < 2 ? '' : ' and ')} in ${filters.region[0]}`} // https://stackoverflow.com/a/16251861/5935694
      plotLayout = { 
        ...plotLayout,
        font: {
          family: getComputedStyle(document.getElementById('plot')).fontFamily,
          size: getComputedStyle(document.getElementById('plot')).fontSize,
          color: getComputedStyle(document.getElementById('plot')).color
        },
        autosize: false, 
        width: parseFloat(getComputedStyle(this.state.plot.target()).width), 
        // height needs to be set dynamically based on the number of items on the x-axis to allow it to dynamically extend vertically with an unobtrusive distance between ticks
        yaxis: { 
          automargin: true, 
          tickfont: { size: parseFloat(getComputedStyle(this.state.plot.target()).fontSize) }, 
          autorange: 'reversed' 
        }
      }
      if(this.state.filters.metric.length > 1) plotLayout = { ...plotLayout, barmode: 'group'  }
      let plotData = undefined
      switch(type) {
        case 'bar': 
          let filterForRegion = this.state.data[filters.region[0]].regions // eventually could be written to handle multiple selections at once
          plotData = this.state.filters.metric.map(thisMetric => {
            return filterForRegion.reduce((acc, curr) => {
              if(!acc.name) acc.name = thisMetric 
              acc.x.push(curr[thisMetric]) // Note that selecting "critical" in Europe & Latin America currently results in NaN. Idk if this is by design or a data quality issue. 
              acc.y.push(curr.country) // 'country' is the key for whatever the location is called (region, country, subregion, etc.)
              return acc
            }, { x: [], y: [], name: undefined, type: 'bar', orientation: 'h' })
          })
          let calculatedHeight = parseFloat(getComputedStyle(this.state.plot.target()).fontSize) * plotData[0].y.length * 2 // Twice the default font size multiplied by the number of data points on the y-axis
          plotLayout = { ...plotLayout, 
            ...{ 
              height: calculatedHeight > window.innerHeight ? calculatedHeight : window.innerHeight , // dynamically set the height of the target div based on the amount of data to be displayed. This enables dynamically sizing the graph vertically to, hopefully, a comfortable viewing experience. Multiplying the fontsize by two seems to be the sweet spot where no labels are hidden by each other and all bars show ¯\_(ツ)_/¯
              xaxis: { // puts the x-axis on the top of the page so the user can see the scale when the page loads and as they adjust the filters
                ...plotLayout.xaxis,
                mirror: 'allticks',
                side: 'top',
                fixedrange: true, // disables zoom; It can be disorienting and makes scrolling more difficult on mobile
                showspikes: true // on hover, a dotted line will track to either axis and display the labels
              },
              yaxis: { ...plotLayout.yaxis,
                fixedrange: true,
                showspikes: true
              }
            }  
          }
          break
        default:
          plotData = [
            {
              x: ['oops', 'something', 'went', 'wrong'],
              y: [20, 14, 23, 12],
              type: 'bar'
            }
          ]
      }
      return [plotData, plotLayout]
    }
    this.generateTable = (data, details) => {
      let header = data.reduce((acc, curr, currIdx, origArr) => {
        let thisRow = `<th>${curr.name}</th>`
        if(currIdx === origArr.length - 1) thisRow += '</tr></thead>'
        return acc += thisRow
      }, '<thead><tr><th></th>')

      let dataPointCount = data[0].x.length
      let metricCount = data.length
      let rows = '<tbody>'
      for (let i = 0; i < dataPointCount; i++) {
        rows += `<tr><th>${data[0].y[i]}</th>`
        for (let j = 0; j < metricCount; j++) {
          rows += `<td>${data[j].x[i]}</td>`
          if(metricCount - 1 === j) rows += `</tr>`
        }
      }

      let html = `<div class="table"><table><caption>${details.title}</caption>${header}${rows}`
      html += `</tbody></table></div>`
      return document.createRange().createContextualFragment(html)
    }
  }

}