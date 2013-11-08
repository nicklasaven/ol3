// FIXME store coordinates in batchgroup?
// FIXME flattened coordinates
// FIXME per-batch extent tests

goog.provide('ol.replay.canvas.BatchGroup');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.object');
goog.require('ol.replay');
goog.require('ol.replay.IBatch');
goog.require('ol.replay.IBatchGroup');
goog.require('ol.style.fill');
goog.require('ol.style.stroke');


/**
 * @enum {number}
 */
ol.replay.canvas.Instruction = {
  BEGIN_PATH: 0,
  CLOSE_PATH: 1,
  FILL: 2,
  MOVE_TO_LINE_TO: 3,
  SET_FILL_STYLE: 4,
  SET_STROKE_STYLE: 5,
  STROKE: 6
};



/**
 * @constructor
 * @implements {ol.replay.IBatch}
 * @protected
 */
ol.replay.canvas.Batch = function() {

  /**
   * @protected
   * @type {Array}
   */
  this.instructions = [];

  /**
   * @protected
   * @type {Array.<number>}
   */
  this.coordinates = [];

  /**
   * @private
   * @type {Array.<number>}
   */
  this.pixelCoordinates_ = [];

};


/**
 * @param {Array.<Array.<number>>} coordinates Coordinates.
 * @param {boolean} close Close.
 * @protected
 * @return {number} End.
 */
ol.replay.canvas.Batch.prototype.appendCoordinates =
    function(coordinates, close) {
  var end = this.coordinates.length;
  var i, ii;
  for (i = 0, ii = coordinates.length; i < ii; ++i) {
    this.coordinates[end++] = coordinates[i][0];
    this.coordinates[end++] = coordinates[i][1];
  }
  if (close) {
    this.coordinates[end++] = coordinates[0][0];
    this.coordinates[end++] = coordinates[0][1];
  }
  return end;
};


/**
 * @param {CanvasRenderingContext2D} context Context.
 * @param {goog.vec.Mat4.AnyType} transform Transform.
 */
ol.replay.canvas.Batch.prototype.draw = function(context, transform) {
  var pixelCoordinates = ol.replay.transformCoordinates(
      this.coordinates, transform, this.pixelCoordinates_);
  this.pixelCoordinates_ = pixelCoordinates;  // FIXME ?
  var instructions = this.instructions;
  var i = 0;
  var j, jj;
  for (j = 0, jj = instructions.length; j < jj; ++j) {
    var instruction = instructions[j];
    var type = instruction[0];
    if (type == ol.replay.canvas.Instruction.BEGIN_PATH) {
      context.beginPath();
    } else if (type == ol.replay.canvas.Instruction.CLOSE_PATH) {
      context.closePath();
    } else if (type == ol.replay.canvas.Instruction.FILL) {
      context.fill();
    } else if (type == ol.replay.canvas.Instruction.MOVE_TO_LINE_TO) {
      context.moveTo(pixelCoordinates[i], pixelCoordinates[i + 1]);
      goog.asserts.assert(goog.isNumber(instruction[1]));
      var end = /** @type {number} */ (instruction[1]);
      for (i += 2; i < end; i += 2) {
        context.lineTo(pixelCoordinates[i], pixelCoordinates[i + 1]);
      }
    } else if (type == ol.replay.canvas.Instruction.SET_FILL_STYLE) {
      goog.asserts.assert(goog.isObject(instruction[1]));
      var fillStyle = /** @type {ol.style.Fill} */ (instruction[1]);
      context.fillStyle = fillStyle.color;
    } else if (type == ol.replay.canvas.Instruction.SET_STROKE_STYLE) {
      goog.asserts.assert(goog.isObject(instruction[1]));
      var strokeStyle = /** @type {ol.style.Stroke} */ (instruction[1]);
      context.strokeStyle = strokeStyle.color;
      context.lineWidth = strokeStyle.width;
    } else if (type == ol.replay.canvas.Instruction.STROKE) {
      context.stroke();
    }
  }
  goog.asserts.assert(i == pixelCoordinates.length);
};


/**
 * @inheritDoc
 */
ol.replay.canvas.Batch.prototype.drawLineStringGeometry = goog.abstractMethod;


/**
 * @inheritDoc
 */
ol.replay.canvas.Batch.prototype.drawMultiLineStringGeometry =
    goog.abstractMethod;


/**
 * @inheritDoc
 */
ol.replay.canvas.Batch.prototype.drawPolygonGeometry = goog.abstractMethod;


/**
 * @inheritDoc
 */
ol.replay.canvas.Batch.prototype.drawMultiPolygonGeometry = goog.abstractMethod;


/**
 * FIXME empty description for jsdoc
 */
ol.replay.canvas.Batch.prototype.finish = goog.nullFunction;


/**
 * @inheritDoc
 */
ol.replay.canvas.Batch.prototype.setFillStrokeStyle = goog.abstractMethod;



/**
 * @constructor
 * @extends {ol.replay.canvas.Batch}
 * @protected
 */
ol.replay.canvas.LineStringBatch = function() {

  goog.base(this);

  /**
   * @private
   * @type {{currentStrokeStyle: ?ol.style.Stroke,
   *         lastDraw: number,
   *         strokeStyle: ?ol.style.Stroke}|null}
   */
  this.state_ = {
    currentStrokeStyle: null,
    lastDraw: 0,
    strokeStyle: null
  };

};
goog.inherits(ol.replay.canvas.LineStringBatch, ol.replay.canvas.Batch);


/**
 * @param {Array.<ol.Coordinate>} coordinates Coordinates.
 * @private
 */
ol.replay.canvas.LineStringBatch.prototype.drawCoordinates_ =
    function(coordinates) {
  var state = this.state_;
  if (!ol.style.stroke.equals(state.currentStrokeStyle, state.strokeStyle)) {
    if (state.lastDraw != this.coordinates.length) {
      this.instructions.push([ol.replay.canvas.Instruction.STROKE]);
    }
    this.instructions.push(
        [ol.replay.canvas.Instruction.SET_STROKE_STYLE, state.strokeStyle],
        [ol.replay.canvas.Instruction.BEGIN_PATH]);
    state.currentStrokeStyle = state.strokeStyle;
  }
  var end = this.appendCoordinates(coordinates, false);
  this.instructions.push([ol.replay.canvas.Instruction.MOVE_TO_LINE_TO, end]);
};


/**
 * @inheritDoc
 */
ol.replay.canvas.LineStringBatch.prototype.drawLineStringGeometry =
    function(lineStringGeometry) {
  goog.asserts.assert(!goog.isNull(this.state_));
  this.drawCoordinates_(lineStringGeometry.getCoordinates());
};


/**
 * @inheritDoc
 */
ol.replay.canvas.LineStringBatch.prototype.drawMultiLineStringGeometry =
    function(multiLineStringGeometry) {
  goog.asserts.assert(!goog.isNull(this.state_));
  var coordinatess = multiLineStringGeometry.getCoordinatess();
  var i, ii;
  for (i = 0, ii = coordinatess.length; i < ii; ++i) {
    this.drawCoordinates_(coordinatess[i]);
  }
};


/**
 * @inheritDoc
 */
ol.replay.canvas.LineStringBatch.prototype.finish = function() {
  var state = this.state_;
  goog.asserts.assert(!goog.isNull(state));
  if (state.lastDraw != this.coordinates.length) {
    this.instructions.push([ol.replay.canvas.Instruction.STROKE]);
  }
  this.state_ = null;
};


/**
 * @inheritDoc
 */
ol.replay.canvas.LineStringBatch.prototype.setFillStrokeStyle =
    function(fillStyle, strokeStyle) {
  goog.asserts.assert(!goog.isNull(this.state_));
  goog.asserts.assert(goog.isNull(fillStyle));
  goog.asserts.assert(!goog.isNull(strokeStyle));
  this.state_.strokeStyle = strokeStyle;
};



/**
 * @constructor
 * @extends {ol.replay.canvas.Batch}
 * @protected
 */
ol.replay.canvas.PolygonBatch = function() {

  goog.base(this);

  /**
   * @private
   * @type {{currentFillStyle: ?ol.style.Fill,
   *         currentStrokeStyle: ?ol.style.Stroke,
   *         fillStyle: ?ol.style.Fill,
   *         strokeStyle: ?ol.style.Stroke}|null}
   */
  this.state_ = {
    currentFillStyle: null,
    currentStrokeStyle: null,
    fillStyle: null,
    strokeStyle: null
  };

};
goog.inherits(ol.replay.canvas.PolygonBatch, ol.replay.canvas.Batch);


/**
 * @param {Array.<Array.<ol.Coordinate>>} rings Rings.
 * @private
 */
ol.replay.canvas.PolygonBatch.prototype.drawRings_ = function(rings) {
  var state = this.state_;
  this.instructions.push([ol.replay.canvas.Instruction.BEGIN_PATH]);
  var i, ii;
  for (i = 0, ii = rings.length; i < ii; ++i) {
    var end = this.appendCoordinates(rings[i], true);
    this.instructions.push(
        [ol.replay.canvas.Instruction.MOVE_TO_LINE_TO, end],
        [ol.replay.canvas.Instruction.CLOSE_PATH]);
  }
  // FIXME is it quicker to fill and stroke each polygon individually,
  // FIXME or all polygons together?
  if (!goog.isNull(state.fillStyle)) {
    this.instructions.push([ol.replay.canvas.Instruction.FILL]);
  }
  if (!goog.isNull(state.strokeStyle)) {
    this.instructions.push([ol.replay.canvas.Instruction.STROKE]);
  }
};


/**
 * @inheritDoc
 */
ol.replay.canvas.PolygonBatch.prototype.drawPolygonGeometry =
    function(polygonGeometry) {
  goog.asserts.assert(!goog.isNull(this.state_));
  this.setFillStrokeStyles_();
  this.drawRings_(polygonGeometry.getRings());
};


/**
 * @inheritDoc
 */
ol.replay.canvas.PolygonBatch.prototype.drawMultiPolygonGeometry =
    function(multiPolygonGeometry) {
  goog.asserts.assert(!goog.isNull(this.state_));
  this.setFillStrokeStyles_();
  var ringss = multiPolygonGeometry.getRingss();
  var i, ii;
  for (i = 0, ii = ringss.length; i < ii; ++i) {
    this.drawRings_(ringss[i]);
  }
};


/**
 * @inheritDoc
 */
ol.replay.canvas.PolygonBatch.prototype.finish = function() {
  goog.asserts.assert(!goog.isNull(this.state_));
  this.state_ = null;
};


/**
 * @inheritDoc
 */
ol.replay.canvas.PolygonBatch.prototype.setFillStrokeStyle =
    function(fillStyle, strokeStyle) {
  goog.asserts.assert(!goog.isNull(this.state_));
  goog.asserts.assert(!goog.isNull(fillStyle) || !goog.isNull(strokeStyle));
  this.state_.fillStyle = fillStyle;
  this.state_.strokeStyle = strokeStyle;
};


/**
 * @private
 */
ol.replay.canvas.PolygonBatch.prototype.setFillStrokeStyles_ = function() {
  var state = this.state_;
  if (!goog.isNull(state.fillStyle) &&
      !ol.style.fill.equals(state.currentFillStyle, state.fillStyle)) {
    this.instructions.push(
        [ol.replay.canvas.Instruction.SET_FILL_STYLE, state.fillStyle]);
    state.currentFillStyle = state.fillStyle;
  }
  if (!goog.isNull(state.strokeStyle) &&
      !ol.style.stroke.equals(state.currentStrokeStyle, state.strokeStyle)) {
    this.instructions.push(
        [ol.replay.canvas.Instruction.SET_STROKE_STYLE, state.strokeStyle]);
    state.currentStrokeStyle = state.strokeStyle;
  }
};



/**
 * @constructor
 * @implements {ol.replay.IBatchGroup}
 */
ol.replay.canvas.BatchGroup = function() {

  /**
   * @private
   * @type {Object.<string,
   *        Object.<ol.replay.BatchType, ol.replay.canvas.Batch>>}
   */
  this.batchesByZIndex_ = {};

};


/**
 * @param {CanvasRenderingContext2D} context Context.
 * @param {goog.vec.Mat4.AnyType} transform Transform.
 */
ol.replay.canvas.BatchGroup.prototype.draw = function(context, transform) {
  /** @type {Array.<number>} */
  var zs = goog.array.map(goog.object.getKeys(this.batchesByZIndex_), Number);
  goog.array.sort(zs);
  var i, ii;
  for (i = 0, ii = zs.length; i < ii; ++i) {
    var batches = this.batchesByZIndex_[zs[i].toString()];
    var batchType;
    for (batchType in batches) {
      var batch = batches[batchType];
      batch.draw(context, transform);
    }
  }
};


/**
 * @inheritDoc
 */
ol.replay.canvas.BatchGroup.prototype.finish = function() {
  var zKey;
  for (zKey in this.batchesByZIndex_) {
    var batches = this.batchesByZIndex_[zKey];
    var batchKey;
    for (batchKey in batches) {
      batches[batchKey].finish();
    }
  }
};


/**
 * @inheritDoc
 */
ol.replay.canvas.BatchGroup.prototype.getBatch = function(zIndex, batchType) {
  var zIndexKey = goog.isDef(zIndex) ? zIndex.toString() : '0';
  var batches = this.batchesByZIndex_[zIndexKey];
  if (!goog.isDef(batches)) {
    batches = {};
    this.batchesByZIndex_[zIndexKey] = batches;
  }
  var batch = batches[batchType];
  if (!goog.isDef(batch)) {
    var constructor = ol.replay.canvas.BATCH_CONSTRUCTORS_[batchType];
    goog.asserts.assert(goog.isDef(constructor));
    batch = new constructor();
    batches[batchType] = batch;
  }
  return batch;
};


/**
 * @inheritDoc
 */
ol.replay.canvas.BatchGroup.prototype.isEmpty = function() {
  return goog.object.isEmpty(this.batchesByZIndex_);
};


/**
 * @const
 * @private
 * @type {Object.<ol.replay.BatchType, function(new: ol.replay.canvas.Batch)>}
 */
ol.replay.canvas.BATCH_CONSTRUCTORS_ = {
  'LineString': ol.replay.canvas.LineStringBatch,
  'Polygon': ol.replay.canvas.PolygonBatch
};