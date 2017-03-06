var mapbox = require('mapbox.js')
var ich = require('icanhaz')

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
  var lowercaseType = type.toLowerCase()
  var pointFeature = {
    type: 'Feature',
    'geometry': {
      'type': type,
      'coordinates': [+lineItem.long, +lineItem.lat]
    },
    'properties': {
      'marker-size': 'small',
      'marker-color': lineItem.hexcolor
    },
    'opts': optionObj
  }
  return pointFeature
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
  if (lineItem.lat && lineItem.long) type = 'Point'
  if (lineItem.polygon) type = 'Polygon'
  if (lineItem.multipolygon) type = 'MultiPolygon'
  if (lineItem.linestring) type = 'LineString'
  return type
}

function loadMap (mapDiv) {
  var map = L.mapbox.map(mapDiv)
  map.touchZoom.disable()
  map.doubleClickZoom.disable()
  map.scrollWheelZoom.disable()
  return map
}

function addTileLayer (map, tileLayer) {
  var layer = L.mapbox.tileLayer(tileLayer)
  layer.addTo(map)
}

function makePopupTemplate (geoJSON) {
  var allOptions = geoJSON[0].opts
  var keys = []
  for (var i in allOptions) keys.push(i)

  var mustacheKeys = mustachify(keys)

  var template = {}
  template.name = 'popup' + Math.random()
  template.template = templateString(mustacheKeys)
  return template
}

function templateString (mustacheKeys) {
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

function addMarkerLayer (geoJSON, map, template, clusterMarkers) {
  if (!template) {
    template = makePopupTemplate(geoJSON)
    ich.addTemplate(template.name, template.template)
  } else {
    template = {'template': template}
    template.name = 'popup' + Math.random()
    ich.addTemplate(template.name, template.template)
  }
  var features = {
    'type': 'FeatureCollection',
    'features': geoJSON
  }
  var layer = L.geoJson(features, {
    pointToLayer: L.mapbox.marker.style,
    style: function (feature) { return feature.properties }
  })
  var bounds = layer.getBounds()

  // check option and Leaflet extension
  var cluster = clusterMarkers && 'MarkerClusterGroup' in L
  if (cluster) {
    var clusterGroup = new L.MarkerClusterGroup()
  }

  map.fitBounds(bounds)

  layer.eachLayer(function (marker) {
    var popupContent = ich[template.name](marker.feature.opts)
    marker.bindPopup(popupContent.html(), {closeButton: false})
    if (cluster) {
      clusterGroup.addLayer(marker)
    }
  })

  if (cluster) {
    map.addLayer(clusterGroup)
  } else {
    layer.addTo(map)
  }

  return layer
}

module.exports.buildOptionObject = buildOptionObject
module.exports.makeupOptionObject = makeupOptionObject
module.exports.createGeoJSON = createGeoJSON
module.exports.confirmGeo = confirmGeo
module.exports.handleLatLong = handleLatLong
module.exports.pointJSON = pointJSON
module.exports.shapeJSON = shapeJSON
module.exports.determineType = determineType
module.exports.loadMap = loadMap
module.exports.addTileLayer = addTileLayer
module.exports.makePopupTemplate = makePopupTemplate
module.exports.templateString = templateString
module.exports.mustachify = mustachify
module.exports.addMarkerLayer = addMarkerLayer
