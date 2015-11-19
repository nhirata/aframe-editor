(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.aframeEditor = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* global THREE */

var colours = ['#DA6369', '#4191A6', '#5AA89A', '#5AA89A', '#F39C85'];

var objects = [
  {
    name: 'box',
    defaults: {
      geometry: 'primitive: box; width: 2; height: 2; depth: 2',
      material: 'color: ' + colours[0]
    }
  },
  {
    name: 'sphere',
    defaults: {
      geometry: 'primitive: sphere; radius: 1',
      material: 'color: ' + colours[1]
    }
  },
  {
    name: 'torus',
    defaults: {
      geometry: 'primitive: torus; radius: 1.6; tube: .5; segments: 32; tubularSegments: 10',
      material: 'color: ' + colours[2]
    }
  }
];

var tools = ['off', 'pick', 'place'];

// builder
function Editor () {
  // object User is holding
  this.inHand = null;

  // wait for DOM to load before we start.
  document.addEventListener('DOMContentLoaded', this.onDomLoaded.bind(this));
}

Editor.prototype.onDomLoaded = function () {
  this.scene = document.querySelector('vr-scene');
  this.camera = this.scene.cameraEl;
  this.cursor = document.querySelector('vr-object[cursor]');

  this.setupCursor();
  this.setupControls();
  this.createFloor();
};

// clear anything being held
Editor.prototype.clearInHand = function () {
  if (this.inHand) {
    this.inHand.parentNode.removeChild(this.inHand);
    this.inHand = null;
  }
};

// toggle through different object types.
Editor.prototype.selectPrevObject = function () {
  if (!this.inHand) { return; }

  this.lastObjectIndex--;
  if (this.lastObjectIndex < 0) {
    this.lastObjectIndex = objects.length - 1;
  }
  this.clearInHand();
  this.createObject(this.lastObjectIndex);
};

Editor.prototype.selectNextObject = function () {
  if (!this.inHand) { return; }

  this.lastObjectIndex++;
  if (this.lastObjectIndex > objects.length - 1) {
    this.lastObjectIndex = 0;
  }
  this.clearInHand();
  this.createObject(this.lastObjectIndex);
};

Editor.prototype.createObject = function (i) {
  if (!i) {
    i = this.lastObjectIndex ? this.lastObjectIndex : 0;
  }

  var object = objects[i];
  // Would like to use templates here rather than using vr-object entity primitives.
  // https://github.com/MozVR/aframe/issues/162
  var vrObject = document.createElement('vr-object');

  // apply default properties
  for (var propertyName in object.defaults) {
    vrObject.setAttribute(propertyName, object.defaults[propertyName]);
  }

  vrObject.setAttribute('rotation', '0 0 0');
  vrObject.setAttribute('position', '0 0 -10');
  this.inHand = vrObject;
  this.camera.appendChild(vrObject);
  this.lastObjectIndex = i;
};

// places in-hand object into scene
Editor.prototype.placeObject = function () {
  if (!this.inHand) { return; }

  var camera = this.camera.object3D;

  var obj = this.inHand.object3D;
  obj.updateMatrixWorld();

  // use camera world rotation
  var euler = new THREE.Euler();
  euler.setFromRotationMatrix(obj.matrixWorld);

  // use objects world postion
  var position = new THREE.Vector3();
  position.setFromMatrixPosition(obj.matrixWorld);

  // only apply camera Y rotation.
  var rotation = {
    x: 0,
    y: euler.y * (180 / Math.PI),
    z: 0
  };

  // remove as child from camera and clone into scene.
  camera.removeChild(this.inHand);

  var clone = this.inHand.cloneNode();
  clone.setAttribute('rotation', rotation.x + ' ' + rotation.y + ' ' + rotation.z);
  clone.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);

  this.scene.appendChild(clone);

  this.inHand = null;
};

// Pick
Editor.prototype.pickObject = function () {
  if (this.inHand) {
    this.placeObject();
    return;
  }

  if (this.intersectedEl && this.intersectedDistance) {
    // position
    var clone = this.intersectedEl.cloneNode();

    var obj = clone.object3D;

    // rotation
    obj.quaternion.multiply(this.camera.object3D.quaternion);
    var euler = new THREE.Euler();
    euler.setFromQuaternion(obj.quaternion);

    var rotation = {
      x: 0,
      y: euler.y * (180 / Math.PI),
      z: 0
    };

    clone.setAttribute('position', '0 0 ' + -this.intersectedDistance);
    clone.setAttribute('rotation', rotation.x + ' ' + rotation.y + ' ' + rotation.z);

    this.inHand = clone;
    this.camera.appendChild(clone);

    this.intersectedEl.parentNode.removeChild(this.intersectedEl);
  }
};

// Cursor
Editor.prototype.setupCursor = function () {
  if (!this.cursor) {
    // create defualt cursor
    var cursor = this.cursor = document.createElement('vr-object');
    cursor.setAttribute('visible', 'false');
    cursor.setAttribute('position', '0 0 -10');
    cursor.setAttribute('cursor', 'maxDistance: 30');
    cursor.setAttribute('geometry', 'primitive: ring; outerRadius: 0.30; innerRadius: 0.20;');
    cursor.setAttribute('material', 'color: red; receiveLight: false;');
    this.camera.appendChild(cursor);
  }
};

// Controls
Editor.prototype.setupControls = function () {
  // toggle cursor
  window.addEventListener('keypress', this.onKeyPress.bind(this), false);

  // use tool
  document.body.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    this.useTool();
  }.bind(this));

  // cursor intersections
  this.cursor.addEventListener('intersection', function (e) {
    this.intersectedDistance = e.detail.distance;
    this.intersectedEl = e.detail.el;
  }.bind(this));
};

Editor.prototype.toggleTool = function () {
  if (!this.currentToolIndex || this.currentToolIndex === tools.length) {
    this.currentToolIndex = 0;
  }
  this.currentToolIndex++;
  this.clearInHand();
  this.updateToolCursor();
};

Editor.prototype.useTool = function () {
  switch (tools[this.currentToolIndex]) {
    case 'off': // no cursor
      break;
    case 'pick': // ring cursor
      this.pickObject();
      break;
    case 'place': // sphere cursor
      if (this.inHand) {
        this.placeObject();
      } else {
        this.createObject();
      }
      break;
  }
};

Editor.prototype.updateToolCursor = function () {
  switch (tools[this.currentToolIndex]) {
    case 'pick': // ring cursor
      this.cursor.setAttribute('visible', true);
      this.cursor.setAttribute('geometry', 'primitive: ring; outerRadius: 0.15; innerRadius: 0.08;');
      break;
    case 'place': // sphere cursor
      this.cursor.setAttribute('visible', true);
      this.cursor.setAttribute('geometry', 'primitive: sphere; radius: 0.1;');
      break;
    default:
      this.cursor.setAttribute('visible', false);
      break;
  }
};

Editor.prototype.onKeyPress = function (e) {
  // console.log('keypress', e.charCode);
  switch (e.charCode) {
    case 32: // space
      this.toggleTool();
      break;
    case 91: // [
      this.selectPrevObject();
      break;
    case 93: // ]
      this.selectNextObject();
      break;
  }
};

Editor.prototype.createFloor = function () {
  var floor = document.createElement('vr-object');
  floor.id = 'floor';
  var size = 2;
  var tileSize = 20;
  var tileSpacing = 0;
  var floorY = -1.5;
  for (var c = 0; c < size; c++) {
    for (var r = 0; r < size; r++) {
      var plane = document.createElement('vr-object');
      plane.setAttribute('geometry', 'primitive: plane; width: ' + tileSize + '; height: ' + tileSize);
      plane.setAttribute('material', 'color: #2E2A23');
      plane.setAttribute('rotation', '-90 0 0');
      var x = (tileSpacing + tileSize) * c;
      var y = 0;
      var z = (tileSpacing + tileSize) * r;
      plane.setAttribute('position', x + ' ' + y + ' ' + z);
      floor.appendChild(plane);
    }
  }

  var centerOffset = (size / 2) * (tileSize + tileSpacing);
  floor.setAttribute('position', -centerOffset + ' ' + floorY + ' ' + -centerOffset);
  this.scene.appendChild(floor);
};

module.exports = new Editor();

},{}],2:[function(require,module,exports){
require('./editor.js');

},{"./editor.js":1}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZWRpdG9yLmpzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyogZ2xvYmFsIFRIUkVFICovXG5cbnZhciBjb2xvdXJzID0gWycjREE2MzY5JywgJyM0MTkxQTYnLCAnIzVBQTg5QScsICcjNUFBODlBJywgJyNGMzlDODUnXTtcblxudmFyIG9iamVjdHMgPSBbXG4gIHtcbiAgICBuYW1lOiAnYm94JyxcbiAgICBkZWZhdWx0czoge1xuICAgICAgZ2VvbWV0cnk6ICdwcmltaXRpdmU6IGJveDsgd2lkdGg6IDI7IGhlaWdodDogMjsgZGVwdGg6IDInLFxuICAgICAgbWF0ZXJpYWw6ICdjb2xvcjogJyArIGNvbG91cnNbMF1cbiAgICB9XG4gIH0sXG4gIHtcbiAgICBuYW1lOiAnc3BoZXJlJyxcbiAgICBkZWZhdWx0czoge1xuICAgICAgZ2VvbWV0cnk6ICdwcmltaXRpdmU6IHNwaGVyZTsgcmFkaXVzOiAxJyxcbiAgICAgIG1hdGVyaWFsOiAnY29sb3I6ICcgKyBjb2xvdXJzWzFdXG4gICAgfVxuICB9LFxuICB7XG4gICAgbmFtZTogJ3RvcnVzJyxcbiAgICBkZWZhdWx0czoge1xuICAgICAgZ2VvbWV0cnk6ICdwcmltaXRpdmU6IHRvcnVzOyByYWRpdXM6IDEuNjsgdHViZTogLjU7IHNlZ21lbnRzOiAzMjsgdHVidWxhclNlZ21lbnRzOiAxMCcsXG4gICAgICBtYXRlcmlhbDogJ2NvbG9yOiAnICsgY29sb3Vyc1syXVxuICAgIH1cbiAgfVxuXTtcblxudmFyIHRvb2xzID0gWydvZmYnLCAncGljaycsICdwbGFjZSddO1xuXG4vLyBidWlsZGVyXG5mdW5jdGlvbiBFZGl0b3IgKCkge1xuICAvLyBvYmplY3QgVXNlciBpcyBob2xkaW5nXG4gIHRoaXMuaW5IYW5kID0gbnVsbDtcblxuICAvLyB3YWl0IGZvciBET00gdG8gbG9hZCBiZWZvcmUgd2Ugc3RhcnQuXG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCB0aGlzLm9uRG9tTG9hZGVkLmJpbmQodGhpcykpO1xufVxuXG5FZGl0b3IucHJvdG90eXBlLm9uRG9tTG9hZGVkID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnNjZW5lID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndnItc2NlbmUnKTtcbiAgdGhpcy5jYW1lcmEgPSB0aGlzLnNjZW5lLmNhbWVyYUVsO1xuICB0aGlzLmN1cnNvciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ3ZyLW9iamVjdFtjdXJzb3JdJyk7XG5cbiAgdGhpcy5zZXR1cEN1cnNvcigpO1xuICB0aGlzLnNldHVwQ29udHJvbHMoKTtcbiAgdGhpcy5jcmVhdGVGbG9vcigpO1xufTtcblxuLy8gY2xlYXIgYW55dGhpbmcgYmVpbmcgaGVsZFxuRWRpdG9yLnByb3RvdHlwZS5jbGVhckluSGFuZCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuaW5IYW5kKSB7XG4gICAgdGhpcy5pbkhhbmQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmluSGFuZCk7XG4gICAgdGhpcy5pbkhhbmQgPSBudWxsO1xuICB9XG59O1xuXG4vLyB0b2dnbGUgdGhyb3VnaCBkaWZmZXJlbnQgb2JqZWN0IHR5cGVzLlxuRWRpdG9yLnByb3RvdHlwZS5zZWxlY3RQcmV2T2JqZWN0ID0gZnVuY3Rpb24gKCkge1xuICBpZiAoIXRoaXMuaW5IYW5kKSB7IHJldHVybjsgfVxuXG4gIHRoaXMubGFzdE9iamVjdEluZGV4LS07XG4gIGlmICh0aGlzLmxhc3RPYmplY3RJbmRleCA8IDApIHtcbiAgICB0aGlzLmxhc3RPYmplY3RJbmRleCA9IG9iamVjdHMubGVuZ3RoIC0gMTtcbiAgfVxuICB0aGlzLmNsZWFySW5IYW5kKCk7XG4gIHRoaXMuY3JlYXRlT2JqZWN0KHRoaXMubGFzdE9iamVjdEluZGV4KTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuc2VsZWN0TmV4dE9iamVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKCF0aGlzLmluSGFuZCkgeyByZXR1cm47IH1cblxuICB0aGlzLmxhc3RPYmplY3RJbmRleCsrO1xuICBpZiAodGhpcy5sYXN0T2JqZWN0SW5kZXggPiBvYmplY3RzLmxlbmd0aCAtIDEpIHtcbiAgICB0aGlzLmxhc3RPYmplY3RJbmRleCA9IDA7XG4gIH1cbiAgdGhpcy5jbGVhckluSGFuZCgpO1xuICB0aGlzLmNyZWF0ZU9iamVjdCh0aGlzLmxhc3RPYmplY3RJbmRleCk7XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLmNyZWF0ZU9iamVjdCA9IGZ1bmN0aW9uIChpKSB7XG4gIGlmICghaSkge1xuICAgIGkgPSB0aGlzLmxhc3RPYmplY3RJbmRleCA/IHRoaXMubGFzdE9iamVjdEluZGV4IDogMDtcbiAgfVxuXG4gIHZhciBvYmplY3QgPSBvYmplY3RzW2ldO1xuICAvLyBXb3VsZCBsaWtlIHRvIHVzZSB0ZW1wbGF0ZXMgaGVyZSByYXRoZXIgdGhhbiB1c2luZyB2ci1vYmplY3QgZW50aXR5IHByaW1pdGl2ZXMuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9Nb3pWUi9hZnJhbWUvaXNzdWVzLzE2MlxuICB2YXIgdnJPYmplY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2ci1vYmplY3QnKTtcblxuICAvLyBhcHBseSBkZWZhdWx0IHByb3BlcnRpZXNcbiAgZm9yICh2YXIgcHJvcGVydHlOYW1lIGluIG9iamVjdC5kZWZhdWx0cykge1xuICAgIHZyT2JqZWN0LnNldEF0dHJpYnV0ZShwcm9wZXJ0eU5hbWUsIG9iamVjdC5kZWZhdWx0c1twcm9wZXJ0eU5hbWVdKTtcbiAgfVxuXG4gIHZyT2JqZWN0LnNldEF0dHJpYnV0ZSgncm90YXRpb24nLCAnMCAwIDAnKTtcbiAgdnJPYmplY3Quc2V0QXR0cmlidXRlKCdwb3NpdGlvbicsICcwIDAgLTEwJyk7XG4gIHRoaXMuaW5IYW5kID0gdnJPYmplY3Q7XG4gIHRoaXMuY2FtZXJhLmFwcGVuZENoaWxkKHZyT2JqZWN0KTtcbiAgdGhpcy5sYXN0T2JqZWN0SW5kZXggPSBpO1xufTtcblxuLy8gcGxhY2VzIGluLWhhbmQgb2JqZWN0IGludG8gc2NlbmVcbkVkaXRvci5wcm90b3R5cGUucGxhY2VPYmplY3QgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghdGhpcy5pbkhhbmQpIHsgcmV0dXJuOyB9XG5cbiAgdmFyIGNhbWVyYSA9IHRoaXMuY2FtZXJhLm9iamVjdDNEO1xuXG4gIHZhciBvYmogPSB0aGlzLmluSGFuZC5vYmplY3QzRDtcbiAgb2JqLnVwZGF0ZU1hdHJpeFdvcmxkKCk7XG5cbiAgLy8gdXNlIGNhbWVyYSB3b3JsZCByb3RhdGlvblxuICB2YXIgZXVsZXIgPSBuZXcgVEhSRUUuRXVsZXIoKTtcbiAgZXVsZXIuc2V0RnJvbVJvdGF0aW9uTWF0cml4KG9iai5tYXRyaXhXb3JsZCk7XG5cbiAgLy8gdXNlIG9iamVjdHMgd29ybGQgcG9zdGlvblxuICB2YXIgcG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuICBwb3NpdGlvbi5zZXRGcm9tTWF0cml4UG9zaXRpb24ob2JqLm1hdHJpeFdvcmxkKTtcblxuICAvLyBvbmx5IGFwcGx5IGNhbWVyYSBZIHJvdGF0aW9uLlxuICB2YXIgcm90YXRpb24gPSB7XG4gICAgeDogMCxcbiAgICB5OiBldWxlci55ICogKDE4MCAvIE1hdGguUEkpLFxuICAgIHo6IDBcbiAgfTtcblxuICAvLyByZW1vdmUgYXMgY2hpbGQgZnJvbSBjYW1lcmEgYW5kIGNsb25lIGludG8gc2NlbmUuXG4gIGNhbWVyYS5yZW1vdmVDaGlsZCh0aGlzLmluSGFuZCk7XG5cbiAgdmFyIGNsb25lID0gdGhpcy5pbkhhbmQuY2xvbmVOb2RlKCk7XG4gIGNsb25lLnNldEF0dHJpYnV0ZSgncm90YXRpb24nLCByb3RhdGlvbi54ICsgJyAnICsgcm90YXRpb24ueSArICcgJyArIHJvdGF0aW9uLnopO1xuICBjbG9uZS5zZXRBdHRyaWJ1dGUoJ3Bvc2l0aW9uJywgcG9zaXRpb24ueCArICcgJyArIHBvc2l0aW9uLnkgKyAnICcgKyBwb3NpdGlvbi56KTtcblxuICB0aGlzLnNjZW5lLmFwcGVuZENoaWxkKGNsb25lKTtcblxuICB0aGlzLmluSGFuZCA9IG51bGw7XG59O1xuXG4vLyBQaWNrXG5FZGl0b3IucHJvdG90eXBlLnBpY2tPYmplY3QgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmluSGFuZCkge1xuICAgIHRoaXMucGxhY2VPYmplY3QoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAodGhpcy5pbnRlcnNlY3RlZEVsICYmIHRoaXMuaW50ZXJzZWN0ZWREaXN0YW5jZSkge1xuICAgIC8vIHBvc2l0aW9uXG4gICAgdmFyIGNsb25lID0gdGhpcy5pbnRlcnNlY3RlZEVsLmNsb25lTm9kZSgpO1xuXG4gICAgdmFyIG9iaiA9IGNsb25lLm9iamVjdDNEO1xuXG4gICAgLy8gcm90YXRpb25cbiAgICBvYmoucXVhdGVybmlvbi5tdWx0aXBseSh0aGlzLmNhbWVyYS5vYmplY3QzRC5xdWF0ZXJuaW9uKTtcbiAgICB2YXIgZXVsZXIgPSBuZXcgVEhSRUUuRXVsZXIoKTtcbiAgICBldWxlci5zZXRGcm9tUXVhdGVybmlvbihvYmoucXVhdGVybmlvbik7XG5cbiAgICB2YXIgcm90YXRpb24gPSB7XG4gICAgICB4OiAwLFxuICAgICAgeTogZXVsZXIueSAqICgxODAgLyBNYXRoLlBJKSxcbiAgICAgIHo6IDBcbiAgICB9O1xuXG4gICAgY2xvbmUuc2V0QXR0cmlidXRlKCdwb3NpdGlvbicsICcwIDAgJyArIC10aGlzLmludGVyc2VjdGVkRGlzdGFuY2UpO1xuICAgIGNsb25lLnNldEF0dHJpYnV0ZSgncm90YXRpb24nLCByb3RhdGlvbi54ICsgJyAnICsgcm90YXRpb24ueSArICcgJyArIHJvdGF0aW9uLnopO1xuXG4gICAgdGhpcy5pbkhhbmQgPSBjbG9uZTtcbiAgICB0aGlzLmNhbWVyYS5hcHBlbmRDaGlsZChjbG9uZSk7XG5cbiAgICB0aGlzLmludGVyc2VjdGVkRWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmludGVyc2VjdGVkRWwpO1xuICB9XG59O1xuXG4vLyBDdXJzb3JcbkVkaXRvci5wcm90b3R5cGUuc2V0dXBDdXJzb3IgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghdGhpcy5jdXJzb3IpIHtcbiAgICAvLyBjcmVhdGUgZGVmdWFsdCBjdXJzb3JcbiAgICB2YXIgY3Vyc29yID0gdGhpcy5jdXJzb3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2ci1vYmplY3QnKTtcbiAgICBjdXJzb3Iuc2V0QXR0cmlidXRlKCd2aXNpYmxlJywgJ2ZhbHNlJyk7XG4gICAgY3Vyc29yLnNldEF0dHJpYnV0ZSgncG9zaXRpb24nLCAnMCAwIC0xMCcpO1xuICAgIGN1cnNvci5zZXRBdHRyaWJ1dGUoJ2N1cnNvcicsICdtYXhEaXN0YW5jZTogMzAnKTtcbiAgICBjdXJzb3Iuc2V0QXR0cmlidXRlKCdnZW9tZXRyeScsICdwcmltaXRpdmU6IHJpbmc7IG91dGVyUmFkaXVzOiAwLjMwOyBpbm5lclJhZGl1czogMC4yMDsnKTtcbiAgICBjdXJzb3Iuc2V0QXR0cmlidXRlKCdtYXRlcmlhbCcsICdjb2xvcjogcmVkOyByZWNlaXZlTGlnaHQ6IGZhbHNlOycpO1xuICAgIHRoaXMuY2FtZXJhLmFwcGVuZENoaWxkKGN1cnNvcik7XG4gIH1cbn07XG5cbi8vIENvbnRyb2xzXG5FZGl0b3IucHJvdG90eXBlLnNldHVwQ29udHJvbHMgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIHRvZ2dsZSBjdXJzb3JcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgdGhpcy5vbktleVByZXNzLmJpbmQodGhpcyksIGZhbHNlKTtcblxuICAvLyB1c2UgdG9vbFxuICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy51c2VUb29sKCk7XG4gIH0uYmluZCh0aGlzKSk7XG5cbiAgLy8gY3Vyc29yIGludGVyc2VjdGlvbnNcbiAgdGhpcy5jdXJzb3IuYWRkRXZlbnRMaXN0ZW5lcignaW50ZXJzZWN0aW9uJywgZnVuY3Rpb24gKGUpIHtcbiAgICB0aGlzLmludGVyc2VjdGVkRGlzdGFuY2UgPSBlLmRldGFpbC5kaXN0YW5jZTtcbiAgICB0aGlzLmludGVyc2VjdGVkRWwgPSBlLmRldGFpbC5lbDtcbiAgfS5iaW5kKHRoaXMpKTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUudG9nZ2xlVG9vbCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKCF0aGlzLmN1cnJlbnRUb29sSW5kZXggfHwgdGhpcy5jdXJyZW50VG9vbEluZGV4ID09PSB0b29scy5sZW5ndGgpIHtcbiAgICB0aGlzLmN1cnJlbnRUb29sSW5kZXggPSAwO1xuICB9XG4gIHRoaXMuY3VycmVudFRvb2xJbmRleCsrO1xuICB0aGlzLmNsZWFySW5IYW5kKCk7XG4gIHRoaXMudXBkYXRlVG9vbEN1cnNvcigpO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS51c2VUb29sID0gZnVuY3Rpb24gKCkge1xuICBzd2l0Y2ggKHRvb2xzW3RoaXMuY3VycmVudFRvb2xJbmRleF0pIHtcbiAgICBjYXNlICdvZmYnOiAvLyBubyBjdXJzb3JcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3BpY2snOiAvLyByaW5nIGN1cnNvclxuICAgICAgdGhpcy5waWNrT2JqZWN0KCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdwbGFjZSc6IC8vIHNwaGVyZSBjdXJzb3JcbiAgICAgIGlmICh0aGlzLmluSGFuZCkge1xuICAgICAgICB0aGlzLnBsYWNlT2JqZWN0KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNyZWF0ZU9iamVjdCgpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gIH1cbn07XG5cbkVkaXRvci5wcm90b3R5cGUudXBkYXRlVG9vbEN1cnNvciA9IGZ1bmN0aW9uICgpIHtcbiAgc3dpdGNoICh0b29sc1t0aGlzLmN1cnJlbnRUb29sSW5kZXhdKSB7XG4gICAgY2FzZSAncGljayc6IC8vIHJpbmcgY3Vyc29yXG4gICAgICB0aGlzLmN1cnNvci5zZXRBdHRyaWJ1dGUoJ3Zpc2libGUnLCB0cnVlKTtcbiAgICAgIHRoaXMuY3Vyc29yLnNldEF0dHJpYnV0ZSgnZ2VvbWV0cnknLCAncHJpbWl0aXZlOiByaW5nOyBvdXRlclJhZGl1czogMC4xNTsgaW5uZXJSYWRpdXM6IDAuMDg7Jyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdwbGFjZSc6IC8vIHNwaGVyZSBjdXJzb3JcbiAgICAgIHRoaXMuY3Vyc29yLnNldEF0dHJpYnV0ZSgndmlzaWJsZScsIHRydWUpO1xuICAgICAgdGhpcy5jdXJzb3Iuc2V0QXR0cmlidXRlKCdnZW9tZXRyeScsICdwcmltaXRpdmU6IHNwaGVyZTsgcmFkaXVzOiAwLjE7Jyk7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy5jdXJzb3Iuc2V0QXR0cmlidXRlKCd2aXNpYmxlJywgZmFsc2UpO1xuICAgICAgYnJlYWs7XG4gIH1cbn07XG5cbkVkaXRvci5wcm90b3R5cGUub25LZXlQcmVzcyA9IGZ1bmN0aW9uIChlKSB7XG4gIC8vIGNvbnNvbGUubG9nKCdrZXlwcmVzcycsIGUuY2hhckNvZGUpO1xuICBzd2l0Y2ggKGUuY2hhckNvZGUpIHtcbiAgICBjYXNlIDMyOiAvLyBzcGFjZVxuICAgICAgdGhpcy50b2dnbGVUb29sKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDkxOiAvLyBbXG4gICAgICB0aGlzLnNlbGVjdFByZXZPYmplY3QoKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgOTM6IC8vIF1cbiAgICAgIHRoaXMuc2VsZWN0TmV4dE9iamVjdCgpO1xuICAgICAgYnJlYWs7XG4gIH1cbn07XG5cbkVkaXRvci5wcm90b3R5cGUuY3JlYXRlRmxvb3IgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBmbG9vciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3ZyLW9iamVjdCcpO1xuICBmbG9vci5pZCA9ICdmbG9vcic7XG4gIHZhciBzaXplID0gMjtcbiAgdmFyIHRpbGVTaXplID0gMjA7XG4gIHZhciB0aWxlU3BhY2luZyA9IDA7XG4gIHZhciBmbG9vclkgPSAtMS41O1xuICBmb3IgKHZhciBjID0gMDsgYyA8IHNpemU7IGMrKykge1xuICAgIGZvciAodmFyIHIgPSAwOyByIDwgc2l6ZTsgcisrKSB7XG4gICAgICB2YXIgcGxhbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2ci1vYmplY3QnKTtcbiAgICAgIHBsYW5lLnNldEF0dHJpYnV0ZSgnZ2VvbWV0cnknLCAncHJpbWl0aXZlOiBwbGFuZTsgd2lkdGg6ICcgKyB0aWxlU2l6ZSArICc7IGhlaWdodDogJyArIHRpbGVTaXplKTtcbiAgICAgIHBsYW5lLnNldEF0dHJpYnV0ZSgnbWF0ZXJpYWwnLCAnY29sb3I6ICMyRTJBMjMnKTtcbiAgICAgIHBsYW5lLnNldEF0dHJpYnV0ZSgncm90YXRpb24nLCAnLTkwIDAgMCcpO1xuICAgICAgdmFyIHggPSAodGlsZVNwYWNpbmcgKyB0aWxlU2l6ZSkgKiBjO1xuICAgICAgdmFyIHkgPSAwO1xuICAgICAgdmFyIHogPSAodGlsZVNwYWNpbmcgKyB0aWxlU2l6ZSkgKiByO1xuICAgICAgcGxhbmUuc2V0QXR0cmlidXRlKCdwb3NpdGlvbicsIHggKyAnICcgKyB5ICsgJyAnICsgeik7XG4gICAgICBmbG9vci5hcHBlbmRDaGlsZChwbGFuZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGNlbnRlck9mZnNldCA9IChzaXplIC8gMikgKiAodGlsZVNpemUgKyB0aWxlU3BhY2luZyk7XG4gIGZsb29yLnNldEF0dHJpYnV0ZSgncG9zaXRpb24nLCAtY2VudGVyT2Zmc2V0ICsgJyAnICsgZmxvb3JZICsgJyAnICsgLWNlbnRlck9mZnNldCk7XG4gIHRoaXMuc2NlbmUuYXBwZW5kQ2hpbGQoZmxvb3IpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgRWRpdG9yKCk7XG4iLCJyZXF1aXJlKCcuL2VkaXRvci5qcycpO1xuIl19
