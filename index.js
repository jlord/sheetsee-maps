var mapbox = require('mapbox.js')
var ich = require('icanhaz')

module.exports.buildOptionObject = buildOptionObject
function buildOptionObject(optionsJSON, lineItem) {
  var newObj = {}
  optionsJSON.forEach(function(option) {
    newObj[option] = lineItem[option]
  })
  return newObj
}

module.exports.makeupOptionObject = function(lineItem) {
  var options = []
  for (var i in lineItem) {
    options.push(i);
  }
  return options
}

module.exports.createGeoJSON = function(data, optionsJSON) {
  var geoJSON = []
  data.forEach(function(lineItem){
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

module.exports.confirmGeo = confirmGeo
function confirmGeo(lineItem) {
  var hasGeo = false
  if (lineItem.lat && lineItem.long || lineItem.polygon) hasGeo = true
  if (lineItem.latitude && lineItem.longitude || lineItem.polygon) hasGeo = true
  if (lineItem.geolatitude && lineItem.geolongitude || lineItem.polygon) hasGeo = true
  return hasGeo
}

module.exports.handleLatLong = handleLatLong
function handleLatLong(lineItem) {
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

module.exports.pointJSON = pointJSON
function pointJSON(lineItem, type, optionObj) {
  var lowercaseType = type.toLowerCase()
  var pointFeature = {
        type: "Feature",
        "geometry": {
          "type": type,
          "coordinates": [+lineItem.long, +lineItem.lat]
        },
        "properties": {
          "marker-size": "small",
          "marker-color": lineItem.hexcolor
        },
        "opts": optionObj
      }
  return pointFeature
}

module.exports.shapeJSON = function(lineItem, type, optionObj) {
  var lowercaseType = type.toLowerCase()
  var coords
  if (type !== "LineString") {
    coords = JSON.parse( "[[" + lineItem[lowercaseType] + "]]" )
  } else { coords = JSON.parse("[" + lineItem[lowercaseType] + "]") }
  var shapeFeature = {
        type: "Feature",
        "geometry": {
          "type": type,
          "coordinates": coords
        },
        "properties": {
          "fillColor": lineItem.hexcolor,
          "color": lineItem.hexcolor
        },
        "opts": optionObj
      }
  return shapeFeature
}

module.exports.determineType = determineType
function determineType(lineItem) {
  var type = ""
  if (lineItem.lat && lineItem.long) type = "Point"
  if (lineItem.polygon) type = "Polygon"
  if (lineItem.multipolygon) type = "MultiPolygon"
  if (lineItem.linestring) type = "LineString"
  return type
}

module.exports.loadMap = function(mapDiv) {
  var map = L.mapbox.map(mapDiv)
  map.touchZoom.disable()
  map.doubleClickZoom.disable()
  map.scrollWheelZoom.disable()
  return map
}

module.exports.addTileLayer = function(map, tileLayer) {
  var layer = L.mapbox.tileLayer(tileLayer)
  layer.addTo(map)
}

module.exports.makePopupTemplate = makePopupTemplate
function makePopupTemplate(geoJSON) {
  var allOptions = geoJSON[0].opts
  var keys = []
  for (var i in allOptions) keys.push(i)

  var mustacheKeys = mustachify(keys)

  var template = {}
  template.name ="popup"
  template.template = templateString(mustacheKeys)
  return template
}

module.exports.templateString = templateString
function templateString(mustacheKeys) {
  var template = "<ul>"
  var counter = mustacheKeys.length
  mustacheKeys.forEach(function(key) {
    counter--
    if (counter === 0) template = template.concat(key, "</ul>")
    else template = template.concat(key)
  })
  return template
}

module.exports.mustachify = mustachify
function mustachify(array) {
  var newArray = []
  array.forEach(function(item) {
    item = "<li><b>" + item + ":</b> {{" + item + "}}</li>"
    newArray.push(item)
  })
  return newArray
}

module.exports.addMarkerLayer = function(geoJSON, map, template) {
  if (!template) {
    template = makePopupTemplate(geoJSON)
    ich.addTemplate(template.name, template.template)
  }
  else {
   var template = {"template": template}
   template.name = "popup"
   ich.addTemplate(template.name, template.template)
  }
  var features = {
    "type": "FeatureCollection",
    "features": geoJSON
  }
  var layer = L.geoJson(features, {
    pointToLayer: L.mapbox.marker.style,
    style: function(feature) { return feature.properties }
  })
  var bounds = layer.getBounds()
  layer.addTo(map)
  map.fitBounds(bounds)

  layer.eachLayer(function(marker) {
    var popupContent = ich[template.name](marker.feature.opts)
    marker.bindPopup(popupContent.html(), {closeButton: false})
  })
  return layer
}
