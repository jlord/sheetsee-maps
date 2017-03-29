var Mustache = require('mustache')

var L = require('leaflet')
require('leaflet.markercluster')

function createGeoJSON (data, optionsJSON) {
  var geoJSON = []
  data.forEach(function (lineItem) {
    var hasGeo = confirmGeo(lineItem)

    if (hasGeo && !lineItem.lat && !lineItem.long) handleLatLong(lineItem)
    if (lineItem.linestring || lineItem.multipolygon) hasGeo = true
    if (!hasGeo) return

    if (!optionsJSON) {
      optionsJSON = makeupOptionObject(lineItem)
      var optionObj = buildOptionObject(optionsJSON, lineItem)
    } else {
      optionObj = buildOptionObject(optionsJSON, lineItem)
    }

    var type = determineType(lineItem)

    if (lineItem.polygon || lineItem.multipolygon || lineItem.linestring) {
      var shapeFeature = shapeJSON(lineItem, type, optionObj)
      geoJSON.push(shapeFeature)
    } else {
      var pointFeature = pointJSON(lineItem, type, optionObj)
      geoJSON.push(pointFeature)
    }
  })
  return geoJSON
}

function buildOptionObject (optionsJSON, lineItem) {
  var newObj = {}
  optionsJSON.forEach(function (option) {
    newObj[option] = lineItem[option]
  })
  return newObj
}

function makeupOptionObject (lineItem) {
  var options = []
  for (var i in lineItem) {
    options.push(i)
  }
  return options
}

function confirmGeo (lineItem) {
  var hasGeo = false
  if (lineItem.lat && lineItem.long || lineItem.polygon) hasGeo = true
  if (lineItem.latitude && lineItem.longitude || lineItem.polygon) hasGeo = true
  if (lineItem.geolatitude && lineItem.geolongitude || lineItem.polygon) hasGeo = true
  return hasGeo
}

function handleLatLong (lineItem) {
  if (lineItem.latitude && lineItem.longitude || lineItem.polygon) {
    lineItem.lat = lineItem.latitude
    lineItem.long = lineItem.longitude
    delete lineItem.latitude
    delete lineItem.longitude
    return lineItem
  }
  if (lineItem.geolatitude && lineItem.geolongitude || lineItem.polygon) {
    lineItem.lat = lineItem.geolatitude
    lineItem.long = lineItem.geolongitude
    delete lineItem.geolatitude
    delete lineItem.geolongitude
    return lineItem
  }
}

function pointJSON (lineItem, type, optionObj) {
  var pointFeature = {
    type: 'Feature',
    'geometry': {
      'type': type,
      'coordinates': [+lineItem.long, +lineItem.lat]
    },
    'properties': {
      'color': lineItem.hexcolor || '#2196f3'
    },
    'opts': optionObj
  }
  return pointFeature
}

function divIcon (color) {
  var markerHtmlStyles = 'background-color: #' + color.replace('#', '') + ';' +
    'width: 2rem; height: 2rem; display: block; left: -1rem; top: -1rem; border: 1px solid #fff;' +
    'position: relative; border-radius: 3rem 3rem 0; transform: rotate(45deg);'
  var icon = L.divIcon({
    className: 'div-icon',
    iconAnchor: [0, 24],
    labelAnchor: [-6, 0],
    popupAnchor: [0, -36],
    html: '<span style="' + markerHtmlStyles + '">'
  })
  return icon
}

function shapeJSON (lineItem, type, optionObj) {
  var lowercaseType = type.toLowerCase()
  var coords
  if (type !== 'LineString') {
    coords = JSON.parse('[[' + lineItem[lowercaseType] + ']]')
  } else { coords = JSON.parse('[' + lineItem[lowercaseType] + ']') }
  var shapeFeature = {
    type: 'Feature',
    'geometry': {
      'type': type,
      'coordinates': coords
    },
    'properties': {
      'fillColor': lineItem.hexcolor,
      'color': lineItem.hexcolor
    },
    'opts': optionObj
  }
  return shapeFeature
}

function determineType (lineItem) {
  var type = ''
  // TODO this is not actually verifying the content just the property
  if (lineItem.lat && lineItem.long) type = 'Point'
  if (lineItem.polygon) type = 'Polygon'
  if (lineItem.multipolygon) type = 'MultiPolygon'
  if (lineItem.linestring) type = 'LineString'
  return type
}

// MAPS

function loadMap (mapOptions) {
  if (!mapOptions.data) return // no data, no map
  var map = L.map(mapOptions.mapDiv)
  var tiles = mapOptions.tiles || 'http://{s}.tile.osm.org/{z}/{x}/{y}.png'
  var attribution = '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'

  L.tileLayer(tiles, {attribution: attribution}).addTo(map)
  // Set behavior
  map.touchZoom.disable()
  map.doubleClickZoom.disable()
  map.scrollWheelZoom.disable()
  addMarkerLayer(map, mapOptions)
}

function makePopupTemplate (geoJSON) {
  var allOptions = geoJSON[0].opts
  var keys = []
  for (var i in allOptions) keys.push(i)
  var mustacheKeys = mustachify(keys)

  var template = '<ul>'
  var counter = mustacheKeys.length
  mustacheKeys.forEach(function (key) {
    counter--
    if (counter === 0) template = template.concat(key, '</ul>')
    else template = template.concat(key)
  })
  return template
}

function mustachify (array) {
  var newArray = []
  array.forEach(function (item) {
    item = '<li><b>' + item + ':</b> {{' + item + '}}</li>'
    newArray.push(item)
  })
  return newArray
}

function addMarkerLayer (map, mapOpts) {
  // setting a color in options overides colors in spreadsheet
  if (mapOpts.hexcolor) var iconColor = mapOpts.hexcolor

  mapOpts.geoJSONincludes = mapOpts.geoJSONincludes || null // um?
  var geoJSON = createGeoJSON(mapOpts.data, mapOpts.geoJSONincludes)

  // if no popup template, create one
  if (!mapOpts.template) mapOpts.template = makePopupTemplate(geoJSON)

  var features = {'type': 'FeatureCollection', 'features': geoJSON}

  if (mapOpts.cluster) var clusterGroup = new L.MarkerClusterGroup()
  var layer = L.geoJson(features)

  layer.eachLayer(function (marker) {
    var popupContent = Mustache.render(mapOpts.template, marker.feature.opts)
    marker.bindPopup(popupContent, {closeButton: false})
    marker.setIcon(divIcon(iconColor || marker.feature.properties.color))
    if (mapOpts.cluster) clusterGroup.addLayer(marker)
  })

  map.fitBounds(layer.getBounds())

  if (mapOpts.cluster) {
    map.addLayer(clusterGroup)
    addClusterCSS(iconColor || '#2196f3')
  } else layer.addTo(map)
}

function addClusterCSS (color) {
  if (!color.match('#')) color += '#'
  var css = '.marker-cluster-small, .marker-cluster-small div, .marker-cluster-medium,' +
      '.marker-cluster-medium div, .marker-cluster-large, .marker-cluster-large div' +
      '{background-color:' + color + ';} .marker-cluster {background-clip: padding-box; border-radius: 20px;}' +
      '.marker-cluster div {width: 30px; height: 30px; margin-left: 5px; margin-top: 5px;' +
      'text-align: center; border-radius: 15px; font: 12px "Helvetica Neue", Arial, Helvetica, sans-serif;}' +
      '.marker-cluster span {line-height: 30px;}'
  var style = document.createElement('style')
  style.innerHTML = css
  document.head.appendChild(style)
}

module.exports.createGeoJSON = createGeoJSON
module.exports.loadMap = loadMap
