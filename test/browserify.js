var fs = require('fs')
var browserify = require('browserify')

browserify(__dirname + '/set.js')
  .bundle()
  .pipe(fs.createWriteStream(__dirname + '/sheetsee.js'))
