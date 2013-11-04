var mapbox = require('mapbox.js')

module.exports.buildOptionObject = function(optionsJSON, lineItem) {
  var newObj = {}
  optionsJSON.forEach(function(option) {
    newObj[option] = lineItem[option]
  })
  return newObj
}

// for geocoding: http://mapbox.com/tilemill/docs/guides/google-docs/#geocoding
// create geoJSON from your spreadsheet's coordinates
module.exports.createGeoJSON = function(data, optionsJSON) {
  var geoJSON = []
  data.forEach(function(lineItem){
    // skip if there are no coords
    var hasGeo = false
    if (lineItem.lat || lineItem.long || lineItem.polygon) hasGeo = true
    if (lineItem.linestring || lineItem.multipolygon) hasGeo = true
    if (!hasGeo) return

    // type of coors
    var type = determineType(lineItem)
    
    if (optionsJSON) var optionObj = buildOptionObject(optionsJSON, lineItem)
    if (lineItem.polygon || lineItem.multipolygon || lineItem.linestring) {
      var shapeFeature = shapeJSON(lineItem, type, optionObj)
      geoJSON.push(shapeFeature)
    } else {
      var poitnFeature = pointJSON(lineItem, type, optionObj)
      geoJSON.push(poitnFeature)
      }
  })
  return geoJSON
}

module.exports.pointJSON = function(lineItem, type, optionObj) {
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
        "opts": optionObj,
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

module.exports.determineType = function(lineItem) {
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

module.exports.addMarkerLayer = function(geoJSON, map, zoomLevel) { 
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
  return layer
}