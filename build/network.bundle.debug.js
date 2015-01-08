!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Network=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Julian on 12/18/2014.
 */
exports.Interface = [

    /*
    gets called when a broadcast message reaches this node.
    this function evaluates if the node should propagate the message further or if it should stop
    sending it. This is defined by either returning {true} (Stop) or {false} (Keep propagating)
    */
    "stopPropagation",

    /*
    before a message is broadcast, it gets decorated by the Broadcast definition.
    Here we can add additional values.
    This function only gets called when a peer starts a NEW BROADCAST. It will not be called when a
    peer simply propagates another peers broadcast.
    */
    "decorateBroadcastMessage",

    /*
    Remove the decoration of the message so that the application can interact with the broadcast message
    transparently. This gets called whenever a broadcast message hits a peer and is propagated to the application.
     */
    "removeDecoration"
];
},{}],2:[function(require,module,exports){
/**
 * Created by Julian on 12/18/2014.
 */
exports.Interface = [

    /*
    Starts the Handshaking. This must be done once to connect to the network. {launch} takes a callback
    as parameter that gets called when the ICE-Candidates are gathered.
    The {offer} that is created must be transmitted to the other peer (How this is done is out of the scope
    of this library) in order to initiate the handshake.
     */
    "launch",

    /*
    Implement {event.EventEmitter}
    We expect the following events:
        {statechange}: applies when the state changes: @params = ["disconnect", "partial", "connect"]
        {receive}: message is send. This is already filtered: @params = (sender {Peer}, message {Object||String}
        {churn}: a received message, unfiltered by BroadcastDef: @params: (sender {Peer}, message {Object||String}
     */
    "on",

    /*
    This is the final handshake-function that gets called after an answer is received
     */
    "handshake",

    /*
    Peer-Sampling-Service-function. When provided with a parameter n, a given number of randomly
    sampled peers is returned, otherwise the whole PartialView of the RPS is returned.
    The returned value should be a list of Objects that have a "send"- function to send data to the peers.
     */
    "getPeers",

    /*
    Upon receiving an offer from {launch} through the signaling service the peer creates a fitting answer.
    This answer is propagated to the application with a callback that must be provided to this function.
    The answer must be send back to the communication initiator.
     */
    "answer",

    /*
    This function checks if the membership protocol is already connected to the network and is "ready" or if
    the handshake is still pending.
    The parameter is a callback that gets called as soon as the peer is connected to the network.
    This function must apply the callback immediately, if it is ready!

    var membership = new Membership(...);

    membership.ready(function(){
        // The membership system is ready and can be used
    });

     */
    "ready"

];
},{}],3:[function(require,module,exports){
/**
 * Created by Julian on 12/18/2014.
 */
var Utils = require("yutils");
var BroadcastDefinition = require("../interface/broadcastDefinition.js").Interface;
var Membership = require("../interface/membership.js").Interface;
//var EventEmitter = require('event-emitter');
var EventEmitter = require('events').EventEmitter;

/**
 *
 * @constructor
 */
var Network = function (bdef, membership) {
    EventEmitter.call(this);

    // Make sure that the interfaces are implemented correctly
    if (!Utils.implements(bdef, BroadcastDefinition)) {
        throw new Error("the Broadcast-Definition must define the correct interface! (" +
            JSON.stringify(BroadcastDefinition) + ")");
    }
    if (!Utils.implements(membership, Membership)) {
        throw new Error("the Membership must define the correct interface! (" +
            JSON.stringify(Membership) + ")");
    }

    this._broadcastDefinition = bdef;
    this._membership = membership;

    var self = this;
    membership.on("churn", function (peer, message) {
        if (!bdef.stopPropagation(message)) {
	    var originalMessage = bdef.removeDecoration(message);
	    self.broadcast(message, true); // keep the decoration!
	    self.emit("receive", originalMessage);
        }
    });


    // listen..
};
Utils.inherit(Network, EventEmitter);

/**
 *
 * @param callback
 * @returns {Network}
 */
Network.prototype.ready = function(callback) {
    this._membership.ready(callback);
    return this;
};

/**
 * Send a broadcast to the network
 * @param msg
 */
Network.prototype.broadcast = function(msg, isDecorated) {
    isDecorated = typeof isDecorated === "undefined" ? false : isDecorated;
    if (!isDecorated) {
        msg = this._broadcastDefinition.decorateBroadcastMessage(msg);
    }
    var peers = this._membership.getPeers();
    for (var i=0; i<peers.length; ++i) {
        peers[i].send(msg);
    }
};

/**
 * Sends a random unicast to the network
 * @param msg
 */
Network.prototype.unicast = function (msg) {
    var peers = this._membership.getPeers(1);
    if (peers.length > 0) {
        peers[0].send(this.decorateBroadcastMessage(msg));
    } else {
        console.warn("cannot unicast: no peer is available!");
    }
};

/**
 * return the current membership protocol
 */
Network.prototype.membership = function () {
    return this._membership;
};

/************************************
 *              A P I               *
 ************************************/
/**
 *
 * @param options {Object}
 * {
 *      broadcastDefinition: {broadcastDefinition},
 *      membership: {membership}
 * }
 * @returns {Network}
 */
exports.init = function (options) {
    var bdef, membership;

    // TODO: make this more elegant..
    if (Utils.isDefined(options)) {
        bdef = options.broadcastDefinition;
        membership = options.membership;
    }

    return new Network(bdef, membership);
};

},{"../interface/broadcastDefinition.js":1,"../interface/membership.js":2,"events":5,"yutils":4}],4:[function(require,module,exports){
/**
 * Created by Julian on 12/10/2014.
 */
(function (exports) {

    // performance.now polyfill
    var perf = null;
    if (typeof performance === 'undefined') {
        perf = {};
    } else {
        perf = performance;
    }

    perf.now = perf.now || perf.mozNow || perf.msNow ||  perf.oNow || perf.webkitNow || Date.now ||
        function () {
            return new Date().getTime();
        };

    function swap(array, i, j) {
        if (i !== j) {
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }

    /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     */

    var getRandomInt = exports.getRandomInt = function (min, max) {
        if (min > max) throw new Error("min must be smaller than max! {" + min + ">" + max + "}" );
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    exports.sample = function (list, n) {
        var result = [], j,i = 0, L = n > list.length ? list.length : n, s = list.length - 1;
        for(;i<L;i++) {
            j = getRandomInt(i,s);
            swap(list,i,j);
            result.push(list[i]);
        }
        return result;
    };

    exports.isString = function(myVar) {
        return (typeof myVar === 'string' || myVar instanceof String)
    };

    exports.assertLength = function (arg, nbr) {
        if (arg.length === nbr) return true;
        else throw new Error("Wrong number of arguments: expected:" + nbr + ", but got: " + arg.length);
    };

    exports.guid = function () {
        var d = perf.now();
        var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return guid;
    };

    exports.timeDifferenceInMs = function (tsA, tsB) {
        if (tsA instanceof Date){
            tsA = tsA.getTime();
        }
        if (tsB instanceof Date){
            tsB = tsB.getTime();
        }
        return Math.abs(tsA - tsB);
    };

    /**
     * milliseconds to seconds
     * @param ms {Number} Millis
     */
    exports.msToS = function (ms) {
        return ms / 1000;
    };

    exports.isDefined = function (o) {
        if (o === null) return false;
        if (typeof o === "undefined") return false;
        return true;
    };

    /**
     * Shallow clone
     * @param list
     * @returns {Array|string|Blob}
     */
    exports.cloneArray = function (list) {
        return list.slice(0);
    }

    /**
     * removes the item at the position and reindexes the list
     * @param list
     * @param i
     * @returns {*}
     */
    exports.deletePosition = function (list, i) {
        if (i < 0 || i >= list.length) throw new Error("Out of bounds");
        list.splice(i,1);
        return list;
    };

    /**
     * Checks weather the the object implements the full interface or not
     * @param o {Object}
     */
    var implements = exports.implements = function (o, a) {
        if (Array.isArray(a)) {
            return implements.apply({},[o].concat(a));
        }
        var i = 1, methodName;
        while((methodName = arguments[i++])) {
            if (typeof o[methodName] !== "function") {
                return false;
            }
        }
        return true;
    };

    /**
     * Inherit stuff from parent
     * @param child
     * @param parent
     */
    exports.inherit = function (child, parent) {
        child.prototype = Object.create(parent.prototype);
    };

})(typeof exports === 'undefined' ? this['yUtils'] = {} : exports);
},{}],5:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[3])(3)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImludGVyZmFjZS9icm9hZGNhc3REZWZpbml0aW9uLmpzIiwiaW50ZXJmYWNlL21lbWJlcnNoaXAuanMiLCJsaWIvbmV0d29yay5qcyIsIm5vZGVfbW9kdWxlcy95dXRpbHMveXV0aWxzLmpzIiwiLi4vLi4vLi4vLi4vLi4vdXNyL2xvY2FsL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQ3JlYXRlZCBieSBKdWxpYW4gb24gMTIvMTgvMjAxNC5cbiAqL1xuZXhwb3J0cy5JbnRlcmZhY2UgPSBbXG5cbiAgICAvKlxuICAgIGdldHMgY2FsbGVkIHdoZW4gYSBicm9hZGNhc3QgbWVzc2FnZSByZWFjaGVzIHRoaXMgbm9kZS5cbiAgICB0aGlzIGZ1bmN0aW9uIGV2YWx1YXRlcyBpZiB0aGUgbm9kZSBzaG91bGQgcHJvcGFnYXRlIHRoZSBtZXNzYWdlIGZ1cnRoZXIgb3IgaWYgaXQgc2hvdWxkIHN0b3BcbiAgICBzZW5kaW5nIGl0LiBUaGlzIGlzIGRlZmluZWQgYnkgZWl0aGVyIHJldHVybmluZyB7dHJ1ZX0gKFN0b3ApIG9yIHtmYWxzZX0gKEtlZXAgcHJvcGFnYXRpbmcpXG4gICAgKi9cbiAgICBcInN0b3BQcm9wYWdhdGlvblwiLFxuXG4gICAgLypcbiAgICBiZWZvcmUgYSBtZXNzYWdlIGlzIGJyb2FkY2FzdCwgaXQgZ2V0cyBkZWNvcmF0ZWQgYnkgdGhlIEJyb2FkY2FzdCBkZWZpbml0aW9uLlxuICAgIEhlcmUgd2UgY2FuIGFkZCBhZGRpdGlvbmFsIHZhbHVlcy5cbiAgICBUaGlzIGZ1bmN0aW9uIG9ubHkgZ2V0cyBjYWxsZWQgd2hlbiBhIHBlZXIgc3RhcnRzIGEgTkVXIEJST0FEQ0FTVC4gSXQgd2lsbCBub3QgYmUgY2FsbGVkIHdoZW4gYVxuICAgIHBlZXIgc2ltcGx5IHByb3BhZ2F0ZXMgYW5vdGhlciBwZWVycyBicm9hZGNhc3QuXG4gICAgKi9cbiAgICBcImRlY29yYXRlQnJvYWRjYXN0TWVzc2FnZVwiLFxuXG4gICAgLypcbiAgICBSZW1vdmUgdGhlIGRlY29yYXRpb24gb2YgdGhlIG1lc3NhZ2Ugc28gdGhhdCB0aGUgYXBwbGljYXRpb24gY2FuIGludGVyYWN0IHdpdGggdGhlIGJyb2FkY2FzdCBtZXNzYWdlXG4gICAgdHJhbnNwYXJlbnRseS4gVGhpcyBnZXRzIGNhbGxlZCB3aGVuZXZlciBhIGJyb2FkY2FzdCBtZXNzYWdlIGhpdHMgYSBwZWVyIGFuZCBpcyBwcm9wYWdhdGVkIHRvIHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKi9cbiAgICBcInJlbW92ZURlY29yYXRpb25cIlxuXTsiLCIvKipcbiAqIENyZWF0ZWQgYnkgSnVsaWFuIG9uIDEyLzE4LzIwMTQuXG4gKi9cbmV4cG9ydHMuSW50ZXJmYWNlID0gW1xuXG4gICAgLypcbiAgICBTdGFydHMgdGhlIEhhbmRzaGFraW5nLiBUaGlzIG11c3QgYmUgZG9uZSBvbmNlIHRvIGNvbm5lY3QgdG8gdGhlIG5ldHdvcmsuIHtsYXVuY2h9IHRha2VzIGEgY2FsbGJhY2tcbiAgICBhcyBwYXJhbWV0ZXIgdGhhdCBnZXRzIGNhbGxlZCB3aGVuIHRoZSBJQ0UtQ2FuZGlkYXRlcyBhcmUgZ2F0aGVyZWQuXG4gICAgVGhlIHtvZmZlcn0gdGhhdCBpcyBjcmVhdGVkIG11c3QgYmUgdHJhbnNtaXR0ZWQgdG8gdGhlIG90aGVyIHBlZXIgKEhvdyB0aGlzIGlzIGRvbmUgaXMgb3V0IG9mIHRoZSBzY29wZVxuICAgIG9mIHRoaXMgbGlicmFyeSkgaW4gb3JkZXIgdG8gaW5pdGlhdGUgdGhlIGhhbmRzaGFrZS5cbiAgICAgKi9cbiAgICBcImxhdW5jaFwiLFxuXG4gICAgLypcbiAgICBJbXBsZW1lbnQge2V2ZW50LkV2ZW50RW1pdHRlcn1cbiAgICBXZSBleHBlY3QgdGhlIGZvbGxvd2luZyBldmVudHM6XG4gICAgICAgIHtzdGF0ZWNoYW5nZX06IGFwcGxpZXMgd2hlbiB0aGUgc3RhdGUgY2hhbmdlczogQHBhcmFtcyA9IFtcImRpc2Nvbm5lY3RcIiwgXCJwYXJ0aWFsXCIsIFwiY29ubmVjdFwiXVxuICAgICAgICB7cmVjZWl2ZX06IG1lc3NhZ2UgaXMgc2VuZC4gVGhpcyBpcyBhbHJlYWR5IGZpbHRlcmVkOiBAcGFyYW1zID0gKHNlbmRlciB7UGVlcn0sIG1lc3NhZ2Uge09iamVjdHx8U3RyaW5nfVxuICAgICAgICB7Y2h1cm59OiBhIHJlY2VpdmVkIG1lc3NhZ2UsIHVuZmlsdGVyZWQgYnkgQnJvYWRjYXN0RGVmOiBAcGFyYW1zOiAoc2VuZGVyIHtQZWVyfSwgbWVzc2FnZSB7T2JqZWN0fHxTdHJpbmd9XG4gICAgICovXG4gICAgXCJvblwiLFxuXG4gICAgLypcbiAgICBUaGlzIGlzIHRoZSBmaW5hbCBoYW5kc2hha2UtZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBhZnRlciBhbiBhbnN3ZXIgaXMgcmVjZWl2ZWRcbiAgICAgKi9cbiAgICBcImhhbmRzaGFrZVwiLFxuXG4gICAgLypcbiAgICBQZWVyLVNhbXBsaW5nLVNlcnZpY2UtZnVuY3Rpb24uIFdoZW4gcHJvdmlkZWQgd2l0aCBhIHBhcmFtZXRlciBuLCBhIGdpdmVuIG51bWJlciBvZiByYW5kb21seVxuICAgIHNhbXBsZWQgcGVlcnMgaXMgcmV0dXJuZWQsIG90aGVyd2lzZSB0aGUgd2hvbGUgUGFydGlhbFZpZXcgb2YgdGhlIFJQUyBpcyByZXR1cm5lZC5cbiAgICBUaGUgcmV0dXJuZWQgdmFsdWUgc2hvdWxkIGJlIGEgbGlzdCBvZiBPYmplY3RzIHRoYXQgaGF2ZSBhIFwic2VuZFwiLSBmdW5jdGlvbiB0byBzZW5kIGRhdGEgdG8gdGhlIHBlZXJzLlxuICAgICAqL1xuICAgIFwiZ2V0UGVlcnNcIixcblxuICAgIC8qXG4gICAgVXBvbiByZWNlaXZpbmcgYW4gb2ZmZXIgZnJvbSB7bGF1bmNofSB0aHJvdWdoIHRoZSBzaWduYWxpbmcgc2VydmljZSB0aGUgcGVlciBjcmVhdGVzIGEgZml0dGluZyBhbnN3ZXIuXG4gICAgVGhpcyBhbnN3ZXIgaXMgcHJvcGFnYXRlZCB0byB0aGUgYXBwbGljYXRpb24gd2l0aCBhIGNhbGxiYWNrIHRoYXQgbXVzdCBiZSBwcm92aWRlZCB0byB0aGlzIGZ1bmN0aW9uLlxuICAgIFRoZSBhbnN3ZXIgbXVzdCBiZSBzZW5kIGJhY2sgdG8gdGhlIGNvbW11bmljYXRpb24gaW5pdGlhdG9yLlxuICAgICAqL1xuICAgIFwiYW5zd2VyXCIsXG5cbiAgICAvKlxuICAgIFRoaXMgZnVuY3Rpb24gY2hlY2tzIGlmIHRoZSBtZW1iZXJzaGlwIHByb3RvY29sIGlzIGFscmVhZHkgY29ubmVjdGVkIHRvIHRoZSBuZXR3b3JrIGFuZCBpcyBcInJlYWR5XCIgb3IgaWZcbiAgICB0aGUgaGFuZHNoYWtlIGlzIHN0aWxsIHBlbmRpbmcuXG4gICAgVGhlIHBhcmFtZXRlciBpcyBhIGNhbGxiYWNrIHRoYXQgZ2V0cyBjYWxsZWQgYXMgc29vbiBhcyB0aGUgcGVlciBpcyBjb25uZWN0ZWQgdG8gdGhlIG5ldHdvcmsuXG4gICAgVGhpcyBmdW5jdGlvbiBtdXN0IGFwcGx5IHRoZSBjYWxsYmFjayBpbW1lZGlhdGVseSwgaWYgaXQgaXMgcmVhZHkhXG5cbiAgICB2YXIgbWVtYmVyc2hpcCA9IG5ldyBNZW1iZXJzaGlwKC4uLik7XG5cbiAgICBtZW1iZXJzaGlwLnJlYWR5KGZ1bmN0aW9uKCl7XG4gICAgICAgIC8vIFRoZSBtZW1iZXJzaGlwIHN5c3RlbSBpcyByZWFkeSBhbmQgY2FuIGJlIHVzZWRcbiAgICB9KTtcblxuICAgICAqL1xuICAgIFwicmVhZHlcIlxuXG5dOyIsIi8qKlxuICogQ3JlYXRlZCBieSBKdWxpYW4gb24gMTIvMTgvMjAxNC5cbiAqL1xudmFyIFV0aWxzID0gcmVxdWlyZShcInl1dGlsc1wiKTtcbnZhciBCcm9hZGNhc3REZWZpbml0aW9uID0gcmVxdWlyZShcIi4uL2ludGVyZmFjZS9icm9hZGNhc3REZWZpbml0aW9uLmpzXCIpLkludGVyZmFjZTtcbnZhciBNZW1iZXJzaGlwID0gcmVxdWlyZShcIi4uL2ludGVyZmFjZS9tZW1iZXJzaGlwLmpzXCIpLkludGVyZmFjZTtcbi8vdmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50LWVtaXR0ZXInKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cbi8qKlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTmV0d29yayA9IGZ1bmN0aW9uIChiZGVmLCBtZW1iZXJzaGlwKSB7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgaW50ZXJmYWNlcyBhcmUgaW1wbGVtZW50ZWQgY29ycmVjdGx5XG4gICAgaWYgKCFVdGlscy5pbXBsZW1lbnRzKGJkZWYsIEJyb2FkY2FzdERlZmluaXRpb24pKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInRoZSBCcm9hZGNhc3QtRGVmaW5pdGlvbiBtdXN0IGRlZmluZSB0aGUgY29ycmVjdCBpbnRlcmZhY2UhIChcIiArXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShCcm9hZGNhc3REZWZpbml0aW9uKSArIFwiKVwiKTtcbiAgICB9XG4gICAgaWYgKCFVdGlscy5pbXBsZW1lbnRzKG1lbWJlcnNoaXAsIE1lbWJlcnNoaXApKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInRoZSBNZW1iZXJzaGlwIG11c3QgZGVmaW5lIHRoZSBjb3JyZWN0IGludGVyZmFjZSEgKFwiICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KE1lbWJlcnNoaXApICsgXCIpXCIpO1xuICAgIH1cblxuICAgIHRoaXMuX2Jyb2FkY2FzdERlZmluaXRpb24gPSBiZGVmO1xuICAgIHRoaXMuX21lbWJlcnNoaXAgPSBtZW1iZXJzaGlwO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIG1lbWJlcnNoaXAub24oXCJjaHVyblwiLCBmdW5jdGlvbiAocGVlciwgbWVzc2FnZSkge1xuICAgICAgICBpZiAoIWJkZWYuc3RvcFByb3BhZ2F0aW9uKG1lc3NhZ2UpKSB7XG5cdCAgICB2YXIgb3JpZ2luYWxNZXNzYWdlID0gYmRlZi5yZW1vdmVEZWNvcmF0aW9uKG1lc3NhZ2UpO1xuXHQgICAgc2VsZi5icm9hZGNhc3QobWVzc2FnZSwgdHJ1ZSk7IC8vIGtlZXAgdGhlIGRlY29yYXRpb24hXG5cdCAgICBzZWxmLmVtaXQoXCJyZWNlaXZlXCIsIG9yaWdpbmFsTWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgLy8gbGlzdGVuLi5cbn07XG5VdGlscy5pbmhlcml0KE5ldHdvcmssIEV2ZW50RW1pdHRlcik7XG5cbi8qKlxuICpcbiAqIEBwYXJhbSBjYWxsYmFja1xuICogQHJldHVybnMge05ldHdvcmt9XG4gKi9cbk5ldHdvcmsucHJvdG90eXBlLnJlYWR5ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB0aGlzLl9tZW1iZXJzaGlwLnJlYWR5KGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogU2VuZCBhIGJyb2FkY2FzdCB0byB0aGUgbmV0d29ya1xuICogQHBhcmFtIG1zZ1xuICovXG5OZXR3b3JrLnByb3RvdHlwZS5icm9hZGNhc3QgPSBmdW5jdGlvbihtc2csIGlzRGVjb3JhdGVkKSB7XG4gICAgaXNEZWNvcmF0ZWQgPSB0eXBlb2YgaXNEZWNvcmF0ZWQgPT09IFwidW5kZWZpbmVkXCIgPyBmYWxzZSA6IGlzRGVjb3JhdGVkO1xuICAgIGlmICghaXNEZWNvcmF0ZWQpIHtcbiAgICAgICAgbXNnID0gdGhpcy5fYnJvYWRjYXN0RGVmaW5pdGlvbi5kZWNvcmF0ZUJyb2FkY2FzdE1lc3NhZ2UobXNnKTtcbiAgICB9XG4gICAgdmFyIHBlZXJzID0gdGhpcy5fbWVtYmVyc2hpcC5nZXRQZWVycygpO1xuICAgIGZvciAodmFyIGk9MDsgaTxwZWVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBwZWVyc1tpXS5zZW5kKG1zZyk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBTZW5kcyBhIHJhbmRvbSB1bmljYXN0IHRvIHRoZSBuZXR3b3JrXG4gKiBAcGFyYW0gbXNnXG4gKi9cbk5ldHdvcmsucHJvdG90eXBlLnVuaWNhc3QgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgdmFyIHBlZXJzID0gdGhpcy5fbWVtYmVyc2hpcC5nZXRQZWVycygxKTtcbiAgICBpZiAocGVlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBwZWVyc1swXS5zZW5kKHRoaXMuZGVjb3JhdGVCcm9hZGNhc3RNZXNzYWdlKG1zZykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcImNhbm5vdCB1bmljYXN0OiBubyBwZWVyIGlzIGF2YWlsYWJsZSFcIik7XG4gICAgfVxufTtcblxuLyoqXG4gKiByZXR1cm4gdGhlIGN1cnJlbnQgbWVtYmVyc2hpcCBwcm90b2NvbFxuICovXG5OZXR3b3JrLnByb3RvdHlwZS5tZW1iZXJzaGlwID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9tZW1iZXJzaGlwO1xufTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogICAgICAgICAgICAgIEEgUCBJICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qKlxuICpcbiAqIEBwYXJhbSBvcHRpb25zIHtPYmplY3R9XG4gKiB7XG4gKiAgICAgIGJyb2FkY2FzdERlZmluaXRpb246IHticm9hZGNhc3REZWZpbml0aW9ufSxcbiAqICAgICAgbWVtYmVyc2hpcDoge21lbWJlcnNoaXB9XG4gKiB9XG4gKiBAcmV0dXJucyB7TmV0d29ya31cbiAqL1xuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgYmRlZiwgbWVtYmVyc2hpcDtcblxuICAgIC8vIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVsZWdhbnQuLlxuICAgIGlmIChVdGlscy5pc0RlZmluZWQob3B0aW9ucykpIHtcbiAgICAgICAgYmRlZiA9IG9wdGlvbnMuYnJvYWRjYXN0RGVmaW5pdGlvbjtcbiAgICAgICAgbWVtYmVyc2hpcCA9IG9wdGlvbnMubWVtYmVyc2hpcDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IE5ldHdvcmsoYmRlZiwgbWVtYmVyc2hpcCk7XG59O1xuIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgSnVsaWFuIG9uIDEyLzEwLzIwMTQuXHJcbiAqL1xyXG4oZnVuY3Rpb24gKGV4cG9ydHMpIHtcclxuXHJcbiAgICAvLyBwZXJmb3JtYW5jZS5ub3cgcG9seWZpbGxcclxuICAgIHZhciBwZXJmID0gbnVsbDtcclxuICAgIGlmICh0eXBlb2YgcGVyZm9ybWFuY2UgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgcGVyZiA9IHt9O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBwZXJmID0gcGVyZm9ybWFuY2U7XHJcbiAgICB9XHJcblxyXG4gICAgcGVyZi5ub3cgPSBwZXJmLm5vdyB8fCBwZXJmLm1vek5vdyB8fCBwZXJmLm1zTm93IHx8ICBwZXJmLm9Ob3cgfHwgcGVyZi53ZWJraXROb3cgfHwgRGF0ZS5ub3cgfHxcclxuICAgICAgICBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgIGZ1bmN0aW9uIHN3YXAoYXJyYXksIGksIGopIHtcclxuICAgICAgICBpZiAoaSAhPT0gaikge1xyXG4gICAgICAgICAgICB2YXIgdGVtcCA9IGFycmF5W2ldO1xyXG4gICAgICAgICAgICBhcnJheVtpXSA9IGFycmF5W2pdO1xyXG4gICAgICAgICAgICBhcnJheVtqXSA9IHRlbXA7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qXHJcbiAgICB+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+flxyXG4gICAgICovXHJcblxyXG4gICAgdmFyIGdldFJhbmRvbUludCA9IGV4cG9ydHMuZ2V0UmFuZG9tSW50ID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XHJcbiAgICAgICAgaWYgKG1pbiA+IG1heCkgdGhyb3cgbmV3IEVycm9yKFwibWluIG11c3QgYmUgc21hbGxlciB0aGFuIG1heCEge1wiICsgbWluICsgXCI+XCIgKyBtYXggKyBcIn1cIiApO1xyXG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpICsgbWluO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLnNhbXBsZSA9IGZ1bmN0aW9uIChsaXN0LCBuKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdLCBqLGkgPSAwLCBMID0gbiA+IGxpc3QubGVuZ3RoID8gbGlzdC5sZW5ndGggOiBuLCBzID0gbGlzdC5sZW5ndGggLSAxO1xyXG4gICAgICAgIGZvcig7aTxMO2krKykge1xyXG4gICAgICAgICAgICBqID0gZ2V0UmFuZG9tSW50KGkscyk7XHJcbiAgICAgICAgICAgIHN3YXAobGlzdCxpLGopO1xyXG4gICAgICAgICAgICByZXN1bHQucHVzaChsaXN0W2ldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0cy5pc1N0cmluZyA9IGZ1bmN0aW9uKG15VmFyKSB7XHJcbiAgICAgICAgcmV0dXJuICh0eXBlb2YgbXlWYXIgPT09ICdzdHJpbmcnIHx8IG15VmFyIGluc3RhbmNlb2YgU3RyaW5nKVxyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmFzc2VydExlbmd0aCA9IGZ1bmN0aW9uIChhcmcsIG5icikge1xyXG4gICAgICAgIGlmIChhcmcubGVuZ3RoID09PSBuYnIpIHJldHVybiB0cnVlO1xyXG4gICAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKFwiV3JvbmcgbnVtYmVyIG9mIGFyZ3VtZW50czogZXhwZWN0ZWQ6XCIgKyBuYnIgKyBcIiwgYnV0IGdvdDogXCIgKyBhcmcubGVuZ3RoKTtcclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0cy5ndWlkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBkID0gcGVyZi5ub3coKTtcclxuICAgICAgICB2YXIgZ3VpZCA9ICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICAgICAgdmFyIHIgPSAoZCArIE1hdGgucmFuZG9tKCkgKiAxNikgJSAxNiB8IDA7XHJcbiAgICAgICAgICAgIGQgPSBNYXRoLmZsb29yKGQgLyAxNik7XHJcbiAgICAgICAgICAgIHJldHVybiAoYyA9PT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KSkudG9TdHJpbmcoMTYpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBndWlkO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLnRpbWVEaWZmZXJlbmNlSW5NcyA9IGZ1bmN0aW9uICh0c0EsIHRzQikge1xyXG4gICAgICAgIGlmICh0c0EgaW5zdGFuY2VvZiBEYXRlKXtcclxuICAgICAgICAgICAgdHNBID0gdHNBLmdldFRpbWUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRzQiBpbnN0YW5jZW9mIERhdGUpe1xyXG4gICAgICAgICAgICB0c0IgPSB0c0IuZ2V0VGltZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gTWF0aC5hYnModHNBIC0gdHNCKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBtaWxsaXNlY29uZHMgdG8gc2Vjb25kc1xyXG4gICAgICogQHBhcmFtIG1zIHtOdW1iZXJ9IE1pbGxpc1xyXG4gICAgICovXHJcbiAgICBleHBvcnRzLm1zVG9TID0gZnVuY3Rpb24gKG1zKSB7XHJcbiAgICAgICAgcmV0dXJuIG1zIC8gMTAwMDtcclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0cy5pc0RlZmluZWQgPSBmdW5jdGlvbiAobykge1xyXG4gICAgICAgIGlmIChvID09PSBudWxsKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvID09PSBcInVuZGVmaW5lZFwiKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2hhbGxvdyBjbG9uZVxyXG4gICAgICogQHBhcmFtIGxpc3RcclxuICAgICAqIEByZXR1cm5zIHtBcnJheXxzdHJpbmd8QmxvYn1cclxuICAgICAqL1xyXG4gICAgZXhwb3J0cy5jbG9uZUFycmF5ID0gZnVuY3Rpb24gKGxpc3QpIHtcclxuICAgICAgICByZXR1cm4gbGlzdC5zbGljZSgwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIHJlbW92ZXMgdGhlIGl0ZW0gYXQgdGhlIHBvc2l0aW9uIGFuZCByZWluZGV4ZXMgdGhlIGxpc3RcclxuICAgICAqIEBwYXJhbSBsaXN0XHJcbiAgICAgKiBAcGFyYW0gaVxyXG4gICAgICogQHJldHVybnMgeyp9XHJcbiAgICAgKi9cclxuICAgIGV4cG9ydHMuZGVsZXRlUG9zaXRpb24gPSBmdW5jdGlvbiAobGlzdCwgaSkge1xyXG4gICAgICAgIGlmIChpIDwgMCB8fCBpID49IGxpc3QubGVuZ3RoKSB0aHJvdyBuZXcgRXJyb3IoXCJPdXQgb2YgYm91bmRzXCIpO1xyXG4gICAgICAgIGxpc3Quc3BsaWNlKGksMSk7XHJcbiAgICAgICAgcmV0dXJuIGxpc3Q7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIHdlYXRoZXIgdGhlIHRoZSBvYmplY3QgaW1wbGVtZW50cyB0aGUgZnVsbCBpbnRlcmZhY2Ugb3Igbm90XHJcbiAgICAgKiBAcGFyYW0gbyB7T2JqZWN0fVxyXG4gICAgICovXHJcbiAgICB2YXIgaW1wbGVtZW50cyA9IGV4cG9ydHMuaW1wbGVtZW50cyA9IGZ1bmN0aW9uIChvLCBhKSB7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGltcGxlbWVudHMuYXBwbHkoe30sW29dLmNvbmNhdChhKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBpID0gMSwgbWV0aG9kTmFtZTtcclxuICAgICAgICB3aGlsZSgobWV0aG9kTmFtZSA9IGFyZ3VtZW50c1tpKytdKSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIG9bbWV0aG9kTmFtZV0gIT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaGVyaXQgc3R1ZmYgZnJvbSBwYXJlbnRcclxuICAgICAqIEBwYXJhbSBjaGlsZFxyXG4gICAgICogQHBhcmFtIHBhcmVudFxyXG4gICAgICovXHJcbiAgICBleHBvcnRzLmluaGVyaXQgPSBmdW5jdGlvbiAoY2hpbGQsIHBhcmVudCkge1xyXG4gICAgICAgIGNoaWxkLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUocGFyZW50LnByb3RvdHlwZSk7XHJcbiAgICB9O1xyXG5cclxufSkodHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gdGhpc1sneVV0aWxzJ10gPSB7fSA6IGV4cG9ydHMpOyIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiJdfQ==
