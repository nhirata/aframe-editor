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
  // this.createFloor();
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

  var camera = this.camera;

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
