var test = require('tape')

var sheetsee = require('../index.js')
var data = require('./data.json')

test('createGeoJSON', function (t) {
  t.plan(1)
  var expected = require('./expected-geoJSON.json')
  var result = sheetsee.createGeoJSON(data)
  t.equal(result.toString(), expected.toString(), 'return geoJSON')
})

test('determineType', function (t) {
  t.plan(2)
  var point = {
    "lat": "-122.41722106933594",
    "long": "37.77695634643178"
   }
  var result = sheetsee.determineType(point)
  t.equal(result, 'Point', 'return Point')
  var linestring = {
    linestring: '[-122.41722106933594, 37.7663045891584], [-122.40477561950684, 37.77695634643178]'
   }
  var result1 = sheetsee.determineType(linestring)
  t.equal(result1, 'LineString', 'return LineString')
})
