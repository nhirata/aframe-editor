#!/usr/bin/env node

var exec = require('child_process').exec;
var path = require('path');

var budo = require('budo');

function execCmd (cmd) {
  var p = exec(cmd);
  p.stderr.pipe(process.stderr);
  p.stdout.pipe(process.stdout);
  return p;
}

var app = budo('./src/index.js:build/aframe-editor.js', {
  verbose: true,
  stream: process.stdout,  // log to stdout
  host: '0.0.0.0',
  port: 8000,
  browserifyArgs: (
    '-s aframe-editor'.split(' ')
  )
});

app
.watch('**/*.{css,js,html}')
.live()
.on('watch', function (eventType, fn) {
  if (eventType !== 'change' && eventType !== 'add') { return; }

  if (path.extname(fn) === '.js') {
    app.reload(fn);
  }
})
.on('update', function (ev) {
  execCmd('semistandard -v $(git ls-files "*.js") | snazzy');
});
