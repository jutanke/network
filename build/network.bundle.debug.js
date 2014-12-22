!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Network=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],3:[function(require,module,exports){
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
},{}],4:[function(require,module,exports){
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
        {receive}: message is send: @params = (sender {Peer}, message {Object||String}
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
},{}],5:[function(require,module,exports){
/**
 * Created by Julian on 12/18/2014.
 */
var Utils = require("yutils");
var BroadcastDefinition = require("./../interface/broadcastDefinition.js").Interface;
var Membership = require("./../interface/membership.js").Interface;
var PrimitiveBroadcastDef = require("./primitiveBroadcastDefinition.js").Def;
//var EventEmitter = require('event-emitter');
var EventEmitter = require('events').EventEmitter;

var Cyclon = require("cyclonp2p").Class;

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
Network.prototype.broadcast = function(msg) {
    var peers = this._membership.getPeers();
    var i = 0, L = peers.length;
    for (;i<L;i++) {
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
        peers[0].send(msg);
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
        bdef = options.broadcastDefinition || new PrimitiveBroadcastDef();
        membership = options.membership || new Cyclon();
    } else {
        bdef = new PrimitiveBroadcastDef();
        membership = new Cyclon();
    }

    return new Network(bdef, membership);
};
},{"./../interface/broadcastDefinition.js":3,"./../interface/membership.js":4,"./primitiveBroadcastDefinition.js":6,"cyclonp2p":7,"events":1,"yutils":49}],6:[function(require,module,exports){
/**
 * Created by Julian on 12/18/2014.
 */
var Utils = require("yutils");

/**
 * This is a very simple approach. It takes a unique value for peer and a counter to distinguish a message.
 * This solution grows without bounds!
 * @constructor
 */
function PrimitiveBroadcastDefinition() {
    this.cache = {};
    this.counter = 0;
    this.address = Utils.guid(); // pseudo-unique..
}

/**
 * gets called when a broadcast message reaches this node.
 * this function evaluates if the node should propagate the message further or if it should stop
 * sending it. This is defined by either returning {true} (Stop) or {false} (Keep propagating)
 * @param message {DecoratedMessage} the message got decorated form the other peers
 */
PrimitiveBroadcastDefinition.prototype.stopPropagation = function (message) {
    if (message.key in this.cache) {
        return true; // STOP PROPAGATION
    } else {
        this.cache[message.key] = true;
        return false; // KEEP ON PROPAGATING
    }
};

/**
 * before a message is broadcasted, it gets decorated by the Broadcast definition.
 * Here we can add additional values.
 * This function only gets called when a peer starts a NEW BROADCAST. It will not be called when a
 * peer simply propagates another peers broadcast.
 * @param message
 */
PrimitiveBroadcastDefinition.prototype.decorateBroadcastMessage = function (message) {
    var key = this.address + "#" + this.counter++;
    if (key in this.cache) throw new Error("This message got sent already!");
    this.cache[key] = true;
    return {key: key, payload: message };
};

/**
 * Remove the decoration of the message so that the application can interact with the broadcast message
 * transparently. This gets called whenever a broadcast message hits a peer and is propagated to the application.
 * @param message
 */
PrimitiveBroadcastDefinition.prototype.removeDecoration = function (message) {
    return message.payload;
};


exports.Def = PrimitiveBroadcastDefinition;
},{"yutils":49}],7:[function(require,module,exports){
/**
 * Remark:
 * The API for this class is defined in the library {p2pnetwork} - {interface/membership.js}
 * Created by Julian on 12/18/2014.
 */
var EventEmitter = require('events').EventEmitter;
var Utils = require("yutils");
//var _ = require("underscore");
var Handshake = require("handshake-webrtc");

/********************************************************************
 *                          A P I                                   *
 *  The code below is the implementation of them {membership}       *
 *  Interface that is defined in the library {p2pnetwork}           *
 *  https://github.com/justayak/network                             *
 ********************************************************************/

var delta_t = 10000; // 10 sec
var c = 10;
var l = 5;

/**
 *
 * @constructor
 */
function Cyclon(options) {
    EventEmitter.call(this);
    this.isReady = false;
    this.readyCallbacks = [];
    this.partialView = [];
    if (Utils.isDefined(options)) {
        this.delta_t = options.delta_t || delta_t;
        this.c = options.c || c;
        this.l = options.l || l;
    } else {
        this.delta_t = delta_t;
        this.c = c;
        this.l = l;
    }

};
Utils.inherit(Cyclon, EventEmitter);

/**
 * Starts the Handshaking. This must be done once to connect to the network. {launch} takes a callback
 * as parameter that gets called when the ICE-Candidates are gathered.
 * The {offer} that is created must be transmitted to the other peer (How this is done is out of the scope
 * of this library) in order to initiate the handshake.
 * @param onOffer {function} (offer {String})
 */
Cyclon.prototype.launch = function (onOffer) {
    Utils.assertLength(arguments, 1);

};

/**
 * This is the final handshake-function that gets called after an answer is received
 * @param answer {String} remote answer
 */
Cyclon.prototype.handshake = function(answer){
    Utils.assertLength(arguments, 1);

};

/**
 * Upon receiving an offer from {launch} through the signaling service the peer creates a fitting answer.
 * This answer is propagated to the application with a callback that must be provided to this function.
 * The answer must be send back to the communication initiator.
 * @param onAnswer {function} (answer {String})
 */
Cyclon.prototype.answer = function (onAnswer) {
    Utils.assertLength(arguments, 1);

};

/**
 * Peer-Sampling-Service-function. When provided with a parameter n, a given number of randomly
 * sampled peers is returned, otherwise the whole PartialView of the RPS is returned.
 * @param n {Number}
 */
Cyclon.prototype.getPeers = function(n){
    if (Utils.isDefined(n)) {
        return _.pluck(Utils.sample(this.partialView, n), "peer");
    } else {
        return _.pluck(this.partialView, "peer");
    }
};

/**
 * This function checks if the membership protocol is already connected to the network and is "ready" or if
 * the handshake is still pending.
 * The parameter is a callback that gets called as soon as the peer is connected to the network.
 * @param callback {function}
 */
Cyclon.prototype.ready = function (callback) {
    if (this.isReady){
        callback.call(this);
    } else {
        this.readyCallbacks.push(callback);
    }
};

exports.Class = Cyclon;

/********************************************************************
 *                       C Y C L O N  F U N C                       *
 ********************************************************************/

// TODO implement me!

/********************************************************************
 *                       H E L P E R S                              *
 ********************************************************************/

function addToPartialView(cyclon, peer, callback) {
    cyclon.partialView.push({ peer: peer, age: 0, address: peer.address});
    callback.call(peer);
};
},{"events":1,"handshake-webrtc":12,"yutils":49}],8:[function(require,module,exports){
/**
 * Created by Julian on 12/17/2014.
 */
var Utils = require("yutils");
exports.LocalAddress = Utils.guid();
},{"yutils":49}],9:[function(require,module,exports){
/**
 * Created by Julian on 12/16/2014.
 */
exports.MESSAGE = 0;
exports.TELL_ADDRESS = 1;
exports.REQUEST_NEIGHBORS = 2;
exports.OFFER = 3;
exports.ANSWER = 4;
exports.ERROR_CANNOT_FIND_PEER = 5;
exports.SEND_NEIGHBORS = 6;
},{}],10:[function(require,module,exports){
/**
 * Created by Julian on 12/16/2014.
 */
var WebRTC = require("webrtc-adapter");
var RTCPeerConnection = WebRTC.RTCPeerConnection;
var MESSAGE_TYPE = require("./MESSAGE_TYPE.js");
var ADDRESS = require("./Address").LocalAddress;
var PeerCache = require("./PeerCache").PeerCache;
var Handshake = require("./handshake.js");
var Promise = require("bluebird");

var REQUEST_NEIGHBORS_TIMEOUT_MS = 5000;

var ICE_CONFIG = {"iceServers":[
    {"url":"stun:23.21.150.121"},
    {
        'url': 'turn:192.158.29.39:3478?transport=udp',
        'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
        'username': '28224511:1379330808'
    }
]};

var CONN = { 'optional': [{'DtlsSrtpKeyAgreement': true}] };

/**
 *
 * @constructor
 */
function Peer() {
    var pc = new RTCPeerConnection(ICE_CONFIG, CONN);
    this.pc = pc;
    this.address = null;
    this.dc = null;
    this.onOpen = [];
    this.onMessage = [];
    this.onDisconnect = [];
    this.offerCallback = null;
    this.createCallback = null;
    this.iceTimeout = null;
    this.onCannotFindPeer = [];
    this.requestNeighbors = null;
    this.requestNeighborsCallback = null;
    var self = this;

    this.disconnectCounter = 0; // to prevent "false" positive...
    this.thread = setInterval(function () {
        var i = 0, L = self.onDisconnect.length;
        if (self.dc !== null) {
            if( self.dc.readyState === "closed") {
                if (self.disconnectCounter > 5) {
                    for(;i<L;i++) {
                        self.onDisconnect[i].call(self);
                    }
                    clearInterval(self.thread);
                } else {
                    self.disconnectCounter += 1;
                }
            } else {
                self.disconnectCounter = 0;
            }
        }
    }, 100);

    /**
     * returns the result
     */
    function exec() {
        clearTimeout(self.iceTimeout);
        var d = JSON.stringify(pc.localDescription);
        if (self.offerCallback !== null) {
            self.offerCallback.call(self, d);
            self.offerCallback = null;
        } else if (self.createCallback !== null) {
            self.createCallback.call(self, d);
            self.createCallback = null;
        }
        pc.onicecandidate = null;
    }

    pc.onicecandidate = function (e) {
        if (e.candidate === null) {
            exec();
        } else {
            if (self.iceTimeout !== null) {
                clearTimeout(self.iceTimeout);
            }
            self.iceTimeout = setTimeout(function () {
                exec();
            }, 1000);
        }
    };

    /*
    pc.onpeeridentity = function (e) {
        //console.log("peer ident:",e);
    }

    pc.onsignalingstatechange = function(ev) {
        //console.log("onsignalingstatechange event detected!", ev);
    };
    */
}

Peer.prototype.isOpen = function () {
    if (this.dc !== null) {
        return this.dc.readyState === "open";
    }
    return false;
};

Peer.prototype.disconnect = function () {
    this.dc.close();
};

Peer.prototype.ondisconnect = function (callback) {
    this.onDisconnect.push(callback);
};

Peer.prototype.onopen = function (callback) {
    this.onOpen.push(callback);
};

Peer.prototype.onmessage = function (callback) {
    this.onMessage.push(callback);
};

Peer.prototype.oncannotfindpeer = function (callback) {
    this.onCannotFindPeer.push(callback);
};

/**
 * Send any kind of data to the other Peer
 * @param message
 */
Peer.prototype.send = function (message) {
    if (this.dc === null || this.dc.readyState !== "open") {
        throw new Error("Handshake incomplete! Sending is not possible.");
    }
    this.dc.send(JSON.stringify({type: MESSAGE_TYPE.MESSAGE, payload:message }));
};

/**
 * Sends a message without payload
 * @param messageType
 */
Peer.prototype.sendMessageType = function (messageType, payload) {
    if (this.dc === null || this.dc.readyState !== "open") {
        throw new Error("Handshake incomplete! Sending is not possible.");
    }
    if (typeof payload === "undefined") {
        this.dc.send(JSON.stringify({type: messageType }));
    } else {
        this.dc.send(JSON.stringify({type: messageType, payload: payload }));
    }
};

/**
 * Tries to connect to the address through the peer
 * @param address {String}
 * @returns {Peer} resulting peer
 */
Peer.prototype.attemptToConnect = function (address) {
    var self = this;
    var other = Handshake.createOffer(function (offer) {
        self.sendMessageType(MESSAGE_TYPE.OFFER, {offer:offer, target:address, source:ADDRESS});
    });
    PeerCache.putPending(other, address);
    return other;
};

/**
 *
 * @returns {Promise}
 */
Peer.prototype.getNeighbors = function () {
    if (this.requestNeighbors !== null) {
        console.warn("already requesting neighbors.. cancel old request!");
        this.requestNeighbors.cancel();
    }
    var self = this;
    this.requestNeighbors = new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () {
            self.requestNeighbors = null;
            self.requestNeighborsCallback = null;
            reject();
        },REQUEST_NEIGHBORS_TIMEOUT_MS);
        self.requestNeighborsCallback = function (neighbors) {
            clearTimeout(timeout);
            self.requestNeighbors = null;
            self.requestNeighborsCallback = null;
            resolve(neighbors);
        }
        self.sendMessageType(MESSAGE_TYPE.REQUEST_NEIGHBORS);
    }).cancellable();
    return this.requestNeighbors;
};

exports.Peer = Peer;
},{"./Address":8,"./MESSAGE_TYPE.js":9,"./PeerCache":11,"./handshake.js":12,"bluebird":15,"webrtc-adapter":48}],11:[function(require,module,exports){
/**
 * Caches connections that are opened and not closed yet for the purpose of signaling
 *
 * Created by Julian on 12/17/2014.
 */
var Utils = require("yutils");

var cache = {};

var pending = {};

exports.PeerCache = {

    getAllAddresses: function () {
        return Object.keys(cache);
    },

    /**
     * Put a Peer that is already open
     * @param peer {Peer}
     */
    put: function (peer) {
        if (!peer.isOpen()) throw new Error("Cannot put not-opened peers into cache!");
        if (peer.address in cache) throw new Error("Connection is already open! Cannot put into cache."); //TODO really..?

        cache[peer.address] = peer;

        // Clear when disconnected
        peer.ondisconnect(function () {
            delete cache[peer.address];
        });
    },

    has: function (address) {
        return address in cache;
    },

    get: function (address) {
        return cache[address];
    },

    putPending: function (peer, address) {
        if (peer.isOpen()) throw new Error("Cannot at peer to pending because it is already open!");
        if (address in pending) throw new Error("Connection is already pending! Cannot put into cache."); //TODO really..?

        peer.onopen(function () {
            delete pending[address];
        });

        pending[address] = {peer: peer, ts: Date.now()};
    },

    getPending: function (address) {
        return pending[address].peer;
    },

    deletePending: function (address) {
        delete pending[address];

    }

};

// =======================================
// CLEAN PENDING CACHE
// =======================================
setInterval(function () {
    var key, s, now = Date.now(), current;
    for(key in pending) {
        current = pending[key];
        s = Utils.msToS(Utils.timeDifferenceInMs(current.ts, now));
        if (s > 60) {
            // if a connection is pending for more than 1 minute, close it..
            current.peer.disconnect();
            delete pending[key];
        }
    }
}, 30000); // every 30 seconds

},{"yutils":49}],12:[function(require,module,exports){
/**
 * Created by Julian on 12/11/2014.
 */
var Utils = require("yutils");
var Peer = require("./Peer.js").Peer;
var PeerCache = require("./PeerCache.js").PeerCache;
var MESSAGE_TYPE = require("./MESSAGE_TYPE.js");
var ADDRESS = require("./Address").LocalAddress;

var onRemoteConnectionCallbacks = [];
var onMessageCallbacks = [];

function onMessage(peer) {
    return function (msg) {
        var i = 0, cb = onMessageCallbacks, L = cb.length;
        for(;i<L;i++) {
            cb[i].call(peer, peer, msg);
        }
    }
}

/**
 * @type {Object}
 * {
 *      guid1 : peer,
 *      guid2 : peer
 * }
 */

/* ====================================
 A P I
 ==================================== */

/**
 * initiates a Peer-to-Peer connection
 * @param callback
 * @returns {Peer}
 */
function createOffer(callback) {
    var peer = new Peer(), pc = peer.pc;
    peer.offerCallback = callback;

    var dc = pc.createDataChannel("q", {reliable:true});
    pc.createOffer(function (desc) {
        pc.setLocalDescription(desc, function() { });
    }, function failure(e) { console.error(e); });

    dc.onopen = function () {
        dc.send(JSON.stringify({type: MESSAGE_TYPE.TELL_ADDRESS, payload: ADDRESS}));
    };

    dc.onmessage = handleMessage(peer);

    peer.dc = dc;
    return peer;
}

/**
 *
 * @param peer
 * @returns {Function}
 */
function handleMessage(peer) {
    return function (e) {
        var msg = Utils.isString(e.data) ? JSON.parse(e.data) : e.data;
        var i, L, newPeer, destinationPeer, n;
        switch (msg.type) {
            case MESSAGE_TYPE.OFFER:
                // =======================================
                // O F F E R
                // =======================================
                if ("target" in msg.payload) {
                    // we are the mediator
                    if (PeerCache.has(msg.payload.target)) {
                        destinationPeer = PeerCache.get(msg.payload.target);
                        destinationPeer.sendMessageType(MESSAGE_TYPE.OFFER, {offer:msg.payload.offer, source:msg.payload.source});
                    } else {
                        // we cannot establish a connection..
                        peer.sendMessageType(MESSAGE_TYPE.ERROR_CANNOT_FIND_PEER, msg.payload.target);
                    }
                } else {
                    // WE are the TARGET!
                    newPeer = createAnswer(msg.payload.offer, function (answer) {
                        peer.sendMessageType(
                            MESSAGE_TYPE.ANSWER, {
                                answer: answer,
                                source: msg.payload.source,
                                target: ADDRESS
                            }
                        );
                    });
                    i = 0, L = onRemoteConnectionCallbacks.length;
                    for(;i<L;i++) {
                        onRemoteConnectionCallbacks[i].call(newPeer,newPeer);
                    }
                }
                break;
            case MESSAGE_TYPE.ANSWER:
                // =======================================
                // A N S W E R
                // =======================================
                if ("source" in msg.payload) {
                    // we are the mediator..
                    if (PeerCache.has(msg.payload.source)) {
                        destinationPeer = PeerCache.get(msg.payload.source);
                        destinationPeer.sendMessageType(MESSAGE_TYPE.ANSWER, {
                            answer: msg.payload.answer,
                            target: msg.payload.target
                        });
                    } else {
                        peer.sendMessageType(MESSAGE_TYPE.ERROR_CANNOT_FIND_PEER, msg.payload.target);
                    }
                } else {
                    // we are the SENDER and we are supposed to apply the answer..
                    destinationPeer = PeerCache.getPending(msg.payload.target);
                    handleAnswer(destinationPeer, msg.payload.answer);
                }
                break;
            case MESSAGE_TYPE.TELL_ADDRESS:
                // =======================================
                // T E L L  A D D R E S S
                // =======================================
                peer.address = msg.payload;
                i = 0, L = peer.onOpen.length;
                PeerCache.put(peer);
                peer.onmessage(onMessage(peer));
                for(;i<L;i++) {
                    peer.onOpen[i].call(peer);
                }
                peer.onOpen = null;
                break;
            case MESSAGE_TYPE.MESSAGE:
                // =======================================
                // M E S S A G E
                // =======================================
                i = 0, L = peer.onMessage.length;
                for(;i<L;i++) {
                    peer.onMessage[i].call(peer, msg.payload);
                }
                break;
            case MESSAGE_TYPE.ERROR_CANNOT_FIND_PEER:
                // =======================================
                // E R R O R  C A N N O T  F I N D  P E E R
                // =======================================
                i=0, L = peer.onCannotFindPeer.length;
                PeerCache.deletePending(msg.payload);
                for (;i<L;i++) {
                    peer.onCannotFindPeer[i].call(peer, msg.payload);
                }
                break;
            case MESSAGE_TYPE.REQUEST_NEIGHBORS:
                // =======================================
                // R E Q U E S T  N E I G H B O R S
                // =======================================
                peer.sendMessageType(MESSAGE_TYPE.SEND_NEIGHBORS, PeerCache.getAllAddresses());
                break;
            case MESSAGE_TYPE.SEND_NEIGHBORS:
                // =======================================
                // S E N D  N E I G H B O R S
                // =======================================
                n = Utils.isString(msg.payload)? JSON.parse(msg.payload) : msg.payload;
                peer.requestNeighborsCallback.call(peer, n);
                break;
        }
    };
}

/**
 * Accepts the initial Peer-to-Peer invitation
 * @param offer
 * @param callback
 * @returns {Peer}
 */
function createAnswer(offer, callback) {
    var peer = new Peer(), pc = peer.pc;
    var offerDesc = new RTCSessionDescription(JSON.parse(offer));
    peer.createCallback = callback;
    pc.setRemoteDescription(offerDesc);
    pc.createAnswer(function (answerDesc) {
        pc.setLocalDescription(answerDesc);
    }, function () { console.warn("No create answer"); });

    pc.ondatachannel = function (e) {
        var dc = e.channel || e; // Chrome sends event, FF sends raw channel
        peer.dc = dc;

        dc.onopen = function () {
            dc.send(JSON.stringify({type: MESSAGE_TYPE.TELL_ADDRESS, payload: ADDRESS}));
            // delay open until the response is in
        };

        dc.onmessage = handleMessage(peer);
    };

    return peer;
}

/**
 * Applies the result
 * @param peer
 * @param answer
 */
function handleAnswer(peer, answer) {
    var answerDesc = new RTCSessionDescription(JSON.parse(answer));
    peer.pc.setRemoteDescription(answerDesc);
}

/**
 * We somehow need to notify Bob, that Alice attempts to talk to him!
 * @param callback {function} ({Peer})
 */
function onRemoteConnection(callback) {
    onRemoteConnectionCallbacks.push(callback);
};

/**
 *
 * @param callback {function} (Peer, Object)
 */
function onmessage(callback) {
    onMessageCallbacks.push(callback);
}

/* ====================================
 EXPORT
 ==================================== */
exports.onmessage = onmessage;
exports.createOffer = createOffer;
exports.handleAnswer = handleAnswer;
exports.createAnswer = createAnswer;
exports.onRemoteConnection = onRemoteConnection;
exports.address = function () {
    return ADDRESS;
};
},{"./Address":8,"./MESSAGE_TYPE.js":9,"./Peer.js":10,"./PeerCache.js":11,"yutils":49}],13:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var SomePromiseArray = Promise._SomePromiseArray;
function Promise$_Any(promises) {
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    if (promise.isRejected()) {
        return promise;
    }
    ret.setHowMany(1);
    ret.setUnwrap();
    ret.init();
    return promise;
}

Promise.any = function Promise$Any(promises) {
    return Promise$_Any(promises);
};

Promise.prototype.any = function Promise$any() {
    return Promise$_Any(this);
};

};

},{}],14:[function(require,module,exports){
(function (process){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var schedule = require("./schedule.js");
var Queue = require("./queue.js");
var errorObj = require("./util.js").errorObj;
var tryCatch1 = require("./util.js").tryCatch1;
var _process = typeof process !== "undefined" ? process : void 0;

function Async() {
    this._isTickUsed = false;
    this._schedule = schedule;
    this._length = 0;
    this._lateBuffer = new Queue(16);
    this._functionBuffer = new Queue(65536);
    var self = this;
    this.consumeFunctionBuffer = function Async$consumeFunctionBuffer() {
        self._consumeFunctionBuffer();
    };
}

Async.prototype.haveItemsQueued = function Async$haveItemsQueued() {
    return this._length > 0;
};

Async.prototype.invokeLater = function Async$invokeLater(fn, receiver, arg) {
    if (_process !== void 0 &&
        _process.domain != null &&
        !fn.domain) {
        fn = _process.domain.bind(fn);
    }
    this._lateBuffer.push(fn, receiver, arg);
    this._queueTick();
};

Async.prototype.invoke = function Async$invoke(fn, receiver, arg) {
    if (_process !== void 0 &&
        _process.domain != null &&
        !fn.domain) {
        fn = _process.domain.bind(fn);
    }
    var functionBuffer = this._functionBuffer;
    functionBuffer.push(fn, receiver, arg);
    this._length = functionBuffer.length();
    this._queueTick();
};

Async.prototype._consumeFunctionBuffer =
function Async$_consumeFunctionBuffer() {
    var functionBuffer = this._functionBuffer;
    while (functionBuffer.length() > 0) {
        var fn = functionBuffer.shift();
        var receiver = functionBuffer.shift();
        var arg = functionBuffer.shift();
        fn.call(receiver, arg);
    }
    this._reset();
    this._consumeLateBuffer();
};

Async.prototype._consumeLateBuffer = function Async$_consumeLateBuffer() {
    var buffer = this._lateBuffer;
    while(buffer.length() > 0) {
        var fn = buffer.shift();
        var receiver = buffer.shift();
        var arg = buffer.shift();
        var res = tryCatch1(fn, receiver, arg);
        if (res === errorObj) {
            this._queueTick();
            if (fn.domain != null) {
                fn.domain.emit("error", res.e);
            } else {
                throw res.e;
            }
        }
    }
};

Async.prototype._queueTick = function Async$_queue() {
    if (!this._isTickUsed) {
        this._schedule(this.consumeFunctionBuffer);
        this._isTickUsed = true;
    }
};

Async.prototype._reset = function Async$_reset() {
    this._isTickUsed = false;
    this._length = 0;
};

module.exports = new Async();

}).call(this,require('_process'))
},{"./queue.js":37,"./schedule.js":40,"./util.js":47,"_process":2}],15:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var Promise = require("./promise.js")();
module.exports = Promise;
},{"./promise.js":32}],16:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var cr = Object.create;
if (cr) {
    var callerCache = cr(null);
    var getterCache = cr(null);
    callerCache[" size"] = getterCache[" size"] = 0;
}

module.exports = function(Promise) {
var util = require("./util.js");
var canEvaluate = util.canEvaluate;
var isIdentifier = util.isIdentifier;

function makeMethodCaller (methodName) {
    return new Function("obj", "                                             \n\
        'use strict'                                                         \n\
        var len = this.length;                                               \n\
        switch(len) {                                                        \n\
            case 1: return obj.methodName(this[0]);                          \n\
            case 2: return obj.methodName(this[0], this[1]);                 \n\
            case 3: return obj.methodName(this[0], this[1], this[2]);        \n\
            case 0: return obj.methodName();                                 \n\
            default: return obj.methodName.apply(obj, this);                 \n\
        }                                                                    \n\
        ".replace(/methodName/g, methodName));
}

function makeGetter (propertyName) {
    return new Function("obj", "                                             \n\
        'use strict';                                                        \n\
        return obj.propertyName;                                             \n\
        ".replace("propertyName", propertyName));
}

function getCompiled(name, compiler, cache) {
    var ret = cache[name];
    if (typeof ret !== "function") {
        if (!isIdentifier(name)) {
            return null;
        }
        ret = compiler(name);
        cache[name] = ret;
        cache[" size"]++;
        if (cache[" size"] > 512) {
            var keys = Object.keys(cache);
            for (var i = 0; i < 256; ++i) delete cache[keys[i]];
            cache[" size"] = keys.length - 256;
        }
    }
    return ret;
}

function getMethodCaller(name) {
    return getCompiled(name, makeMethodCaller, callerCache);
}

function getGetter(name) {
    return getCompiled(name, makeGetter, getterCache);
}

function caller(obj) {
    return obj[this.pop()].apply(obj, this);
}
Promise.prototype.call = function Promise$call(methodName) {
    var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
    if (canEvaluate) {
        var maybeCaller = getMethodCaller(methodName);
        if (maybeCaller !== null) {
            return this._then(maybeCaller, void 0, void 0, args, void 0);
        }
    }
    args.push(methodName);
    return this._then(caller, void 0, void 0, args, void 0);
};

function namedGetter(obj) {
    return obj[this];
}
function indexedGetter(obj) {
    return obj[this];
}
Promise.prototype.get = function Promise$get(propertyName) {
    var isIndex = (typeof propertyName === "number");
    var getter;
    if (!isIndex) {
        if (canEvaluate) {
            var maybeGetter = getGetter(propertyName);
            getter = maybeGetter !== null ? maybeGetter : namedGetter;
        } else {
            getter = namedGetter;
        }
    } else {
        getter = indexedGetter;
    }
    return this._then(getter, void 0, void 0, propertyName, void 0);
};
};

},{"./util.js":47}],17:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var errors = require("./errors.js");
var canAttach = errors.canAttach;
var async = require("./async.js");
var CancellationError = errors.CancellationError;

Promise.prototype._cancel = function Promise$_cancel(reason) {
    if (!this.isCancellable()) return this;
    var parent;
    var promiseToReject = this;
    while ((parent = promiseToReject._cancellationParent) !== void 0 &&
        parent.isCancellable()) {
        promiseToReject = parent;
    }
    this._unsetCancellable();
    promiseToReject._attachExtraTrace(reason);
    promiseToReject._rejectUnchecked(reason);
};

Promise.prototype.cancel = function Promise$cancel(reason) {
    if (!this.isCancellable()) return this;
    reason = reason !== void 0
        ? (canAttach(reason) ? reason : new Error(reason + ""))
        : new CancellationError();
    async.invokeLater(this._cancel, this, reason);
    return this;
};

Promise.prototype.cancellable = function Promise$cancellable() {
    if (this._cancellable()) return this;
    this._setCancellable();
    this._cancellationParent = void 0;
    return this;
};

Promise.prototype.uncancellable = function Promise$uncancellable() {
    var ret = new Promise(INTERNAL);
    ret._propagateFrom(this, 2 | 4);
    ret._follow(this);
    ret._unsetCancellable();
    return ret;
};

Promise.prototype.fork =
function Promise$fork(didFulfill, didReject, didProgress) {
    var ret = this._then(didFulfill, didReject, didProgress,
                         void 0, void 0);

    ret._setCancellable();
    ret._cancellationParent = void 0;
    return ret;
};
};

},{"./async.js":14,"./errors.js":22}],18:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function() {
var inherits = require("./util.js").inherits;
var defineProperty = require("./es5.js").defineProperty;

var rignore = new RegExp(
    "\\b(?:[a-zA-Z0-9.]+\\$_\\w+|" +
    "tryCatch(?:1|2|3|4|Apply)|new \\w*PromiseArray|" +
    "\\w*PromiseArray\\.\\w*PromiseArray|" +
    "setTimeout|CatchFilter\\$_\\w+|makeNodePromisified|processImmediate|" +
    "process._tickCallback|nextTick|Async\\$\\w+)\\b"
);

var rtraceline = null;
var formatStack = null;

function formatNonError(obj) {
    var str;
    if (typeof obj === "function") {
        str = "[function " +
            (obj.name || "anonymous") +
            "]";
    } else {
        str = obj.toString();
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
            try {
                var newStr = JSON.stringify(obj);
                str = newStr;
            }
            catch(e) {

            }
        }
        if (str.length === 0) {
            str = "(empty array)";
        }
    }
    return ("(<" + snip(str) + ">, no stack trace)");
}

function snip(str) {
    var maxChars = 41;
    if (str.length < maxChars) {
        return str;
    }
    return str.substr(0, maxChars - 3) + "...";
}

function CapturedTrace(ignoreUntil, isTopLevel) {
    this.captureStackTrace(CapturedTrace, isTopLevel);

}
inherits(CapturedTrace, Error);

CapturedTrace.prototype.captureStackTrace =
function CapturedTrace$captureStackTrace(ignoreUntil, isTopLevel) {
    captureStackTrace(this, ignoreUntil, isTopLevel);
};

CapturedTrace.possiblyUnhandledRejection =
function CapturedTrace$PossiblyUnhandledRejection(reason) {
    if (typeof console === "object") {
        var message;
        if (typeof reason === "object" || typeof reason === "function") {
            var stack = reason.stack;
            message = "Possibly unhandled " + formatStack(stack, reason);
        } else {
            message = "Possibly unhandled " + String(reason);
        }
        if (typeof console.error === "function" ||
            typeof console.error === "object") {
            console.error(message);
        } else if (typeof console.log === "function" ||
            typeof console.log === "object") {
            console.log(message);
        }
    }
};

CapturedTrace.combine = function CapturedTrace$Combine(current, prev) {
    var currentLastIndex = current.length - 1;
    var currentLastLine = current[currentLastIndex];
    var commonRootMeetPoint = -1;
    for (var i = prev.length - 1; i >= 0; --i) {
        if (prev[i] === currentLastLine) {
            commonRootMeetPoint = i;
            break;
        }
    }

    for (var i = commonRootMeetPoint; i >= 0; --i) {
        var line = prev[i];
        if (current[currentLastIndex] === line) {
            current.pop();
            currentLastIndex--;
        } else {
            break;
        }
    }

    current.push("From previous event:");
    var lines = current.concat(prev);

    var ret = [];

    for (var i = 0, len = lines.length; i < len; ++i) {

        if (((rignore.test(lines[i]) && rtraceline.test(lines[i])) ||
            (i > 0 && !rtraceline.test(lines[i])) &&
            lines[i] !== "From previous event:")
       ) {
            continue;
        }
        ret.push(lines[i]);
    }
    return ret;
};

CapturedTrace.protectErrorMessageNewlines = function(stack) {
    for (var i = 0; i < stack.length; ++i) {
        if (rtraceline.test(stack[i])) {
            break;
        }
    }

    if (i <= 1) return;

    var errorMessageLines = [];
    for (var j = 0; j < i; ++j) {
        errorMessageLines.push(stack.shift());
    }
    stack.unshift(errorMessageLines.join("\u0002\u0000\u0001"));
};

CapturedTrace.isSupported = function CapturedTrace$IsSupported() {
    return typeof captureStackTrace === "function";
};

var captureStackTrace = (function stackDetection() {
    if (typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function") {
        rtraceline = /^\s*at\s*/;
        formatStack = function(stack, error) {
            if (typeof stack === "string") return stack;

            if (error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);


        };
        var captureStackTrace = Error.captureStackTrace;
        return function CapturedTrace$_captureStackTrace(
            receiver, ignoreUntil) {
            captureStackTrace(receiver, ignoreUntil);
        };
    }
    var err = new Error();

    if (typeof err.stack === "string" &&
        typeof "".startsWith === "function" &&
        (err.stack.startsWith("stackDetection@")) &&
        stackDetection.name === "stackDetection") {

        defineProperty(Error, "stackTraceLimit", {
            writable: true,
            enumerable: false,
            configurable: false,
            value: 25
        });
        rtraceline = /@/;
        var rline = /[@\n]/;

        formatStack = function(stack, error) {
            if (typeof stack === "string") {
                return (error.name + ". " + error.message + "\n" + stack);
            }

            if (error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);
        };

        return function captureStackTrace(o) {
            var stack = new Error().stack;
            var split = stack.split(rline);
            var len = split.length;
            var ret = "";
            for (var i = 0; i < len; i += 2) {
                ret += split[i];
                ret += "@";
                ret += split[i + 1];
                ret += "\n";
            }
            o.stack = ret;
        };
    } else {
        formatStack = function(stack, error) {
            if (typeof stack === "string") return stack;

            if ((typeof error === "object" ||
                typeof error === "function") &&
                error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);
        };

        return null;
    }
})();

return CapturedTrace;
};

},{"./es5.js":24,"./util.js":47}],19:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(NEXT_FILTER) {
var util = require("./util.js");
var errors = require("./errors.js");
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;
var keys = require("./es5.js").keys;
var TypeError = errors.TypeError;

function CatchFilter(instances, callback, promise) {
    this._instances = instances;
    this._callback = callback;
    this._promise = promise;
}

function CatchFilter$_safePredicate(predicate, e) {
    var safeObject = {};
    var retfilter = tryCatch1(predicate, safeObject, e);

    if (retfilter === errorObj) return retfilter;

    var safeKeys = keys(safeObject);
    if (safeKeys.length) {
        errorObj.e = new TypeError(
            "Catch filter must inherit from Error "
          + "or be a simple predicate function");
        return errorObj;
    }
    return retfilter;
}

CatchFilter.prototype.doFilter = function CatchFilter$_doFilter(e) {
    var cb = this._callback;
    var promise = this._promise;
    var boundTo = promise._boundTo;
    for (var i = 0, len = this._instances.length; i < len; ++i) {
        var item = this._instances[i];
        var itemIsErrorType = item === Error ||
            (item != null && item.prototype instanceof Error);

        if (itemIsErrorType && e instanceof item) {
            var ret = tryCatch1(cb, boundTo, e);
            if (ret === errorObj) {
                NEXT_FILTER.e = ret.e;
                return NEXT_FILTER;
            }
            return ret;
        } else if (typeof item === "function" && !itemIsErrorType) {
            var shouldHandle = CatchFilter$_safePredicate(item, e);
            if (shouldHandle === errorObj) {
                var trace = errors.canAttach(errorObj.e)
                    ? errorObj.e
                    : new Error(errorObj.e + "");
                this._promise._attachExtraTrace(trace);
                e = errorObj.e;
                break;
            } else if (shouldHandle) {
                var ret = tryCatch1(cb, boundTo, e);
                if (ret === errorObj) {
                    NEXT_FILTER.e = ret.e;
                    return NEXT_FILTER;
                }
                return ret;
            }
        }
    }
    NEXT_FILTER.e = e;
    return NEXT_FILTER;
};

return CatchFilter;
};

},{"./errors.js":22,"./es5.js":24,"./util.js":47}],20:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var util = require("./util.js");
var isPrimitive = util.isPrimitive;
var wrapsPrimitiveReceiver = util.wrapsPrimitiveReceiver;

module.exports = function(Promise) {
var returner = function Promise$_returner() {
    return this;
};
var thrower = function Promise$_thrower() {
    throw this;
};

var wrapper = function Promise$_wrapper(value, action) {
    if (action === 1) {
        return function Promise$_thrower() {
            throw value;
        };
    } else if (action === 2) {
        return function Promise$_returner() {
            return value;
        };
    }
};


Promise.prototype["return"] =
Promise.prototype.thenReturn =
function Promise$thenReturn(value) {
    if (wrapsPrimitiveReceiver && isPrimitive(value)) {
        return this._then(
            wrapper(value, 2),
            void 0,
            void 0,
            void 0,
            void 0
       );
    }
    return this._then(returner, void 0, void 0, value, void 0);
};

Promise.prototype["throw"] =
Promise.prototype.thenThrow =
function Promise$thenThrow(reason) {
    if (wrapsPrimitiveReceiver && isPrimitive(reason)) {
        return this._then(
            wrapper(reason, 1),
            void 0,
            void 0,
            void 0,
            void 0
       );
    }
    return this._then(thrower, void 0, void 0, reason, void 0);
};
};

},{"./util.js":47}],21:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseReduce = Promise.reduce;

Promise.prototype.each = function Promise$each(fn) {
    return PromiseReduce(this, fn, null, INTERNAL);
};

Promise.each = function Promise$Each(promises, fn) {
    return PromiseReduce(promises, fn, null, INTERNAL);
};
};

},{}],22:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var Objectfreeze = require("./es5.js").freeze;
var util = require("./util.js");
var inherits = util.inherits;
var notEnumerableProp = util.notEnumerableProp;

function markAsOriginatingFromRejection(e) {
    try {
        notEnumerableProp(e, "isOperational", true);
    }
    catch(ignore) {}
}

function originatesFromRejection(e) {
    if (e == null) return false;
    return ((e instanceof OperationalError) ||
        e["isOperational"] === true);
}

function isError(obj) {
    return obj instanceof Error;
}

function canAttach(obj) {
    return isError(obj);
}

function subError(nameProperty, defaultMessage) {
    function SubError(message) {
        if (!(this instanceof SubError)) return new SubError(message);
        this.message = typeof message === "string" ? message : defaultMessage;
        this.name = nameProperty;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    inherits(SubError, Error);
    return SubError;
}

var _TypeError, _RangeError;
var CancellationError = subError("CancellationError", "cancellation error");
var TimeoutError = subError("TimeoutError", "timeout error");
var AggregateError = subError("AggregateError", "aggregate error");
try {
    _TypeError = TypeError;
    _RangeError = RangeError;
} catch(e) {
    _TypeError = subError("TypeError", "type error");
    _RangeError = subError("RangeError", "range error");
}

var methods = ("join pop push shift unshift slice filter forEach some " +
    "every map indexOf lastIndexOf reduce reduceRight sort reverse").split(" ");

for (var i = 0; i < methods.length; ++i) {
    if (typeof Array.prototype[methods[i]] === "function") {
        AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
    }
}

AggregateError.prototype.length = 0;
AggregateError.prototype["isOperational"] = true;
var level = 0;
AggregateError.prototype.toString = function() {
    var indent = Array(level * 4 + 1).join(" ");
    var ret = "\n" + indent + "AggregateError of:" + "\n";
    level++;
    indent = Array(level * 4 + 1).join(" ");
    for (var i = 0; i < this.length; ++i) {
        var str = this[i] === this ? "[Circular AggregateError]" : this[i] + "";
        var lines = str.split("\n");
        for (var j = 0; j < lines.length; ++j) {
            lines[j] = indent + lines[j];
        }
        str = lines.join("\n");
        ret += str + "\n";
    }
    level--;
    return ret;
};

function OperationalError(message) {
    this.name = "OperationalError";
    this.message = message;
    this.cause = message;
    this["isOperational"] = true;

    if (message instanceof Error) {
        this.message = message.message;
        this.stack = message.stack;
    } else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

}
inherits(OperationalError, Error);

var key = "__BluebirdErrorTypes__";
var errorTypes = Error[key];
if (!errorTypes) {
    errorTypes = Objectfreeze({
        CancellationError: CancellationError,
        TimeoutError: TimeoutError,
        OperationalError: OperationalError,
        RejectionError: OperationalError,
        AggregateError: AggregateError
    });
    notEnumerableProp(Error, key, errorTypes);
}

module.exports = {
    Error: Error,
    TypeError: _TypeError,
    RangeError: _RangeError,
    CancellationError: errorTypes.CancellationError,
    OperationalError: errorTypes.OperationalError,
    TimeoutError: errorTypes.TimeoutError,
    AggregateError: errorTypes.AggregateError,
    originatesFromRejection: originatesFromRejection,
    markAsOriginatingFromRejection: markAsOriginatingFromRejection,
    canAttach: canAttach
};

},{"./es5.js":24,"./util.js":47}],23:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var TypeError = require('./errors.js').TypeError;

function apiRejection(msg) {
    var error = new TypeError(msg);
    var ret = Promise.rejected(error);
    var parent = ret._peekContext();
    if (parent != null) {
        parent._attachExtraTrace(error);
    }
    return ret;
}

return apiRejection;
};

},{"./errors.js":22}],24:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
var isES5 = (function(){
    "use strict";
    return this === void 0;
})();

if (isES5) {
    module.exports = {
        freeze: Object.freeze,
        defineProperty: Object.defineProperty,
        keys: Object.keys,
        getPrototypeOf: Object.getPrototypeOf,
        isArray: Array.isArray,
        isES5: isES5
    };
} else {
    var has = {}.hasOwnProperty;
    var str = {}.toString;
    var proto = {}.constructor.prototype;

    var ObjectKeys = function ObjectKeys(o) {
        var ret = [];
        for (var key in o) {
            if (has.call(o, key)) {
                ret.push(key);
            }
        }
        return ret;
    }

    var ObjectDefineProperty = function ObjectDefineProperty(o, key, desc) {
        o[key] = desc.value;
        return o;
    }

    var ObjectFreeze = function ObjectFreeze(obj) {
        return obj;
    }

    var ObjectGetPrototypeOf = function ObjectGetPrototypeOf(obj) {
        try {
            return Object(obj).constructor.prototype;
        }
        catch (e) {
            return proto;
        }
    }

    var ArrayIsArray = function ArrayIsArray(obj) {
        try {
            return str.call(obj) === "[object Array]";
        }
        catch(e) {
            return false;
        }
    }

    module.exports = {
        isArray: ArrayIsArray,
        keys: ObjectKeys,
        defineProperty: ObjectDefineProperty,
        freeze: ObjectFreeze,
        getPrototypeOf: ObjectGetPrototypeOf,
        isES5: isES5
    };
}

},{}],25:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseMap = Promise.map;

Promise.prototype.filter = function Promise$filter(fn, options) {
    return PromiseMap(this, fn, options, INTERNAL);
};

Promise.filter = function Promise$Filter(promises, fn, options) {
    return PromiseMap(promises, fn, options, INTERNAL);
};
};

},{}],26:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, NEXT_FILTER, cast) {
var util = require("./util.js");
var wrapsPrimitiveReceiver = util.wrapsPrimitiveReceiver;
var isPrimitive = util.isPrimitive;
var thrower = util.thrower;

function returnThis() {
    return this;
}
function throwThis() {
    throw this;
}
function return$(r) {
    return function Promise$_returner() {
        return r;
    };
}
function throw$(r) {
    return function Promise$_thrower() {
        throw r;
    };
}
function promisedFinally(ret, reasonOrValue, isFulfilled) {
    var then;
    if (wrapsPrimitiveReceiver && isPrimitive(reasonOrValue)) {
        then = isFulfilled ? return$(reasonOrValue) : throw$(reasonOrValue);
    } else {
        then = isFulfilled ? returnThis : throwThis;
    }
    return ret._then(then, thrower, void 0, reasonOrValue, void 0);
}

function finallyHandler(reasonOrValue) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundTo)
                    : handler();

    if (ret !== void 0) {
        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            return promisedFinally(maybePromise, reasonOrValue,
                                    promise.isFulfilled());
        }
    }

    if (promise.isRejected()) {
        NEXT_FILTER.e = reasonOrValue;
        return NEXT_FILTER;
    } else {
        return reasonOrValue;
    }
}

function tapHandler(value) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundTo, value)
                    : handler(value);

    if (ret !== void 0) {
        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            return promisedFinally(maybePromise, value, true);
        }
    }
    return value;
}

Promise.prototype._passThroughHandler =
function Promise$_passThroughHandler(handler, isFinally) {
    if (typeof handler !== "function") return this.then();

    var promiseAndHandler = {
        promise: this,
        handler: handler
    };

    return this._then(
            isFinally ? finallyHandler : tapHandler,
            isFinally ? finallyHandler : void 0, void 0,
            promiseAndHandler, void 0);
};

Promise.prototype.lastly =
Promise.prototype["finally"] = function Promise$finally(handler) {
    return this._passThroughHandler(handler, true);
};

Promise.prototype.tap = function Promise$tap(handler) {
    return this._passThroughHandler(handler, false);
};
};

},{"./util.js":47}],27:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, apiRejection, INTERNAL, cast) {
var errors = require("./errors.js");
var TypeError = errors.TypeError;
var deprecated = require("./util.js").deprecated;
var util = require("./util.js");
var errorObj = util.errorObj;
var tryCatch1 = util.tryCatch1;
var yieldHandlers = [];

function promiseFromYieldHandler(value, yieldHandlers) {
    var _errorObj = errorObj;
    var _Promise = Promise;
    var len = yieldHandlers.length;
    for (var i = 0; i < len; ++i) {
        var result = tryCatch1(yieldHandlers[i], void 0, value);
        if (result === _errorObj) {
            return _Promise.reject(_errorObj.e);
        }
        var maybePromise = cast(result, promiseFromYieldHandler);
        if (maybePromise instanceof _Promise) return maybePromise;
    }
    return null;
}

function PromiseSpawn(generatorFunction, receiver, yieldHandler) {
    var promise = this._promise = new Promise(INTERNAL);
    promise._setTrace(void 0);
    this._generatorFunction = generatorFunction;
    this._receiver = receiver;
    this._generator = void 0;
    this._yieldHandlers = typeof yieldHandler === "function"
        ? [yieldHandler].concat(yieldHandlers)
        : yieldHandlers;
}

PromiseSpawn.prototype.promise = function PromiseSpawn$promise() {
    return this._promise;
};

PromiseSpawn.prototype._run = function PromiseSpawn$_run() {
    this._generator = this._generatorFunction.call(this._receiver);
    this._receiver =
        this._generatorFunction = void 0;
    this._next(void 0);
};

PromiseSpawn.prototype._continue = function PromiseSpawn$_continue(result) {
    if (result === errorObj) {
        this._generator = void 0;
        var trace = errors.canAttach(result.e)
            ? result.e : new Error(result.e + "");
        this._promise._attachExtraTrace(trace);
        this._promise._reject(result.e, trace);
        return;
    }

    var value = result.value;
    if (result.done === true) {
        this._generator = void 0;
        if (!this._promise._tryFollow(value)) {
            this._promise._fulfill(value);
        }
    } else {
        var maybePromise = cast(value, void 0);
        if (!(maybePromise instanceof Promise)) {
            maybePromise =
                promiseFromYieldHandler(maybePromise, this._yieldHandlers);
            if (maybePromise === null) {
                this._throw(new TypeError("A value was yielded that could not be treated as a promise"));
                return;
            }
        }
        maybePromise._then(
            this._next,
            this._throw,
            void 0,
            this,
            null
       );
    }
};

PromiseSpawn.prototype._throw = function PromiseSpawn$_throw(reason) {
    if (errors.canAttach(reason))
        this._promise._attachExtraTrace(reason);
    this._continue(
        tryCatch1(this._generator["throw"], this._generator, reason)
   );
};

PromiseSpawn.prototype._next = function PromiseSpawn$_next(value) {
    this._continue(
        tryCatch1(this._generator.next, this._generator, value)
   );
};

Promise.coroutine =
function Promise$Coroutine(generatorFunction, options) {
    if (typeof generatorFunction !== "function") {
        throw new TypeError("generatorFunction must be a function");
    }
    var yieldHandler = Object(options).yieldHandler;
    var PromiseSpawn$ = PromiseSpawn;
    return function () {
        var generator = generatorFunction.apply(this, arguments);
        var spawn = new PromiseSpawn$(void 0, void 0, yieldHandler);
        spawn._generator = generator;
        spawn._next(void 0);
        return spawn.promise();
    };
};

Promise.coroutine.addYieldHandler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function");
    yieldHandlers.push(fn);
};

Promise.spawn = function Promise$Spawn(generatorFunction) {
    deprecated("Promise.spawn is deprecated. Use Promise.coroutine instead.");
    if (typeof generatorFunction !== "function") {
        return apiRejection("generatorFunction must be a function");
    }
    var spawn = new PromiseSpawn(generatorFunction, this);
    var ret = spawn.promise();
    spawn._run(Promise.spawn);
    return ret;
};
};

},{"./errors.js":22,"./util.js":47}],28:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
function(Promise, PromiseArray, cast, INTERNAL) {
var util = require("./util.js");
var canEvaluate = util.canEvaluate;
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;


if (canEvaluate) {
    var thenCallback = function(i) {
        return new Function("value", "holder", "                             \n\
            'use strict';                                                    \n\
            holder.pIndex = value;                                           \n\
            holder.checkFulfillment(this);                                   \n\
            ".replace(/Index/g, i));
    };

    var caller = function(count) {
        var values = [];
        for (var i = 1; i <= count; ++i) values.push("holder.p" + i);
        return new Function("holder", "                                      \n\
            'use strict';                                                    \n\
            var callback = holder.fn;                                        \n\
            return callback(values);                                         \n\
            ".replace(/values/g, values.join(", ")));
    };
    var thenCallbacks = [];
    var callers = [void 0];
    for (var i = 1; i <= 5; ++i) {
        thenCallbacks.push(thenCallback(i));
        callers.push(caller(i));
    }

    var Holder = function(total, fn) {
        this.p1 = this.p2 = this.p3 = this.p4 = this.p5 = null;
        this.fn = fn;
        this.total = total;
        this.now = 0;
    };

    Holder.prototype.callers = callers;
    Holder.prototype.checkFulfillment = function(promise) {
        var now = this.now;
        now++;
        var total = this.total;
        if (now >= total) {
            var handler = this.callers[total];
            var ret = tryCatch1(handler, void 0, this);
            if (ret === errorObj) {
                promise._rejectUnchecked(ret.e);
            } else if (!promise._tryFollow(ret)) {
                promise._fulfillUnchecked(ret);
            }
        } else {
            this.now = now;
        }
    };
}

function reject(reason) {
    this._reject(reason);
}

Promise.join = function Promise$Join() {
    var last = arguments.length - 1;
    var fn;
    if (last > 0 && typeof arguments[last] === "function") {
        fn = arguments[last];
        if (last < 6 && canEvaluate) {
            var ret = new Promise(INTERNAL);
            ret._setTrace(void 0);
            var holder = new Holder(last, fn);
            var callbacks = thenCallbacks;
            for (var i = 0; i < last; ++i) {
                var maybePromise = cast(arguments[i], void 0);
                if (maybePromise instanceof Promise) {
                    if (maybePromise.isPending()) {
                        maybePromise._then(callbacks[i], reject,
                                           void 0, ret, holder);
                    } else if (maybePromise.isFulfilled()) {
                        callbacks[i].call(ret,
                                          maybePromise._settledValue, holder);
                    } else {
                        ret._reject(maybePromise._settledValue);
                        maybePromise._unsetRejectionIsUnhandled();
                    }
                } else {
                    callbacks[i].call(ret, maybePromise, holder);
                }
            }
            return ret;
        }
    }
    var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
    var ret = new PromiseArray(args).promise();
    return fn !== void 0 ? ret.spread(fn) : ret;
};

};

},{"./util.js":47}],29:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray, apiRejection, cast, INTERNAL) {
var util = require("./util.js");
var tryCatch3 = util.tryCatch3;
var errorObj = util.errorObj;
var PENDING = {};
var EMPTY_ARRAY = [];

function MappingPromiseArray(promises, fn, limit, _filter) {
    this.constructor$(promises);
    this._callback = fn;
    this._preservedValues = _filter === INTERNAL
        ? new Array(this.length())
        : null;
    this._limit = limit;
    this._inFlight = 0;
    this._queue = limit >= 1 ? [] : EMPTY_ARRAY;
    this._init$(void 0, -2);
}
util.inherits(MappingPromiseArray, PromiseArray);

MappingPromiseArray.prototype._init = function MappingPromiseArray$_init() {};

MappingPromiseArray.prototype._promiseFulfilled =
function MappingPromiseArray$_promiseFulfilled(value, index) {
    var values = this._values;
    if (values === null) return;

    var length = this.length();
    var preservedValues = this._preservedValues;
    var limit = this._limit;
    if (values[index] === PENDING) {
        values[index] = value;
        if (limit >= 1) {
            this._inFlight--;
            this._drainQueue();
            if (this._isResolved()) return;
        }
    } else {
        if (limit >= 1 && this._inFlight >= limit) {
            values[index] = value;
            this._queue.push(index);
            return;
        }
        if (preservedValues !== null) preservedValues[index] = value;

        var callback = this._callback;
        var receiver = this._promise._boundTo;
        var ret = tryCatch3(callback, receiver, value, index, length);
        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                if (limit >= 1) this._inFlight++;
                values[index] = PENDING;
                return maybePromise._proxyPromiseArray(this, index);
            } else if (maybePromise.isFulfilled()) {
                ret = maybePromise.value();
            } else {
                maybePromise._unsetRejectionIsUnhandled();
                return this._reject(maybePromise.reason());
            }
        }
        values[index] = ret;
    }
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= length) {
        if (preservedValues !== null) {
            this._filter(values, preservedValues);
        } else {
            this._resolve(values);
        }

    }
};

MappingPromiseArray.prototype._drainQueue =
function MappingPromiseArray$_drainQueue() {
    var queue = this._queue;
    var limit = this._limit;
    var values = this._values;
    while (queue.length > 0 && this._inFlight < limit) {
        var index = queue.pop();
        this._promiseFulfilled(values[index], index);
    }
};

MappingPromiseArray.prototype._filter =
function MappingPromiseArray$_filter(booleans, values) {
    var len = values.length;
    var ret = new Array(len);
    var j = 0;
    for (var i = 0; i < len; ++i) {
        if (booleans[i]) ret[j++] = values[i];
    }
    ret.length = j;
    this._resolve(ret);
};

MappingPromiseArray.prototype.preservedValues =
function MappingPromiseArray$preserveValues() {
    return this._preservedValues;
};

function map(promises, fn, options, _filter) {
    var limit = typeof options === "object" && options !== null
        ? options.concurrency
        : 0;
    limit = typeof limit === "number" &&
        isFinite(limit) && limit >= 1 ? limit : 0;
    return new MappingPromiseArray(promises, fn, limit, _filter);
}

Promise.prototype.map = function Promise$map(fn, options) {
    if (typeof fn !== "function") return apiRejection("fn must be a function");

    return map(this, fn, options, null).promise();
};

Promise.map = function Promise$Map(promises, fn, options, _filter) {
    if (typeof fn !== "function") return apiRejection("fn must be a function");
    return map(promises, fn, options, _filter).promise();
};


};

},{"./util.js":47}],30:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var util = require("./util.js");
var async = require("./async.js");
var tryCatch2 = util.tryCatch2;
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;

function thrower(r) {
    throw r;
}

function Promise$_spreadAdapter(val, receiver) {
    if (!util.isArray(val)) return Promise$_successAdapter(val, receiver);
    var ret = util.tryCatchApply(this, [null].concat(val), receiver);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}

function Promise$_successAdapter(val, receiver) {
    var nodeback = this;
    var ret = val === void 0
        ? tryCatch1(nodeback, receiver, null)
        : tryCatch2(nodeback, receiver, null, val);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}
function Promise$_errorAdapter(reason, receiver) {
    var nodeback = this;
    var ret = tryCatch1(nodeback, receiver, reason);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}

Promise.prototype.nodeify = function Promise$nodeify(nodeback, options) {
    if (typeof nodeback == "function") {
        var adapter = Promise$_successAdapter;
        if (options !== void 0 && Object(options).spread) {
            adapter = Promise$_spreadAdapter;
        }
        this._then(
            adapter,
            Promise$_errorAdapter,
            void 0,
            nodeback,
            this._boundTo
        );
    }
    return this;
};
};

},{"./async.js":14,"./util.js":47}],31:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray) {
var util = require("./util.js");
var async = require("./async.js");
var errors = require("./errors.js");
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;

Promise.prototype.progressed = function Promise$progressed(handler) {
    return this._then(void 0, void 0, handler, void 0, void 0);
};

Promise.prototype._progress = function Promise$_progress(progressValue) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._progressUnchecked(progressValue);

};

Promise.prototype._clearFirstHandlerData$Base =
Promise.prototype._clearFirstHandlerData;
Promise.prototype._clearFirstHandlerData =
function Promise$_clearFirstHandlerData() {
    this._clearFirstHandlerData$Base();
    this._progressHandler0 = void 0;
};

Promise.prototype._progressHandlerAt =
function Promise$_progressHandlerAt(index) {
    return index === 0
        ? this._progressHandler0
        : this[(index << 2) + index - 5 + 2];
};

Promise.prototype._doProgressWith =
function Promise$_doProgressWith(progression) {
    var progressValue = progression.value;
    var handler = progression.handler;
    var promise = progression.promise;
    var receiver = progression.receiver;

    var ret = tryCatch1(handler, receiver, progressValue);
    if (ret === errorObj) {
        if (ret.e != null &&
            ret.e.name !== "StopProgressPropagation") {
            var trace = errors.canAttach(ret.e)
                ? ret.e : new Error(ret.e + "");
            promise._attachExtraTrace(trace);
            promise._progress(ret.e);
        }
    } else if (ret instanceof Promise) {
        ret._then(promise._progress, null, null, promise, void 0);
    } else {
        promise._progress(ret);
    }
};


Promise.prototype._progressUnchecked =
function Promise$_progressUnchecked(progressValue) {
    if (!this.isPending()) return;
    var len = this._length();
    var progress = this._progress;
    for (var i = 0; i < len; i++) {
        var handler = this._progressHandlerAt(i);
        var promise = this._promiseAt(i);
        if (!(promise instanceof Promise)) {
            var receiver = this._receiverAt(i);
            if (typeof handler === "function") {
                handler.call(receiver, progressValue, promise);
            } else if (receiver instanceof Promise && receiver._isProxied()) {
                receiver._progressUnchecked(progressValue);
            } else if (receiver instanceof PromiseArray) {
                receiver._promiseProgressed(progressValue, promise);
            }
            continue;
        }

        if (typeof handler === "function") {
            async.invoke(this._doProgressWith, this, {
                handler: handler,
                promise: promise,
                receiver: this._receiverAt(i),
                value: progressValue
            });
        } else {
            async.invoke(progress, promise, progressValue);
        }
    }
};
};

},{"./async.js":14,"./errors.js":22,"./util.js":47}],32:[function(require,module,exports){
(function (process){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var old;
if (typeof Promise !== "undefined") old = Promise;
function noConflict(bluebird) {
    try { if (Promise === bluebird) Promise = old; }
    catch (e) {}
    return bluebird;
}
module.exports = function() {
var util = require("./util.js");
var async = require("./async.js");
var errors = require("./errors.js");

var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {e: null};

var cast = require("./thenables.js")(Promise, INTERNAL);
var PromiseArray = require("./promise_array.js")(Promise, INTERNAL, cast);
var CapturedTrace = require("./captured_trace.js")();
var CatchFilter = require("./catch_filter.js")(NEXT_FILTER);
var PromiseResolver = require("./promise_resolver.js");

var isArray = util.isArray;

var errorObj = util.errorObj;
var tryCatch1 = util.tryCatch1;
var tryCatch2 = util.tryCatch2;
var tryCatchApply = util.tryCatchApply;
var RangeError = errors.RangeError;
var TypeError = errors.TypeError;
var CancellationError = errors.CancellationError;
var TimeoutError = errors.TimeoutError;
var OperationalError = errors.OperationalError;
var originatesFromRejection = errors.originatesFromRejection;
var markAsOriginatingFromRejection = errors.markAsOriginatingFromRejection;
var canAttach = errors.canAttach;
var thrower = util.thrower;
var apiRejection = require("./errors_api_rejection")(Promise);


var makeSelfResolutionError = function Promise$_makeSelfResolutionError() {
    return new TypeError("circular promise resolution chain");
};

function Promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("the promise constructor requires a resolver function");
    }
    if (this.constructor !== Promise) {
        throw new TypeError("the promise constructor cannot be invoked directly");
    }
    this._bitField = 0;
    this._fulfillmentHandler0 = void 0;
    this._rejectionHandler0 = void 0;
    this._promise0 = void 0;
    this._receiver0 = void 0;
    this._settledValue = void 0;
    this._boundTo = void 0;
    if (resolver !== INTERNAL) this._resolveFromResolver(resolver);
}

function returnFirstElement(elements) {
    return elements[0];
}

Promise.prototype.bind = function Promise$bind(thisArg) {
    var maybePromise = cast(thisArg, void 0);
    var ret = new Promise(INTERNAL);
    if (maybePromise instanceof Promise) {
        var binder = maybePromise.then(function(thisArg) {
            ret._setBoundTo(thisArg);
        });
        var p = Promise.all([this, binder]).then(returnFirstElement);
        ret._follow(p);
    } else {
        ret._follow(this);
        ret._setBoundTo(thisArg);
    }
    ret._propagateFrom(this, 2 | 1);
    return ret;
};

Promise.prototype.toString = function Promise$toString() {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] =
function Promise$catch(fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (typeof item === "function") {
                catchInstances[j++] = item;
            } else {
                var catchFilterTypeError =
                    new TypeError(
                        "A catch filter must be an error constructor "
                        + "or a filter function");

                this._attachExtraTrace(catchFilterTypeError);
                return Promise.reject(catchFilterTypeError);
            }
        }
        catchInstances.length = j;
        fn = arguments[i];

        this._resetTrace();
        var catchFilter = new CatchFilter(catchInstances, fn, this);
        return this._then(void 0, catchFilter.doFilter, void 0,
            catchFilter, void 0);
    }
    return this._then(void 0, fn, void 0, void 0, void 0);
};

function reflect() {
    return new Promise.PromiseInspection(this);
}

Promise.prototype.reflect = function Promise$reflect() {
    return this._then(reflect, reflect, void 0, this, void 0);
};

Promise.prototype.then =
function Promise$then(didFulfill, didReject, didProgress) {
    return this._then(didFulfill, didReject, didProgress,
        void 0, void 0);
};


Promise.prototype.done =
function Promise$done(didFulfill, didReject, didProgress) {
    var promise = this._then(didFulfill, didReject, didProgress,
        void 0, void 0);
    promise._setIsFinal();
};

Promise.prototype.spread = function Promise$spread(didFulfill, didReject) {
    return this._then(didFulfill, didReject, void 0,
        APPLY, void 0);
};

Promise.prototype.isCancellable = function Promise$isCancellable() {
    return !this.isResolved() &&
        this._cancellable();
};

Promise.prototype.toJSON = function Promise$toJSON() {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: void 0,
        rejectionReason: void 0
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this._settledValue;
        ret.isFulfilled = true;
    } else if (this.isRejected()) {
        ret.rejectionReason = this._settledValue;
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function Promise$all() {
    return new PromiseArray(this).promise();
};


Promise.is = function Promise$Is(val) {
    return val instanceof Promise;
};

Promise.all = function Promise$All(promises) {
    return new PromiseArray(promises).promise();
};

Promise.prototype.error = function Promise$_error(fn) {
    return this.caught(originatesFromRejection, fn);
};

Promise.prototype._resolveFromSyncValue =
function Promise$_resolveFromSyncValue(value) {
    if (value === errorObj) {
        this._cleanValues();
        this._setRejected();
        var reason = value.e;
        this._settledValue = reason;
        this._tryAttachExtraTrace(reason);
        this._ensurePossibleRejectionHandled();
    } else {
        var maybePromise = cast(value, void 0);
        if (maybePromise instanceof Promise) {
            this._follow(maybePromise);
        } else {
            this._cleanValues();
            this._setFulfilled();
            this._settledValue = value;
        }
    }
};

Promise.method = function Promise$_Method(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }
    return function Promise$_method() {
        var value;
        switch(arguments.length) {
        case 0: value = tryCatch1(fn, this, void 0); break;
        case 1: value = tryCatch1(fn, this, arguments[0]); break;
        case 2: value = tryCatch2(fn, this, arguments[0], arguments[1]); break;
        default:
            var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
            value = tryCatchApply(fn, args, this); break;
        }
        var ret = new Promise(INTERNAL);
        ret._setTrace(void 0);
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function Promise$_Try(fn, args, ctx) {
    if (typeof fn !== "function") {
        return apiRejection("fn must be a function");
    }
    var value = isArray(args)
        ? tryCatchApply(fn, args, ctx)
        : tryCatch1(fn, ctx, args);

    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.defer = Promise.pending = function Promise$Defer() {
    var promise = new Promise(INTERNAL);
    promise._setTrace(void 0);
    return new PromiseResolver(promise);
};

Promise.bind = function Promise$Bind(thisArg) {
    var maybePromise = cast(thisArg, void 0);
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);

    if (maybePromise instanceof Promise) {
        var p = maybePromise.then(function(thisArg) {
            ret._setBoundTo(thisArg);
        });
        ret._follow(p);
    } else {
        ret._setBoundTo(thisArg);
        ret._setFulfilled();
    }
    return ret;
};

Promise.cast = function Promise$_Cast(obj) {
    var ret = cast(obj, void 0);
    if (!(ret instanceof Promise)) {
        var val = ret;
        ret = new Promise(INTERNAL);
        ret._setTrace(void 0);
        ret._setFulfilled();
        ret._cleanValues();
        ret._settledValue = val;
    }
    return ret;
};

Promise.resolve = Promise.fulfilled = Promise.cast;

Promise.reject = Promise.rejected = function Promise$Reject(reason) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    markAsOriginatingFromRejection(reason);
    ret._cleanValues();
    ret._setRejected();
    ret._settledValue = reason;
    if (!canAttach(reason)) {
        var trace = new Error(reason + "");
        ret._setCarriedStackTrace(trace);
    }
    ret._ensurePossibleRejectionHandled();
    return ret;
};

Promise.onPossiblyUnhandledRejection =
function Promise$OnPossiblyUnhandledRejection(fn) {
        CapturedTrace.possiblyUnhandledRejection = typeof fn === "function"
                                                    ? fn : void 0;
};

var unhandledRejectionHandled;
Promise.onUnhandledRejectionHandled =
function Promise$onUnhandledRejectionHandled(fn) {
    unhandledRejectionHandled = typeof fn === "function" ? fn : void 0;
};

var debugging = false || !!(
    typeof process !== "undefined" &&
    typeof process.execPath === "string" &&
    typeof process.env === "object" &&
    (process.env["BLUEBIRD_DEBUG"] ||
        process.env["NODE_ENV"] === "development")
);


Promise.longStackTraces = function Promise$LongStackTraces() {
    if (async.haveItemsQueued() &&
        debugging === false
   ) {
        throw new Error("cannot enable long stack traces after promises have been created");
    }
    debugging = CapturedTrace.isSupported();
};

Promise.hasLongStackTraces = function Promise$HasLongStackTraces() {
    return debugging && CapturedTrace.isSupported();
};

Promise.prototype._then =
function Promise$_then(
    didFulfill,
    didReject,
    didProgress,
    receiver,
    internalData
) {
    var haveInternalData = internalData !== void 0;
    var ret = haveInternalData ? internalData : new Promise(INTERNAL);

    if (!haveInternalData) {
        if (debugging) {
            var haveSameContext = this._peekContext() === this._traceParent;
            ret._traceParent = haveSameContext ? this._traceParent : this;
        }
        ret._propagateFrom(this, 7);
    }

    var callbackIndex =
        this._addCallbacks(didFulfill, didReject, didProgress, ret, receiver);

    if (this.isResolved()) {
        async.invoke(this._queueSettleAt, this, callbackIndex);
    }

    return ret;
};

Promise.prototype._length = function Promise$_length() {
    return this._bitField & 262143;
};

Promise.prototype._isFollowingOrFulfilledOrRejected =
function Promise$_isFollowingOrFulfilledOrRejected() {
    return (this._bitField & 939524096) > 0;
};

Promise.prototype._isFollowing = function Promise$_isFollowing() {
    return (this._bitField & 536870912) === 536870912;
};

Promise.prototype._setLength = function Promise$_setLength(len) {
    this._bitField = (this._bitField & -262144) |
        (len & 262143);
};

Promise.prototype._setFulfilled = function Promise$_setFulfilled() {
    this._bitField = this._bitField | 268435456;
};

Promise.prototype._setRejected = function Promise$_setRejected() {
    this._bitField = this._bitField | 134217728;
};

Promise.prototype._setFollowing = function Promise$_setFollowing() {
    this._bitField = this._bitField | 536870912;
};

Promise.prototype._setIsFinal = function Promise$_setIsFinal() {
    this._bitField = this._bitField | 33554432;
};

Promise.prototype._isFinal = function Promise$_isFinal() {
    return (this._bitField & 33554432) > 0;
};

Promise.prototype._cancellable = function Promise$_cancellable() {
    return (this._bitField & 67108864) > 0;
};

Promise.prototype._setCancellable = function Promise$_setCancellable() {
    this._bitField = this._bitField | 67108864;
};

Promise.prototype._unsetCancellable = function Promise$_unsetCancellable() {
    this._bitField = this._bitField & (~67108864);
};

Promise.prototype._setRejectionIsUnhandled =
function Promise$_setRejectionIsUnhandled() {
    this._bitField = this._bitField | 2097152;
};

Promise.prototype._unsetRejectionIsUnhandled =
function Promise$_unsetRejectionIsUnhandled() {
    this._bitField = this._bitField & (~2097152);
    if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
    }
};

Promise.prototype._isRejectionUnhandled =
function Promise$_isRejectionUnhandled() {
    return (this._bitField & 2097152) > 0;
};

Promise.prototype._setUnhandledRejectionIsNotified =
function Promise$_setUnhandledRejectionIsNotified() {
    this._bitField = this._bitField | 524288;
};

Promise.prototype._unsetUnhandledRejectionIsNotified =
function Promise$_unsetUnhandledRejectionIsNotified() {
    this._bitField = this._bitField & (~524288);
};

Promise.prototype._isUnhandledRejectionNotified =
function Promise$_isUnhandledRejectionNotified() {
    return (this._bitField & 524288) > 0;
};

Promise.prototype._setCarriedStackTrace =
function Promise$_setCarriedStackTrace(capturedTrace) {
    this._bitField = this._bitField | 1048576;
    this._fulfillmentHandler0 = capturedTrace;
};

Promise.prototype._unsetCarriedStackTrace =
function Promise$_unsetCarriedStackTrace() {
    this._bitField = this._bitField & (~1048576);
    this._fulfillmentHandler0 = void 0;
};

Promise.prototype._isCarryingStackTrace =
function Promise$_isCarryingStackTrace() {
    return (this._bitField & 1048576) > 0;
};

Promise.prototype._getCarriedStackTrace =
function Promise$_getCarriedStackTrace() {
    return this._isCarryingStackTrace()
        ? this._fulfillmentHandler0
        : void 0;
};

Promise.prototype._receiverAt = function Promise$_receiverAt(index) {
    var ret = index === 0
        ? this._receiver0
        : this[(index << 2) + index - 5 + 4];
    if (this._isBound() && ret === void 0) {
        return this._boundTo;
    }
    return ret;
};

Promise.prototype._promiseAt = function Promise$_promiseAt(index) {
    return index === 0
        ? this._promise0
        : this[(index << 2) + index - 5 + 3];
};

Promise.prototype._fulfillmentHandlerAt =
function Promise$_fulfillmentHandlerAt(index) {
    return index === 0
        ? this._fulfillmentHandler0
        : this[(index << 2) + index - 5 + 0];
};

Promise.prototype._rejectionHandlerAt =
function Promise$_rejectionHandlerAt(index) {
    return index === 0
        ? this._rejectionHandler0
        : this[(index << 2) + index - 5 + 1];
};

Promise.prototype._addCallbacks = function Promise$_addCallbacks(
    fulfill,
    reject,
    progress,
    promise,
    receiver
) {
    var index = this._length();

    if (index >= 262143 - 5) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        if (receiver !== void 0) this._receiver0 = receiver;
        if (typeof fulfill === "function" && !this._isCarryingStackTrace())
            this._fulfillmentHandler0 = fulfill;
        if (typeof reject === "function") this._rejectionHandler0 = reject;
        if (typeof progress === "function") this._progressHandler0 = progress;
    } else {
        var base = (index << 2) + index - 5;
        this[base + 3] = promise;
        this[base + 4] = receiver;
        this[base + 0] = typeof fulfill === "function"
                                            ? fulfill : void 0;
        this[base + 1] = typeof reject === "function"
                                            ? reject : void 0;
        this[base + 2] = typeof progress === "function"
                                            ? progress : void 0;
    }
    this._setLength(index + 1);
    return index;
};

Promise.prototype._setProxyHandlers =
function Promise$_setProxyHandlers(receiver, promiseSlotValue) {
    var index = this._length();

    if (index >= 262143 - 5) {
        index = 0;
        this._setLength(0);
    }
    if (index === 0) {
        this._promise0 = promiseSlotValue;
        this._receiver0 = receiver;
    } else {
        var base = (index << 2) + index - 5;
        this[base + 3] = promiseSlotValue;
        this[base + 4] = receiver;
        this[base + 0] =
        this[base + 1] =
        this[base + 2] = void 0;
    }
    this._setLength(index + 1);
};

Promise.prototype._proxyPromiseArray =
function Promise$_proxyPromiseArray(promiseArray, index) {
    this._setProxyHandlers(promiseArray, index);
};

Promise.prototype._proxyPromise = function Promise$_proxyPromise(promise) {
    promise._setProxied();
    this._setProxyHandlers(promise, -15);
};

Promise.prototype._setBoundTo = function Promise$_setBoundTo(obj) {
    if (obj !== void 0) {
        this._bitField = this._bitField | 8388608;
        this._boundTo = obj;
    } else {
        this._bitField = this._bitField & (~8388608);
    }
};

Promise.prototype._isBound = function Promise$_isBound() {
    return (this._bitField & 8388608) === 8388608;
};

Promise.prototype._resolveFromResolver =
function Promise$_resolveFromResolver(resolver) {
    var promise = this;
    this._setTrace(void 0);
    this._pushContext();

    function Promise$_resolver(val) {
        if (promise._tryFollow(val)) {
            return;
        }
        promise._fulfill(val);
    }
    function Promise$_rejecter(val) {
        var trace = canAttach(val) ? val : new Error(val + "");
        promise._attachExtraTrace(trace);
        markAsOriginatingFromRejection(val);
        promise._reject(val, trace === val ? void 0 : trace);
    }
    var r = tryCatch2(resolver, void 0, Promise$_resolver, Promise$_rejecter);
    this._popContext();

    if (r !== void 0 && r === errorObj) {
        var e = r.e;
        var trace = canAttach(e) ? e : new Error(e + "");
        promise._reject(e, trace);
    }
};

Promise.prototype._spreadSlowCase =
function Promise$_spreadSlowCase(targetFn, promise, values, boundTo) {
    var promiseForAll = new PromiseArray(values).promise();
    var promise2 = promiseForAll._then(function() {
        return targetFn.apply(boundTo, arguments);
    }, void 0, void 0, APPLY, void 0);
    promise._follow(promise2);
};

Promise.prototype._callSpread =
function Promise$_callSpread(handler, promise, value) {
    var boundTo = this._boundTo;
    if (isArray(value)) {
        for (var i = 0, len = value.length; i < len; ++i) {
            if (cast(value[i], void 0) instanceof Promise) {
                this._spreadSlowCase(handler, promise, value, boundTo);
                return;
            }
        }
    }
    promise._pushContext();
    return tryCatchApply(handler, value, boundTo);
};

Promise.prototype._callHandler =
function Promise$_callHandler(
    handler, receiver, promise, value) {
    var x;
    if (receiver === APPLY && !this.isRejected()) {
        x = this._callSpread(handler, promise, value);
    } else {
        promise._pushContext();
        x = tryCatch1(handler, receiver, value);
    }
    promise._popContext();
    return x;
};

Promise.prototype._settlePromiseFromHandler =
function Promise$_settlePromiseFromHandler(
    handler, receiver, value, promise
) {
    if (!(promise instanceof Promise)) {
        handler.call(receiver, value, promise);
        return;
    }
    if (promise.isResolved()) return;
    var x = this._callHandler(handler, receiver, promise, value);
    if (promise._isFollowing()) return;

    if (x === errorObj || x === promise || x === NEXT_FILTER) {
        var err = x === promise
                    ? makeSelfResolutionError()
                    : x.e;
        var trace = canAttach(err) ? err : new Error(err + "");
        if (x !== NEXT_FILTER) promise._attachExtraTrace(trace);
        promise._rejectUnchecked(err, trace);
    } else {
        var castValue = cast(x, promise);
        if (castValue instanceof Promise) {
            if (castValue.isRejected() &&
                !castValue._isCarryingStackTrace() &&
                !canAttach(castValue._settledValue)) {
                var trace = new Error(castValue._settledValue + "");
                promise._attachExtraTrace(trace);
                castValue._setCarriedStackTrace(trace);
            }
            promise._follow(castValue);
            promise._propagateFrom(castValue, 1);
        } else {
            promise._fulfillUnchecked(x);
        }
    }
};

Promise.prototype._follow =
function Promise$_follow(promise) {
    this._setFollowing();

    if (promise.isPending()) {
        this._propagateFrom(promise, 1);
        promise._proxyPromise(this);
    } else if (promise.isFulfilled()) {
        this._fulfillUnchecked(promise._settledValue);
    } else {
        this._rejectUnchecked(promise._settledValue,
            promise._getCarriedStackTrace());
    }

    if (promise._isRejectionUnhandled()) promise._unsetRejectionIsUnhandled();

    if (debugging &&
        promise._traceParent == null) {
        promise._traceParent = this;
    }
};

Promise.prototype._tryFollow =
function Promise$_tryFollow(value) {
    if (this._isFollowingOrFulfilledOrRejected() ||
        value === this) {
        return false;
    }
    var maybePromise = cast(value, void 0);
    if (!(maybePromise instanceof Promise)) {
        return false;
    }
    this._follow(maybePromise);
    return true;
};

Promise.prototype._resetTrace = function Promise$_resetTrace() {
    if (debugging) {
        this._trace = new CapturedTrace(this._peekContext() === void 0);
    }
};

Promise.prototype._setTrace = function Promise$_setTrace(parent) {
    if (debugging) {
        var context = this._peekContext();
        this._traceParent = context;
        var isTopLevel = context === void 0;
        if (parent !== void 0 &&
            parent._traceParent === context) {
            this._trace = parent._trace;
        } else {
            this._trace = new CapturedTrace(isTopLevel);
        }
    }
    return this;
};

Promise.prototype._tryAttachExtraTrace =
function Promise$_tryAttachExtraTrace(error) {
    if (canAttach(error)) {
        this._attachExtraTrace(error);
    }
};

Promise.prototype._attachExtraTrace =
function Promise$_attachExtraTrace(error) {
    if (debugging) {
        var promise = this;
        var stack = error.stack;
        stack = typeof stack === "string" ? stack.split("\n") : [];
        CapturedTrace.protectErrorMessageNewlines(stack);
        var headerLineCount = 1;
        var combinedTraces = 1;
        while(promise != null &&
            promise._trace != null) {
            stack = CapturedTrace.combine(
                stack,
                promise._trace.stack.split("\n")
            );
            promise = promise._traceParent;
            combinedTraces++;
        }

        var stackTraceLimit = Error.stackTraceLimit || 10;
        var max = (stackTraceLimit + headerLineCount) * combinedTraces;
        var len = stack.length;
        if (len > max) {
            stack.length = max;
        }

        if (len > 0)
            stack[0] = stack[0].split("\u0002\u0000\u0001").join("\n");

        if (stack.length <= headerLineCount) {
            error.stack = "(No stack trace)";
        } else {
            error.stack = stack.join("\n");
        }
    }
};

Promise.prototype._cleanValues = function Promise$_cleanValues() {
    if (this._cancellable()) {
        this._cancellationParent = void 0;
    }
};

Promise.prototype._propagateFrom =
function Promise$_propagateFrom(parent, flags) {
    if ((flags & 1) > 0 && parent._cancellable()) {
        this._setCancellable();
        this._cancellationParent = parent;
    }
    if ((flags & 4) > 0) {
        this._setBoundTo(parent._boundTo);
    }
    if ((flags & 2) > 0) {
        this._setTrace(parent);
    }
};

Promise.prototype._fulfill = function Promise$_fulfill(value) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._fulfillUnchecked(value);
};

Promise.prototype._reject =
function Promise$_reject(reason, carriedStackTrace) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._rejectUnchecked(reason, carriedStackTrace);
};

Promise.prototype._settlePromiseAt = function Promise$_settlePromiseAt(index) {
    var handler = this.isFulfilled()
        ? this._fulfillmentHandlerAt(index)
        : this._rejectionHandlerAt(index);

    var value = this._settledValue;
    var receiver = this._receiverAt(index);
    var promise = this._promiseAt(index);

    if (typeof handler === "function") {
        this._settlePromiseFromHandler(handler, receiver, value, promise);
    } else {
        var done = false;
        var isFulfilled = this.isFulfilled();
        if (receiver !== void 0) {
            if (receiver instanceof Promise &&
                receiver._isProxied()) {
                receiver._unsetProxied();

                if (isFulfilled) receiver._fulfillUnchecked(value);
                else receiver._rejectUnchecked(value,
                    this._getCarriedStackTrace());
                done = true;
            } else if (receiver instanceof PromiseArray) {
                if (isFulfilled) receiver._promiseFulfilled(value, promise);
                else receiver._promiseRejected(value, promise);
                done = true;
            }
        }

        if (!done) {
            if (isFulfilled) promise._fulfill(value);
            else promise._reject(value, this._getCarriedStackTrace());
        }
    }

    if (index >= 4) {
        this._queueGC();
    }
};

Promise.prototype._isProxied = function Promise$_isProxied() {
    return (this._bitField & 4194304) === 4194304;
};

Promise.prototype._setProxied = function Promise$_setProxied() {
    this._bitField = this._bitField | 4194304;
};

Promise.prototype._unsetProxied = function Promise$_unsetProxied() {
    this._bitField = this._bitField & (~4194304);
};

Promise.prototype._isGcQueued = function Promise$_isGcQueued() {
    return (this._bitField & -1073741824) === -1073741824;
};

Promise.prototype._setGcQueued = function Promise$_setGcQueued() {
    this._bitField = this._bitField | -1073741824;
};

Promise.prototype._unsetGcQueued = function Promise$_unsetGcQueued() {
    this._bitField = this._bitField & (~-1073741824);
};

Promise.prototype._queueGC = function Promise$_queueGC() {
    if (this._isGcQueued()) return;
    this._setGcQueued();
    async.invokeLater(this._gc, this, void 0);
};

Promise.prototype._gc = function Promise$gc() {
    var len = this._length() * 5 - 5;
    for (var i = 0; i < len; i++) {
        delete this[i];
    }
    this._clearFirstHandlerData();
    this._setLength(0);
    this._unsetGcQueued();
};

Promise.prototype._clearFirstHandlerData =
function Promise$_clearFirstHandlerData() {
    this._fulfillmentHandler0 = void 0;
    this._rejectionHandler0 = void 0;
    this._promise0 = void 0;
    this._receiver0 = void 0;
};

Promise.prototype._queueSettleAt = function Promise$_queueSettleAt(index) {
    if (this._isRejectionUnhandled()) this._unsetRejectionIsUnhandled();
    async.invoke(this._settlePromiseAt, this, index);
};

Promise.prototype._fulfillUnchecked =
function Promise$_fulfillUnchecked(value) {
    if (!this.isPending()) return;
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err, void 0);
    }
    this._cleanValues();
    this._setFulfilled();
    this._settledValue = value;
    var len = this._length();

    if (len > 0) {
        async.invoke(this._settlePromises, this, len);
    }
};

Promise.prototype._rejectUncheckedCheckError =
function Promise$_rejectUncheckedCheckError(reason) {
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this._rejectUnchecked(reason, trace === reason ? void 0 : trace);
};

Promise.prototype._rejectUnchecked =
function Promise$_rejectUnchecked(reason, trace) {
    if (!this.isPending()) return;
    if (reason === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err);
    }
    this._cleanValues();
    this._setRejected();
    this._settledValue = reason;

    if (this._isFinal()) {
        async.invokeLater(thrower, void 0, trace === void 0 ? reason : trace);
        return;
    }
    var len = this._length();

    if (trace !== void 0) this._setCarriedStackTrace(trace);

    if (len > 0) {
        async.invoke(this._rejectPromises, this, null);
    } else {
        this._ensurePossibleRejectionHandled();
    }
};

Promise.prototype._rejectPromises = function Promise$_rejectPromises() {
    this._settlePromises();
    this._unsetCarriedStackTrace();
};

Promise.prototype._settlePromises = function Promise$_settlePromises() {
    var len = this._length();
    for (var i = 0; i < len; i++) {
        this._settlePromiseAt(i);
    }
};

Promise.prototype._ensurePossibleRejectionHandled =
function Promise$_ensurePossibleRejectionHandled() {
    this._setRejectionIsUnhandled();
    if (CapturedTrace.possiblyUnhandledRejection !== void 0) {
        async.invokeLater(this._notifyUnhandledRejection, this, void 0);
    }
};

Promise.prototype._notifyUnhandledRejectionIsHandled =
function Promise$_notifyUnhandledRejectionIsHandled() {
    if (typeof unhandledRejectionHandled === "function") {
        async.invokeLater(unhandledRejectionHandled, void 0, this);
    }
};

Promise.prototype._notifyUnhandledRejection =
function Promise$_notifyUnhandledRejection() {
    if (this._isRejectionUnhandled()) {
        var reason = this._settledValue;
        var trace = this._getCarriedStackTrace();

        this._setUnhandledRejectionIsNotified();

        if (trace !== void 0) {
            this._unsetCarriedStackTrace();
            reason = trace;
        }
        if (typeof CapturedTrace.possiblyUnhandledRejection === "function") {
            CapturedTrace.possiblyUnhandledRejection(reason, this);
        }
    }
};

var contextStack = [];
Promise.prototype._peekContext = function Promise$_peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return void 0;

};

Promise.prototype._pushContext = function Promise$_pushContext() {
    if (!debugging) return;
    contextStack.push(this);
};

Promise.prototype._popContext = function Promise$_popContext() {
    if (!debugging) return;
    contextStack.pop();
};

Promise.noConflict = function Promise$NoConflict() {
    return noConflict(Promise);
};

Promise.setScheduler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function");
    async._schedule = fn;
};

if (!CapturedTrace.isSupported()) {
    Promise.longStackTraces = function(){};
    debugging = false;
}

Promise._makeSelfResolutionError = makeSelfResolutionError;
require("./finally.js")(Promise, NEXT_FILTER, cast);
require("./direct_resolve.js")(Promise);
require("./synchronous_inspection.js")(Promise);
require("./join.js")(Promise, PromiseArray, cast, INTERNAL);
Promise.RangeError = RangeError;
Promise.CancellationError = CancellationError;
Promise.TimeoutError = TimeoutError;
Promise.TypeError = TypeError;
Promise.OperationalError = OperationalError;
Promise.RejectionError = OperationalError;
Promise.AggregateError = errors.AggregateError;

util.toFastProperties(Promise);
util.toFastProperties(Promise.prototype);
Promise.Promise = Promise;
require('./timers.js')(Promise,INTERNAL,cast);
require('./race.js')(Promise,INTERNAL,cast);
require('./call_get.js')(Promise);
require('./generators.js')(Promise,apiRejection,INTERNAL,cast);
require('./map.js')(Promise,PromiseArray,apiRejection,cast,INTERNAL);
require('./nodeify.js')(Promise);
require('./promisify.js')(Promise,INTERNAL);
require('./props.js')(Promise,PromiseArray,cast);
require('./reduce.js')(Promise,PromiseArray,apiRejection,cast,INTERNAL);
require('./settle.js')(Promise,PromiseArray);
require('./some.js')(Promise,PromiseArray,apiRejection);
require('./progress.js')(Promise,PromiseArray);
require('./cancel.js')(Promise,INTERNAL);
require('./filter.js')(Promise,INTERNAL);
require('./any.js')(Promise,PromiseArray);
require('./each.js')(Promise,INTERNAL);
require('./using.js')(Promise,apiRejection,cast);

Promise.prototype = Promise.prototype;
return Promise;

};

}).call(this,require('_process'))
},{"./any.js":13,"./async.js":14,"./call_get.js":16,"./cancel.js":17,"./captured_trace.js":18,"./catch_filter.js":19,"./direct_resolve.js":20,"./each.js":21,"./errors.js":22,"./errors_api_rejection":23,"./filter.js":25,"./finally.js":26,"./generators.js":27,"./join.js":28,"./map.js":29,"./nodeify.js":30,"./progress.js":31,"./promise_array.js":33,"./promise_resolver.js":34,"./promisify.js":35,"./props.js":36,"./race.js":38,"./reduce.js":39,"./settle.js":41,"./some.js":42,"./synchronous_inspection.js":43,"./thenables.js":44,"./timers.js":45,"./using.js":46,"./util.js":47,"_process":2}],33:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL, cast) {
var canAttach = require("./errors.js").canAttach;
var util = require("./util.js");
var isArray = util.isArray;

function toResolutionValue(val) {
    switch(val) {
    case -1: return void 0;
    case -2: return [];
    case -3: return {};
    }
}

function PromiseArray(values) {
    var promise = this._promise = new Promise(INTERNAL);
    var parent = void 0;
    if (values instanceof Promise) {
        parent = values;
        promise._propagateFrom(parent, 1 | 4);
    }
    promise._setTrace(parent);
    this._values = values;
    this._length = 0;
    this._totalResolved = 0;
    this._init(void 0, -2);
}
PromiseArray.prototype.length = function PromiseArray$length() {
    return this._length;
};

PromiseArray.prototype.promise = function PromiseArray$promise() {
    return this._promise;
};

PromiseArray.prototype._init =
function PromiseArray$_init(_, resolveValueIfEmpty) {
    var values = cast(this._values, void 0);
    if (values instanceof Promise) {
        this._values = values;
        values._setBoundTo(this._promise._boundTo);
        if (values.isFulfilled()) {
            values = values._settledValue;
            if (!isArray(values)) {
                var err = new Promise.TypeError("expecting an array, a promise or a thenable");
                this.__hardReject__(err);
                return;
            }
        } else if (values.isPending()) {
            values._then(
                PromiseArray$_init,
                this._reject,
                void 0,
                this,
                resolveValueIfEmpty
           );
            return;
        } else {
            values._unsetRejectionIsUnhandled();
            this._reject(values._settledValue);
            return;
        }
    } else if (!isArray(values)) {
        var err = new Promise.TypeError("expecting an array, a promise or a thenable");
        this.__hardReject__(err);
        return;
    }

    if (values.length === 0) {
        if (resolveValueIfEmpty === -5) {
            this._resolveEmptyArray();
        }
        else {
            this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
    }
    var len = this.getActualLength(values.length);
    var newLen = len;
    var newValues = this.shouldCopyValues() ? new Array(len) : this._values;
    var isDirectScanNeeded = false;
    for (var i = 0; i < len; ++i) {
        var maybePromise = cast(values[i], void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                maybePromise._proxyPromiseArray(this, i);
            } else {
                maybePromise._unsetRejectionIsUnhandled();
                isDirectScanNeeded = true;
            }
        } else {
            isDirectScanNeeded = true;
        }
        newValues[i] = maybePromise;
    }
    this._values = newValues;
    this._length = newLen;
    if (isDirectScanNeeded) {
        this._scanDirectValues(len);
    }
};

PromiseArray.prototype._settlePromiseAt =
function PromiseArray$_settlePromiseAt(index) {
    var value = this._values[index];
    if (!(value instanceof Promise)) {
        this._promiseFulfilled(value, index);
    } else if (value.isFulfilled()) {
        this._promiseFulfilled(value._settledValue, index);
    } else if (value.isRejected()) {
        this._promiseRejected(value._settledValue, index);
    }
};

PromiseArray.prototype._scanDirectValues =
function PromiseArray$_scanDirectValues(len) {
    for (var i = 0; i < len; ++i) {
        if (this._isResolved()) {
            break;
        }
        this._settlePromiseAt(i);
    }
};

PromiseArray.prototype._isResolved = function PromiseArray$_isResolved() {
    return this._values === null;
};

PromiseArray.prototype._resolve = function PromiseArray$_resolve(value) {
    this._values = null;
    this._promise._fulfill(value);
};

PromiseArray.prototype.__hardReject__ =
PromiseArray.prototype._reject = function PromiseArray$_reject(reason) {
    this._values = null;
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this._promise._attachExtraTrace(trace);
    this._promise._reject(reason, trace);
};

PromiseArray.prototype._promiseProgressed =
function PromiseArray$_promiseProgressed(progressValue, index) {
    if (this._isResolved()) return;
    this._promise._progress({
        index: index,
        value: progressValue
    });
};


PromiseArray.prototype._promiseFulfilled =
function PromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

PromiseArray.prototype._promiseRejected =
function PromiseArray$_promiseRejected(reason, index) {
    if (this._isResolved()) return;
    this._totalResolved++;
    this._reject(reason);
};

PromiseArray.prototype.shouldCopyValues =
function PromiseArray$_shouldCopyValues() {
    return true;
};

PromiseArray.prototype.getActualLength =
function PromiseArray$getActualLength(len) {
    return len;
};

return PromiseArray;
};

},{"./errors.js":22,"./util.js":47}],34:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var util = require("./util.js");
var maybeWrapAsError = util.maybeWrapAsError;
var errors = require("./errors.js");
var TimeoutError = errors.TimeoutError;
var OperationalError = errors.OperationalError;
var async = require("./async.js");
var haveGetters = util.haveGetters;
var es5 = require("./es5.js");

function isUntypedError(obj) {
    return obj instanceof Error &&
        es5.getPrototypeOf(obj) === Error.prototype;
}

function wrapAsOperationalError(obj) {
    var ret;
    if (isUntypedError(obj)) {
        ret = new OperationalError(obj);
    } else {
        ret = obj;
    }
    errors.markAsOriginatingFromRejection(ret);
    return ret;
}

function nodebackForPromise(promise) {
    function PromiseResolver$_callback(err, value) {
        if (promise === null) return;

        if (err) {
            var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        } else if (arguments.length > 2) {
            var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
            promise._fulfill(args);
        } else {
            promise._fulfill(value);
        }

        promise = null;
    }
    return PromiseResolver$_callback;
}


var PromiseResolver;
if (!haveGetters) {
    PromiseResolver = function PromiseResolver(promise) {
        this.promise = promise;
        this.asCallback = nodebackForPromise(promise);
        this.callback = this.asCallback;
    };
}
else {
    PromiseResolver = function PromiseResolver(promise) {
        this.promise = promise;
    };
}
if (haveGetters) {
    var prop = {
        get: function() {
            return nodebackForPromise(this.promise);
        }
    };
    es5.defineProperty(PromiseResolver.prototype, "asCallback", prop);
    es5.defineProperty(PromiseResolver.prototype, "callback", prop);
}

PromiseResolver._nodebackForPromise = nodebackForPromise;

PromiseResolver.prototype.toString = function PromiseResolver$toString() {
    return "[object PromiseResolver]";
};

PromiseResolver.prototype.resolve =
PromiseResolver.prototype.fulfill = function PromiseResolver$resolve(value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }

    var promise = this.promise;
    if (promise._tryFollow(value)) {
        return;
    }
    async.invoke(promise._fulfill, promise, value);
};

PromiseResolver.prototype.reject = function PromiseResolver$reject(reason) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }

    var promise = this.promise;
    errors.markAsOriginatingFromRejection(reason);
    var trace = errors.canAttach(reason) ? reason : new Error(reason + "");
    promise._attachExtraTrace(trace);
    async.invoke(promise._reject, promise, reason);
    if (trace !== reason) {
        async.invoke(this._setCarriedStackTrace, this, trace);
    }
};

PromiseResolver.prototype.progress =
function PromiseResolver$progress(value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }
    async.invoke(this.promise._progress, this.promise, value);
};

PromiseResolver.prototype.cancel = function PromiseResolver$cancel() {
    async.invoke(this.promise.cancel, this.promise, void 0);
};

PromiseResolver.prototype.timeout = function PromiseResolver$timeout() {
    this.reject(new TimeoutError("timeout"));
};

PromiseResolver.prototype.isResolved = function PromiseResolver$isResolved() {
    return this.promise.isResolved();
};

PromiseResolver.prototype.toJSON = function PromiseResolver$toJSON() {
    return this.promise.toJSON();
};

PromiseResolver.prototype._setCarriedStackTrace =
function PromiseResolver$_setCarriedStackTrace(trace) {
    if (this.promise.isRejected()) {
        this.promise._setCarriedStackTrace(trace);
    }
};

module.exports = PromiseResolver;

},{"./async.js":14,"./errors.js":22,"./es5.js":24,"./util.js":47}],35:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var THIS = {};
var util = require("./util.js");
var nodebackForPromise = require("./promise_resolver.js")
    ._nodebackForPromise;
var withAppended = util.withAppended;
var maybeWrapAsError = util.maybeWrapAsError;
var canEvaluate = util.canEvaluate;
var TypeError = require("./errors").TypeError;
var defaultSuffix = "Async";
var defaultFilter = function(name, func) {
    return util.isIdentifier(name) &&
        name.charAt(0) !== "_" &&
        !util.isClass(func);
};
var defaultPromisified = {__isPromisified__: true};


function escapeIdentRegex(str) {
    return str.replace(/([$])/, "\\$");
}

function isPromisified(fn) {
    try {
        return fn.__isPromisified__ === true;
    }
    catch (e) {
        return false;
    }
}

function hasPromisified(obj, key, suffix) {
    var val = util.getDataPropertyOrDefault(obj, key + suffix,
                                            defaultPromisified);
    return val ? isPromisified(val) : false;
}
function checkValid(ret, suffix, suffixRegexp) {
    for (var i = 0; i < ret.length; i += 2) {
        var key = ret[i];
        if (suffixRegexp.test(key)) {
            var keyWithoutAsyncSuffix = key.replace(suffixRegexp, "");
            for (var j = 0; j < ret.length; j += 2) {
                if (ret[j] === keyWithoutAsyncSuffix) {
                    throw new TypeError("Cannot promisify an API " +
                        "that has normal methods with '"+suffix+"'-suffix");
                }
            }
        }
    }
}

function promisifiableMethods(obj, suffix, suffixRegexp, filter) {
    var keys = util.inheritedDataKeys(obj);
    var ret = [];
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var value = obj[key];
        if (typeof value === "function" &&
            !isPromisified(value) &&
            !hasPromisified(obj, key, suffix) &&
            filter(key, value, obj)) {
            ret.push(key, value);
        }
    }
    checkValid(ret, suffix, suffixRegexp);
    return ret;
}

function switchCaseArgumentOrder(likelyArgumentCount) {
    var ret = [likelyArgumentCount];
    var min = Math.max(0, likelyArgumentCount - 1 - 5);
    for(var i = likelyArgumentCount - 1; i >= min; --i) {
        if (i === likelyArgumentCount) continue;
        ret.push(i);
    }
    for(var i = likelyArgumentCount + 1; i <= 5; ++i) {
        ret.push(i);
    }
    return ret;
}

function argumentSequence(argumentCount) {
    return util.filledRange(argumentCount, "arguments[", "]");
}

function parameterDeclaration(parameterCount) {
    return util.filledRange(parameterCount, "_arg", "");
}

function parameterCount(fn) {
    if (typeof fn.length === "number") {
        return Math.max(Math.min(fn.length, 1023 + 1), 0);
    }
    return 0;
}

function generatePropertyAccess(key) {
    if (util.isIdentifier(key)) {
        return "." + key;
    }
    else return "['" + key.replace(/(['\\])/g, "\\$1") + "']";
}

function makeNodePromisifiedEval(callback, receiver, originalName, fn, suffix) {
    var newParameterCount = Math.max(0, parameterCount(fn) - 1);
    var argumentOrder = switchCaseArgumentOrder(newParameterCount);
    var callbackName =
        (typeof originalName === "string" && util.isIdentifier(originalName)
            ? originalName + suffix
            : "promisified");

    function generateCallForArgumentCount(count) {
        var args = argumentSequence(count).join(", ");
        var comma = count > 0 ? ", " : "";
        var ret;
        if (typeof callback === "string") {
            ret = "                                                          \n\
                this.method({{args}}, fn);                                   \n\
                break;                                                       \n\
            ".replace(".method", generatePropertyAccess(callback));
        } else if (receiver === THIS) {
            ret =  "                                                         \n\
                callback.call(this, {{args}}, fn);                           \n\
                break;                                                       \n\
            ";
        } else if (receiver !== void 0) {
            ret =  "                                                         \n\
                callback.call(receiver, {{args}}, fn);                       \n\
                break;                                                       \n\
            ";
        } else {
            ret =  "                                                         \n\
                callback({{args}}, fn);                                      \n\
                break;                                                       \n\
            ";
        }
        return ret.replace("{{args}}", args).replace(", ", comma);
    }

    function generateArgumentSwitchCase() {
        var ret = "";
        for(var i = 0; i < argumentOrder.length; ++i) {
            ret += "case " + argumentOrder[i] +":" +
                generateCallForArgumentCount(argumentOrder[i]);
        }
        var codeForCall;
        if (typeof callback === "string") {
            codeForCall = "                                                  \n\
                this.property.apply(this, args);                             \n\
            "
                .replace(".property", generatePropertyAccess(callback));
        } else if (receiver === THIS) {
            codeForCall = "                                                  \n\
                callback.apply(this, args);                                  \n\
            ";
        } else {
            codeForCall = "                                                  \n\
                callback.apply(receiver, args);                              \n\
            ";
        }

        ret += "                                                             \n\
        default:                                                             \n\
            var args = new Array(len + 1);                                   \n\
            var i = 0;                                                       \n\
            for (var i = 0; i < len; ++i) {                                  \n\
               args[i] = arguments[i];                                       \n\
            }                                                                \n\
            args[i] = fn;                                                    \n\
            [CodeForCall]                                                    \n\
            break;                                                           \n\
        ".replace("[CodeForCall]", codeForCall);
        return ret;
    }

    return new Function("Promise",
                        "callback",
                        "receiver",
                        "withAppended",
                        "maybeWrapAsError",
                        "nodebackForPromise",
                        "INTERNAL","                                         \n\
        var ret = function FunctionName(Parameters) {                        \n\
            'use strict';                                                    \n\
            var len = arguments.length;                                      \n\
            var promise = new Promise(INTERNAL);                             \n\
            promise._setTrace(void 0);                                       \n\
            var fn = nodebackForPromise(promise);                            \n\
            try {                                                            \n\
                switch(len) {                                                \n\
                    [CodeForSwitchCase]                                      \n\
                }                                                            \n\
            } catch (e) {                                                    \n\
                var wrapped = maybeWrapAsError(e);                           \n\
                promise._attachExtraTrace(wrapped);                          \n\
                promise._reject(wrapped);                                    \n\
            }                                                                \n\
            return promise;                                                  \n\
        };                                                                   \n\
        ret.__isPromisified__ = true;                                        \n\
        return ret;                                                          \n\
        "
        .replace("FunctionName", callbackName)
        .replace("Parameters", parameterDeclaration(newParameterCount))
        .replace("[CodeForSwitchCase]", generateArgumentSwitchCase()))(
            Promise,
            callback,
            receiver,
            withAppended,
            maybeWrapAsError,
            nodebackForPromise,
            INTERNAL
        );
}

function makeNodePromisifiedClosure(callback, receiver) {
    function promisified() {
        var _receiver = receiver;
        if (receiver === THIS) _receiver = this;
        if (typeof callback === "string") {
            callback = _receiver[callback];
        }
        var promise = new Promise(INTERNAL);
        promise._setTrace(void 0);
        var fn = nodebackForPromise(promise);
        try {
            callback.apply(_receiver, withAppended(arguments, fn));
        } catch(e) {
            var wrapped = maybeWrapAsError(e);
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        }
        return promise;
    }
    promisified.__isPromisified__ = true;
    return promisified;
}

var makeNodePromisified = canEvaluate
    ? makeNodePromisifiedEval
    : makeNodePromisifiedClosure;

function promisifyAll(obj, suffix, filter, promisifier) {
    var suffixRegexp = new RegExp(escapeIdentRegex(suffix) + "$");
    var methods =
        promisifiableMethods(obj, suffix, suffixRegexp, filter);

    for (var i = 0, len = methods.length; i < len; i+= 2) {
        var key = methods[i];
        var fn = methods[i+1];
        var promisifiedKey = key + suffix;
        obj[promisifiedKey] = promisifier === makeNodePromisified
                ? makeNodePromisified(key, THIS, key, fn, suffix)
                : promisifier(fn);
    }
    util.toFastProperties(obj);
    return obj;
}

function promisify(callback, receiver) {
    return makeNodePromisified(callback, receiver, void 0, callback);
}

Promise.promisify = function Promise$Promisify(fn, receiver) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }
    if (isPromisified(fn)) {
        return fn;
    }
    return promisify(fn, arguments.length < 2 ? THIS : receiver);
};

Promise.promisifyAll = function Promise$PromisifyAll(target, options) {
    if (typeof target !== "function" && typeof target !== "object") {
        throw new TypeError("the target of promisifyAll must be an object or a function");
    }
    options = Object(options);
    var suffix = options.suffix;
    if (typeof suffix !== "string") suffix = defaultSuffix;
    var filter = options.filter;
    if (typeof filter !== "function") filter = defaultFilter;
    var promisifier = options.promisifier;
    if (typeof promisifier !== "function") promisifier = makeNodePromisified;

    if (!util.isIdentifier(suffix)) {
        throw new RangeError("suffix must be a valid identifier");
    }

    var keys = util.inheritedDataKeys(target, {includeHidden: true});
    for (var i = 0; i < keys.length; ++i) {
        var value = target[keys[i]];
        if (keys[i] !== "constructor" &&
            util.isClass(value)) {
            promisifyAll(value.prototype, suffix, filter, promisifier);
            promisifyAll(value, suffix, filter, promisifier);
        }
    }

    return promisifyAll(target, suffix, filter, promisifier);
};
};


},{"./errors":22,"./promise_resolver.js":34,"./util.js":47}],36:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray, cast) {
var util = require("./util.js");
var apiRejection = require("./errors_api_rejection")(Promise);
var isObject = util.isObject;
var es5 = require("./es5.js");

function PropertiesPromiseArray(obj) {
    var keys = es5.keys(obj);
    var len = keys.length;
    var values = new Array(len * 2);
    for (var i = 0; i < len; ++i) {
        var key = keys[i];
        values[i] = obj[key];
        values[i + len] = key;
    }
    this.constructor$(values);
}
util.inherits(PropertiesPromiseArray, PromiseArray);

PropertiesPromiseArray.prototype._init =
function PropertiesPromiseArray$_init() {
    this._init$(void 0, -3) ;
};

PropertiesPromiseArray.prototype._promiseFulfilled =
function PropertiesPromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        var val = {};
        var keyOffset = this.length();
        for (var i = 0, len = this.length(); i < len; ++i) {
            val[this._values[i + keyOffset]] = this._values[i];
        }
        this._resolve(val);
    }
};

PropertiesPromiseArray.prototype._promiseProgressed =
function PropertiesPromiseArray$_promiseProgressed(value, index) {
    if (this._isResolved()) return;

    this._promise._progress({
        key: this._values[index + this.length()],
        value: value
    });
};

PropertiesPromiseArray.prototype.shouldCopyValues =
function PropertiesPromiseArray$_shouldCopyValues() {
    return false;
};

PropertiesPromiseArray.prototype.getActualLength =
function PropertiesPromiseArray$getActualLength(len) {
    return len >> 1;
};

function Promise$_Props(promises) {
    var ret;
    var castValue = cast(promises, void 0);

    if (!isObject(castValue)) {
        return apiRejection("cannot await properties of a non-object");
    } else if (castValue instanceof Promise) {
        ret = castValue._then(Promise.props, void 0, void 0, void 0, void 0);
    } else {
        ret = new PropertiesPromiseArray(castValue).promise();
    }

    if (castValue instanceof Promise) {
        ret._propagateFrom(castValue, 4);
    }
    return ret;
}

Promise.prototype.props = function Promise$props() {
    return Promise$_Props(this);
};

Promise.props = function Promise$Props(promises) {
    return Promise$_Props(promises);
};
};

},{"./errors_api_rejection":23,"./es5.js":24,"./util.js":47}],37:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
function arrayCopy(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0; j < len; ++j) {
        dst[j + dstIndex] = src[j + srcIndex];
    }
}

function Queue(capacity) {
    this._capacity = capacity;
    this._length = 0;
    this._front = 0;
    this._makeCapacity();
}

Queue.prototype._willBeOverCapacity =
function Queue$_willBeOverCapacity(size) {
    return this._capacity < size;
};

Queue.prototype._pushOne = function Queue$_pushOne(arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = (this._front + length) & (this._capacity - 1);
    this[i] = arg;
    this._length = length + 1;
};

Queue.prototype.push = function Queue$push(fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
        this._pushOne(fn);
        this._pushOne(receiver);
        this._pushOne(arg);
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[(j + 0) & wrapMask] = fn;
    this[(j + 1) & wrapMask] = receiver;
    this[(j + 2) & wrapMask] = arg;
    this._length = length;
};

Queue.prototype.shift = function Queue$shift() {
    var front = this._front,
        ret = this[front];

    this[front] = void 0;
    this._front = (front + 1) & (this._capacity - 1);
    this._length--;
    return ret;
};

Queue.prototype.length = function Queue$length() {
    return this._length;
};

Queue.prototype._makeCapacity = function Queue$_makeCapacity() {
    var len = this._capacity;
    for (var i = 0; i < len; ++i) {
        this[i] = void 0;
    }
};

Queue.prototype._checkCapacity = function Queue$_checkCapacity(size) {
    if (this._capacity < size) {
        this._resizeTo(this._capacity << 3);
    }
};

Queue.prototype._resizeTo = function Queue$_resizeTo(capacity) {
    var oldFront = this._front;
    var oldCapacity = this._capacity;
    var oldQueue = new Array(oldCapacity);
    var length = this.length();

    arrayCopy(this, 0, oldQueue, 0, oldCapacity);
    this._capacity = capacity;
    this._makeCapacity();
    this._front = 0;
    if (oldFront + length <= oldCapacity) {
        arrayCopy(oldQueue, oldFront, this, 0, length);
    } else {        var lengthBeforeWrapping =
            length - ((oldFront + length) & (oldCapacity - 1));

        arrayCopy(oldQueue, oldFront, this, 0, lengthBeforeWrapping);
        arrayCopy(oldQueue, 0, this, lengthBeforeWrapping,
                    length - lengthBeforeWrapping);
    }
};

module.exports = Queue;

},{}],38:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL, cast) {
var apiRejection = require("./errors_api_rejection.js")(Promise);
var isArray = require("./util.js").isArray;

var raceLater = function Promise$_raceLater(promise) {
    return promise.then(function(array) {
        return Promise$_Race(array, promise);
    });
};

var hasOwn = {}.hasOwnProperty;
function Promise$_Race(promises, parent) {
    var maybePromise = cast(promises, void 0);

    if (maybePromise instanceof Promise) {
        return raceLater(maybePromise);
    } else if (!isArray(promises)) {
        return apiRejection("expecting an array, a promise or a thenable");
    }

    var ret = new Promise(INTERNAL);
    if (parent !== void 0) {
        ret._propagateFrom(parent, 7);
    } else {
        ret._setTrace(void 0);
    }
    var fulfill = ret._fulfill;
    var reject = ret._reject;
    for (var i = 0, len = promises.length; i < len; ++i) {
        var val = promises[i];

        if (val === void 0 && !(hasOwn.call(promises, i))) {
            continue;
        }

        Promise.cast(val)._then(fulfill, reject, void 0, ret, null);
    }
    return ret;
}

Promise.race = function Promise$Race(promises) {
    return Promise$_Race(promises, void 0);
};

Promise.prototype.race = function Promise$race() {
    return Promise$_Race(this, void 0);
};

};

},{"./errors_api_rejection.js":23,"./util.js":47}],39:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray, apiRejection, cast, INTERNAL) {
var util = require("./util.js");
var tryCatch4 = util.tryCatch4;
var tryCatch3 = util.tryCatch3;
var errorObj = util.errorObj;
function ReductionPromiseArray(promises, fn, accum, _each) {
    this.constructor$(promises);
    this._preservedValues = _each === INTERNAL ? [] : null;
    this._zerothIsAccum = (accum === void 0);
    this._gotAccum = false;
    this._reducingIndex = (this._zerothIsAccum ? 1 : 0);
    this._valuesPhase = undefined;

    var maybePromise = cast(accum, void 0);
    var rejected = false;
    var isPromise = maybePromise instanceof Promise;
    if (isPromise) {
        if (maybePromise.isPending()) {
            maybePromise._proxyPromiseArray(this, -1);
        } else if (maybePromise.isFulfilled()) {
            accum = maybePromise.value();
            this._gotAccum = true;
        } else {
            maybePromise._unsetRejectionIsUnhandled();
            this._reject(maybePromise.reason());
            rejected = true;
        }
    }
    if (!(isPromise || this._zerothIsAccum)) this._gotAccum = true;
    this._callback = fn;
    this._accum = accum;
    if (!rejected) this._init$(void 0, -5);
}
util.inherits(ReductionPromiseArray, PromiseArray);

ReductionPromiseArray.prototype._init =
function ReductionPromiseArray$_init() {};

ReductionPromiseArray.prototype._resolveEmptyArray =
function ReductionPromiseArray$_resolveEmptyArray() {
    if (this._gotAccum || this._zerothIsAccum) {
        this._resolve(this._preservedValues !== null
                        ? [] : this._accum);
    }
};

ReductionPromiseArray.prototype._promiseFulfilled =
function ReductionPromiseArray$_promiseFulfilled(value, index) {
    var values = this._values;
    if (values === null) return;
    var length = this.length();
    var preservedValues = this._preservedValues;
    var isEach = preservedValues !== null;
    var gotAccum = this._gotAccum;
    var valuesPhase = this._valuesPhase;
    var valuesPhaseIndex;
    if (!valuesPhase) {
        valuesPhase = this._valuesPhase = Array(length);
        for (valuesPhaseIndex=0; valuesPhaseIndex<length; ++valuesPhaseIndex) {
            valuesPhase[valuesPhaseIndex] = 0;
        }
    }
    valuesPhaseIndex = valuesPhase[index];

    if (index === 0 && this._zerothIsAccum) {
        if (!gotAccum) {
            this._accum = value;
            this._gotAccum = gotAccum = true;
        }
        valuesPhase[index] = ((valuesPhaseIndex === 0)
            ? 1 : 2);
    } else if (index === -1) {
        if (!gotAccum) {
            this._accum = value;
            this._gotAccum = gotAccum = true;
        }
    } else {
        if (valuesPhaseIndex === 0) {
            valuesPhase[index] = 1;
        }
        else {
            valuesPhase[index] = 2;
            if (gotAccum) {
                this._accum = value;
            }
        }
    }
    if (!gotAccum) return;

    var callback = this._callback;
    var receiver = this._promise._boundTo;
    var ret;

    for (var i = this._reducingIndex; i < length; ++i) {
        valuesPhaseIndex = valuesPhase[i];
        if (valuesPhaseIndex === 2) {
            this._reducingIndex = i + 1;
            continue;
        }
        if (valuesPhaseIndex !== 1) return;

        value = values[i];
        if (value instanceof Promise) {
            if (value.isFulfilled()) {
                value = value._settledValue;
            } else if (value.isPending()) {
                return;
            } else {
                value._unsetRejectionIsUnhandled();
                return this._reject(value.reason());
            }
        }

        if (isEach) {
            preservedValues.push(value);
            ret = tryCatch3(callback, receiver, value, i, length);
        }
        else {
            ret = tryCatch4(callback, receiver, this._accum, value, i, length);
        }

        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                valuesPhase[i] = 4;
                return maybePromise._proxyPromiseArray(this, i);
            } else if (maybePromise.isFulfilled()) {
                ret = maybePromise.value();
            } else {
                maybePromise._unsetRejectionIsUnhandled();
                return this._reject(maybePromise.reason());
            }
        }

        this._reducingIndex = i + 1;
        this._accum = ret;
    }

    if (this._reducingIndex < length) return;
    this._resolve(isEach ? preservedValues : this._accum);
};

function reduce(promises, fn, initialValue, _each) {
    if (typeof fn !== "function") return apiRejection("fn must be a function");
    var array = new ReductionPromiseArray(promises, fn, initialValue, _each);
    return array.promise();
}

Promise.prototype.reduce = function Promise$reduce(fn, initialValue) {
    return reduce(this, fn, initialValue, null);
};

Promise.reduce = function Promise$Reduce(promises, fn, initialValue, _each) {
    return reduce(promises, fn, initialValue, _each);
};
};

},{"./util.js":47}],40:[function(require,module,exports){
(function (process){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var schedule;
var _MutationObserver;
if (typeof process === "object" && typeof process.version === "string") {
    schedule = function Promise$_Scheduler(fn) {
        process.nextTick(fn);
    };
}
else if ((typeof MutationObserver !== "undefined" &&
         (_MutationObserver = MutationObserver)) ||
         (typeof WebKitMutationObserver !== "undefined" &&
         (_MutationObserver = WebKitMutationObserver))) {
    schedule = (function() {
        var div = document.createElement("div");
        var queuedFn = void 0;
        var observer = new _MutationObserver(
            function Promise$_Scheduler() {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
            }
       );
        observer.observe(div, {
            attributes: true
        });
        return function Promise$_Scheduler(fn) {
            queuedFn = fn;
            div.classList.toggle("foo");
        };

    })();
}
else if (typeof setTimeout !== "undefined") {
    schedule = function Promise$_Scheduler(fn) {
        setTimeout(fn, 0);
    };
}
else throw new Error("no async scheduler available");
module.exports = schedule;

}).call(this,require('_process'))
},{"_process":2}],41:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
    function(Promise, PromiseArray) {
var PromiseInspection = Promise.PromiseInspection;
var util = require("./util.js");

function SettledPromiseArray(values) {
    this.constructor$(values);
}
util.inherits(SettledPromiseArray, PromiseArray);

SettledPromiseArray.prototype._promiseResolved =
function SettledPromiseArray$_promiseResolved(index, inspection) {
    this._values[index] = inspection;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

SettledPromiseArray.prototype._promiseFulfilled =
function SettledPromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    var ret = new PromiseInspection();
    ret._bitField = 268435456;
    ret._settledValue = value;
    this._promiseResolved(index, ret);
};
SettledPromiseArray.prototype._promiseRejected =
function SettledPromiseArray$_promiseRejected(reason, index) {
    if (this._isResolved()) return;
    var ret = new PromiseInspection();
    ret._bitField = 134217728;
    ret._settledValue = reason;
    this._promiseResolved(index, ret);
};

Promise.settle = function Promise$Settle(promises) {
    return new SettledPromiseArray(promises).promise();
};

Promise.prototype.settle = function Promise$settle() {
    return new SettledPromiseArray(this).promise();
};
};

},{"./util.js":47}],42:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
function(Promise, PromiseArray, apiRejection) {
var util = require("./util.js");
var RangeError = require("./errors.js").RangeError;
var AggregateError = require("./errors.js").AggregateError;
var isArray = util.isArray;


function SomePromiseArray(values) {
    this.constructor$(values);
    this._howMany = 0;
    this._unwrap = false;
    this._initialized = false;
}
util.inherits(SomePromiseArray, PromiseArray);

SomePromiseArray.prototype._init = function SomePromiseArray$_init() {
    if (!this._initialized) {
        return;
    }
    if (this._howMany === 0) {
        this._resolve([]);
        return;
    }
    this._init$(void 0, -5);
    var isArrayResolved = isArray(this._values);
    if (!this._isResolved() &&
        isArrayResolved &&
        this._howMany > this._canPossiblyFulfill()) {
        this._reject(this._getRangeError(this.length()));
    }
};

SomePromiseArray.prototype.init = function SomePromiseArray$init() {
    this._initialized = true;
    this._init();
};

SomePromiseArray.prototype.setUnwrap = function SomePromiseArray$setUnwrap() {
    this._unwrap = true;
};

SomePromiseArray.prototype.howMany = function SomePromiseArray$howMany() {
    return this._howMany;
};

SomePromiseArray.prototype.setHowMany =
function SomePromiseArray$setHowMany(count) {
    if (this._isResolved()) return;
    this._howMany = count;
};

SomePromiseArray.prototype._promiseFulfilled =
function SomePromiseArray$_promiseFulfilled(value) {
    if (this._isResolved()) return;
    this._addFulfilled(value);
    if (this._fulfilled() === this.howMany()) {
        this._values.length = this.howMany();
        if (this.howMany() === 1 && this._unwrap) {
            this._resolve(this._values[0]);
        } else {
            this._resolve(this._values);
        }
    }

};
SomePromiseArray.prototype._promiseRejected =
function SomePromiseArray$_promiseRejected(reason) {
    if (this._isResolved()) return;
    this._addRejected(reason);
    if (this.howMany() > this._canPossiblyFulfill()) {
        var e = new AggregateError();
        for (var i = this.length(); i < this._values.length; ++i) {
            e.push(this._values[i]);
        }
        this._reject(e);
    }
};

SomePromiseArray.prototype._fulfilled = function SomePromiseArray$_fulfilled() {
    return this._totalResolved;
};

SomePromiseArray.prototype._rejected = function SomePromiseArray$_rejected() {
    return this._values.length - this.length();
};

SomePromiseArray.prototype._addRejected =
function SomePromiseArray$_addRejected(reason) {
    this._values.push(reason);
};

SomePromiseArray.prototype._addFulfilled =
function SomePromiseArray$_addFulfilled(value) {
    this._values[this._totalResolved++] = value;
};

SomePromiseArray.prototype._canPossiblyFulfill =
function SomePromiseArray$_canPossiblyFulfill() {
    return this.length() - this._rejected();
};

SomePromiseArray.prototype._getRangeError =
function SomePromiseArray$_getRangeError(count) {
    var message = "Input array must contain at least " +
            this._howMany + " items but contains only " + count + " items";
    return new RangeError(message);
};

SomePromiseArray.prototype._resolveEmptyArray =
function SomePromiseArray$_resolveEmptyArray() {
    this._reject(this._getRangeError(0));
};

function Promise$_Some(promises, howMany) {
    if ((howMany | 0) !== howMany || howMany < 0) {
        return apiRejection("expecting a positive integer");
    }
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    if (promise.isRejected()) {
        return promise;
    }
    ret.setHowMany(howMany);
    ret.init();
    return promise;
}

Promise.some = function Promise$Some(promises, howMany) {
    return Promise$_Some(promises, howMany);
};

Promise.prototype.some = function Promise$some(howMany) {
    return Promise$_Some(this, howMany);
};

Promise._SomePromiseArray = SomePromiseArray;
};

},{"./errors.js":22,"./util.js":47}],43:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
function PromiseInspection(promise) {
    if (promise !== void 0) {
        this._bitField = promise._bitField;
        this._settledValue = promise.isResolved()
            ? promise._settledValue
            : void 0;
    }
    else {
        this._bitField = 0;
        this._settledValue = void 0;
    }
}

PromiseInspection.prototype.isFulfilled =
Promise.prototype.isFulfilled = function Promise$isFulfilled() {
    return (this._bitField & 268435456) > 0;
};

PromiseInspection.prototype.isRejected =
Promise.prototype.isRejected = function Promise$isRejected() {
    return (this._bitField & 134217728) > 0;
};

PromiseInspection.prototype.isPending =
Promise.prototype.isPending = function Promise$isPending() {
    return (this._bitField & 402653184) === 0;
};

PromiseInspection.prototype.value =
Promise.prototype.value = function Promise$value() {
    if (!this.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise");
    }
    return this._settledValue;
};

PromiseInspection.prototype.error =
PromiseInspection.prototype.reason =
Promise.prototype.reason = function Promise$reason() {
    if (!this.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise");
    }
    return this._settledValue;
};

PromiseInspection.prototype.isResolved =
Promise.prototype.isResolved = function Promise$isResolved() {
    return (this._bitField & 402653184) > 0;
};

Promise.PromiseInspection = PromiseInspection;
};

},{}],44:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = require("./util.js");
var canAttach = require("./errors.js").canAttach;
var errorObj = util.errorObj;
var isObject = util.isObject;

function getThen(obj) {
    try {
        return obj.then;
    }
    catch(e) {
        errorObj.e = e;
        return errorObj;
    }
}

function Promise$_Cast(obj, originalPromise) {
    if (isObject(obj)) {
        if (obj instanceof Promise) {
            return obj;
        }
        else if (isAnyBluebirdPromise(obj)) {
            var ret = new Promise(INTERNAL);
            ret._setTrace(void 0);
            obj._then(
                ret._fulfillUnchecked,
                ret._rejectUncheckedCheckError,
                ret._progressUnchecked,
                ret,
                null
            );
            ret._setFollowing();
            return ret;
        }
        var then = getThen(obj);
        if (then === errorObj) {
            if (originalPromise !== void 0 && canAttach(then.e)) {
                originalPromise._attachExtraTrace(then.e);
            }
            return Promise.reject(then.e);
        } else if (typeof then === "function") {
            return Promise$_doThenable(obj, then, originalPromise);
        }
    }
    return obj;
}

var hasProp = {}.hasOwnProperty;
function isAnyBluebirdPromise(obj) {
    return hasProp.call(obj, "_promise0");
}

function Promise$_doThenable(x, then, originalPromise) {
    var resolver = Promise.defer();
    var called = false;
    try {
        then.call(
            x,
            Promise$_resolveFromThenable,
            Promise$_rejectFromThenable,
            Promise$_progressFromThenable
        );
    } catch(e) {
        if (!called) {
            called = true;
            var trace = canAttach(e) ? e : new Error(e + "");
            if (originalPromise !== void 0) {
                originalPromise._attachExtraTrace(trace);
            }
            resolver.promise._reject(e, trace);
        }
    }
    return resolver.promise;

    function Promise$_resolveFromThenable(y) {
        if (called) return;
        called = true;

        if (x === y) {
            var e = Promise._makeSelfResolutionError();
            if (originalPromise !== void 0) {
                originalPromise._attachExtraTrace(e);
            }
            resolver.promise._reject(e, void 0);
            return;
        }
        resolver.resolve(y);
    }

    function Promise$_rejectFromThenable(r) {
        if (called) return;
        called = true;
        var trace = canAttach(r) ? r : new Error(r + "");
        if (originalPromise !== void 0) {
            originalPromise._attachExtraTrace(trace);
        }
        resolver.promise._reject(r, trace);
    }

    function Promise$_progressFromThenable(v) {
        if (called) return;
        var promise = resolver.promise;
        if (typeof promise._progress === "function") {
            promise._progress(v);
        }
    }
}

return Promise$_Cast;
};

},{"./errors.js":22,"./util.js":47}],45:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var _setTimeout = function(fn, ms) {
    var len = arguments.length;
    var arg0 = arguments[2];
    var arg1 = arguments[3];
    var arg2 = len >= 5 ? arguments[4] : void 0;
    return setTimeout(function() {
        fn(arg0, arg1, arg2);
    }, ms|0);
};

module.exports = function(Promise, INTERNAL, cast) {
var util = require("./util.js");
var errors = require("./errors.js");
var apiRejection = require("./errors_api_rejection")(Promise);
var TimeoutError = Promise.TimeoutError;

var afterTimeout = function Promise$_afterTimeout(promise, message, ms) {
    if (!promise.isPending()) return;
    if (typeof message !== "string") {
        message = "operation timed out after" + " " + ms + " ms"
    }
    var err = new TimeoutError(message);
    errors.markAsOriginatingFromRejection(err);
    promise._attachExtraTrace(err);
    promise._cancel(err);
};

var afterDelay = function Promise$_afterDelay(value, promise) {
    promise._fulfill(value);
};

var delay = Promise.delay = function Promise$Delay(value, ms) {
    if (ms === void 0) {
        ms = value;
        value = void 0;
    }
    ms = +ms;
    var maybePromise = cast(value, void 0);
    var promise = new Promise(INTERNAL);

    if (maybePromise instanceof Promise) {
        promise._propagateFrom(maybePromise, 7);
        promise._follow(maybePromise);
        return promise.then(function(value) {
            return Promise.delay(value, ms);
        });
    } else {
        promise._setTrace(void 0);
        _setTimeout(afterDelay, ms, value, promise);
    }
    return promise;
};

Promise.prototype.delay = function Promise$delay(ms) {
    return delay(this, ms);
};

function successClear(value) {
    var handle = this;
    if (handle instanceof Number) handle = +handle;
    clearTimeout(handle);
    return value;
}

function failureClear(reason) {
    var handle = this;
    if (handle instanceof Number) handle = +handle;
    clearTimeout(handle);
    throw reason;
}

Promise.prototype.timeout = function Promise$timeout(ms, message) {
    ms = +ms;

    var ret = new Promise(INTERNAL);
    ret._propagateFrom(this, 7);
    ret._follow(this);
    var handle = _setTimeout(afterTimeout, ms, ret, message, ms);
    return ret.cancellable()
              ._then(successClear, failureClear, void 0, handle, void 0);
};

};

},{"./errors.js":22,"./errors_api_rejection":23,"./util.js":47}],46:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function (Promise, apiRejection, cast) {
    var TypeError = require("./errors.js").TypeError;
    var inherits = require("./util.js").inherits;
    var PromiseInspection = Promise.PromiseInspection;

    function inspectionMapper(inspections) {
        var len = inspections.length;
        for (var i = 0; i < len; ++i) {
            var inspection = inspections[i];
            if (inspection.isRejected()) {
                return Promise.reject(inspection.error());
            }
            inspections[i] = inspection.value();
        }
        return inspections;
    }

    function thrower(e) {
        setTimeout(function(){throw e;}, 0);
    }

    function castPreservingDisposable(thenable) {
        var maybePromise = cast(thenable, void 0);
        if (maybePromise !== thenable &&
            typeof thenable._isDisposable === "function" &&
            typeof thenable._getDisposer === "function" &&
            thenable._isDisposable()) {
            maybePromise._setDisposable(thenable._getDisposer());
        }
        return maybePromise;
    }
    function dispose(resources, inspection) {
        var i = 0;
        var len = resources.length;
        var ret = Promise.defer();
        function iterator() {
            if (i >= len) return ret.resolve();
            var maybePromise = castPreservingDisposable(resources[i++]);
            if (maybePromise instanceof Promise &&
                maybePromise._isDisposable()) {
                try {
                    maybePromise = cast(maybePromise._getDisposer()
                                        .tryDispose(inspection), void 0);
                } catch (e) {
                    return thrower(e);
                }
                if (maybePromise instanceof Promise) {
                    return maybePromise._then(iterator, thrower,
                                              null, null, null);
                }
            }
            iterator();
        }
        iterator();
        return ret.promise;
    }

    function disposerSuccess(value) {
        var inspection = new PromiseInspection();
        inspection._settledValue = value;
        inspection._bitField = 268435456;
        return dispose(this, inspection).thenReturn(value);
    }

    function disposerFail(reason) {
        var inspection = new PromiseInspection();
        inspection._settledValue = reason;
        inspection._bitField = 134217728;
        return dispose(this, inspection).thenThrow(reason);
    }

    function Disposer(data, promise) {
        this._data = data;
        this._promise = promise;
    }

    Disposer.prototype.data = function Disposer$data() {
        return this._data;
    };

    Disposer.prototype.promise = function Disposer$promise() {
        return this._promise;
    };

    Disposer.prototype.resource = function Disposer$resource() {
        if (this.promise().isFulfilled()) {
            return this.promise().value();
        }
        return null;
    };

    Disposer.prototype.tryDispose = function(inspection) {
        var resource = this.resource();
        var ret = resource !== null
            ? this.doDispose(resource, inspection) : null;
        this._promise._unsetDisposable();
        this._data = this._promise = null;
        return ret;
    };

    Disposer.isDisposer = function Disposer$isDisposer(d) {
        return (d != null &&
                typeof d.resource === "function" &&
                typeof d.tryDispose === "function");
    };

    function FunctionDisposer(fn, promise) {
        this.constructor$(fn, promise);
    }
    inherits(FunctionDisposer, Disposer);

    FunctionDisposer.prototype.doDispose = function (resource, inspection) {
        var fn = this.data();
        return fn.call(resource, resource, inspection);
    };

    Promise.using = function Promise$using() {
        var len = arguments.length;
        if (len < 2) return apiRejection(
                        "you must pass at least 2 arguments to Promise.using");
        var fn = arguments[len - 1];
        if (typeof fn !== "function") return apiRejection("fn must be a function");
        len--;
        var resources = new Array(len);
        for (var i = 0; i < len; ++i) {
            var resource = arguments[i];
            if (Disposer.isDisposer(resource)) {
                var disposer = resource;
                resource = resource.promise();
                resource._setDisposable(disposer);
            }
            resources[i] = resource;
        }

        return Promise.settle(resources)
            .then(inspectionMapper)
            .spread(fn)
            ._then(disposerSuccess, disposerFail, void 0, resources, void 0);
    };

    Promise.prototype._setDisposable =
    function Promise$_setDisposable(disposer) {
        this._bitField = this._bitField | 262144;
        this._disposer = disposer;
    };

    Promise.prototype._isDisposable = function Promise$_isDisposable() {
        return (this._bitField & 262144) > 0;
    };

    Promise.prototype._getDisposer = function Promise$_getDisposer() {
        return this._disposer;
    };

    Promise.prototype._unsetDisposable = function Promise$_unsetDisposable() {
        this._bitField = this._bitField & (~262144);
        this._disposer = void 0;
    };

    Promise.prototype.disposer = function Promise$disposer(fn) {
        if (typeof fn === "function") {
            return new FunctionDisposer(fn, this);
        }
        throw new TypeError();
    };

};

},{"./errors.js":22,"./util.js":47}],47:[function(require,module,exports){
/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var es5 = require("./es5.js");
var haveGetters = (function(){
    try {
        var o = {};
        es5.defineProperty(o, "f", {
            get: function () {
                return 3;
            }
        });
        return o.f === 3;
    }
    catch (e) {
        return false;
    }

})();
var canEvaluate = typeof navigator == "undefined";
var errorObj = {e: {}};
function tryCatch1(fn, receiver, arg) {
    try { return fn.call(receiver, arg); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch2(fn, receiver, arg, arg2) {
    try { return fn.call(receiver, arg, arg2); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch3(fn, receiver, arg, arg2, arg3) {
    try { return fn.call(receiver, arg, arg2, arg3); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch4(fn, receiver, arg, arg2, arg3, arg4) {
    try { return fn.call(receiver, arg, arg2, arg3, arg4); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatchApply(fn, args, receiver) {
    try { return fn.apply(receiver, args); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

var inherits = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call(Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
           ) {
                this[propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};

function asString(val) {
    return typeof val === "string" ? val : ("" + val);
}

function isPrimitive(val) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function isObject(value) {
    return !isPrimitive(value);
}

function maybeWrapAsError(maybeError) {
    if (!isPrimitive(maybeError)) return maybeError;

    return new Error(asString(maybeError));
}

function withAppended(target, appendee) {
    var len = target.length;
    var ret = new Array(len + 1);
    var i;
    for (i = 0; i < len; ++i) {
        ret[i] = target[i];
    }
    ret[i] = appendee;
    return ret;
}

function getDataPropertyOrDefault(obj, key, defaultValue) {
    if (es5.isES5) {
        var desc = Object.getOwnPropertyDescriptor(obj, key);
        if (desc != null) {
            return desc.get == null && desc.set == null
                    ? desc.value
                    : defaultValue;
        }
    } else {
        return {}.hasOwnProperty.call(obj, key) ? obj[key] : void 0;
    }
}

function notEnumerableProp(obj, name, value) {
    if (isPrimitive(obj)) return obj;
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
}


var wrapsPrimitiveReceiver = (function() {
    return this !== "string";
}).call("string");

function thrower(r) {
    throw r;
}

var inheritedDataKeys = (function() {
    if (es5.isES5) {
        return function(obj, opts) {
            var ret = [];
            var visitedKeys = Object.create(null);
            var getKeys = Object(opts).includeHidden
                ? Object.getOwnPropertyNames
                : Object.keys;
            while (obj != null) {
                var keys;
                try {
                    keys = getKeys(obj);
                } catch (e) {
                    return ret;
                }
                for (var i = 0; i < keys.length; ++i) {
                    var key = keys[i];
                    if (visitedKeys[key]) continue;
                    visitedKeys[key] = true;
                    var desc = Object.getOwnPropertyDescriptor(obj, key);
                    if (desc != null && desc.get == null && desc.set == null) {
                        ret.push(key);
                    }
                }
                obj = es5.getPrototypeOf(obj);
            }
            return ret;
        };
    } else {
        return function(obj) {
            var ret = [];
            /*jshint forin:false */
            for (var key in obj) {
                ret.push(key);
            }
            return ret;
        };
    }

})();

function isClass(fn) {
    try {
        if (typeof fn === "function") {
            var keys = es5.keys(fn.prototype);
            return keys.length > 0 &&
                   !(keys.length === 1 && keys[0] === "constructor");
        }
        return false;
    } catch (e) {
        return false;
    }
}

function toFastProperties(obj) {
    /*jshint -W027*/
    function f() {}
    f.prototype = obj;
    return f;
    eval(obj);
}

var rident = /^[a-z$_][a-z$_0-9]*$/i;
function isIdentifier(str) {
    return rident.test(str);
}

function filledRange(count, prefix, suffix) {
    var ret = new Array(count);
    for(var i = 0; i < count; ++i) {
        ret[i] = prefix + i + suffix;
    }
    return ret;
}

var ret = {
    isClass: isClass,
    isIdentifier: isIdentifier,
    inheritedDataKeys: inheritedDataKeys,
    getDataPropertyOrDefault: getDataPropertyOrDefault,
    thrower: thrower,
    isArray: es5.isArray,
    haveGetters: haveGetters,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    canEvaluate: canEvaluate,
    errorObj: errorObj,
    tryCatch1: tryCatch1,
    tryCatch2: tryCatch2,
    tryCatch3: tryCatch3,
    tryCatch4: tryCatch4,
    tryCatchApply: tryCatchApply,
    inherits: inherits,
    withAppended: withAppended,
    asString: asString,
    maybeWrapAsError: maybeWrapAsError,
    wrapsPrimitiveReceiver: wrapsPrimitiveReceiver,
    toFastProperties: toFastProperties,
    filledRange: filledRange
};

module.exports = ret;

},{"./es5.js":24}],48:[function(require,module,exports){
/*jslint node:true*/
/*globals RTCPeerConnection, mozRTCPeerConnection, webkitRTCPeerConnection */
/*globals RTCSessionDescription, mozRTCSessionDescription */
/*globals RTCIceCandidate, mozRTCIceCandidate */
'use strict';

var myRTCPeerConnection = null;
var myRTCSessionDescription = null;
var myRTCIceCandidate = null;

var renameIceURLs = function (config) {
  if (!config) {
    return;
  }
  if (!config.iceServers) {
    return config;
  }
  config.iceServers.forEach(function (server) {
    server.url = server.urls;
    delete server.urls;
  });
  return config;
};

var fixChromeStatsResponse = function(response) {
  var standardReport = {};
  var reports = response.result();
  reports.forEach(function(report) {
    var standardStats = {
      id: report.id,
      timestamp: report.timestamp,
      type: report.type
    };
    report.names().forEach(function(name) {
      standardStats[name] = report.stat(name);
    });
    standardReport[standardStats.id] = standardStats;
  });

  return standardReport;
};

var sessionHasData = function(desc) {
  if (!desc) {
    return false;
  }
  var hasData = false;
  var prefix = 'm=application';
  desc.sdp.split('\n').forEach(function(line) {
    if (line.slice(0, prefix.length) === prefix) {
      hasData = true;
    }
  });
  return hasData;
};

// Unify PeerConnection Object.
if (typeof RTCPeerConnection !== 'undefined') {
  myRTCPeerConnection = RTCPeerConnection;
} else if (typeof mozRTCPeerConnection !== 'undefined') {
  myRTCPeerConnection = function (configuration, constraints) {
    // Firefox uses 'url' rather than 'urls' for RTCIceServer.urls
    var pc = new mozRTCPeerConnection(renameIceURLs(configuration), constraints);

    // Firefox doesn't fire 'onnegotiationneeded' when a data channel is created
    // https://bugzilla.mozilla.org/show_bug.cgi?id=840728
    var dataEnabled = false;
    var boundCreateDataChannel = pc.createDataChannel.bind(pc);
    pc.createDataChannel = function(label, dataChannelDict) {
      var dc = boundCreateDataChannel(label, dataChannelDict);
      if (!dataEnabled) {
        dataEnabled = true;
        if (pc.onnegotiationneeded &&
            !sessionHasData(pc.localDescription) &&
            !sessionHasData(pc.remoteDescription)) {
          var event = new Event('negotiationneeded');
          pc.onnegotiationneeded(event);
        }
      }
      return dc;
    };

    return pc;
  };
} else if (typeof webkitRTCPeerConnection !== 'undefined') {
  // Chrome returns a nonstandard, non-JSON-ifiable response from getStats.
  myRTCPeerConnection = function(configuration, constraints) {
    var pc = new webkitRTCPeerConnection(configuration, constraints);
    var boundGetStats = pc.getStats.bind(pc);
    pc.getStats = function(selector, successCallback, failureCallback) {
      var successCallbackWrapper = function(chromeStatsResponse) {
        successCallback(fixChromeStatsResponse(chromeStatsResponse));
      };
      // Chrome also takes its arguments in the wrong order.
      boundGetStats(successCallbackWrapper, failureCallback, selector);
    };
    return pc;
  };
}

// Unify SessionDescrption Object.
if (typeof RTCSessionDescription !== 'undefined') {
  myRTCSessionDescription = RTCSessionDescription;
} else if (typeof mozRTCSessionDescription !== 'undefined') {
  myRTCSessionDescription = mozRTCSessionDescription;
}

// Unify IceCandidate Object.
if (typeof RTCIceCandidate !== 'undefined') {
  myRTCIceCandidate = RTCIceCandidate;
} else if (typeof mozRTCIceCandidate !== 'undefined') {
  myRTCIceCandidate = mozRTCIceCandidate;
}

exports.RTCPeerConnection = myRTCPeerConnection;
exports.RTCSessionDescription = myRTCSessionDescription;
exports.RTCIceCandidate = myRTCIceCandidate;

},{}],49:[function(require,module,exports){
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
},{}]},{},[5])(5)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcQmFrYVxcQXBwRGF0YVxcUm9hbWluZ1xcbnBtXFxub2RlX21vZHVsZXNcXGJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3Nlci1wYWNrXFxfcHJlbHVkZS5qcyIsIkM6XFxVc2Vyc1xcQmFrYVxcQXBwRGF0YVxcUm9hbWluZ1xcbnBtXFxub2RlX21vZHVsZXNcXGJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcZXZlbnRzXFxldmVudHMuanMiLCJDOlxcVXNlcnNcXEJha2FcXEFwcERhdGFcXFJvYW1pbmdcXG5wbVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXHByb2Nlc3NcXGJyb3dzZXIuanMiLCJpbnRlcmZhY2VcXGJyb2FkY2FzdERlZmluaXRpb24uanMiLCJpbnRlcmZhY2VcXG1lbWJlcnNoaXAuanMiLCJsaWJcXG5ldHdvcmsuanMiLCJsaWJcXHByaW1pdGl2ZUJyb2FkY2FzdERlZmluaXRpb24uanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbGliXFxjeWNsb24uanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxsaWJcXEFkZHJlc3MuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxsaWJcXE1FU1NBR0VfVFlQRS5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXGxpYlxcUGVlci5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXGxpYlxcUGVlckNhY2hlLmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbGliXFxoYW5kc2hha2UuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcYW55LmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXGFzeW5jLmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXGJsdWViaXJkLmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXGNhbGxfZ2V0LmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXGNhbmNlbC5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxjYXB0dXJlZF90cmFjZS5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxjYXRjaF9maWx0ZXIuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcZGlyZWN0X3Jlc29sdmUuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcZWFjaC5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxlcnJvcnMuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcZXJyb3JzX2FwaV9yZWplY3Rpb24uanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcZXM1LmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXGZpbHRlci5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxmaW5hbGx5LmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXGdlbmVyYXRvcnMuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcam9pbi5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxtYXAuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcbm9kZWlmeS5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxwcm9ncmVzcy5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxwcm9taXNlLmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXHByb21pc2VfYXJyYXkuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxccHJvbWlzZV9yZXNvbHZlci5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxwcm9taXNpZnkuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxccHJvcHMuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxccXVldWUuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxccmFjZS5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFxyZWR1Y2UuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcc2NoZWR1bGUuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcc2V0dGxlLmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXHNvbWUuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcc3luY2hyb25vdXNfaW5zcGVjdGlvbi5qcyIsIm5vZGVfbW9kdWxlc1xcY3ljbG9ucDJwXFxub2RlX21vZHVsZXNcXGhhbmRzaGFrZS13ZWJydGNcXG5vZGVfbW9kdWxlc1xcYmx1ZWJpcmRcXGpzXFxtYWluXFx0aGVuYWJsZXMuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXGJsdWViaXJkXFxqc1xcbWFpblxcdGltZXJzLmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXHVzaW5nLmpzIiwibm9kZV9tb2R1bGVzXFxjeWNsb25wMnBcXG5vZGVfbW9kdWxlc1xcaGFuZHNoYWtlLXdlYnJ0Y1xcbm9kZV9tb2R1bGVzXFxibHVlYmlyZFxcanNcXG1haW5cXHV0aWwuanMiLCJub2RlX21vZHVsZXNcXGN5Y2xvbnAycFxcbm9kZV9tb2R1bGVzXFxoYW5kc2hha2Utd2VicnRjXFxub2RlX21vZHVsZXNcXHdlYnJ0Yy1hZGFwdGVyXFxhZGFwdGVyLmpzIiwibm9kZV9tb2R1bGVzXFx5dXRpbHNcXHl1dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25KQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFrQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhbk11dGF0aW9uT2JzZXJ2ZXIgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5NdXRhdGlvbk9ic2VydmVyO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIHZhciBxdWV1ZSA9IFtdO1xuXG4gICAgaWYgKGNhbk11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgICAgdmFyIGhpZGRlbkRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBxdWV1ZUxpc3QgPSBxdWV1ZS5zbGljZSgpO1xuICAgICAgICAgICAgcXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIHF1ZXVlTGlzdC5mb3JFYWNoKGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZShoaWRkZW5EaXYsIHsgYXR0cmlidXRlczogdHJ1ZSB9KTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIGlmICghcXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaGlkZGVuRGl2LnNldEF0dHJpYnV0ZSgneWVzJywgJ25vJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iLCIvKipcclxuICogQ3JlYXRlZCBieSBKdWxpYW4gb24gMTIvMTgvMjAxNC5cclxuICovXHJcbmV4cG9ydHMuSW50ZXJmYWNlID0gW1xyXG5cclxuICAgIC8qXHJcbiAgICBnZXRzIGNhbGxlZCB3aGVuIGEgYnJvYWRjYXN0IG1lc3NhZ2UgcmVhY2hlcyB0aGlzIG5vZGUuXHJcbiAgICB0aGlzIGZ1bmN0aW9uIGV2YWx1YXRlcyBpZiB0aGUgbm9kZSBzaG91bGQgcHJvcGFnYXRlIHRoZSBtZXNzYWdlIGZ1cnRoZXIgb3IgaWYgaXQgc2hvdWxkIHN0b3BcclxuICAgIHNlbmRpbmcgaXQuIFRoaXMgaXMgZGVmaW5lZCBieSBlaXRoZXIgcmV0dXJuaW5nIHt0cnVlfSAoU3RvcCkgb3Ige2ZhbHNlfSAoS2VlcCBwcm9wYWdhdGluZylcclxuICAgICovXHJcbiAgICBcInN0b3BQcm9wYWdhdGlvblwiLFxyXG5cclxuICAgIC8qXHJcbiAgICBiZWZvcmUgYSBtZXNzYWdlIGlzIGJyb2FkY2FzdCwgaXQgZ2V0cyBkZWNvcmF0ZWQgYnkgdGhlIEJyb2FkY2FzdCBkZWZpbml0aW9uLlxyXG4gICAgSGVyZSB3ZSBjYW4gYWRkIGFkZGl0aW9uYWwgdmFsdWVzLlxyXG4gICAgVGhpcyBmdW5jdGlvbiBvbmx5IGdldHMgY2FsbGVkIHdoZW4gYSBwZWVyIHN0YXJ0cyBhIE5FVyBCUk9BRENBU1QuIEl0IHdpbGwgbm90IGJlIGNhbGxlZCB3aGVuIGFcclxuICAgIHBlZXIgc2ltcGx5IHByb3BhZ2F0ZXMgYW5vdGhlciBwZWVycyBicm9hZGNhc3QuXHJcbiAgICAqL1xyXG4gICAgXCJkZWNvcmF0ZUJyb2FkY2FzdE1lc3NhZ2VcIixcclxuXHJcbiAgICAvKlxyXG4gICAgUmVtb3ZlIHRoZSBkZWNvcmF0aW9uIG9mIHRoZSBtZXNzYWdlIHNvIHRoYXQgdGhlIGFwcGxpY2F0aW9uIGNhbiBpbnRlcmFjdCB3aXRoIHRoZSBicm9hZGNhc3QgbWVzc2FnZVxyXG4gICAgdHJhbnNwYXJlbnRseS4gVGhpcyBnZXRzIGNhbGxlZCB3aGVuZXZlciBhIGJyb2FkY2FzdCBtZXNzYWdlIGhpdHMgYSBwZWVyIGFuZCBpcyBwcm9wYWdhdGVkIHRvIHRoZSBhcHBsaWNhdGlvbi5cclxuICAgICAqL1xyXG4gICAgXCJyZW1vdmVEZWNvcmF0aW9uXCJcclxuXTsiLCIvKipcclxuICogQ3JlYXRlZCBieSBKdWxpYW4gb24gMTIvMTgvMjAxNC5cclxuICovXHJcbmV4cG9ydHMuSW50ZXJmYWNlID0gW1xyXG5cclxuICAgIC8qXHJcbiAgICBTdGFydHMgdGhlIEhhbmRzaGFraW5nLiBUaGlzIG11c3QgYmUgZG9uZSBvbmNlIHRvIGNvbm5lY3QgdG8gdGhlIG5ldHdvcmsuIHtsYXVuY2h9IHRha2VzIGEgY2FsbGJhY2tcclxuICAgIGFzIHBhcmFtZXRlciB0aGF0IGdldHMgY2FsbGVkIHdoZW4gdGhlIElDRS1DYW5kaWRhdGVzIGFyZSBnYXRoZXJlZC5cclxuICAgIFRoZSB7b2ZmZXJ9IHRoYXQgaXMgY3JlYXRlZCBtdXN0IGJlIHRyYW5zbWl0dGVkIHRvIHRoZSBvdGhlciBwZWVyIChIb3cgdGhpcyBpcyBkb25lIGlzIG91dCBvZiB0aGUgc2NvcGVcclxuICAgIG9mIHRoaXMgbGlicmFyeSkgaW4gb3JkZXIgdG8gaW5pdGlhdGUgdGhlIGhhbmRzaGFrZS5cclxuICAgICAqL1xyXG4gICAgXCJsYXVuY2hcIixcclxuXHJcbiAgICAvKlxyXG4gICAgSW1wbGVtZW50IHtldmVudC5FdmVudEVtaXR0ZXJ9XHJcbiAgICBXZSBleHBlY3QgdGhlIGZvbGxvd2luZyBldmVudHM6XHJcbiAgICAgICAge3N0YXRlY2hhbmdlfTogYXBwbGllcyB3aGVuIHRoZSBzdGF0ZSBjaGFuZ2VzOiBAcGFyYW1zID0gW1wiZGlzY29ubmVjdFwiLCBcInBhcnRpYWxcIiwgXCJjb25uZWN0XCJdXHJcbiAgICAgICAge3JlY2VpdmV9OiBtZXNzYWdlIGlzIHNlbmQ6IEBwYXJhbXMgPSAoc2VuZGVyIHtQZWVyfSwgbWVzc2FnZSB7T2JqZWN0fHxTdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIFwib25cIixcclxuXHJcbiAgICAvKlxyXG4gICAgVGhpcyBpcyB0aGUgZmluYWwgaGFuZHNoYWtlLWZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgYWZ0ZXIgYW4gYW5zd2VyIGlzIHJlY2VpdmVkXHJcbiAgICAgKi9cclxuICAgIFwiaGFuZHNoYWtlXCIsXHJcblxyXG4gICAgLypcclxuICAgIFBlZXItU2FtcGxpbmctU2VydmljZS1mdW5jdGlvbi4gV2hlbiBwcm92aWRlZCB3aXRoIGEgcGFyYW1ldGVyIG4sIGEgZ2l2ZW4gbnVtYmVyIG9mIHJhbmRvbWx5XHJcbiAgICBzYW1wbGVkIHBlZXJzIGlzIHJldHVybmVkLCBvdGhlcndpc2UgdGhlIHdob2xlIFBhcnRpYWxWaWV3IG9mIHRoZSBSUFMgaXMgcmV0dXJuZWQuXHJcbiAgICBUaGUgcmV0dXJuZWQgdmFsdWUgc2hvdWxkIGJlIGEgbGlzdCBvZiBPYmplY3RzIHRoYXQgaGF2ZSBhIFwic2VuZFwiLSBmdW5jdGlvbiB0byBzZW5kIGRhdGEgdG8gdGhlIHBlZXJzLlxyXG4gICAgICovXHJcbiAgICBcImdldFBlZXJzXCIsXHJcblxyXG4gICAgLypcclxuICAgIFVwb24gcmVjZWl2aW5nIGFuIG9mZmVyIGZyb20ge2xhdW5jaH0gdGhyb3VnaCB0aGUgc2lnbmFsaW5nIHNlcnZpY2UgdGhlIHBlZXIgY3JlYXRlcyBhIGZpdHRpbmcgYW5zd2VyLlxyXG4gICAgVGhpcyBhbnN3ZXIgaXMgcHJvcGFnYXRlZCB0byB0aGUgYXBwbGljYXRpb24gd2l0aCBhIGNhbGxiYWNrIHRoYXQgbXVzdCBiZSBwcm92aWRlZCB0byB0aGlzIGZ1bmN0aW9uLlxyXG4gICAgVGhlIGFuc3dlciBtdXN0IGJlIHNlbmQgYmFjayB0byB0aGUgY29tbXVuaWNhdGlvbiBpbml0aWF0b3IuXHJcbiAgICAgKi9cclxuICAgIFwiYW5zd2VyXCIsXHJcblxyXG4gICAgLypcclxuICAgIFRoaXMgZnVuY3Rpb24gY2hlY2tzIGlmIHRoZSBtZW1iZXJzaGlwIHByb3RvY29sIGlzIGFscmVhZHkgY29ubmVjdGVkIHRvIHRoZSBuZXR3b3JrIGFuZCBpcyBcInJlYWR5XCIgb3IgaWZcclxuICAgIHRoZSBoYW5kc2hha2UgaXMgc3RpbGwgcGVuZGluZy5cclxuICAgIFRoZSBwYXJhbWV0ZXIgaXMgYSBjYWxsYmFjayB0aGF0IGdldHMgY2FsbGVkIGFzIHNvb24gYXMgdGhlIHBlZXIgaXMgY29ubmVjdGVkIHRvIHRoZSBuZXR3b3JrLlxyXG4gICAgVGhpcyBmdW5jdGlvbiBtdXN0IGFwcGx5IHRoZSBjYWxsYmFjayBpbW1lZGlhdGVseSwgaWYgaXQgaXMgcmVhZHkhXHJcblxyXG4gICAgdmFyIG1lbWJlcnNoaXAgPSBuZXcgTWVtYmVyc2hpcCguLi4pO1xyXG5cclxuICAgIG1lbWJlcnNoaXAucmVhZHkoZnVuY3Rpb24oKXtcclxuICAgICAgICAvLyBUaGUgbWVtYmVyc2hpcCBzeXN0ZW0gaXMgcmVhZHkgYW5kIGNhbiBiZSB1c2VkXHJcbiAgICB9KTtcclxuXHJcbiAgICAgKi9cclxuICAgIFwicmVhZHlcIlxyXG5cclxuXTsiLCIvKipcclxuICogQ3JlYXRlZCBieSBKdWxpYW4gb24gMTIvMTgvMjAxNC5cclxuICovXHJcbnZhciBVdGlscyA9IHJlcXVpcmUoXCJ5dXRpbHNcIik7XHJcbnZhciBCcm9hZGNhc3REZWZpbml0aW9uID0gcmVxdWlyZShcIi4vLi4vaW50ZXJmYWNlL2Jyb2FkY2FzdERlZmluaXRpb24uanNcIikuSW50ZXJmYWNlO1xyXG52YXIgTWVtYmVyc2hpcCA9IHJlcXVpcmUoXCIuLy4uL2ludGVyZmFjZS9tZW1iZXJzaGlwLmpzXCIpLkludGVyZmFjZTtcclxudmFyIFByaW1pdGl2ZUJyb2FkY2FzdERlZiA9IHJlcXVpcmUoXCIuL3ByaW1pdGl2ZUJyb2FkY2FzdERlZmluaXRpb24uanNcIikuRGVmO1xyXG4vL3ZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudC1lbWl0dGVyJyk7XHJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XHJcblxyXG52YXIgQ3ljbG9uID0gcmVxdWlyZShcImN5Y2xvbnAycFwiKS5DbGFzcztcclxuXHJcbi8qKlxyXG4gKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbnZhciBOZXR3b3JrID0gZnVuY3Rpb24gKGJkZWYsIG1lbWJlcnNoaXApIHtcclxuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xyXG5cclxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBpbnRlcmZhY2VzIGFyZSBpbXBsZW1lbnRlZCBjb3JyZWN0bHlcclxuICAgIGlmICghVXRpbHMuaW1wbGVtZW50cyhiZGVmLCBCcm9hZGNhc3REZWZpbml0aW9uKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInRoZSBCcm9hZGNhc3QtRGVmaW5pdGlvbiBtdXN0IGRlZmluZSB0aGUgY29ycmVjdCBpbnRlcmZhY2UhIChcIiArXHJcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KEJyb2FkY2FzdERlZmluaXRpb24pICsgXCIpXCIpO1xyXG4gICAgfVxyXG4gICAgaWYgKCFVdGlscy5pbXBsZW1lbnRzKG1lbWJlcnNoaXAsIE1lbWJlcnNoaXApKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidGhlIE1lbWJlcnNoaXAgbXVzdCBkZWZpbmUgdGhlIGNvcnJlY3QgaW50ZXJmYWNlISAoXCIgK1xyXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShNZW1iZXJzaGlwKSArIFwiKVwiKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9icm9hZGNhc3REZWZpbml0aW9uID0gYmRlZjtcclxuICAgIHRoaXMuX21lbWJlcnNoaXAgPSBtZW1iZXJzaGlwO1xyXG5cclxuICAgIC8vIGxpc3Rlbi4uXHJcbn07XHJcblV0aWxzLmluaGVyaXQoTmV0d29yaywgRXZlbnRFbWl0dGVyKTtcclxuXHJcbi8qKlxyXG4gKlxyXG4gKiBAcGFyYW0gY2FsbGJhY2tcclxuICogQHJldHVybnMge05ldHdvcmt9XHJcbiAqL1xyXG5OZXR3b3JrLnByb3RvdHlwZS5yZWFkeSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLl9tZW1iZXJzaGlwLnJlYWR5KGNhbGxiYWNrKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgYSBicm9hZGNhc3QgdG8gdGhlIG5ldHdvcmtcclxuICogQHBhcmFtIG1zZ1xyXG4gKi9cclxuTmV0d29yay5wcm90b3R5cGUuYnJvYWRjYXN0ID0gZnVuY3Rpb24obXNnKSB7XHJcbiAgICB2YXIgcGVlcnMgPSB0aGlzLl9tZW1iZXJzaGlwLmdldFBlZXJzKCk7XHJcbiAgICB2YXIgaSA9IDAsIEwgPSBwZWVycy5sZW5ndGg7XHJcbiAgICBmb3IgKDtpPEw7aSsrKSB7XHJcbiAgICAgICAgcGVlcnNbaV0uc2VuZChtc2cpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNlbmRzIGEgcmFuZG9tIHVuaWNhc3QgdG8gdGhlIG5ldHdvcmtcclxuICogQHBhcmFtIG1zZ1xyXG4gKi9cclxuTmV0d29yay5wcm90b3R5cGUudW5pY2FzdCA9IGZ1bmN0aW9uIChtc2cpIHtcclxuICAgIHZhciBwZWVycyA9IHRoaXMuX21lbWJlcnNoaXAuZ2V0UGVlcnMoMSk7XHJcbiAgICBpZiAocGVlcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHBlZXJzWzBdLnNlbmQobXNnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKFwiY2Fubm90IHVuaWNhc3Q6IG5vIHBlZXIgaXMgYXZhaWxhYmxlIVwiKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiByZXR1cm4gdGhlIGN1cnJlbnQgbWVtYmVyc2hpcCBwcm90b2NvbFxyXG4gKi9cclxuTmV0d29yay5wcm90b3R5cGUubWVtYmVyc2hpcCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB0aGlzLl9tZW1iZXJzaGlwO1xyXG59O1xyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gKiAgICAgICAgICAgICAgQSBQIEkgICAgICAgICAgICAgICAqXHJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbi8qKlxyXG4gKlxyXG4gKiBAcGFyYW0gb3B0aW9ucyB7T2JqZWN0fVxyXG4gKiB7XHJcbiAqICAgICAgYnJvYWRjYXN0RGVmaW5pdGlvbjoge2Jyb2FkY2FzdERlZmluaXRpb259LFxyXG4gKiAgICAgIG1lbWJlcnNoaXA6IHttZW1iZXJzaGlwfVxyXG4gKiB9XHJcbiAqIEByZXR1cm5zIHtOZXR3b3JrfVxyXG4gKi9cclxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuICAgIHZhciBiZGVmLCBtZW1iZXJzaGlwO1xyXG5cclxuICAgIC8vIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVsZWdhbnQuLlxyXG4gICAgaWYgKFV0aWxzLmlzRGVmaW5lZChvcHRpb25zKSkge1xyXG4gICAgICAgIGJkZWYgPSBvcHRpb25zLmJyb2FkY2FzdERlZmluaXRpb24gfHwgbmV3IFByaW1pdGl2ZUJyb2FkY2FzdERlZigpO1xyXG4gICAgICAgIG1lbWJlcnNoaXAgPSBvcHRpb25zLm1lbWJlcnNoaXAgfHwgbmV3IEN5Y2xvbigpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBiZGVmID0gbmV3IFByaW1pdGl2ZUJyb2FkY2FzdERlZigpO1xyXG4gICAgICAgIG1lbWJlcnNoaXAgPSBuZXcgQ3ljbG9uKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG5ldyBOZXR3b3JrKGJkZWYsIG1lbWJlcnNoaXApO1xyXG59OyIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IEp1bGlhbiBvbiAxMi8xOC8yMDE0LlxyXG4gKi9cclxudmFyIFV0aWxzID0gcmVxdWlyZShcInl1dGlsc1wiKTtcclxuXHJcbi8qKlxyXG4gKiBUaGlzIGlzIGEgdmVyeSBzaW1wbGUgYXBwcm9hY2guIEl0IHRha2VzIGEgdW5pcXVlIHZhbHVlIGZvciBwZWVyIGFuZCBhIGNvdW50ZXIgdG8gZGlzdGluZ3Vpc2ggYSBtZXNzYWdlLlxyXG4gKiBUaGlzIHNvbHV0aW9uIGdyb3dzIHdpdGhvdXQgYm91bmRzIVxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIFByaW1pdGl2ZUJyb2FkY2FzdERlZmluaXRpb24oKSB7XHJcbiAgICB0aGlzLmNhY2hlID0ge307XHJcbiAgICB0aGlzLmNvdW50ZXIgPSAwO1xyXG4gICAgdGhpcy5hZGRyZXNzID0gVXRpbHMuZ3VpZCgpOyAvLyBwc2V1ZG8tdW5pcXVlLi5cclxufVxyXG5cclxuLyoqXHJcbiAqIGdldHMgY2FsbGVkIHdoZW4gYSBicm9hZGNhc3QgbWVzc2FnZSByZWFjaGVzIHRoaXMgbm9kZS5cclxuICogdGhpcyBmdW5jdGlvbiBldmFsdWF0ZXMgaWYgdGhlIG5vZGUgc2hvdWxkIHByb3BhZ2F0ZSB0aGUgbWVzc2FnZSBmdXJ0aGVyIG9yIGlmIGl0IHNob3VsZCBzdG9wXHJcbiAqIHNlbmRpbmcgaXQuIFRoaXMgaXMgZGVmaW5lZCBieSBlaXRoZXIgcmV0dXJuaW5nIHt0cnVlfSAoU3RvcCkgb3Ige2ZhbHNlfSAoS2VlcCBwcm9wYWdhdGluZylcclxuICogQHBhcmFtIG1lc3NhZ2Uge0RlY29yYXRlZE1lc3NhZ2V9IHRoZSBtZXNzYWdlIGdvdCBkZWNvcmF0ZWQgZm9ybSB0aGUgb3RoZXIgcGVlcnNcclxuICovXHJcblByaW1pdGl2ZUJyb2FkY2FzdERlZmluaXRpb24ucHJvdG90eXBlLnN0b3BQcm9wYWdhdGlvbiA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XHJcbiAgICBpZiAobWVzc2FnZS5rZXkgaW4gdGhpcy5jYWNoZSkge1xyXG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBTVE9QIFBST1BBR0FUSU9OXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuY2FjaGVbbWVzc2FnZS5rZXldID0gdHJ1ZTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIEtFRVAgT04gUFJPUEFHQVRJTkdcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBiZWZvcmUgYSBtZXNzYWdlIGlzIGJyb2FkY2FzdGVkLCBpdCBnZXRzIGRlY29yYXRlZCBieSB0aGUgQnJvYWRjYXN0IGRlZmluaXRpb24uXHJcbiAqIEhlcmUgd2UgY2FuIGFkZCBhZGRpdGlvbmFsIHZhbHVlcy5cclxuICogVGhpcyBmdW5jdGlvbiBvbmx5IGdldHMgY2FsbGVkIHdoZW4gYSBwZWVyIHN0YXJ0cyBhIE5FVyBCUk9BRENBU1QuIEl0IHdpbGwgbm90IGJlIGNhbGxlZCB3aGVuIGFcclxuICogcGVlciBzaW1wbHkgcHJvcGFnYXRlcyBhbm90aGVyIHBlZXJzIGJyb2FkY2FzdC5cclxuICogQHBhcmFtIG1lc3NhZ2VcclxuICovXHJcblByaW1pdGl2ZUJyb2FkY2FzdERlZmluaXRpb24ucHJvdG90eXBlLmRlY29yYXRlQnJvYWRjYXN0TWVzc2FnZSA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XHJcbiAgICB2YXIga2V5ID0gdGhpcy5hZGRyZXNzICsgXCIjXCIgKyB0aGlzLmNvdW50ZXIrKztcclxuICAgIGlmIChrZXkgaW4gdGhpcy5jYWNoZSkgdGhyb3cgbmV3IEVycm9yKFwiVGhpcyBtZXNzYWdlIGdvdCBzZW50IGFscmVhZHkhXCIpO1xyXG4gICAgdGhpcy5jYWNoZVtrZXldID0gdHJ1ZTtcclxuICAgIHJldHVybiB7a2V5OiBrZXksIHBheWxvYWQ6IG1lc3NhZ2UgfTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZW1vdmUgdGhlIGRlY29yYXRpb24gb2YgdGhlIG1lc3NhZ2Ugc28gdGhhdCB0aGUgYXBwbGljYXRpb24gY2FuIGludGVyYWN0IHdpdGggdGhlIGJyb2FkY2FzdCBtZXNzYWdlXHJcbiAqIHRyYW5zcGFyZW50bHkuIFRoaXMgZ2V0cyBjYWxsZWQgd2hlbmV2ZXIgYSBicm9hZGNhc3QgbWVzc2FnZSBoaXRzIGEgcGVlciBhbmQgaXMgcHJvcGFnYXRlZCB0byB0aGUgYXBwbGljYXRpb24uXHJcbiAqIEBwYXJhbSBtZXNzYWdlXHJcbiAqL1xyXG5QcmltaXRpdmVCcm9hZGNhc3REZWZpbml0aW9uLnByb3RvdHlwZS5yZW1vdmVEZWNvcmF0aW9uID0gZnVuY3Rpb24gKG1lc3NhZ2UpIHtcclxuICAgIHJldHVybiBtZXNzYWdlLnBheWxvYWQ7XHJcbn07XHJcblxyXG5cclxuZXhwb3J0cy5EZWYgPSBQcmltaXRpdmVCcm9hZGNhc3REZWZpbml0aW9uOyIsIi8qKlxyXG4gKiBSZW1hcms6XHJcbiAqIFRoZSBBUEkgZm9yIHRoaXMgY2xhc3MgaXMgZGVmaW5lZCBpbiB0aGUgbGlicmFyeSB7cDJwbmV0d29ya30gLSB7aW50ZXJmYWNlL21lbWJlcnNoaXAuanN9XHJcbiAqIENyZWF0ZWQgYnkgSnVsaWFuIG9uIDEyLzE4LzIwMTQuXHJcbiAqL1xyXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKFwieXV0aWxzXCIpO1xyXG4vL3ZhciBfID0gcmVxdWlyZShcInVuZGVyc2NvcmVcIik7XHJcbnZhciBIYW5kc2hha2UgPSByZXF1aXJlKFwiaGFuZHNoYWtlLXdlYnJ0Y1wiKTtcclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgQSBQIEkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuICogIFRoZSBjb2RlIGJlbG93IGlzIHRoZSBpbXBsZW1lbnRhdGlvbiBvZiB0aGVtIHttZW1iZXJzaGlwfSAgICAgICAqXHJcbiAqICBJbnRlcmZhY2UgdGhhdCBpcyBkZWZpbmVkIGluIHRoZSBsaWJyYXJ5IHtwMnBuZXR3b3JrfSAgICAgICAgICAgKlxyXG4gKiAgaHR0cHM6Ly9naXRodWIuY29tL2p1c3RheWFrL25ldHdvcmsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxudmFyIGRlbHRhX3QgPSAxMDAwMDsgLy8gMTAgc2VjXHJcbnZhciBjID0gMTA7XHJcbnZhciBsID0gNTtcclxuXHJcbi8qKlxyXG4gKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIEN5Y2xvbihvcHRpb25zKSB7XHJcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcclxuICAgIHRoaXMuaXNSZWFkeSA9IGZhbHNlO1xyXG4gICAgdGhpcy5yZWFkeUNhbGxiYWNrcyA9IFtdO1xyXG4gICAgdGhpcy5wYXJ0aWFsVmlldyA9IFtdO1xyXG4gICAgaWYgKFV0aWxzLmlzRGVmaW5lZChvcHRpb25zKSkge1xyXG4gICAgICAgIHRoaXMuZGVsdGFfdCA9IG9wdGlvbnMuZGVsdGFfdCB8fCBkZWx0YV90O1xyXG4gICAgICAgIHRoaXMuYyA9IG9wdGlvbnMuYyB8fCBjO1xyXG4gICAgICAgIHRoaXMubCA9IG9wdGlvbnMubCB8fCBsO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmRlbHRhX3QgPSBkZWx0YV90O1xyXG4gICAgICAgIHRoaXMuYyA9IGM7XHJcbiAgICAgICAgdGhpcy5sID0gbDtcclxuICAgIH1cclxuXHJcbn07XHJcblV0aWxzLmluaGVyaXQoQ3ljbG9uLCBFdmVudEVtaXR0ZXIpO1xyXG5cclxuLyoqXHJcbiAqIFN0YXJ0cyB0aGUgSGFuZHNoYWtpbmcuIFRoaXMgbXVzdCBiZSBkb25lIG9uY2UgdG8gY29ubmVjdCB0byB0aGUgbmV0d29yay4ge2xhdW5jaH0gdGFrZXMgYSBjYWxsYmFja1xyXG4gKiBhcyBwYXJhbWV0ZXIgdGhhdCBnZXRzIGNhbGxlZCB3aGVuIHRoZSBJQ0UtQ2FuZGlkYXRlcyBhcmUgZ2F0aGVyZWQuXHJcbiAqIFRoZSB7b2ZmZXJ9IHRoYXQgaXMgY3JlYXRlZCBtdXN0IGJlIHRyYW5zbWl0dGVkIHRvIHRoZSBvdGhlciBwZWVyIChIb3cgdGhpcyBpcyBkb25lIGlzIG91dCBvZiB0aGUgc2NvcGVcclxuICogb2YgdGhpcyBsaWJyYXJ5KSBpbiBvcmRlciB0byBpbml0aWF0ZSB0aGUgaGFuZHNoYWtlLlxyXG4gKiBAcGFyYW0gb25PZmZlciB7ZnVuY3Rpb259IChvZmZlciB7U3RyaW5nfSlcclxuICovXHJcbkN5Y2xvbi5wcm90b3R5cGUubGF1bmNoID0gZnVuY3Rpb24gKG9uT2ZmZXIpIHtcclxuICAgIFV0aWxzLmFzc2VydExlbmd0aChhcmd1bWVudHMsIDEpO1xyXG5cclxufTtcclxuXHJcbi8qKlxyXG4gKiBUaGlzIGlzIHRoZSBmaW5hbCBoYW5kc2hha2UtZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBhZnRlciBhbiBhbnN3ZXIgaXMgcmVjZWl2ZWRcclxuICogQHBhcmFtIGFuc3dlciB7U3RyaW5nfSByZW1vdGUgYW5zd2VyXHJcbiAqL1xyXG5DeWNsb24ucHJvdG90eXBlLmhhbmRzaGFrZSA9IGZ1bmN0aW9uKGFuc3dlcil7XHJcbiAgICBVdGlscy5hc3NlcnRMZW5ndGgoYXJndW1lbnRzLCAxKTtcclxuXHJcbn07XHJcblxyXG4vKipcclxuICogVXBvbiByZWNlaXZpbmcgYW4gb2ZmZXIgZnJvbSB7bGF1bmNofSB0aHJvdWdoIHRoZSBzaWduYWxpbmcgc2VydmljZSB0aGUgcGVlciBjcmVhdGVzIGEgZml0dGluZyBhbnN3ZXIuXHJcbiAqIFRoaXMgYW5zd2VyIGlzIHByb3BhZ2F0ZWQgdG8gdGhlIGFwcGxpY2F0aW9uIHdpdGggYSBjYWxsYmFjayB0aGF0IG11c3QgYmUgcHJvdmlkZWQgdG8gdGhpcyBmdW5jdGlvbi5cclxuICogVGhlIGFuc3dlciBtdXN0IGJlIHNlbmQgYmFjayB0byB0aGUgY29tbXVuaWNhdGlvbiBpbml0aWF0b3IuXHJcbiAqIEBwYXJhbSBvbkFuc3dlciB7ZnVuY3Rpb259IChhbnN3ZXIge1N0cmluZ30pXHJcbiAqL1xyXG5DeWNsb24ucHJvdG90eXBlLmFuc3dlciA9IGZ1bmN0aW9uIChvbkFuc3dlcikge1xyXG4gICAgVXRpbHMuYXNzZXJ0TGVuZ3RoKGFyZ3VtZW50cywgMSk7XHJcblxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFBlZXItU2FtcGxpbmctU2VydmljZS1mdW5jdGlvbi4gV2hlbiBwcm92aWRlZCB3aXRoIGEgcGFyYW1ldGVyIG4sIGEgZ2l2ZW4gbnVtYmVyIG9mIHJhbmRvbWx5XHJcbiAqIHNhbXBsZWQgcGVlcnMgaXMgcmV0dXJuZWQsIG90aGVyd2lzZSB0aGUgd2hvbGUgUGFydGlhbFZpZXcgb2YgdGhlIFJQUyBpcyByZXR1cm5lZC5cclxuICogQHBhcmFtIG4ge051bWJlcn1cclxuICovXHJcbkN5Y2xvbi5wcm90b3R5cGUuZ2V0UGVlcnMgPSBmdW5jdGlvbihuKXtcclxuICAgIGlmIChVdGlscy5pc0RlZmluZWQobikpIHtcclxuICAgICAgICByZXR1cm4gXy5wbHVjayhVdGlscy5zYW1wbGUodGhpcy5wYXJ0aWFsVmlldywgbiksIFwicGVlclwiKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIF8ucGx1Y2sodGhpcy5wYXJ0aWFsVmlldywgXCJwZWVyXCIpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFRoaXMgZnVuY3Rpb24gY2hlY2tzIGlmIHRoZSBtZW1iZXJzaGlwIHByb3RvY29sIGlzIGFscmVhZHkgY29ubmVjdGVkIHRvIHRoZSBuZXR3b3JrIGFuZCBpcyBcInJlYWR5XCIgb3IgaWZcclxuICogdGhlIGhhbmRzaGFrZSBpcyBzdGlsbCBwZW5kaW5nLlxyXG4gKiBUaGUgcGFyYW1ldGVyIGlzIGEgY2FsbGJhY2sgdGhhdCBnZXRzIGNhbGxlZCBhcyBzb29uIGFzIHRoZSBwZWVyIGlzIGNvbm5lY3RlZCB0byB0aGUgbmV0d29yay5cclxuICogQHBhcmFtIGNhbGxiYWNrIHtmdW5jdGlvbn1cclxuICovXHJcbkN5Y2xvbi5wcm90b3R5cGUucmVhZHkgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgIGlmICh0aGlzLmlzUmVhZHkpe1xyXG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpcyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMucmVhZHlDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnRzLkNsYXNzID0gQ3ljbG9uO1xyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICBDIFkgQyBMIE8gTiAgRiBVIE4gQyAgICAgICAgICAgICAgICAgICAgICAgKlxyXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vLyBUT0RPIGltcGxlbWVudCBtZSFcclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgSCBFIEwgUCBFIFIgUyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxuZnVuY3Rpb24gYWRkVG9QYXJ0aWFsVmlldyhjeWNsb24sIHBlZXIsIGNhbGxiYWNrKSB7XHJcbiAgICBjeWNsb24ucGFydGlhbFZpZXcucHVzaCh7IHBlZXI6IHBlZXIsIGFnZTogMCwgYWRkcmVzczogcGVlci5hZGRyZXNzfSk7XHJcbiAgICBjYWxsYmFjay5jYWxsKHBlZXIpO1xyXG59OyIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IEp1bGlhbiBvbiAxMi8xNy8yMDE0LlxyXG4gKi9cclxudmFyIFV0aWxzID0gcmVxdWlyZShcInl1dGlsc1wiKTtcclxuZXhwb3J0cy5Mb2NhbEFkZHJlc3MgPSBVdGlscy5ndWlkKCk7IiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgSnVsaWFuIG9uIDEyLzE2LzIwMTQuXHJcbiAqL1xyXG5leHBvcnRzLk1FU1NBR0UgPSAwO1xyXG5leHBvcnRzLlRFTExfQUREUkVTUyA9IDE7XHJcbmV4cG9ydHMuUkVRVUVTVF9ORUlHSEJPUlMgPSAyO1xyXG5leHBvcnRzLk9GRkVSID0gMztcclxuZXhwb3J0cy5BTlNXRVIgPSA0O1xyXG5leHBvcnRzLkVSUk9SX0NBTk5PVF9GSU5EX1BFRVIgPSA1O1xyXG5leHBvcnRzLlNFTkRfTkVJR0hCT1JTID0gNjsiLCIvKipcclxuICogQ3JlYXRlZCBieSBKdWxpYW4gb24gMTIvMTYvMjAxNC5cclxuICovXHJcbnZhciBXZWJSVEMgPSByZXF1aXJlKFwid2VicnRjLWFkYXB0ZXJcIik7XHJcbnZhciBSVENQZWVyQ29ubmVjdGlvbiA9IFdlYlJUQy5SVENQZWVyQ29ubmVjdGlvbjtcclxudmFyIE1FU1NBR0VfVFlQRSA9IHJlcXVpcmUoXCIuL01FU1NBR0VfVFlQRS5qc1wiKTtcclxudmFyIEFERFJFU1MgPSByZXF1aXJlKFwiLi9BZGRyZXNzXCIpLkxvY2FsQWRkcmVzcztcclxudmFyIFBlZXJDYWNoZSA9IHJlcXVpcmUoXCIuL1BlZXJDYWNoZVwiKS5QZWVyQ2FjaGU7XHJcbnZhciBIYW5kc2hha2UgPSByZXF1aXJlKFwiLi9oYW5kc2hha2UuanNcIik7XHJcbnZhciBQcm9taXNlID0gcmVxdWlyZShcImJsdWViaXJkXCIpO1xyXG5cclxudmFyIFJFUVVFU1RfTkVJR0hCT1JTX1RJTUVPVVRfTVMgPSA1MDAwO1xyXG5cclxudmFyIElDRV9DT05GSUcgPSB7XCJpY2VTZXJ2ZXJzXCI6W1xyXG4gICAge1widXJsXCI6XCJzdHVuOjIzLjIxLjE1MC4xMjFcIn0sXHJcbiAgICB7XHJcbiAgICAgICAgJ3VybCc6ICd0dXJuOjE5Mi4xNTguMjkuMzk6MzQ3OD90cmFuc3BvcnQ9dWRwJyxcclxuICAgICAgICAnY3JlZGVudGlhbCc6ICdKWkVPRXQyVjNRYjB5MjdHUm50dDJ1MlBBWUE9JyxcclxuICAgICAgICAndXNlcm5hbWUnOiAnMjgyMjQ1MTE6MTM3OTMzMDgwOCdcclxuICAgIH1cclxuXX07XHJcblxyXG52YXIgQ09OTiA9IHsgJ29wdGlvbmFsJzogW3snRHRsc1NydHBLZXlBZ3JlZW1lbnQnOiB0cnVlfV0gfTtcclxuXHJcbi8qKlxyXG4gKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmZ1bmN0aW9uIFBlZXIoKSB7XHJcbiAgICB2YXIgcGMgPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24oSUNFX0NPTkZJRywgQ09OTik7XHJcbiAgICB0aGlzLnBjID0gcGM7XHJcbiAgICB0aGlzLmFkZHJlc3MgPSBudWxsO1xyXG4gICAgdGhpcy5kYyA9IG51bGw7XHJcbiAgICB0aGlzLm9uT3BlbiA9IFtdO1xyXG4gICAgdGhpcy5vbk1lc3NhZ2UgPSBbXTtcclxuICAgIHRoaXMub25EaXNjb25uZWN0ID0gW107XHJcbiAgICB0aGlzLm9mZmVyQ2FsbGJhY2sgPSBudWxsO1xyXG4gICAgdGhpcy5jcmVhdGVDYWxsYmFjayA9IG51bGw7XHJcbiAgICB0aGlzLmljZVRpbWVvdXQgPSBudWxsO1xyXG4gICAgdGhpcy5vbkNhbm5vdEZpbmRQZWVyID0gW107XHJcbiAgICB0aGlzLnJlcXVlc3ROZWlnaGJvcnMgPSBudWxsO1xyXG4gICAgdGhpcy5yZXF1ZXN0TmVpZ2hib3JzQ2FsbGJhY2sgPSBudWxsO1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuZGlzY29ubmVjdENvdW50ZXIgPSAwOyAvLyB0byBwcmV2ZW50IFwiZmFsc2VcIiBwb3NpdGl2ZS4uLlxyXG4gICAgdGhpcy50aHJlYWQgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGkgPSAwLCBMID0gc2VsZi5vbkRpc2Nvbm5lY3QubGVuZ3RoO1xyXG4gICAgICAgIGlmIChzZWxmLmRjICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGlmKCBzZWxmLmRjLnJlYWR5U3RhdGUgPT09IFwiY2xvc2VkXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmIChzZWxmLmRpc2Nvbm5lY3RDb3VudGVyID4gNSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvcig7aTxMO2krKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9uRGlzY29ubmVjdFtpXS5jYWxsKHNlbGYpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKHNlbGYudGhyZWFkKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5kaXNjb25uZWN0Q291bnRlciArPSAxO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5kaXNjb25uZWN0Q291bnRlciA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9LCAxMDApO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJucyB0aGUgcmVzdWx0XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGV4ZWMoKSB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHNlbGYuaWNlVGltZW91dCk7XHJcbiAgICAgICAgdmFyIGQgPSBKU09OLnN0cmluZ2lmeShwYy5sb2NhbERlc2NyaXB0aW9uKTtcclxuICAgICAgICBpZiAoc2VsZi5vZmZlckNhbGxiYWNrICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHNlbGYub2ZmZXJDYWxsYmFjay5jYWxsKHNlbGYsIGQpO1xyXG4gICAgICAgICAgICBzZWxmLm9mZmVyQ2FsbGJhY2sgPSBudWxsO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoc2VsZi5jcmVhdGVDYWxsYmFjayAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBzZWxmLmNyZWF0ZUNhbGxiYWNrLmNhbGwoc2VsZiwgZCk7XHJcbiAgICAgICAgICAgIHNlbGYuY3JlYXRlQ2FsbGJhY2sgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwYy5vbmljZWNhbmRpZGF0ZSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcGMub25pY2VjYW5kaWRhdGUgPSBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGlmIChlLmNhbmRpZGF0ZSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICBleGVjKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHNlbGYuaWNlVGltZW91dCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHNlbGYuaWNlVGltZW91dCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc2VsZi5pY2VUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBleGVjKCk7XHJcbiAgICAgICAgICAgIH0sIDEwMDApO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLypcclxuICAgIHBjLm9ucGVlcmlkZW50aXR5ID0gZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwicGVlciBpZGVudDpcIixlKTtcclxuICAgIH1cclxuXHJcbiAgICBwYy5vbnNpZ25hbGluZ3N0YXRlY2hhbmdlID0gZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwib25zaWduYWxpbmdzdGF0ZWNoYW5nZSBldmVudCBkZXRlY3RlZCFcIiwgZXYpO1xyXG4gICAgfTtcclxuICAgICovXHJcbn1cclxuXHJcblBlZXIucHJvdG90eXBlLmlzT3BlbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmICh0aGlzLmRjICE9PSBudWxsKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZGMucmVhZHlTdGF0ZSA9PT0gXCJvcGVuXCI7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn07XHJcblxyXG5QZWVyLnByb3RvdHlwZS5kaXNjb25uZWN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5kYy5jbG9zZSgpO1xyXG59O1xyXG5cclxuUGVlci5wcm90b3R5cGUub25kaXNjb25uZWN0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLm9uRGlzY29ubmVjdC5wdXNoKGNhbGxiYWNrKTtcclxufTtcclxuXHJcblBlZXIucHJvdG90eXBlLm9ub3BlbiA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgdGhpcy5vbk9wZW4ucHVzaChjYWxsYmFjayk7XHJcbn07XHJcblxyXG5QZWVyLnByb3RvdHlwZS5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgIHRoaXMub25NZXNzYWdlLnB1c2goY2FsbGJhY2spO1xyXG59O1xyXG5cclxuUGVlci5wcm90b3R5cGUub25jYW5ub3RmaW5kcGVlciA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgdGhpcy5vbkNhbm5vdEZpbmRQZWVyLnB1c2goY2FsbGJhY2spO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgYW55IGtpbmQgb2YgZGF0YSB0byB0aGUgb3RoZXIgUGVlclxyXG4gKiBAcGFyYW0gbWVzc2FnZVxyXG4gKi9cclxuUGVlci5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XHJcbiAgICBpZiAodGhpcy5kYyA9PT0gbnVsbCB8fCB0aGlzLmRjLnJlYWR5U3RhdGUgIT09IFwib3BlblwiKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSGFuZHNoYWtlIGluY29tcGxldGUhIFNlbmRpbmcgaXMgbm90IHBvc3NpYmxlLlwiKTtcclxuICAgIH1cclxuICAgIHRoaXMuZGMuc2VuZChKU09OLnN0cmluZ2lmeSh7dHlwZTogTUVTU0FHRV9UWVBFLk1FU1NBR0UsIHBheWxvYWQ6bWVzc2FnZSB9KSk7XHJcbn07XHJcblxyXG4vKipcclxuICogU2VuZHMgYSBtZXNzYWdlIHdpdGhvdXQgcGF5bG9hZFxyXG4gKiBAcGFyYW0gbWVzc2FnZVR5cGVcclxuICovXHJcblBlZXIucHJvdG90eXBlLnNlbmRNZXNzYWdlVHlwZSA9IGZ1bmN0aW9uIChtZXNzYWdlVHlwZSwgcGF5bG9hZCkge1xyXG4gICAgaWYgKHRoaXMuZGMgPT09IG51bGwgfHwgdGhpcy5kYy5yZWFkeVN0YXRlICE9PSBcIm9wZW5cIikge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkhhbmRzaGFrZSBpbmNvbXBsZXRlISBTZW5kaW5nIGlzIG5vdCBwb3NzaWJsZS5cIik7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHBheWxvYWQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICB0aGlzLmRjLnNlbmQoSlNPTi5zdHJpbmdpZnkoe3R5cGU6IG1lc3NhZ2VUeXBlIH0pKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5kYy5zZW5kKEpTT04uc3RyaW5naWZ5KHt0eXBlOiBtZXNzYWdlVHlwZSwgcGF5bG9hZDogcGF5bG9hZCB9KSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogVHJpZXMgdG8gY29ubmVjdCB0byB0aGUgYWRkcmVzcyB0aHJvdWdoIHRoZSBwZWVyXHJcbiAqIEBwYXJhbSBhZGRyZXNzIHtTdHJpbmd9XHJcbiAqIEByZXR1cm5zIHtQZWVyfSByZXN1bHRpbmcgcGVlclxyXG4gKi9cclxuUGVlci5wcm90b3R5cGUuYXR0ZW1wdFRvQ29ubmVjdCA9IGZ1bmN0aW9uIChhZGRyZXNzKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICB2YXIgb3RoZXIgPSBIYW5kc2hha2UuY3JlYXRlT2ZmZXIoZnVuY3Rpb24gKG9mZmVyKSB7XHJcbiAgICAgICAgc2VsZi5zZW5kTWVzc2FnZVR5cGUoTUVTU0FHRV9UWVBFLk9GRkVSLCB7b2ZmZXI6b2ZmZXIsIHRhcmdldDphZGRyZXNzLCBzb3VyY2U6QUREUkVTU30pO1xyXG4gICAgfSk7XHJcbiAgICBQZWVyQ2FjaGUucHV0UGVuZGluZyhvdGhlciwgYWRkcmVzcyk7XHJcbiAgICByZXR1cm4gb3RoZXI7XHJcbn07XHJcblxyXG4vKipcclxuICpcclxuICogQHJldHVybnMge1Byb21pc2V9XHJcbiAqL1xyXG5QZWVyLnByb3RvdHlwZS5nZXROZWlnaGJvcnMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBpZiAodGhpcy5yZXF1ZXN0TmVpZ2hib3JzICE9PSBudWxsKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKFwiYWxyZWFkeSByZXF1ZXN0aW5nIG5laWdoYm9ycy4uIGNhbmNlbCBvbGQgcmVxdWVzdCFcIik7XHJcbiAgICAgICAgdGhpcy5yZXF1ZXN0TmVpZ2hib3JzLmNhbmNlbCgpO1xyXG4gICAgfVxyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgdGhpcy5yZXF1ZXN0TmVpZ2hib3JzID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHNlbGYucmVxdWVzdE5laWdoYm9ycyA9IG51bGw7XHJcbiAgICAgICAgICAgIHNlbGYucmVxdWVzdE5laWdoYm9yc0NhbGxiYWNrID0gbnVsbDtcclxuICAgICAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgICAgfSxSRVFVRVNUX05FSUdIQk9SU19USU1FT1VUX01TKTtcclxuICAgICAgICBzZWxmLnJlcXVlc3ROZWlnaGJvcnNDYWxsYmFjayA9IGZ1bmN0aW9uIChuZWlnaGJvcnMpIHtcclxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgICAgICBzZWxmLnJlcXVlc3ROZWlnaGJvcnMgPSBudWxsO1xyXG4gICAgICAgICAgICBzZWxmLnJlcXVlc3ROZWlnaGJvcnNDYWxsYmFjayA9IG51bGw7XHJcbiAgICAgICAgICAgIHJlc29sdmUobmVpZ2hib3JzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc2VsZi5zZW5kTWVzc2FnZVR5cGUoTUVTU0FHRV9UWVBFLlJFUVVFU1RfTkVJR0hCT1JTKTtcclxuICAgIH0pLmNhbmNlbGxhYmxlKCk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0TmVpZ2hib3JzO1xyXG59O1xyXG5cclxuZXhwb3J0cy5QZWVyID0gUGVlcjsiLCIvKipcclxuICogQ2FjaGVzIGNvbm5lY3Rpb25zIHRoYXQgYXJlIG9wZW5lZCBhbmQgbm90IGNsb3NlZCB5ZXQgZm9yIHRoZSBwdXJwb3NlIG9mIHNpZ25hbGluZ1xyXG4gKlxyXG4gKiBDcmVhdGVkIGJ5IEp1bGlhbiBvbiAxMi8xNy8yMDE0LlxyXG4gKi9cclxudmFyIFV0aWxzID0gcmVxdWlyZShcInl1dGlsc1wiKTtcclxuXHJcbnZhciBjYWNoZSA9IHt9O1xyXG5cclxudmFyIHBlbmRpbmcgPSB7fTtcclxuXHJcbmV4cG9ydHMuUGVlckNhY2hlID0ge1xyXG5cclxuICAgIGdldEFsbEFkZHJlc3NlczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhjYWNoZSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUHV0IGEgUGVlciB0aGF0IGlzIGFscmVhZHkgb3BlblxyXG4gICAgICogQHBhcmFtIHBlZXIge1BlZXJ9XHJcbiAgICAgKi9cclxuICAgIHB1dDogZnVuY3Rpb24gKHBlZXIpIHtcclxuICAgICAgICBpZiAoIXBlZXIuaXNPcGVuKCkpIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBwdXQgbm90LW9wZW5lZCBwZWVycyBpbnRvIGNhY2hlIVwiKTtcclxuICAgICAgICBpZiAocGVlci5hZGRyZXNzIGluIGNhY2hlKSB0aHJvdyBuZXcgRXJyb3IoXCJDb25uZWN0aW9uIGlzIGFscmVhZHkgb3BlbiEgQ2Fubm90IHB1dCBpbnRvIGNhY2hlLlwiKTsgLy9UT0RPIHJlYWxseS4uP1xyXG5cclxuICAgICAgICBjYWNoZVtwZWVyLmFkZHJlc3NdID0gcGVlcjtcclxuXHJcbiAgICAgICAgLy8gQ2xlYXIgd2hlbiBkaXNjb25uZWN0ZWRcclxuICAgICAgICBwZWVyLm9uZGlzY29ubmVjdChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSBjYWNoZVtwZWVyLmFkZHJlc3NdO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICBoYXM6IGZ1bmN0aW9uIChhZGRyZXNzKSB7XHJcbiAgICAgICAgcmV0dXJuIGFkZHJlc3MgaW4gY2FjaGU7XHJcbiAgICB9LFxyXG5cclxuICAgIGdldDogZnVuY3Rpb24gKGFkZHJlc3MpIHtcclxuICAgICAgICByZXR1cm4gY2FjaGVbYWRkcmVzc107XHJcbiAgICB9LFxyXG5cclxuICAgIHB1dFBlbmRpbmc6IGZ1bmN0aW9uIChwZWVyLCBhZGRyZXNzKSB7XHJcbiAgICAgICAgaWYgKHBlZXIuaXNPcGVuKCkpIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBhdCBwZWVyIHRvIHBlbmRpbmcgYmVjYXVzZSBpdCBpcyBhbHJlYWR5IG9wZW4hXCIpO1xyXG4gICAgICAgIGlmIChhZGRyZXNzIGluIHBlbmRpbmcpIHRocm93IG5ldyBFcnJvcihcIkNvbm5lY3Rpb24gaXMgYWxyZWFkeSBwZW5kaW5nISBDYW5ub3QgcHV0IGludG8gY2FjaGUuXCIpOyAvL1RPRE8gcmVhbGx5Li4/XHJcblxyXG4gICAgICAgIHBlZXIub25vcGVuKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgZGVsZXRlIHBlbmRpbmdbYWRkcmVzc107XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHBlbmRpbmdbYWRkcmVzc10gPSB7cGVlcjogcGVlciwgdHM6IERhdGUubm93KCl9O1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRQZW5kaW5nOiBmdW5jdGlvbiAoYWRkcmVzcykge1xyXG4gICAgICAgIHJldHVybiBwZW5kaW5nW2FkZHJlc3NdLnBlZXI7XHJcbiAgICB9LFxyXG5cclxuICAgIGRlbGV0ZVBlbmRpbmc6IGZ1bmN0aW9uIChhZGRyZXNzKSB7XHJcbiAgICAgICAgZGVsZXRlIHBlbmRpbmdbYWRkcmVzc107XHJcblxyXG4gICAgfVxyXG5cclxufTtcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBDTEVBTiBQRU5ESU5HIENBQ0hFXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5zZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIga2V5LCBzLCBub3cgPSBEYXRlLm5vdygpLCBjdXJyZW50O1xyXG4gICAgZm9yKGtleSBpbiBwZW5kaW5nKSB7XHJcbiAgICAgICAgY3VycmVudCA9IHBlbmRpbmdba2V5XTtcclxuICAgICAgICBzID0gVXRpbHMubXNUb1MoVXRpbHMudGltZURpZmZlcmVuY2VJbk1zKGN1cnJlbnQudHMsIG5vdykpO1xyXG4gICAgICAgIGlmIChzID4gNjApIHtcclxuICAgICAgICAgICAgLy8gaWYgYSBjb25uZWN0aW9uIGlzIHBlbmRpbmcgZm9yIG1vcmUgdGhhbiAxIG1pbnV0ZSwgY2xvc2UgaXQuLlxyXG4gICAgICAgICAgICBjdXJyZW50LnBlZXIuZGlzY29ubmVjdCgpO1xyXG4gICAgICAgICAgICBkZWxldGUgcGVuZGluZ1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSwgMzAwMDApOyAvLyBldmVyeSAzMCBzZWNvbmRzXHJcbiIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IEp1bGlhbiBvbiAxMi8xMS8yMDE0LlxyXG4gKi9cclxudmFyIFV0aWxzID0gcmVxdWlyZShcInl1dGlsc1wiKTtcclxudmFyIFBlZXIgPSByZXF1aXJlKFwiLi9QZWVyLmpzXCIpLlBlZXI7XHJcbnZhciBQZWVyQ2FjaGUgPSByZXF1aXJlKFwiLi9QZWVyQ2FjaGUuanNcIikuUGVlckNhY2hlO1xyXG52YXIgTUVTU0FHRV9UWVBFID0gcmVxdWlyZShcIi4vTUVTU0FHRV9UWVBFLmpzXCIpO1xyXG52YXIgQUREUkVTUyA9IHJlcXVpcmUoXCIuL0FkZHJlc3NcIikuTG9jYWxBZGRyZXNzO1xyXG5cclxudmFyIG9uUmVtb3RlQ29ubmVjdGlvbkNhbGxiYWNrcyA9IFtdO1xyXG52YXIgb25NZXNzYWdlQ2FsbGJhY2tzID0gW107XHJcblxyXG5mdW5jdGlvbiBvbk1lc3NhZ2UocGVlcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChtc2cpIHtcclxuICAgICAgICB2YXIgaSA9IDAsIGNiID0gb25NZXNzYWdlQ2FsbGJhY2tzLCBMID0gY2IubGVuZ3RoO1xyXG4gICAgICAgIGZvcig7aTxMO2krKykge1xyXG4gICAgICAgICAgICBjYltpXS5jYWxsKHBlZXIsIHBlZXIsIG1zZyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogQHR5cGUge09iamVjdH1cclxuICoge1xyXG4gKiAgICAgIGd1aWQxIDogcGVlcixcclxuICogICAgICBndWlkMiA6IHBlZXJcclxuICogfVxyXG4gKi9cclxuXHJcbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gQSBQIElcclxuID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuLyoqXHJcbiAqIGluaXRpYXRlcyBhIFBlZXItdG8tUGVlciBjb25uZWN0aW9uXHJcbiAqIEBwYXJhbSBjYWxsYmFja1xyXG4gKiBAcmV0dXJucyB7UGVlcn1cclxuICovXHJcbmZ1bmN0aW9uIGNyZWF0ZU9mZmVyKGNhbGxiYWNrKSB7XHJcbiAgICB2YXIgcGVlciA9IG5ldyBQZWVyKCksIHBjID0gcGVlci5wYztcclxuICAgIHBlZXIub2ZmZXJDYWxsYmFjayA9IGNhbGxiYWNrO1xyXG5cclxuICAgIHZhciBkYyA9IHBjLmNyZWF0ZURhdGFDaGFubmVsKFwicVwiLCB7cmVsaWFibGU6dHJ1ZX0pO1xyXG4gICAgcGMuY3JlYXRlT2ZmZXIoZnVuY3Rpb24gKGRlc2MpIHtcclxuICAgICAgICBwYy5zZXRMb2NhbERlc2NyaXB0aW9uKGRlc2MsIGZ1bmN0aW9uKCkgeyB9KTtcclxuICAgIH0sIGZ1bmN0aW9uIGZhaWx1cmUoZSkgeyBjb25zb2xlLmVycm9yKGUpOyB9KTtcclxuXHJcbiAgICBkYy5vbm9wZW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgZGMuc2VuZChKU09OLnN0cmluZ2lmeSh7dHlwZTogTUVTU0FHRV9UWVBFLlRFTExfQUREUkVTUywgcGF5bG9hZDogQUREUkVTU30pKTtcclxuICAgIH07XHJcblxyXG4gICAgZGMub25tZXNzYWdlID0gaGFuZGxlTWVzc2FnZShwZWVyKTtcclxuXHJcbiAgICBwZWVyLmRjID0gZGM7XHJcbiAgICByZXR1cm4gcGVlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqXHJcbiAqIEBwYXJhbSBwZWVyXHJcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cclxuICovXHJcbmZ1bmN0aW9uIGhhbmRsZU1lc3NhZ2UocGVlcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgdmFyIG1zZyA9IFV0aWxzLmlzU3RyaW5nKGUuZGF0YSkgPyBKU09OLnBhcnNlKGUuZGF0YSkgOiBlLmRhdGE7XHJcbiAgICAgICAgdmFyIGksIEwsIG5ld1BlZXIsIGRlc3RpbmF0aW9uUGVlciwgbjtcclxuICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgTUVTU0FHRV9UWVBFLk9GRkVSOlxyXG4gICAgICAgICAgICAgICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAgICAgICAgICAgICAvLyBPIEYgRiBFIFJcclxuICAgICAgICAgICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgICAgICAgICAgICAgaWYgKFwidGFyZ2V0XCIgaW4gbXNnLnBheWxvYWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB3ZSBhcmUgdGhlIG1lZGlhdG9yXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKFBlZXJDYWNoZS5oYXMobXNnLnBheWxvYWQudGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvblBlZXIgPSBQZWVyQ2FjaGUuZ2V0KG1zZy5wYXlsb2FkLnRhcmdldCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uUGVlci5zZW5kTWVzc2FnZVR5cGUoTUVTU0FHRV9UWVBFLk9GRkVSLCB7b2ZmZXI6bXNnLnBheWxvYWQub2ZmZXIsIHNvdXJjZTptc2cucGF5bG9hZC5zb3VyY2V9KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB3ZSBjYW5ub3QgZXN0YWJsaXNoIGEgY29ubmVjdGlvbi4uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZXIuc2VuZE1lc3NhZ2VUeXBlKE1FU1NBR0VfVFlQRS5FUlJPUl9DQU5OT1RfRklORF9QRUVSLCBtc2cucGF5bG9hZC50YXJnZXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gV0UgYXJlIHRoZSBUQVJHRVQhXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3UGVlciA9IGNyZWF0ZUFuc3dlcihtc2cucGF5bG9hZC5vZmZlciwgZnVuY3Rpb24gKGFuc3dlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwZWVyLnNlbmRNZXNzYWdlVHlwZShcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1FU1NBR0VfVFlQRS5BTlNXRVIsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbnN3ZXI6IGFuc3dlcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IG1zZy5wYXlsb2FkLnNvdXJjZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IEFERFJFU1NcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBpID0gMCwgTCA9IG9uUmVtb3RlQ29ubmVjdGlvbkNhbGxiYWNrcy5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yKDtpPEw7aSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uUmVtb3RlQ29ubmVjdGlvbkNhbGxiYWNrc1tpXS5jYWxsKG5ld1BlZXIsbmV3UGVlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgTUVTU0FHRV9UWVBFLkFOU1dFUjpcclxuICAgICAgICAgICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgICAgICAgICAgICAgLy8gQSBOIFMgVyBFIFJcclxuICAgICAgICAgICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgICAgICAgICAgICAgaWYgKFwic291cmNlXCIgaW4gbXNnLnBheWxvYWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB3ZSBhcmUgdGhlIG1lZGlhdG9yLi5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoUGVlckNhY2hlLmhhcyhtc2cucGF5bG9hZC5zb3VyY2UpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uUGVlciA9IFBlZXJDYWNoZS5nZXQobXNnLnBheWxvYWQuc291cmNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25QZWVyLnNlbmRNZXNzYWdlVHlwZShNRVNTQUdFX1RZUEUuQU5TV0VSLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbnN3ZXI6IG1zZy5wYXlsb2FkLmFuc3dlcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldDogbXNnLnBheWxvYWQudGFyZ2V0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZXIuc2VuZE1lc3NhZ2VUeXBlKE1FU1NBR0VfVFlQRS5FUlJPUl9DQU5OT1RfRklORF9QRUVSLCBtc2cucGF5bG9hZC50YXJnZXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gd2UgYXJlIHRoZSBTRU5ERVIgYW5kIHdlIGFyZSBzdXBwb3NlZCB0byBhcHBseSB0aGUgYW5zd2VyLi5cclxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvblBlZXIgPSBQZWVyQ2FjaGUuZ2V0UGVuZGluZyhtc2cucGF5bG9hZC50YXJnZXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZUFuc3dlcihkZXN0aW5hdGlvblBlZXIsIG1zZy5wYXlsb2FkLmFuc3dlcik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNRVNTQUdFX1RZUEUuVEVMTF9BRERSRVNTOlxyXG4gICAgICAgICAgICAgICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAgICAgICAgICAgICAvLyBUIEUgTCBMICBBIEQgRCBSIEUgUyBTXHJcbiAgICAgICAgICAgICAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgICAgICAgICAgICAgIHBlZXIuYWRkcmVzcyA9IG1zZy5wYXlsb2FkO1xyXG4gICAgICAgICAgICAgICAgaSA9IDAsIEwgPSBwZWVyLm9uT3Blbi5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBQZWVyQ2FjaGUucHV0KHBlZXIpO1xyXG4gICAgICAgICAgICAgICAgcGVlci5vbm1lc3NhZ2Uob25NZXNzYWdlKHBlZXIpKTtcclxuICAgICAgICAgICAgICAgIGZvcig7aTxMO2krKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHBlZXIub25PcGVuW2ldLmNhbGwocGVlcik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBwZWVyLm9uT3BlbiA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNRVNTQUdFX1RZUEUuTUVTU0FHRTpcclxuICAgICAgICAgICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgICAgICAgICAgICAgLy8gTSBFIFMgUyBBIEcgRVxyXG4gICAgICAgICAgICAgICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAgICAgICAgICAgICBpID0gMCwgTCA9IHBlZXIub25NZXNzYWdlLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIGZvcig7aTxMO2krKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHBlZXIub25NZXNzYWdlW2ldLmNhbGwocGVlciwgbXNnLnBheWxvYWQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgTUVTU0FHRV9UWVBFLkVSUk9SX0NBTk5PVF9GSU5EX1BFRVI6XHJcbiAgICAgICAgICAgICAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgICAgICAgICAgICAgIC8vIEUgUiBSIE8gUiAgQyBBIE4gTiBPIFQgIEYgSSBOIEQgIFAgRSBFIFJcclxuICAgICAgICAgICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgICAgICAgICAgICAgaT0wLCBMID0gcGVlci5vbkNhbm5vdEZpbmRQZWVyLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIFBlZXJDYWNoZS5kZWxldGVQZW5kaW5nKG1zZy5wYXlsb2FkKTtcclxuICAgICAgICAgICAgICAgIGZvciAoO2k8TDtpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBwZWVyLm9uQ2Fubm90RmluZFBlZXJbaV0uY2FsbChwZWVyLCBtc2cucGF5bG9hZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNRVNTQUdFX1RZUEUuUkVRVUVTVF9ORUlHSEJPUlM6XHJcbiAgICAgICAgICAgICAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgICAgICAgICAgICAgIC8vIFIgRSBRIFUgRSBTIFQgIE4gRSBJIEcgSCBCIE8gUiBTXHJcbiAgICAgICAgICAgICAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgICAgICAgICAgICAgIHBlZXIuc2VuZE1lc3NhZ2VUeXBlKE1FU1NBR0VfVFlQRS5TRU5EX05FSUdIQk9SUywgUGVlckNhY2hlLmdldEFsbEFkZHJlc3NlcygpKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIE1FU1NBR0VfVFlQRS5TRU5EX05FSUdIQk9SUzpcclxuICAgICAgICAgICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgICAgICAgICAgICAgLy8gUyBFIE4gRCAgTiBFIEkgRyBIIEIgTyBSIFNcclxuICAgICAgICAgICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgICAgICAgICAgICAgbiA9IFV0aWxzLmlzU3RyaW5nKG1zZy5wYXlsb2FkKT8gSlNPTi5wYXJzZShtc2cucGF5bG9hZCkgOiBtc2cucGF5bG9hZDtcclxuICAgICAgICAgICAgICAgIHBlZXIucmVxdWVzdE5laWdoYm9yc0NhbGxiYWNrLmNhbGwocGVlciwgbik7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQWNjZXB0cyB0aGUgaW5pdGlhbCBQZWVyLXRvLVBlZXIgaW52aXRhdGlvblxyXG4gKiBAcGFyYW0gb2ZmZXJcclxuICogQHBhcmFtIGNhbGxiYWNrXHJcbiAqIEByZXR1cm5zIHtQZWVyfVxyXG4gKi9cclxuZnVuY3Rpb24gY3JlYXRlQW5zd2VyKG9mZmVyLCBjYWxsYmFjaykge1xyXG4gICAgdmFyIHBlZXIgPSBuZXcgUGVlcigpLCBwYyA9IHBlZXIucGM7XHJcbiAgICB2YXIgb2ZmZXJEZXNjID0gbmV3IFJUQ1Nlc3Npb25EZXNjcmlwdGlvbihKU09OLnBhcnNlKG9mZmVyKSk7XHJcbiAgICBwZWVyLmNyZWF0ZUNhbGxiYWNrID0gY2FsbGJhY2s7XHJcbiAgICBwYy5zZXRSZW1vdGVEZXNjcmlwdGlvbihvZmZlckRlc2MpO1xyXG4gICAgcGMuY3JlYXRlQW5zd2VyKGZ1bmN0aW9uIChhbnN3ZXJEZXNjKSB7XHJcbiAgICAgICAgcGMuc2V0TG9jYWxEZXNjcmlwdGlvbihhbnN3ZXJEZXNjKTtcclxuICAgIH0sIGZ1bmN0aW9uICgpIHsgY29uc29sZS53YXJuKFwiTm8gY3JlYXRlIGFuc3dlclwiKTsgfSk7XHJcblxyXG4gICAgcGMub25kYXRhY2hhbm5lbCA9IGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgdmFyIGRjID0gZS5jaGFubmVsIHx8IGU7IC8vIENocm9tZSBzZW5kcyBldmVudCwgRkYgc2VuZHMgcmF3IGNoYW5uZWxcclxuICAgICAgICBwZWVyLmRjID0gZGM7XHJcblxyXG4gICAgICAgIGRjLm9ub3BlbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgZGMuc2VuZChKU09OLnN0cmluZ2lmeSh7dHlwZTogTUVTU0FHRV9UWVBFLlRFTExfQUREUkVTUywgcGF5bG9hZDogQUREUkVTU30pKTtcclxuICAgICAgICAgICAgLy8gZGVsYXkgb3BlbiB1bnRpbCB0aGUgcmVzcG9uc2UgaXMgaW5cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBkYy5vbm1lc3NhZ2UgPSBoYW5kbGVNZXNzYWdlKHBlZXIpO1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gcGVlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFwcGxpZXMgdGhlIHJlc3VsdFxyXG4gKiBAcGFyYW0gcGVlclxyXG4gKiBAcGFyYW0gYW5zd2VyXHJcbiAqL1xyXG5mdW5jdGlvbiBoYW5kbGVBbnN3ZXIocGVlciwgYW5zd2VyKSB7XHJcbiAgICB2YXIgYW5zd2VyRGVzYyA9IG5ldyBSVENTZXNzaW9uRGVzY3JpcHRpb24oSlNPTi5wYXJzZShhbnN3ZXIpKTtcclxuICAgIHBlZXIucGMuc2V0UmVtb3RlRGVzY3JpcHRpb24oYW5zd2VyRGVzYyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBXZSBzb21laG93IG5lZWQgdG8gbm90aWZ5IEJvYiwgdGhhdCBBbGljZSBhdHRlbXB0cyB0byB0YWxrIHRvIGhpbSFcclxuICogQHBhcmFtIGNhbGxiYWNrIHtmdW5jdGlvbn0gKHtQZWVyfSlcclxuICovXHJcbmZ1bmN0aW9uIG9uUmVtb3RlQ29ubmVjdGlvbihjYWxsYmFjaykge1xyXG4gICAgb25SZW1vdGVDb25uZWN0aW9uQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqXHJcbiAqIEBwYXJhbSBjYWxsYmFjayB7ZnVuY3Rpb259IChQZWVyLCBPYmplY3QpXHJcbiAqL1xyXG5mdW5jdGlvbiBvbm1lc3NhZ2UoY2FsbGJhY2spIHtcclxuICAgIG9uTWVzc2FnZUNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcclxufVxyXG5cclxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiBFWFBPUlRcclxuID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5leHBvcnRzLm9ubWVzc2FnZSA9IG9ubWVzc2FnZTtcclxuZXhwb3J0cy5jcmVhdGVPZmZlciA9IGNyZWF0ZU9mZmVyO1xyXG5leHBvcnRzLmhhbmRsZUFuc3dlciA9IGhhbmRsZUFuc3dlcjtcclxuZXhwb3J0cy5jcmVhdGVBbnN3ZXIgPSBjcmVhdGVBbnN3ZXI7XHJcbmV4cG9ydHMub25SZW1vdGVDb25uZWN0aW9uID0gb25SZW1vdGVDb25uZWN0aW9uO1xyXG5leHBvcnRzLmFkZHJlc3MgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4gQUREUkVTUztcclxufTsiLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUHJvbWlzZSkge1xudmFyIFNvbWVQcm9taXNlQXJyYXkgPSBQcm9taXNlLl9Tb21lUHJvbWlzZUFycmF5O1xuZnVuY3Rpb24gUHJvbWlzZSRfQW55KHByb21pc2VzKSB7XG4gICAgdmFyIHJldCA9IG5ldyBTb21lUHJvbWlzZUFycmF5KHByb21pc2VzKTtcbiAgICB2YXIgcHJvbWlzZSA9IHJldC5wcm9taXNlKCk7XG4gICAgaWYgKHByb21pc2UuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICByZXQuc2V0SG93TWFueSgxKTtcbiAgICByZXQuc2V0VW53cmFwKCk7XG4gICAgcmV0LmluaXQoKTtcbiAgICByZXR1cm4gcHJvbWlzZTtcbn1cblxuUHJvbWlzZS5hbnkgPSBmdW5jdGlvbiBQcm9taXNlJEFueShwcm9taXNlcykge1xuICAgIHJldHVybiBQcm9taXNlJF9BbnkocHJvbWlzZXMpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuYW55ID0gZnVuY3Rpb24gUHJvbWlzZSRhbnkoKSB7XG4gICAgcmV0dXJuIFByb21pc2UkX0FueSh0aGlzKTtcbn07XG5cbn07XG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG52YXIgc2NoZWR1bGUgPSByZXF1aXJlKFwiLi9zY2hlZHVsZS5qc1wiKTtcbnZhciBRdWV1ZSA9IHJlcXVpcmUoXCIuL3F1ZXVlLmpzXCIpO1xudmFyIGVycm9yT2JqID0gcmVxdWlyZShcIi4vdXRpbC5qc1wiKS5lcnJvck9iajtcbnZhciB0cnlDYXRjaDEgPSByZXF1aXJlKFwiLi91dGlsLmpzXCIpLnRyeUNhdGNoMTtcbnZhciBfcHJvY2VzcyA9IHR5cGVvZiBwcm9jZXNzICE9PSBcInVuZGVmaW5lZFwiID8gcHJvY2VzcyA6IHZvaWQgMDtcblxuZnVuY3Rpb24gQXN5bmMoKSB7XG4gICAgdGhpcy5faXNUaWNrVXNlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3NjaGVkdWxlID0gc2NoZWR1bGU7XG4gICAgdGhpcy5fbGVuZ3RoID0gMDtcbiAgICB0aGlzLl9sYXRlQnVmZmVyID0gbmV3IFF1ZXVlKDE2KTtcbiAgICB0aGlzLl9mdW5jdGlvbkJ1ZmZlciA9IG5ldyBRdWV1ZSg2NTUzNik7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuY29uc3VtZUZ1bmN0aW9uQnVmZmVyID0gZnVuY3Rpb24gQXN5bmMkY29uc3VtZUZ1bmN0aW9uQnVmZmVyKCkge1xuICAgICAgICBzZWxmLl9jb25zdW1lRnVuY3Rpb25CdWZmZXIoKTtcbiAgICB9O1xufVxuXG5Bc3luYy5wcm90b3R5cGUuaGF2ZUl0ZW1zUXVldWVkID0gZnVuY3Rpb24gQXN5bmMkaGF2ZUl0ZW1zUXVldWVkKCkge1xuICAgIHJldHVybiB0aGlzLl9sZW5ndGggPiAwO1xufTtcblxuQXN5bmMucHJvdG90eXBlLmludm9rZUxhdGVyID0gZnVuY3Rpb24gQXN5bmMkaW52b2tlTGF0ZXIoZm4sIHJlY2VpdmVyLCBhcmcpIHtcbiAgICBpZiAoX3Byb2Nlc3MgIT09IHZvaWQgMCAmJlxuICAgICAgICBfcHJvY2Vzcy5kb21haW4gIT0gbnVsbCAmJlxuICAgICAgICAhZm4uZG9tYWluKSB7XG4gICAgICAgIGZuID0gX3Byb2Nlc3MuZG9tYWluLmJpbmQoZm4pO1xuICAgIH1cbiAgICB0aGlzLl9sYXRlQnVmZmVyLnB1c2goZm4sIHJlY2VpdmVyLCBhcmcpO1xuICAgIHRoaXMuX3F1ZXVlVGljaygpO1xufTtcblxuQXN5bmMucHJvdG90eXBlLmludm9rZSA9IGZ1bmN0aW9uIEFzeW5jJGludm9rZShmbiwgcmVjZWl2ZXIsIGFyZykge1xuICAgIGlmIChfcHJvY2VzcyAhPT0gdm9pZCAwICYmXG4gICAgICAgIF9wcm9jZXNzLmRvbWFpbiAhPSBudWxsICYmXG4gICAgICAgICFmbi5kb21haW4pIHtcbiAgICAgICAgZm4gPSBfcHJvY2Vzcy5kb21haW4uYmluZChmbik7XG4gICAgfVxuICAgIHZhciBmdW5jdGlvbkJ1ZmZlciA9IHRoaXMuX2Z1bmN0aW9uQnVmZmVyO1xuICAgIGZ1bmN0aW9uQnVmZmVyLnB1c2goZm4sIHJlY2VpdmVyLCBhcmcpO1xuICAgIHRoaXMuX2xlbmd0aCA9IGZ1bmN0aW9uQnVmZmVyLmxlbmd0aCgpO1xuICAgIHRoaXMuX3F1ZXVlVGljaygpO1xufTtcblxuQXN5bmMucHJvdG90eXBlLl9jb25zdW1lRnVuY3Rpb25CdWZmZXIgPVxuZnVuY3Rpb24gQXN5bmMkX2NvbnN1bWVGdW5jdGlvbkJ1ZmZlcigpIHtcbiAgICB2YXIgZnVuY3Rpb25CdWZmZXIgPSB0aGlzLl9mdW5jdGlvbkJ1ZmZlcjtcbiAgICB3aGlsZSAoZnVuY3Rpb25CdWZmZXIubGVuZ3RoKCkgPiAwKSB7XG4gICAgICAgIHZhciBmbiA9IGZ1bmN0aW9uQnVmZmVyLnNoaWZ0KCk7XG4gICAgICAgIHZhciByZWNlaXZlciA9IGZ1bmN0aW9uQnVmZmVyLnNoaWZ0KCk7XG4gICAgICAgIHZhciBhcmcgPSBmdW5jdGlvbkJ1ZmZlci5zaGlmdCgpO1xuICAgICAgICBmbi5jYWxsKHJlY2VpdmVyLCBhcmcpO1xuICAgIH1cbiAgICB0aGlzLl9yZXNldCgpO1xuICAgIHRoaXMuX2NvbnN1bWVMYXRlQnVmZmVyKCk7XG59O1xuXG5Bc3luYy5wcm90b3R5cGUuX2NvbnN1bWVMYXRlQnVmZmVyID0gZnVuY3Rpb24gQXN5bmMkX2NvbnN1bWVMYXRlQnVmZmVyKCkge1xuICAgIHZhciBidWZmZXIgPSB0aGlzLl9sYXRlQnVmZmVyO1xuICAgIHdoaWxlKGJ1ZmZlci5sZW5ndGgoKSA+IDApIHtcbiAgICAgICAgdmFyIGZuID0gYnVmZmVyLnNoaWZ0KCk7XG4gICAgICAgIHZhciByZWNlaXZlciA9IGJ1ZmZlci5zaGlmdCgpO1xuICAgICAgICB2YXIgYXJnID0gYnVmZmVyLnNoaWZ0KCk7XG4gICAgICAgIHZhciByZXMgPSB0cnlDYXRjaDEoZm4sIHJlY2VpdmVyLCBhcmcpO1xuICAgICAgICBpZiAocmVzID09PSBlcnJvck9iaikge1xuICAgICAgICAgICAgdGhpcy5fcXVldWVUaWNrKCk7XG4gICAgICAgICAgICBpZiAoZm4uZG9tYWluICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBmbi5kb21haW4uZW1pdChcImVycm9yXCIsIHJlcy5lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgcmVzLmU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5Bc3luYy5wcm90b3R5cGUuX3F1ZXVlVGljayA9IGZ1bmN0aW9uIEFzeW5jJF9xdWV1ZSgpIHtcbiAgICBpZiAoIXRoaXMuX2lzVGlja1VzZWQpIHtcbiAgICAgICAgdGhpcy5fc2NoZWR1bGUodGhpcy5jb25zdW1lRnVuY3Rpb25CdWZmZXIpO1xuICAgICAgICB0aGlzLl9pc1RpY2tVc2VkID0gdHJ1ZTtcbiAgICB9XG59O1xuXG5Bc3luYy5wcm90b3R5cGUuX3Jlc2V0ID0gZnVuY3Rpb24gQXN5bmMkX3Jlc2V0KCkge1xuICAgIHRoaXMuX2lzVGlja1VzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9sZW5ndGggPSAwO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgQXN5bmMoKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJykpIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoXCIuL3Byb21pc2UuanNcIikoKTtcbm1vZHVsZS5leHBvcnRzID0gUHJvbWlzZTsiLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbnZhciBjciA9IE9iamVjdC5jcmVhdGU7XG5pZiAoY3IpIHtcbiAgICB2YXIgY2FsbGVyQ2FjaGUgPSBjcihudWxsKTtcbiAgICB2YXIgZ2V0dGVyQ2FjaGUgPSBjcihudWxsKTtcbiAgICBjYWxsZXJDYWNoZVtcIiBzaXplXCJdID0gZ2V0dGVyQ2FjaGVbXCIgc2l6ZVwiXSA9IDA7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUHJvbWlzZSkge1xudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsLmpzXCIpO1xudmFyIGNhbkV2YWx1YXRlID0gdXRpbC5jYW5FdmFsdWF0ZTtcbnZhciBpc0lkZW50aWZpZXIgPSB1dGlsLmlzSWRlbnRpZmllcjtcblxuZnVuY3Rpb24gbWFrZU1ldGhvZENhbGxlciAobWV0aG9kTmFtZSkge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oXCJvYmpcIiwgXCIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAndXNlIHN0cmljdCcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICB2YXIgbGVuID0gdGhpcy5sZW5ndGg7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICBzd2l0Y2gobGVuKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgY2FzZSAxOiByZXR1cm4gb2JqLm1ldGhvZE5hbWUodGhpc1swXSk7ICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgY2FzZSAyOiByZXR1cm4gb2JqLm1ldGhvZE5hbWUodGhpc1swXSwgdGhpc1sxXSk7ICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgY2FzZSAzOiByZXR1cm4gb2JqLm1ldGhvZE5hbWUodGhpc1swXSwgdGhpc1sxXSwgdGhpc1syXSk7ICAgICAgICBcXG5cXFxuICAgICAgICAgICAgY2FzZSAwOiByZXR1cm4gb2JqLm1ldGhvZE5hbWUoKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgZGVmYXVsdDogcmV0dXJuIG9iai5tZXRob2ROYW1lLmFwcGx5KG9iaiwgdGhpcyk7ICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICB9ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICBcIi5yZXBsYWNlKC9tZXRob2ROYW1lL2csIG1ldGhvZE5hbWUpKTtcbn1cblxuZnVuY3Rpb24gbWFrZUdldHRlciAocHJvcGVydHlOYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbihcIm9ialwiLCBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxcblxcXG4gICAgICAgICd1c2Ugc3RyaWN0JzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxcblxcXG4gICAgICAgIHJldHVybiBvYmoucHJvcGVydHlOYW1lOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxcblxcXG4gICAgICAgIFwiLnJlcGxhY2UoXCJwcm9wZXJ0eU5hbWVcIiwgcHJvcGVydHlOYW1lKSk7XG59XG5cbmZ1bmN0aW9uIGdldENvbXBpbGVkKG5hbWUsIGNvbXBpbGVyLCBjYWNoZSkge1xuICAgIHZhciByZXQgPSBjYWNoZVtuYW1lXTtcbiAgICBpZiAodHlwZW9mIHJldCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGlmICghaXNJZGVudGlmaWVyKG5hbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXQgPSBjb21waWxlcihuYW1lKTtcbiAgICAgICAgY2FjaGVbbmFtZV0gPSByZXQ7XG4gICAgICAgIGNhY2hlW1wiIHNpemVcIl0rKztcbiAgICAgICAgaWYgKGNhY2hlW1wiIHNpemVcIl0gPiA1MTIpIHtcbiAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAyNTY7ICsraSkgZGVsZXRlIGNhY2hlW2tleXNbaV1dO1xuICAgICAgICAgICAgY2FjaGVbXCIgc2l6ZVwiXSA9IGtleXMubGVuZ3RoIC0gMjU2O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGdldE1ldGhvZENhbGxlcihuYW1lKSB7XG4gICAgcmV0dXJuIGdldENvbXBpbGVkKG5hbWUsIG1ha2VNZXRob2RDYWxsZXIsIGNhbGxlckNhY2hlKTtcbn1cblxuZnVuY3Rpb24gZ2V0R2V0dGVyKG5hbWUpIHtcbiAgICByZXR1cm4gZ2V0Q29tcGlsZWQobmFtZSwgbWFrZUdldHRlciwgZ2V0dGVyQ2FjaGUpO1xufVxuXG5mdW5jdGlvbiBjYWxsZXIob2JqKSB7XG4gICAgcmV0dXJuIG9ialt0aGlzLnBvcCgpXS5hcHBseShvYmosIHRoaXMpO1xufVxuUHJvbWlzZS5wcm90b3R5cGUuY2FsbCA9IGZ1bmN0aW9uIFByb21pc2UkY2FsbChtZXRob2ROYW1lKSB7XG4gICAgdmFyICRfbGVuID0gYXJndW1lbnRzLmxlbmd0aDt2YXIgYXJncyA9IG5ldyBBcnJheSgkX2xlbiAtIDEpOyBmb3IodmFyICRfaSA9IDE7ICRfaSA8ICRfbGVuOyArKyRfaSkge2FyZ3NbJF9pIC0gMV0gPSBhcmd1bWVudHNbJF9pXTt9XG4gICAgaWYgKGNhbkV2YWx1YXRlKSB7XG4gICAgICAgIHZhciBtYXliZUNhbGxlciA9IGdldE1ldGhvZENhbGxlcihtZXRob2ROYW1lKTtcbiAgICAgICAgaWYgKG1heWJlQ2FsbGVyICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdGhlbihtYXliZUNhbGxlciwgdm9pZCAwLCB2b2lkIDAsIGFyZ3MsIHZvaWQgMCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXJncy5wdXNoKG1ldGhvZE5hbWUpO1xuICAgIHJldHVybiB0aGlzLl90aGVuKGNhbGxlciwgdm9pZCAwLCB2b2lkIDAsIGFyZ3MsIHZvaWQgMCk7XG59O1xuXG5mdW5jdGlvbiBuYW1lZEdldHRlcihvYmopIHtcbiAgICByZXR1cm4gb2JqW3RoaXNdO1xufVxuZnVuY3Rpb24gaW5kZXhlZEdldHRlcihvYmopIHtcbiAgICByZXR1cm4gb2JqW3RoaXNdO1xufVxuUHJvbWlzZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gUHJvbWlzZSRnZXQocHJvcGVydHlOYW1lKSB7XG4gICAgdmFyIGlzSW5kZXggPSAodHlwZW9mIHByb3BlcnR5TmFtZSA9PT0gXCJudW1iZXJcIik7XG4gICAgdmFyIGdldHRlcjtcbiAgICBpZiAoIWlzSW5kZXgpIHtcbiAgICAgICAgaWYgKGNhbkV2YWx1YXRlKSB7XG4gICAgICAgICAgICB2YXIgbWF5YmVHZXR0ZXIgPSBnZXRHZXR0ZXIocHJvcGVydHlOYW1lKTtcbiAgICAgICAgICAgIGdldHRlciA9IG1heWJlR2V0dGVyICE9PSBudWxsID8gbWF5YmVHZXR0ZXIgOiBuYW1lZEdldHRlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGdldHRlciA9IG5hbWVkR2V0dGVyO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZ2V0dGVyID0gaW5kZXhlZEdldHRlcjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3RoZW4oZ2V0dGVyLCB2b2lkIDAsIHZvaWQgMCwgcHJvcGVydHlOYW1lLCB2b2lkIDApO1xufTtcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUHJvbWlzZSwgSU5URVJOQUwpIHtcbnZhciBlcnJvcnMgPSByZXF1aXJlKFwiLi9lcnJvcnMuanNcIik7XG52YXIgY2FuQXR0YWNoID0gZXJyb3JzLmNhbkF0dGFjaDtcbnZhciBhc3luYyA9IHJlcXVpcmUoXCIuL2FzeW5jLmpzXCIpO1xudmFyIENhbmNlbGxhdGlvbkVycm9yID0gZXJyb3JzLkNhbmNlbGxhdGlvbkVycm9yO1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fY2FuY2VsID0gZnVuY3Rpb24gUHJvbWlzZSRfY2FuY2VsKHJlYXNvbikge1xuICAgIGlmICghdGhpcy5pc0NhbmNlbGxhYmxlKCkpIHJldHVybiB0aGlzO1xuICAgIHZhciBwYXJlbnQ7XG4gICAgdmFyIHByb21pc2VUb1JlamVjdCA9IHRoaXM7XG4gICAgd2hpbGUgKChwYXJlbnQgPSBwcm9taXNlVG9SZWplY3QuX2NhbmNlbGxhdGlvblBhcmVudCkgIT09IHZvaWQgMCAmJlxuICAgICAgICBwYXJlbnQuaXNDYW5jZWxsYWJsZSgpKSB7XG4gICAgICAgIHByb21pc2VUb1JlamVjdCA9IHBhcmVudDtcbiAgICB9XG4gICAgdGhpcy5fdW5zZXRDYW5jZWxsYWJsZSgpO1xuICAgIHByb21pc2VUb1JlamVjdC5fYXR0YWNoRXh0cmFUcmFjZShyZWFzb24pO1xuICAgIHByb21pc2VUb1JlamVjdC5fcmVqZWN0VW5jaGVja2VkKHJlYXNvbik7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiBQcm9taXNlJGNhbmNlbChyZWFzb24pIHtcbiAgICBpZiAoIXRoaXMuaXNDYW5jZWxsYWJsZSgpKSByZXR1cm4gdGhpcztcbiAgICByZWFzb24gPSByZWFzb24gIT09IHZvaWQgMFxuICAgICAgICA/IChjYW5BdHRhY2gocmVhc29uKSA/IHJlYXNvbiA6IG5ldyBFcnJvcihyZWFzb24gKyBcIlwiKSlcbiAgICAgICAgOiBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcbiAgICBhc3luYy5pbnZva2VMYXRlcih0aGlzLl9jYW5jZWwsIHRoaXMsIHJlYXNvbik7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5jYW5jZWxsYWJsZSA9IGZ1bmN0aW9uIFByb21pc2UkY2FuY2VsbGFibGUoKSB7XG4gICAgaWYgKHRoaXMuX2NhbmNlbGxhYmxlKCkpIHJldHVybiB0aGlzO1xuICAgIHRoaXMuX3NldENhbmNlbGxhYmxlKCk7XG4gICAgdGhpcy5fY2FuY2VsbGF0aW9uUGFyZW50ID0gdm9pZCAwO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUudW5jYW5jZWxsYWJsZSA9IGZ1bmN0aW9uIFByb21pc2UkdW5jYW5jZWxsYWJsZSgpIHtcbiAgICB2YXIgcmV0ID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICAgIHJldC5fcHJvcGFnYXRlRnJvbSh0aGlzLCAyIHwgNCk7XG4gICAgcmV0Ll9mb2xsb3codGhpcyk7XG4gICAgcmV0Ll91bnNldENhbmNlbGxhYmxlKCk7XG4gICAgcmV0dXJuIHJldDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmZvcmsgPVxuZnVuY3Rpb24gUHJvbWlzZSRmb3JrKGRpZEZ1bGZpbGwsIGRpZFJlamVjdCwgZGlkUHJvZ3Jlc3MpIHtcbiAgICB2YXIgcmV0ID0gdGhpcy5fdGhlbihkaWRGdWxmaWxsLCBkaWRSZWplY3QsIGRpZFByb2dyZXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgIHZvaWQgMCwgdm9pZCAwKTtcblxuICAgIHJldC5fc2V0Q2FuY2VsbGFibGUoKTtcbiAgICByZXQuX2NhbmNlbGxhdGlvblBhcmVudCA9IHZvaWQgMDtcbiAgICByZXR1cm4gcmV0O1xufTtcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKFwiLi91dGlsLmpzXCIpLmluaGVyaXRzO1xudmFyIGRlZmluZVByb3BlcnR5ID0gcmVxdWlyZShcIi4vZXM1LmpzXCIpLmRlZmluZVByb3BlcnR5O1xuXG52YXIgcmlnbm9yZSA9IG5ldyBSZWdFeHAoXG4gICAgXCJcXFxcYig/OlthLXpBLVowLTkuXStcXFxcJF9cXFxcdyt8XCIgK1xuICAgIFwidHJ5Q2F0Y2goPzoxfDJ8M3w0fEFwcGx5KXxuZXcgXFxcXHcqUHJvbWlzZUFycmF5fFwiICtcbiAgICBcIlxcXFx3KlByb21pc2VBcnJheVxcXFwuXFxcXHcqUHJvbWlzZUFycmF5fFwiICtcbiAgICBcInNldFRpbWVvdXR8Q2F0Y2hGaWx0ZXJcXFxcJF9cXFxcdyt8bWFrZU5vZGVQcm9taXNpZmllZHxwcm9jZXNzSW1tZWRpYXRlfFwiICtcbiAgICBcInByb2Nlc3MuX3RpY2tDYWxsYmFja3xuZXh0VGlja3xBc3luY1xcXFwkXFxcXHcrKVxcXFxiXCJcbik7XG5cbnZhciBydHJhY2VsaW5lID0gbnVsbDtcbnZhciBmb3JtYXRTdGFjayA9IG51bGw7XG5cbmZ1bmN0aW9uIGZvcm1hdE5vbkVycm9yKG9iaikge1xuICAgIHZhciBzdHI7XG4gICAgaWYgKHR5cGVvZiBvYmogPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBzdHIgPSBcIltmdW5jdGlvbiBcIiArXG4gICAgICAgICAgICAob2JqLm5hbWUgfHwgXCJhbm9ueW1vdXNcIikgK1xuICAgICAgICAgICAgXCJdXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gb2JqLnRvU3RyaW5nKCk7XG4gICAgICAgIHZhciBydXNlbGVzc1RvU3RyaW5nID0gL1xcW29iamVjdCBbYS16QS1aMC05JF9dK1xcXS87XG4gICAgICAgIGlmIChydXNlbGVzc1RvU3RyaW5nLnRlc3Qoc3RyKSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB2YXIgbmV3U3RyID0gSlNPTi5zdHJpbmdpZnkob2JqKTtcbiAgICAgICAgICAgICAgICBzdHIgPSBuZXdTdHI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlKSB7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgc3RyID0gXCIoZW1wdHkgYXJyYXkpXCI7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIChcIig8XCIgKyBzbmlwKHN0cikgKyBcIj4sIG5vIHN0YWNrIHRyYWNlKVwiKTtcbn1cblxuZnVuY3Rpb24gc25pcChzdHIpIHtcbiAgICB2YXIgbWF4Q2hhcnMgPSA0MTtcbiAgICBpZiAoc3RyLmxlbmd0aCA8IG1heENoYXJzKSB7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIHJldHVybiBzdHIuc3Vic3RyKDAsIG1heENoYXJzIC0gMykgKyBcIi4uLlwiO1xufVxuXG5mdW5jdGlvbiBDYXB0dXJlZFRyYWNlKGlnbm9yZVVudGlsLCBpc1RvcExldmVsKSB7XG4gICAgdGhpcy5jYXB0dXJlU3RhY2tUcmFjZShDYXB0dXJlZFRyYWNlLCBpc1RvcExldmVsKTtcblxufVxuaW5oZXJpdHMoQ2FwdHVyZWRUcmFjZSwgRXJyb3IpO1xuXG5DYXB0dXJlZFRyYWNlLnByb3RvdHlwZS5jYXB0dXJlU3RhY2tUcmFjZSA9XG5mdW5jdGlvbiBDYXB0dXJlZFRyYWNlJGNhcHR1cmVTdGFja1RyYWNlKGlnbm9yZVVudGlsLCBpc1RvcExldmVsKSB7XG4gICAgY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgaWdub3JlVW50aWwsIGlzVG9wTGV2ZWwpO1xufTtcblxuQ2FwdHVyZWRUcmFjZS5wb3NzaWJseVVuaGFuZGxlZFJlamVjdGlvbiA9XG5mdW5jdGlvbiBDYXB0dXJlZFRyYWNlJFBvc3NpYmx5VW5oYW5kbGVkUmVqZWN0aW9uKHJlYXNvbikge1xuICAgIGlmICh0eXBlb2YgY29uc29sZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICB2YXIgbWVzc2FnZTtcbiAgICAgICAgaWYgKHR5cGVvZiByZWFzb24gPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIHJlYXNvbiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICB2YXIgc3RhY2sgPSByZWFzb24uc3RhY2s7XG4gICAgICAgICAgICBtZXNzYWdlID0gXCJQb3NzaWJseSB1bmhhbmRsZWQgXCIgKyBmb3JtYXRTdGFjayhzdGFjaywgcmVhc29uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBcIlBvc3NpYmx5IHVuaGFuZGxlZCBcIiArIFN0cmluZyhyZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gXCJmdW5jdGlvblwiIHx8XG4gICAgICAgICAgICB0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29uc29sZS5sb2cgPT09IFwiZnVuY3Rpb25cIiB8fFxuICAgICAgICAgICAgdHlwZW9mIGNvbnNvbGUubG9nID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkNhcHR1cmVkVHJhY2UuY29tYmluZSA9IGZ1bmN0aW9uIENhcHR1cmVkVHJhY2UkQ29tYmluZShjdXJyZW50LCBwcmV2KSB7XG4gICAgdmFyIGN1cnJlbnRMYXN0SW5kZXggPSBjdXJyZW50Lmxlbmd0aCAtIDE7XG4gICAgdmFyIGN1cnJlbnRMYXN0TGluZSA9IGN1cnJlbnRbY3VycmVudExhc3RJbmRleF07XG4gICAgdmFyIGNvbW1vblJvb3RNZWV0UG9pbnQgPSAtMTtcbiAgICBmb3IgKHZhciBpID0gcHJldi5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICBpZiAocHJldltpXSA9PT0gY3VycmVudExhc3RMaW5lKSB7XG4gICAgICAgICAgICBjb21tb25Sb290TWVldFBvaW50ID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IGNvbW1vblJvb3RNZWV0UG9pbnQ7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBsaW5lID0gcHJldltpXTtcbiAgICAgICAgaWYgKGN1cnJlbnRbY3VycmVudExhc3RJbmRleF0gPT09IGxpbmUpIHtcbiAgICAgICAgICAgIGN1cnJlbnQucG9wKCk7XG4gICAgICAgICAgICBjdXJyZW50TGFzdEluZGV4LS07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGN1cnJlbnQucHVzaChcIkZyb20gcHJldmlvdXMgZXZlbnQ6XCIpO1xuICAgIHZhciBsaW5lcyA9IGN1cnJlbnQuY29uY2F0KHByZXYpO1xuXG4gICAgdmFyIHJldCA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG5cbiAgICAgICAgaWYgKCgocmlnbm9yZS50ZXN0KGxpbmVzW2ldKSAmJiBydHJhY2VsaW5lLnRlc3QobGluZXNbaV0pKSB8fFxuICAgICAgICAgICAgKGkgPiAwICYmICFydHJhY2VsaW5lLnRlc3QobGluZXNbaV0pKSAmJlxuICAgICAgICAgICAgbGluZXNbaV0gIT09IFwiRnJvbSBwcmV2aW91cyBldmVudDpcIilcbiAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldC5wdXNoKGxpbmVzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbn07XG5cbkNhcHR1cmVkVHJhY2UucHJvdGVjdEVycm9yTWVzc2FnZU5ld2xpbmVzID0gZnVuY3Rpb24oc3RhY2spIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0YWNrLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmIChydHJhY2VsaW5lLnRlc3Qoc3RhY2tbaV0pKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpIDw9IDEpIHJldHVybjtcblxuICAgIHZhciBlcnJvck1lc3NhZ2VMaW5lcyA9IFtdO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgaTsgKytqKSB7XG4gICAgICAgIGVycm9yTWVzc2FnZUxpbmVzLnB1c2goc3RhY2suc2hpZnQoKSk7XG4gICAgfVxuICAgIHN0YWNrLnVuc2hpZnQoZXJyb3JNZXNzYWdlTGluZXMuam9pbihcIlxcdTAwMDJcXHUwMDAwXFx1MDAwMVwiKSk7XG59O1xuXG5DYXB0dXJlZFRyYWNlLmlzU3VwcG9ydGVkID0gZnVuY3Rpb24gQ2FwdHVyZWRUcmFjZSRJc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gdHlwZW9mIGNhcHR1cmVTdGFja1RyYWNlID09PSBcImZ1bmN0aW9uXCI7XG59O1xuXG52YXIgY2FwdHVyZVN0YWNrVHJhY2UgPSAoZnVuY3Rpb24gc3RhY2tEZXRlY3Rpb24oKSB7XG4gICAgaWYgKHR5cGVvZiBFcnJvci5zdGFja1RyYWNlTGltaXQgPT09IFwibnVtYmVyXCIgJiZcbiAgICAgICAgdHlwZW9mIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgcnRyYWNlbGluZSA9IC9eXFxzKmF0XFxzKi87XG4gICAgICAgIGZvcm1hdFN0YWNrID0gZnVuY3Rpb24oc3RhY2ssIGVycm9yKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHN0YWNrID09PSBcInN0cmluZ1wiKSByZXR1cm4gc3RhY2s7XG5cbiAgICAgICAgICAgIGlmIChlcnJvci5uYW1lICE9PSB2b2lkIDAgJiZcbiAgICAgICAgICAgICAgICBlcnJvci5tZXNzYWdlICE9PSB2b2lkIDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3IubmFtZSArIFwiLiBcIiArIGVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0Tm9uRXJyb3IoZXJyb3IpO1xuXG5cbiAgICAgICAgfTtcbiAgICAgICAgdmFyIGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBDYXB0dXJlZFRyYWNlJF9jYXB0dXJlU3RhY2tUcmFjZShcbiAgICAgICAgICAgIHJlY2VpdmVyLCBpZ25vcmVVbnRpbCkge1xuICAgICAgICAgICAgY2FwdHVyZVN0YWNrVHJhY2UocmVjZWl2ZXIsIGlnbm9yZVVudGlsKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcigpO1xuXG4gICAgaWYgKHR5cGVvZiBlcnIuc3RhY2sgPT09IFwic3RyaW5nXCIgJiZcbiAgICAgICAgdHlwZW9mIFwiXCIuc3RhcnRzV2l0aCA9PT0gXCJmdW5jdGlvblwiICYmXG4gICAgICAgIChlcnIuc3RhY2suc3RhcnRzV2l0aChcInN0YWNrRGV0ZWN0aW9uQFwiKSkgJiZcbiAgICAgICAgc3RhY2tEZXRlY3Rpb24ubmFtZSA9PT0gXCJzdGFja0RldGVjdGlvblwiKSB7XG5cbiAgICAgICAgZGVmaW5lUHJvcGVydHkoRXJyb3IsIFwic3RhY2tUcmFjZUxpbWl0XCIsIHtcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgdmFsdWU6IDI1XG4gICAgICAgIH0pO1xuICAgICAgICBydHJhY2VsaW5lID0gL0AvO1xuICAgICAgICB2YXIgcmxpbmUgPSAvW0BcXG5dLztcblxuICAgICAgICBmb3JtYXRTdGFjayA9IGZ1bmN0aW9uKHN0YWNrLCBlcnJvcikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBzdGFjayA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiAoZXJyb3IubmFtZSArIFwiLiBcIiArIGVycm9yLm1lc3NhZ2UgKyBcIlxcblwiICsgc3RhY2spO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZXJyb3IubmFtZSAhPT0gdm9pZCAwICYmXG4gICAgICAgICAgICAgICAgZXJyb3IubWVzc2FnZSAhPT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yLm5hbWUgKyBcIi4gXCIgKyBlcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZvcm1hdE5vbkVycm9yKGVycm9yKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gY2FwdHVyZVN0YWNrVHJhY2Uobykge1xuICAgICAgICAgICAgdmFyIHN0YWNrID0gbmV3IEVycm9yKCkuc3RhY2s7XG4gICAgICAgICAgICB2YXIgc3BsaXQgPSBzdGFjay5zcGxpdChybGluZSk7XG4gICAgICAgICAgICB2YXIgbGVuID0gc3BsaXQubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIHJldCA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgICAgICAgICAgICAgcmV0ICs9IHNwbGl0W2ldO1xuICAgICAgICAgICAgICAgIHJldCArPSBcIkBcIjtcbiAgICAgICAgICAgICAgICByZXQgKz0gc3BsaXRbaSArIDFdO1xuICAgICAgICAgICAgICAgIHJldCArPSBcIlxcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgby5zdGFjayA9IHJldDtcbiAgICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3JtYXRTdGFjayA9IGZ1bmN0aW9uKHN0YWNrLCBlcnJvcikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBzdGFjayA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIHN0YWNrO1xuXG4gICAgICAgICAgICBpZiAoKHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiB8fFxuICAgICAgICAgICAgICAgIHR5cGVvZiBlcnJvciA9PT0gXCJmdW5jdGlvblwiKSAmJlxuICAgICAgICAgICAgICAgIGVycm9yLm5hbWUgIT09IHZvaWQgMCAmJlxuICAgICAgICAgICAgICAgIGVycm9yLm1lc3NhZ2UgIT09IHZvaWQgMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvci5uYW1lICsgXCIuIFwiICsgZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmb3JtYXROb25FcnJvcihlcnJvcik7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufSkoKTtcblxucmV0dXJuIENhcHR1cmVkVHJhY2U7XG59O1xuIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE5FWFRfRklMVEVSKSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgZXJyb3JzID0gcmVxdWlyZShcIi4vZXJyb3JzLmpzXCIpO1xudmFyIHRyeUNhdGNoMSA9IHV0aWwudHJ5Q2F0Y2gxO1xudmFyIGVycm9yT2JqID0gdXRpbC5lcnJvck9iajtcbnZhciBrZXlzID0gcmVxdWlyZShcIi4vZXM1LmpzXCIpLmtleXM7XG52YXIgVHlwZUVycm9yID0gZXJyb3JzLlR5cGVFcnJvcjtcblxuZnVuY3Rpb24gQ2F0Y2hGaWx0ZXIoaW5zdGFuY2VzLCBjYWxsYmFjaywgcHJvbWlzZSkge1xuICAgIHRoaXMuX2luc3RhbmNlcyA9IGluc3RhbmNlcztcbiAgICB0aGlzLl9jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIHRoaXMuX3Byb21pc2UgPSBwcm9taXNlO1xufVxuXG5mdW5jdGlvbiBDYXRjaEZpbHRlciRfc2FmZVByZWRpY2F0ZShwcmVkaWNhdGUsIGUpIHtcbiAgICB2YXIgc2FmZU9iamVjdCA9IHt9O1xuICAgIHZhciByZXRmaWx0ZXIgPSB0cnlDYXRjaDEocHJlZGljYXRlLCBzYWZlT2JqZWN0LCBlKTtcblxuICAgIGlmIChyZXRmaWx0ZXIgPT09IGVycm9yT2JqKSByZXR1cm4gcmV0ZmlsdGVyO1xuXG4gICAgdmFyIHNhZmVLZXlzID0ga2V5cyhzYWZlT2JqZWN0KTtcbiAgICBpZiAoc2FmZUtleXMubGVuZ3RoKSB7XG4gICAgICAgIGVycm9yT2JqLmUgPSBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgXCJDYXRjaCBmaWx0ZXIgbXVzdCBpbmhlcml0IGZyb20gRXJyb3IgXCJcbiAgICAgICAgICArIFwib3IgYmUgYSBzaW1wbGUgcHJlZGljYXRlIGZ1bmN0aW9uXCIpO1xuICAgICAgICByZXR1cm4gZXJyb3JPYmo7XG4gICAgfVxuICAgIHJldHVybiByZXRmaWx0ZXI7XG59XG5cbkNhdGNoRmlsdGVyLnByb3RvdHlwZS5kb0ZpbHRlciA9IGZ1bmN0aW9uIENhdGNoRmlsdGVyJF9kb0ZpbHRlcihlKSB7XG4gICAgdmFyIGNiID0gdGhpcy5fY2FsbGJhY2s7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl9wcm9taXNlO1xuICAgIHZhciBib3VuZFRvID0gcHJvbWlzZS5fYm91bmRUbztcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5faW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIHZhciBpdGVtID0gdGhpcy5faW5zdGFuY2VzW2ldO1xuICAgICAgICB2YXIgaXRlbUlzRXJyb3JUeXBlID0gaXRlbSA9PT0gRXJyb3IgfHxcbiAgICAgICAgICAgIChpdGVtICE9IG51bGwgJiYgaXRlbS5wcm90b3R5cGUgaW5zdGFuY2VvZiBFcnJvcik7XG5cbiAgICAgICAgaWYgKGl0ZW1Jc0Vycm9yVHlwZSAmJiBlIGluc3RhbmNlb2YgaXRlbSkge1xuICAgICAgICAgICAgdmFyIHJldCA9IHRyeUNhdGNoMShjYiwgYm91bmRUbywgZSk7XG4gICAgICAgICAgICBpZiAocmV0ID09PSBlcnJvck9iaikge1xuICAgICAgICAgICAgICAgIE5FWFRfRklMVEVSLmUgPSByZXQuZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gTkVYVF9GSUxURVI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBpdGVtID09PSBcImZ1bmN0aW9uXCIgJiYgIWl0ZW1Jc0Vycm9yVHlwZSkge1xuICAgICAgICAgICAgdmFyIHNob3VsZEhhbmRsZSA9IENhdGNoRmlsdGVyJF9zYWZlUHJlZGljYXRlKGl0ZW0sIGUpO1xuICAgICAgICAgICAgaWYgKHNob3VsZEhhbmRsZSA9PT0gZXJyb3JPYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgdHJhY2UgPSBlcnJvcnMuY2FuQXR0YWNoKGVycm9yT2JqLmUpXG4gICAgICAgICAgICAgICAgICAgID8gZXJyb3JPYmouZVxuICAgICAgICAgICAgICAgICAgICA6IG5ldyBFcnJvcihlcnJvck9iai5lICsgXCJcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvbWlzZS5fYXR0YWNoRXh0cmFUcmFjZSh0cmFjZSk7XG4gICAgICAgICAgICAgICAgZSA9IGVycm9yT2JqLmU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNob3VsZEhhbmRsZSkge1xuICAgICAgICAgICAgICAgIHZhciByZXQgPSB0cnlDYXRjaDEoY2IsIGJvdW5kVG8sIGUpO1xuICAgICAgICAgICAgICAgIGlmIChyZXQgPT09IGVycm9yT2JqKSB7XG4gICAgICAgICAgICAgICAgICAgIE5FWFRfRklMVEVSLmUgPSByZXQuZTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE5FWFRfRklMVEVSO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIE5FWFRfRklMVEVSLmUgPSBlO1xuICAgIHJldHVybiBORVhUX0ZJTFRFUjtcbn07XG5cbnJldHVybiBDYXRjaEZpbHRlcjtcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbC5qc1wiKTtcbnZhciBpc1ByaW1pdGl2ZSA9IHV0aWwuaXNQcmltaXRpdmU7XG52YXIgd3JhcHNQcmltaXRpdmVSZWNlaXZlciA9IHV0aWwud3JhcHNQcmltaXRpdmVSZWNlaXZlcjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihQcm9taXNlKSB7XG52YXIgcmV0dXJuZXIgPSBmdW5jdGlvbiBQcm9taXNlJF9yZXR1cm5lcigpIHtcbiAgICByZXR1cm4gdGhpcztcbn07XG52YXIgdGhyb3dlciA9IGZ1bmN0aW9uIFByb21pc2UkX3Rocm93ZXIoKSB7XG4gICAgdGhyb3cgdGhpcztcbn07XG5cbnZhciB3cmFwcGVyID0gZnVuY3Rpb24gUHJvbWlzZSRfd3JhcHBlcih2YWx1ZSwgYWN0aW9uKSB7XG4gICAgaWYgKGFjdGlvbiA9PT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gUHJvbWlzZSRfdGhyb3dlcigpIHtcbiAgICAgICAgICAgIHRocm93IHZhbHVlO1xuICAgICAgICB9O1xuICAgIH0gZWxzZSBpZiAoYWN0aW9uID09PSAyKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBQcm9taXNlJF9yZXR1cm5lcigpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfTtcbiAgICB9XG59O1xuXG5cblByb21pc2UucHJvdG90eXBlW1wicmV0dXJuXCJdID1cblByb21pc2UucHJvdG90eXBlLnRoZW5SZXR1cm4gPVxuZnVuY3Rpb24gUHJvbWlzZSR0aGVuUmV0dXJuKHZhbHVlKSB7XG4gICAgaWYgKHdyYXBzUHJpbWl0aXZlUmVjZWl2ZXIgJiYgaXNQcmltaXRpdmUodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90aGVuKFxuICAgICAgICAgICAgd3JhcHBlcih2YWx1ZSwgMiksXG4gICAgICAgICAgICB2b2lkIDAsXG4gICAgICAgICAgICB2b2lkIDAsXG4gICAgICAgICAgICB2b2lkIDAsXG4gICAgICAgICAgICB2b2lkIDBcbiAgICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fdGhlbihyZXR1cm5lciwgdm9pZCAwLCB2b2lkIDAsIHZhbHVlLCB2b2lkIDApO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGVbXCJ0aHJvd1wiXSA9XG5Qcm9taXNlLnByb3RvdHlwZS50aGVuVGhyb3cgPVxuZnVuY3Rpb24gUHJvbWlzZSR0aGVuVGhyb3cocmVhc29uKSB7XG4gICAgaWYgKHdyYXBzUHJpbWl0aXZlUmVjZWl2ZXIgJiYgaXNQcmltaXRpdmUocmVhc29uKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGhlbihcbiAgICAgICAgICAgIHdyYXBwZXIocmVhc29uLCAxKSxcbiAgICAgICAgICAgIHZvaWQgMCxcbiAgICAgICAgICAgIHZvaWQgMCxcbiAgICAgICAgICAgIHZvaWQgMCxcbiAgICAgICAgICAgIHZvaWQgMFxuICAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90aGVuKHRocm93ZXIsIHZvaWQgMCwgdm9pZCAwLCByZWFzb24sIHZvaWQgMCk7XG59O1xufTtcbiIsIi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cblwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihQcm9taXNlLCBJTlRFUk5BTCkge1xudmFyIFByb21pc2VSZWR1Y2UgPSBQcm9taXNlLnJlZHVjZTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZWFjaCA9IGZ1bmN0aW9uIFByb21pc2UkZWFjaChmbikge1xuICAgIHJldHVybiBQcm9taXNlUmVkdWNlKHRoaXMsIGZuLCBudWxsLCBJTlRFUk5BTCk7XG59O1xuXG5Qcm9taXNlLmVhY2ggPSBmdW5jdGlvbiBQcm9taXNlJEVhY2gocHJvbWlzZXMsIGZuKSB7XG4gICAgcmV0dXJuIFByb21pc2VSZWR1Y2UocHJvbWlzZXMsIGZuLCBudWxsLCBJTlRFUk5BTCk7XG59O1xufTtcbiIsIi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cblwidXNlIHN0cmljdFwiO1xudmFyIE9iamVjdGZyZWV6ZSA9IHJlcXVpcmUoXCIuL2VzNS5qc1wiKS5mcmVlemU7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgaW5oZXJpdHMgPSB1dGlsLmluaGVyaXRzO1xudmFyIG5vdEVudW1lcmFibGVQcm9wID0gdXRpbC5ub3RFbnVtZXJhYmxlUHJvcDtcblxuZnVuY3Rpb24gbWFya0FzT3JpZ2luYXRpbmdGcm9tUmVqZWN0aW9uKGUpIHtcbiAgICB0cnkge1xuICAgICAgICBub3RFbnVtZXJhYmxlUHJvcChlLCBcImlzT3BlcmF0aW9uYWxcIiwgdHJ1ZSk7XG4gICAgfVxuICAgIGNhdGNoKGlnbm9yZSkge31cbn1cblxuZnVuY3Rpb24gb3JpZ2luYXRlc0Zyb21SZWplY3Rpb24oZSkge1xuICAgIGlmIChlID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gKChlIGluc3RhbmNlb2YgT3BlcmF0aW9uYWxFcnJvcikgfHxcbiAgICAgICAgZVtcImlzT3BlcmF0aW9uYWxcIl0gPT09IHRydWUpO1xufVxuXG5mdW5jdGlvbiBpc0Vycm9yKG9iaikge1xuICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBFcnJvcjtcbn1cblxuZnVuY3Rpb24gY2FuQXR0YWNoKG9iaikge1xuICAgIHJldHVybiBpc0Vycm9yKG9iaik7XG59XG5cbmZ1bmN0aW9uIHN1YkVycm9yKG5hbWVQcm9wZXJ0eSwgZGVmYXVsdE1lc3NhZ2UpIHtcbiAgICBmdW5jdGlvbiBTdWJFcnJvcihtZXNzYWdlKSB7XG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTdWJFcnJvcikpIHJldHVybiBuZXcgU3ViRXJyb3IobWVzc2FnZSk7XG4gICAgICAgIHRoaXMubWVzc2FnZSA9IHR5cGVvZiBtZXNzYWdlID09PSBcInN0cmluZ1wiID8gbWVzc2FnZSA6IGRlZmF1bHRNZXNzYWdlO1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lUHJvcGVydHk7XG4gICAgICAgIGlmIChFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgICAgICAgICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaW5oZXJpdHMoU3ViRXJyb3IsIEVycm9yKTtcbiAgICByZXR1cm4gU3ViRXJyb3I7XG59XG5cbnZhciBfVHlwZUVycm9yLCBfUmFuZ2VFcnJvcjtcbnZhciBDYW5jZWxsYXRpb25FcnJvciA9IHN1YkVycm9yKFwiQ2FuY2VsbGF0aW9uRXJyb3JcIiwgXCJjYW5jZWxsYXRpb24gZXJyb3JcIik7XG52YXIgVGltZW91dEVycm9yID0gc3ViRXJyb3IoXCJUaW1lb3V0RXJyb3JcIiwgXCJ0aW1lb3V0IGVycm9yXCIpO1xudmFyIEFnZ3JlZ2F0ZUVycm9yID0gc3ViRXJyb3IoXCJBZ2dyZWdhdGVFcnJvclwiLCBcImFnZ3JlZ2F0ZSBlcnJvclwiKTtcbnRyeSB7XG4gICAgX1R5cGVFcnJvciA9IFR5cGVFcnJvcjtcbiAgICBfUmFuZ2VFcnJvciA9IFJhbmdlRXJyb3I7XG59IGNhdGNoKGUpIHtcbiAgICBfVHlwZUVycm9yID0gc3ViRXJyb3IoXCJUeXBlRXJyb3JcIiwgXCJ0eXBlIGVycm9yXCIpO1xuICAgIF9SYW5nZUVycm9yID0gc3ViRXJyb3IoXCJSYW5nZUVycm9yXCIsIFwicmFuZ2UgZXJyb3JcIik7XG59XG5cbnZhciBtZXRob2RzID0gKFwiam9pbiBwb3AgcHVzaCBzaGlmdCB1bnNoaWZ0IHNsaWNlIGZpbHRlciBmb3JFYWNoIHNvbWUgXCIgK1xuICAgIFwiZXZlcnkgbWFwIGluZGV4T2YgbGFzdEluZGV4T2YgcmVkdWNlIHJlZHVjZVJpZ2h0IHNvcnQgcmV2ZXJzZVwiKS5zcGxpdChcIiBcIik7XG5cbmZvciAodmFyIGkgPSAwOyBpIDwgbWV0aG9kcy5sZW5ndGg7ICsraSkge1xuICAgIGlmICh0eXBlb2YgQXJyYXkucHJvdG90eXBlW21ldGhvZHNbaV1dID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgQWdncmVnYXRlRXJyb3IucHJvdG90eXBlW21ldGhvZHNbaV1dID0gQXJyYXkucHJvdG90eXBlW21ldGhvZHNbaV1dO1xuICAgIH1cbn1cblxuQWdncmVnYXRlRXJyb3IucHJvdG90eXBlLmxlbmd0aCA9IDA7XG5BZ2dyZWdhdGVFcnJvci5wcm90b3R5cGVbXCJpc09wZXJhdGlvbmFsXCJdID0gdHJ1ZTtcbnZhciBsZXZlbCA9IDA7XG5BZ2dyZWdhdGVFcnJvci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaW5kZW50ID0gQXJyYXkobGV2ZWwgKiA0ICsgMSkuam9pbihcIiBcIik7XG4gICAgdmFyIHJldCA9IFwiXFxuXCIgKyBpbmRlbnQgKyBcIkFnZ3JlZ2F0ZUVycm9yIG9mOlwiICsgXCJcXG5cIjtcbiAgICBsZXZlbCsrO1xuICAgIGluZGVudCA9IEFycmF5KGxldmVsICogNCArIDEpLmpvaW4oXCIgXCIpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgc3RyID0gdGhpc1tpXSA9PT0gdGhpcyA/IFwiW0NpcmN1bGFyIEFnZ3JlZ2F0ZUVycm9yXVwiIDogdGhpc1tpXSArIFwiXCI7XG4gICAgICAgIHZhciBsaW5lcyA9IHN0ci5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBsaW5lcy5sZW5ndGg7ICsraikge1xuICAgICAgICAgICAgbGluZXNbal0gPSBpbmRlbnQgKyBsaW5lc1tqXTtcbiAgICAgICAgfVxuICAgICAgICBzdHIgPSBsaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICByZXQgKz0gc3RyICsgXCJcXG5cIjtcbiAgICB9XG4gICAgbGV2ZWwtLTtcbiAgICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gT3BlcmF0aW9uYWxFcnJvcihtZXNzYWdlKSB7XG4gICAgdGhpcy5uYW1lID0gXCJPcGVyYXRpb25hbEVycm9yXCI7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICB0aGlzLmNhdXNlID0gbWVzc2FnZTtcbiAgICB0aGlzW1wiaXNPcGVyYXRpb25hbFwiXSA9IHRydWU7XG5cbiAgICBpZiAobWVzc2FnZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2UubWVzc2FnZTtcbiAgICAgICAgdGhpcy5zdGFjayA9IG1lc3NhZ2Uuc3RhY2s7XG4gICAgfSBlbHNlIGlmIChFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgICAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcbiAgICB9XG5cbn1cbmluaGVyaXRzKE9wZXJhdGlvbmFsRXJyb3IsIEVycm9yKTtcblxudmFyIGtleSA9IFwiX19CbHVlYmlyZEVycm9yVHlwZXNfX1wiO1xudmFyIGVycm9yVHlwZXMgPSBFcnJvcltrZXldO1xuaWYgKCFlcnJvclR5cGVzKSB7XG4gICAgZXJyb3JUeXBlcyA9IE9iamVjdGZyZWV6ZSh7XG4gICAgICAgIENhbmNlbGxhdGlvbkVycm9yOiBDYW5jZWxsYXRpb25FcnJvcixcbiAgICAgICAgVGltZW91dEVycm9yOiBUaW1lb3V0RXJyb3IsXG4gICAgICAgIE9wZXJhdGlvbmFsRXJyb3I6IE9wZXJhdGlvbmFsRXJyb3IsXG4gICAgICAgIFJlamVjdGlvbkVycm9yOiBPcGVyYXRpb25hbEVycm9yLFxuICAgICAgICBBZ2dyZWdhdGVFcnJvcjogQWdncmVnYXRlRXJyb3JcbiAgICB9KTtcbiAgICBub3RFbnVtZXJhYmxlUHJvcChFcnJvciwga2V5LCBlcnJvclR5cGVzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgRXJyb3I6IEVycm9yLFxuICAgIFR5cGVFcnJvcjogX1R5cGVFcnJvcixcbiAgICBSYW5nZUVycm9yOiBfUmFuZ2VFcnJvcixcbiAgICBDYW5jZWxsYXRpb25FcnJvcjogZXJyb3JUeXBlcy5DYW5jZWxsYXRpb25FcnJvcixcbiAgICBPcGVyYXRpb25hbEVycm9yOiBlcnJvclR5cGVzLk9wZXJhdGlvbmFsRXJyb3IsXG4gICAgVGltZW91dEVycm9yOiBlcnJvclR5cGVzLlRpbWVvdXRFcnJvcixcbiAgICBBZ2dyZWdhdGVFcnJvcjogZXJyb3JUeXBlcy5BZ2dyZWdhdGVFcnJvcixcbiAgICBvcmlnaW5hdGVzRnJvbVJlamVjdGlvbjogb3JpZ2luYXRlc0Zyb21SZWplY3Rpb24sXG4gICAgbWFya0FzT3JpZ2luYXRpbmdGcm9tUmVqZWN0aW9uOiBtYXJrQXNPcmlnaW5hdGluZ0Zyb21SZWplY3Rpb24sXG4gICAgY2FuQXR0YWNoOiBjYW5BdHRhY2hcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUHJvbWlzZSkge1xudmFyIFR5cGVFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3JzLmpzJykuVHlwZUVycm9yO1xuXG5mdW5jdGlvbiBhcGlSZWplY3Rpb24obXNnKSB7XG4gICAgdmFyIGVycm9yID0gbmV3IFR5cGVFcnJvcihtc2cpO1xuICAgIHZhciByZXQgPSBQcm9taXNlLnJlamVjdGVkKGVycm9yKTtcbiAgICB2YXIgcGFyZW50ID0gcmV0Ll9wZWVrQ29udGV4dCgpO1xuICAgIGlmIChwYXJlbnQgIT0gbnVsbCkge1xuICAgICAgICBwYXJlbnQuX2F0dGFjaEV4dHJhVHJhY2UoZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xufVxuXG5yZXR1cm4gYXBpUmVqZWN0aW9uO1xufTtcbiIsIi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cbnZhciBpc0VTNSA9IChmdW5jdGlvbigpe1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHJldHVybiB0aGlzID09PSB2b2lkIDA7XG59KSgpO1xuXG5pZiAoaXNFUzUpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgZnJlZXplOiBPYmplY3QuZnJlZXplLFxuICAgICAgICBkZWZpbmVQcm9wZXJ0eTogT2JqZWN0LmRlZmluZVByb3BlcnR5LFxuICAgICAgICBrZXlzOiBPYmplY3Qua2V5cyxcbiAgICAgICAgZ2V0UHJvdG90eXBlT2Y6IE9iamVjdC5nZXRQcm90b3R5cGVPZixcbiAgICAgICAgaXNBcnJheTogQXJyYXkuaXNBcnJheSxcbiAgICAgICAgaXNFUzU6IGlzRVM1XG4gICAgfTtcbn0gZWxzZSB7XG4gICAgdmFyIGhhcyA9IHt9Lmhhc093blByb3BlcnR5O1xuICAgIHZhciBzdHIgPSB7fS50b1N0cmluZztcbiAgICB2YXIgcHJvdG8gPSB7fS5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG5cbiAgICB2YXIgT2JqZWN0S2V5cyA9IGZ1bmN0aW9uIE9iamVjdEtleXMobykge1xuICAgICAgICB2YXIgcmV0ID0gW107XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvKSB7XG4gICAgICAgICAgICBpZiAoaGFzLmNhbGwobywga2V5KSkge1xuICAgICAgICAgICAgICAgIHJldC5wdXNoKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG5cbiAgICB2YXIgT2JqZWN0RGVmaW5lUHJvcGVydHkgPSBmdW5jdGlvbiBPYmplY3REZWZpbmVQcm9wZXJ0eShvLCBrZXksIGRlc2MpIHtcbiAgICAgICAgb1trZXldID0gZGVzYy52YWx1ZTtcbiAgICAgICAgcmV0dXJuIG87XG4gICAgfVxuXG4gICAgdmFyIE9iamVjdEZyZWV6ZSA9IGZ1bmN0aW9uIE9iamVjdEZyZWV6ZShvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG5cbiAgICB2YXIgT2JqZWN0R2V0UHJvdG90eXBlT2YgPSBmdW5jdGlvbiBPYmplY3RHZXRQcm90b3R5cGVPZihvYmopIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qob2JqKS5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm90bztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBBcnJheUlzQXJyYXkgPSBmdW5jdGlvbiBBcnJheUlzQXJyYXkob2JqKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBpc0FycmF5OiBBcnJheUlzQXJyYXksXG4gICAgICAgIGtleXM6IE9iamVjdEtleXMsXG4gICAgICAgIGRlZmluZVByb3BlcnR5OiBPYmplY3REZWZpbmVQcm9wZXJ0eSxcbiAgICAgICAgZnJlZXplOiBPYmplY3RGcmVlemUsXG4gICAgICAgIGdldFByb3RvdHlwZU9mOiBPYmplY3RHZXRQcm90b3R5cGVPZixcbiAgICAgICAgaXNFUzU6IGlzRVM1XG4gICAgfTtcbn1cbiIsIi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cblwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihQcm9taXNlLCBJTlRFUk5BTCkge1xudmFyIFByb21pc2VNYXAgPSBQcm9taXNlLm1hcDtcblxuUHJvbWlzZS5wcm90b3R5cGUuZmlsdGVyID0gZnVuY3Rpb24gUHJvbWlzZSRmaWx0ZXIoZm4sIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gUHJvbWlzZU1hcCh0aGlzLCBmbiwgb3B0aW9ucywgSU5URVJOQUwpO1xufTtcblxuUHJvbWlzZS5maWx0ZXIgPSBmdW5jdGlvbiBQcm9taXNlJEZpbHRlcihwcm9taXNlcywgZm4sIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gUHJvbWlzZU1hcChwcm9taXNlcywgZm4sIG9wdGlvbnMsIElOVEVSTkFMKTtcbn07XG59O1xuIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFByb21pc2UsIE5FWFRfRklMVEVSLCBjYXN0KSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgd3JhcHNQcmltaXRpdmVSZWNlaXZlciA9IHV0aWwud3JhcHNQcmltaXRpdmVSZWNlaXZlcjtcbnZhciBpc1ByaW1pdGl2ZSA9IHV0aWwuaXNQcmltaXRpdmU7XG52YXIgdGhyb3dlciA9IHV0aWwudGhyb3dlcjtcblxuZnVuY3Rpb24gcmV0dXJuVGhpcygpIHtcbiAgICByZXR1cm4gdGhpcztcbn1cbmZ1bmN0aW9uIHRocm93VGhpcygpIHtcbiAgICB0aHJvdyB0aGlzO1xufVxuZnVuY3Rpb24gcmV0dXJuJChyKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIFByb21pc2UkX3JldHVybmVyKCkge1xuICAgICAgICByZXR1cm4gcjtcbiAgICB9O1xufVxuZnVuY3Rpb24gdGhyb3ckKHIpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gUHJvbWlzZSRfdGhyb3dlcigpIHtcbiAgICAgICAgdGhyb3cgcjtcbiAgICB9O1xufVxuZnVuY3Rpb24gcHJvbWlzZWRGaW5hbGx5KHJldCwgcmVhc29uT3JWYWx1ZSwgaXNGdWxmaWxsZWQpIHtcbiAgICB2YXIgdGhlbjtcbiAgICBpZiAod3JhcHNQcmltaXRpdmVSZWNlaXZlciAmJiBpc1ByaW1pdGl2ZShyZWFzb25PclZhbHVlKSkge1xuICAgICAgICB0aGVuID0gaXNGdWxmaWxsZWQgPyByZXR1cm4kKHJlYXNvbk9yVmFsdWUpIDogdGhyb3ckKHJlYXNvbk9yVmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoZW4gPSBpc0Z1bGZpbGxlZCA/IHJldHVyblRoaXMgOiB0aHJvd1RoaXM7XG4gICAgfVxuICAgIHJldHVybiByZXQuX3RoZW4odGhlbiwgdGhyb3dlciwgdm9pZCAwLCByZWFzb25PclZhbHVlLCB2b2lkIDApO1xufVxuXG5mdW5jdGlvbiBmaW5hbGx5SGFuZGxlcihyZWFzb25PclZhbHVlKSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzLnByb21pc2U7XG4gICAgdmFyIGhhbmRsZXIgPSB0aGlzLmhhbmRsZXI7XG5cbiAgICB2YXIgcmV0ID0gcHJvbWlzZS5faXNCb3VuZCgpXG4gICAgICAgICAgICAgICAgICAgID8gaGFuZGxlci5jYWxsKHByb21pc2UuX2JvdW5kVG8pXG4gICAgICAgICAgICAgICAgICAgIDogaGFuZGxlcigpO1xuXG4gICAgaWYgKHJldCAhPT0gdm9pZCAwKSB7XG4gICAgICAgIHZhciBtYXliZVByb21pc2UgPSBjYXN0KHJldCwgdm9pZCAwKTtcbiAgICAgICAgaWYgKG1heWJlUHJvbWlzZSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlZEZpbmFsbHkobWF5YmVQcm9taXNlLCByZWFzb25PclZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvbWlzZS5pc0Z1bGZpbGxlZCgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwcm9taXNlLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICBORVhUX0ZJTFRFUi5lID0gcmVhc29uT3JWYWx1ZTtcbiAgICAgICAgcmV0dXJuIE5FWFRfRklMVEVSO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZWFzb25PclZhbHVlO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdGFwSGFuZGxlcih2YWx1ZSkge1xuICAgIHZhciBwcm9taXNlID0gdGhpcy5wcm9taXNlO1xuICAgIHZhciBoYW5kbGVyID0gdGhpcy5oYW5kbGVyO1xuXG4gICAgdmFyIHJldCA9IHByb21pc2UuX2lzQm91bmQoKVxuICAgICAgICAgICAgICAgICAgICA/IGhhbmRsZXIuY2FsbChwcm9taXNlLl9ib3VuZFRvLCB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgOiBoYW5kbGVyKHZhbHVlKTtcblxuICAgIGlmIChyZXQgIT09IHZvaWQgMCkge1xuICAgICAgICB2YXIgbWF5YmVQcm9taXNlID0gY2FzdChyZXQsIHZvaWQgMCk7XG4gICAgICAgIGlmIChtYXliZVByb21pc2UgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJvbWlzZWRGaW5hbGx5KG1heWJlUHJvbWlzZSwgdmFsdWUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuX3Bhc3NUaHJvdWdoSGFuZGxlciA9XG5mdW5jdGlvbiBQcm9taXNlJF9wYXNzVGhyb3VnaEhhbmRsZXIoaGFuZGxlciwgaXNGaW5hbGx5KSB7XG4gICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiB0aGlzLnRoZW4oKTtcblxuICAgIHZhciBwcm9taXNlQW5kSGFuZGxlciA9IHtcbiAgICAgICAgcHJvbWlzZTogdGhpcyxcbiAgICAgICAgaGFuZGxlcjogaGFuZGxlclxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5fdGhlbihcbiAgICAgICAgICAgIGlzRmluYWxseSA/IGZpbmFsbHlIYW5kbGVyIDogdGFwSGFuZGxlcixcbiAgICAgICAgICAgIGlzRmluYWxseSA/IGZpbmFsbHlIYW5kbGVyIDogdm9pZCAwLCB2b2lkIDAsXG4gICAgICAgICAgICBwcm9taXNlQW5kSGFuZGxlciwgdm9pZCAwKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmxhc3RseSA9XG5Qcm9taXNlLnByb3RvdHlwZVtcImZpbmFsbHlcIl0gPSBmdW5jdGlvbiBQcm9taXNlJGZpbmFsbHkoaGFuZGxlcikge1xuICAgIHJldHVybiB0aGlzLl9wYXNzVGhyb3VnaEhhbmRsZXIoaGFuZGxlciwgdHJ1ZSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS50YXAgPSBmdW5jdGlvbiBQcm9taXNlJHRhcChoYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Bhc3NUaHJvdWdoSGFuZGxlcihoYW5kbGVyLCBmYWxzZSk7XG59O1xufTtcbiIsIi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cblwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihQcm9taXNlLCBhcGlSZWplY3Rpb24sIElOVEVSTkFMLCBjYXN0KSB7XG52YXIgZXJyb3JzID0gcmVxdWlyZShcIi4vZXJyb3JzLmpzXCIpO1xudmFyIFR5cGVFcnJvciA9IGVycm9ycy5UeXBlRXJyb3I7XG52YXIgZGVwcmVjYXRlZCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIikuZGVwcmVjYXRlZDtcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbC5qc1wiKTtcbnZhciBlcnJvck9iaiA9IHV0aWwuZXJyb3JPYmo7XG52YXIgdHJ5Q2F0Y2gxID0gdXRpbC50cnlDYXRjaDE7XG52YXIgeWllbGRIYW5kbGVycyA9IFtdO1xuXG5mdW5jdGlvbiBwcm9taXNlRnJvbVlpZWxkSGFuZGxlcih2YWx1ZSwgeWllbGRIYW5kbGVycykge1xuICAgIHZhciBfZXJyb3JPYmogPSBlcnJvck9iajtcbiAgICB2YXIgX1Byb21pc2UgPSBQcm9taXNlO1xuICAgIHZhciBsZW4gPSB5aWVsZEhhbmRsZXJzLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSB0cnlDYXRjaDEoeWllbGRIYW5kbGVyc1tpXSwgdm9pZCAwLCB2YWx1ZSk7XG4gICAgICAgIGlmIChyZXN1bHQgPT09IF9lcnJvck9iaikge1xuICAgICAgICAgICAgcmV0dXJuIF9Qcm9taXNlLnJlamVjdChfZXJyb3JPYmouZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG1heWJlUHJvbWlzZSA9IGNhc3QocmVzdWx0LCBwcm9taXNlRnJvbVlpZWxkSGFuZGxlcik7XG4gICAgICAgIGlmIChtYXliZVByb21pc2UgaW5zdGFuY2VvZiBfUHJvbWlzZSkgcmV0dXJuIG1heWJlUHJvbWlzZTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIFByb21pc2VTcGF3bihnZW5lcmF0b3JGdW5jdGlvbiwgcmVjZWl2ZXIsIHlpZWxkSGFuZGxlcikge1xuICAgIHZhciBwcm9taXNlID0gdGhpcy5fcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgICBwcm9taXNlLl9zZXRUcmFjZSh2b2lkIDApO1xuICAgIHRoaXMuX2dlbmVyYXRvckZ1bmN0aW9uID0gZ2VuZXJhdG9yRnVuY3Rpb247XG4gICAgdGhpcy5fcmVjZWl2ZXIgPSByZWNlaXZlcjtcbiAgICB0aGlzLl9nZW5lcmF0b3IgPSB2b2lkIDA7XG4gICAgdGhpcy5feWllbGRIYW5kbGVycyA9IHR5cGVvZiB5aWVsZEhhbmRsZXIgPT09IFwiZnVuY3Rpb25cIlxuICAgICAgICA/IFt5aWVsZEhhbmRsZXJdLmNvbmNhdCh5aWVsZEhhbmRsZXJzKVxuICAgICAgICA6IHlpZWxkSGFuZGxlcnM7XG59XG5cblByb21pc2VTcGF3bi5wcm90b3R5cGUucHJvbWlzZSA9IGZ1bmN0aW9uIFByb21pc2VTcGF3biRwcm9taXNlKCkge1xuICAgIHJldHVybiB0aGlzLl9wcm9taXNlO1xufTtcblxuUHJvbWlzZVNwYXduLnByb3RvdHlwZS5fcnVuID0gZnVuY3Rpb24gUHJvbWlzZVNwYXduJF9ydW4oKSB7XG4gICAgdGhpcy5fZ2VuZXJhdG9yID0gdGhpcy5fZ2VuZXJhdG9yRnVuY3Rpb24uY2FsbCh0aGlzLl9yZWNlaXZlcik7XG4gICAgdGhpcy5fcmVjZWl2ZXIgPVxuICAgICAgICB0aGlzLl9nZW5lcmF0b3JGdW5jdGlvbiA9IHZvaWQgMDtcbiAgICB0aGlzLl9uZXh0KHZvaWQgMCk7XG59O1xuXG5Qcm9taXNlU3Bhd24ucHJvdG90eXBlLl9jb250aW51ZSA9IGZ1bmN0aW9uIFByb21pc2VTcGF3biRfY29udGludWUocmVzdWx0KSB7XG4gICAgaWYgKHJlc3VsdCA9PT0gZXJyb3JPYmopIHtcbiAgICAgICAgdGhpcy5fZ2VuZXJhdG9yID0gdm9pZCAwO1xuICAgICAgICB2YXIgdHJhY2UgPSBlcnJvcnMuY2FuQXR0YWNoKHJlc3VsdC5lKVxuICAgICAgICAgICAgPyByZXN1bHQuZSA6IG5ldyBFcnJvcihyZXN1bHQuZSArIFwiXCIpO1xuICAgICAgICB0aGlzLl9wcm9taXNlLl9hdHRhY2hFeHRyYVRyYWNlKHRyYWNlKTtcbiAgICAgICAgdGhpcy5fcHJvbWlzZS5fcmVqZWN0KHJlc3VsdC5lLCB0cmFjZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWUgPSByZXN1bHQudmFsdWU7XG4gICAgaWYgKHJlc3VsdC5kb25lID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuX2dlbmVyYXRvciA9IHZvaWQgMDtcbiAgICAgICAgaWYgKCF0aGlzLl9wcm9taXNlLl90cnlGb2xsb3codmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9taXNlLl9mdWxmaWxsKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBtYXliZVByb21pc2UgPSBjYXN0KHZhbHVlLCB2b2lkIDApO1xuICAgICAgICBpZiAoIShtYXliZVByb21pc2UgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xuICAgICAgICAgICAgbWF5YmVQcm9taXNlID1cbiAgICAgICAgICAgICAgICBwcm9taXNlRnJvbVlpZWxkSGFuZGxlcihtYXliZVByb21pc2UsIHRoaXMuX3lpZWxkSGFuZGxlcnMpO1xuICAgICAgICAgICAgaWYgKG1heWJlUHJvbWlzZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Rocm93KG5ldyBUeXBlRXJyb3IoXCJBIHZhbHVlIHdhcyB5aWVsZGVkIHRoYXQgY291bGQgbm90IGJlIHRyZWF0ZWQgYXMgYSBwcm9taXNlXCIpKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbWF5YmVQcm9taXNlLl90aGVuKFxuICAgICAgICAgICAgdGhpcy5fbmV4dCxcbiAgICAgICAgICAgIHRoaXMuX3Rocm93LFxuICAgICAgICAgICAgdm9pZCAwLFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIG51bGxcbiAgICAgICApO1xuICAgIH1cbn07XG5cblByb21pc2VTcGF3bi5wcm90b3R5cGUuX3Rocm93ID0gZnVuY3Rpb24gUHJvbWlzZVNwYXduJF90aHJvdyhyZWFzb24pIHtcbiAgICBpZiAoZXJyb3JzLmNhbkF0dGFjaChyZWFzb24pKVxuICAgICAgICB0aGlzLl9wcm9taXNlLl9hdHRhY2hFeHRyYVRyYWNlKHJlYXNvbik7XG4gICAgdGhpcy5fY29udGludWUoXG4gICAgICAgIHRyeUNhdGNoMSh0aGlzLl9nZW5lcmF0b3JbXCJ0aHJvd1wiXSwgdGhpcy5fZ2VuZXJhdG9yLCByZWFzb24pXG4gICApO1xufTtcblxuUHJvbWlzZVNwYXduLnByb3RvdHlwZS5fbmV4dCA9IGZ1bmN0aW9uIFByb21pc2VTcGF3biRfbmV4dCh2YWx1ZSkge1xuICAgIHRoaXMuX2NvbnRpbnVlKFxuICAgICAgICB0cnlDYXRjaDEodGhpcy5fZ2VuZXJhdG9yLm5leHQsIHRoaXMuX2dlbmVyYXRvciwgdmFsdWUpXG4gICApO1xufTtcblxuUHJvbWlzZS5jb3JvdXRpbmUgPVxuZnVuY3Rpb24gUHJvbWlzZSRDb3JvdXRpbmUoZ2VuZXJhdG9yRnVuY3Rpb24sIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZW9mIGdlbmVyYXRvckZ1bmN0aW9uICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImdlbmVyYXRvckZ1bmN0aW9uIG11c3QgYmUgYSBmdW5jdGlvblwiKTtcbiAgICB9XG4gICAgdmFyIHlpZWxkSGFuZGxlciA9IE9iamVjdChvcHRpb25zKS55aWVsZEhhbmRsZXI7XG4gICAgdmFyIFByb21pc2VTcGF3biQgPSBQcm9taXNlU3Bhd247XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGdlbmVyYXRvciA9IGdlbmVyYXRvckZ1bmN0aW9uLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIHZhciBzcGF3biA9IG5ldyBQcm9taXNlU3Bhd24kKHZvaWQgMCwgdm9pZCAwLCB5aWVsZEhhbmRsZXIpO1xuICAgICAgICBzcGF3bi5fZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICAgICAgICBzcGF3bi5fbmV4dCh2b2lkIDApO1xuICAgICAgICByZXR1cm4gc3Bhd24ucHJvbWlzZSgpO1xuICAgIH07XG59O1xuXG5Qcm9taXNlLmNvcm91dGluZS5hZGRZaWVsZEhhbmRsZXIgPSBmdW5jdGlvbihmbikge1xuICAgIGlmICh0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcImZuIG11c3QgYmUgYSBmdW5jdGlvblwiKTtcbiAgICB5aWVsZEhhbmRsZXJzLnB1c2goZm4pO1xufTtcblxuUHJvbWlzZS5zcGF3biA9IGZ1bmN0aW9uIFByb21pc2UkU3Bhd24oZ2VuZXJhdG9yRnVuY3Rpb24pIHtcbiAgICBkZXByZWNhdGVkKFwiUHJvbWlzZS5zcGF3biBpcyBkZXByZWNhdGVkLiBVc2UgUHJvbWlzZS5jb3JvdXRpbmUgaW5zdGVhZC5cIik7XG4gICAgaWYgKHR5cGVvZiBnZW5lcmF0b3JGdW5jdGlvbiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBhcGlSZWplY3Rpb24oXCJnZW5lcmF0b3JGdW5jdGlvbiBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgfVxuICAgIHZhciBzcGF3biA9IG5ldyBQcm9taXNlU3Bhd24oZ2VuZXJhdG9yRnVuY3Rpb24sIHRoaXMpO1xuICAgIHZhciByZXQgPSBzcGF3bi5wcm9taXNlKCk7XG4gICAgc3Bhd24uX3J1bihQcm9taXNlLnNwYXduKTtcbiAgICByZXR1cm4gcmV0O1xufTtcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID1cbmZ1bmN0aW9uKFByb21pc2UsIFByb21pc2VBcnJheSwgY2FzdCwgSU5URVJOQUwpIHtcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbC5qc1wiKTtcbnZhciBjYW5FdmFsdWF0ZSA9IHV0aWwuY2FuRXZhbHVhdGU7XG52YXIgdHJ5Q2F0Y2gxID0gdXRpbC50cnlDYXRjaDE7XG52YXIgZXJyb3JPYmogPSB1dGlsLmVycm9yT2JqO1xuXG5cbmlmIChjYW5FdmFsdWF0ZSkge1xuICAgIHZhciB0aGVuQ2FsbGJhY2sgPSBmdW5jdGlvbihpKSB7XG4gICAgICAgIHJldHVybiBuZXcgRnVuY3Rpb24oXCJ2YWx1ZVwiLCBcImhvbGRlclwiLCBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgICd1c2Ugc3RyaWN0JzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIGhvbGRlci5wSW5kZXggPSB2YWx1ZTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIGhvbGRlci5jaGVja0Z1bGZpbGxtZW50KHRoaXMpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIFwiLnJlcGxhY2UoL0luZGV4L2csIGkpKTtcbiAgICB9O1xuXG4gICAgdmFyIGNhbGxlciA9IGZ1bmN0aW9uKGNvdW50KSB7XG4gICAgICAgIHZhciB2YWx1ZXMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPD0gY291bnQ7ICsraSkgdmFsdWVzLnB1c2goXCJob2xkZXIucFwiICsgaSk7XG4gICAgICAgIHJldHVybiBuZXcgRnVuY3Rpb24oXCJob2xkZXJcIiwgXCIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxcblxcXG4gICAgICAgICAgICAndXNlIHN0cmljdCc7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxcblxcXG4gICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBob2xkZXIuZm47ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxcblxcXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sodmFsdWVzKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxcblxcXG4gICAgICAgICAgICBcIi5yZXBsYWNlKC92YWx1ZXMvZywgdmFsdWVzLmpvaW4oXCIsIFwiKSkpO1xuICAgIH07XG4gICAgdmFyIHRoZW5DYWxsYmFja3MgPSBbXTtcbiAgICB2YXIgY2FsbGVycyA9IFt2b2lkIDBdO1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDw9IDU7ICsraSkge1xuICAgICAgICB0aGVuQ2FsbGJhY2tzLnB1c2godGhlbkNhbGxiYWNrKGkpKTtcbiAgICAgICAgY2FsbGVycy5wdXNoKGNhbGxlcihpKSk7XG4gICAgfVxuXG4gICAgdmFyIEhvbGRlciA9IGZ1bmN0aW9uKHRvdGFsLCBmbikge1xuICAgICAgICB0aGlzLnAxID0gdGhpcy5wMiA9IHRoaXMucDMgPSB0aGlzLnA0ID0gdGhpcy5wNSA9IG51bGw7XG4gICAgICAgIHRoaXMuZm4gPSBmbjtcbiAgICAgICAgdGhpcy50b3RhbCA9IHRvdGFsO1xuICAgICAgICB0aGlzLm5vdyA9IDA7XG4gICAgfTtcblxuICAgIEhvbGRlci5wcm90b3R5cGUuY2FsbGVycyA9IGNhbGxlcnM7XG4gICAgSG9sZGVyLnByb3RvdHlwZS5jaGVja0Z1bGZpbGxtZW50ID0gZnVuY3Rpb24ocHJvbWlzZSkge1xuICAgICAgICB2YXIgbm93ID0gdGhpcy5ub3c7XG4gICAgICAgIG5vdysrO1xuICAgICAgICB2YXIgdG90YWwgPSB0aGlzLnRvdGFsO1xuICAgICAgICBpZiAobm93ID49IHRvdGFsKSB7XG4gICAgICAgICAgICB2YXIgaGFuZGxlciA9IHRoaXMuY2FsbGVyc1t0b3RhbF07XG4gICAgICAgICAgICB2YXIgcmV0ID0gdHJ5Q2F0Y2gxKGhhbmRsZXIsIHZvaWQgMCwgdGhpcyk7XG4gICAgICAgICAgICBpZiAocmV0ID09PSBlcnJvck9iaikge1xuICAgICAgICAgICAgICAgIHByb21pc2UuX3JlamVjdFVuY2hlY2tlZChyZXQuZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFwcm9taXNlLl90cnlGb2xsb3cocmV0KSkge1xuICAgICAgICAgICAgICAgIHByb21pc2UuX2Z1bGZpbGxVbmNoZWNrZWQocmV0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubm93ID0gbm93O1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAgIHRoaXMuX3JlamVjdChyZWFzb24pO1xufVxuXG5Qcm9taXNlLmpvaW4gPSBmdW5jdGlvbiBQcm9taXNlJEpvaW4oKSB7XG4gICAgdmFyIGxhc3QgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcbiAgICB2YXIgZm47XG4gICAgaWYgKGxhc3QgPiAwICYmIHR5cGVvZiBhcmd1bWVudHNbbGFzdF0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBmbiA9IGFyZ3VtZW50c1tsYXN0XTtcbiAgICAgICAgaWYgKGxhc3QgPCA2ICYmIGNhbkV2YWx1YXRlKSB7XG4gICAgICAgICAgICB2YXIgcmV0ID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICAgICAgICAgICAgcmV0Ll9zZXRUcmFjZSh2b2lkIDApO1xuICAgICAgICAgICAgdmFyIGhvbGRlciA9IG5ldyBIb2xkZXIobGFzdCwgZm4pO1xuICAgICAgICAgICAgdmFyIGNhbGxiYWNrcyA9IHRoZW5DYWxsYmFja3M7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxhc3Q7ICsraSkge1xuICAgICAgICAgICAgICAgIHZhciBtYXliZVByb21pc2UgPSBjYXN0KGFyZ3VtZW50c1tpXSwgdm9pZCAwKTtcbiAgICAgICAgICAgICAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF5YmVQcm9taXNlLmlzUGVuZGluZygpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXliZVByb21pc2UuX3RoZW4oY2FsbGJhY2tzW2ldLCByZWplY3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdm9pZCAwLCByZXQsIGhvbGRlcik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWF5YmVQcm9taXNlLmlzRnVsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrc1tpXS5jYWxsKHJldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heWJlUHJvbWlzZS5fc2V0dGxlZFZhbHVlLCBob2xkZXIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0Ll9yZWplY3QobWF5YmVQcm9taXNlLl9zZXR0bGVkVmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF5YmVQcm9taXNlLl91bnNldFJlamVjdGlvbklzVW5oYW5kbGVkKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja3NbaV0uY2FsbChyZXQsIG1heWJlUHJvbWlzZSwgaG9sZGVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9XG4gICAgfVxuICAgIHZhciAkX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGg7dmFyIGFyZ3MgPSBuZXcgQXJyYXkoJF9sZW4pOyBmb3IodmFyICRfaSA9IDA7ICRfaSA8ICRfbGVuOyArKyRfaSkge2FyZ3NbJF9pXSA9IGFyZ3VtZW50c1skX2ldO31cbiAgICB2YXIgcmV0ID0gbmV3IFByb21pc2VBcnJheShhcmdzKS5wcm9taXNlKCk7XG4gICAgcmV0dXJuIGZuICE9PSB2b2lkIDAgPyByZXQuc3ByZWFkKGZuKSA6IHJldDtcbn07XG5cbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUHJvbWlzZSwgUHJvbWlzZUFycmF5LCBhcGlSZWplY3Rpb24sIGNhc3QsIElOVEVSTkFMKSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgdHJ5Q2F0Y2gzID0gdXRpbC50cnlDYXRjaDM7XG52YXIgZXJyb3JPYmogPSB1dGlsLmVycm9yT2JqO1xudmFyIFBFTkRJTkcgPSB7fTtcbnZhciBFTVBUWV9BUlJBWSA9IFtdO1xuXG5mdW5jdGlvbiBNYXBwaW5nUHJvbWlzZUFycmF5KHByb21pc2VzLCBmbiwgbGltaXQsIF9maWx0ZXIpIHtcbiAgICB0aGlzLmNvbnN0cnVjdG9yJChwcm9taXNlcyk7XG4gICAgdGhpcy5fY2FsbGJhY2sgPSBmbjtcbiAgICB0aGlzLl9wcmVzZXJ2ZWRWYWx1ZXMgPSBfZmlsdGVyID09PSBJTlRFUk5BTFxuICAgICAgICA/IG5ldyBBcnJheSh0aGlzLmxlbmd0aCgpKVxuICAgICAgICA6IG51bGw7XG4gICAgdGhpcy5fbGltaXQgPSBsaW1pdDtcbiAgICB0aGlzLl9pbkZsaWdodCA9IDA7XG4gICAgdGhpcy5fcXVldWUgPSBsaW1pdCA+PSAxID8gW10gOiBFTVBUWV9BUlJBWTtcbiAgICB0aGlzLl9pbml0JCh2b2lkIDAsIC0yKTtcbn1cbnV0aWwuaW5oZXJpdHMoTWFwcGluZ1Byb21pc2VBcnJheSwgUHJvbWlzZUFycmF5KTtcblxuTWFwcGluZ1Byb21pc2VBcnJheS5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbiBNYXBwaW5nUHJvbWlzZUFycmF5JF9pbml0KCkge307XG5cbk1hcHBpbmdQcm9taXNlQXJyYXkucHJvdG90eXBlLl9wcm9taXNlRnVsZmlsbGVkID1cbmZ1bmN0aW9uIE1hcHBpbmdQcm9taXNlQXJyYXkkX3Byb21pc2VGdWxmaWxsZWQodmFsdWUsIGluZGV4KSB7XG4gICAgdmFyIHZhbHVlcyA9IHRoaXMuX3ZhbHVlcztcbiAgICBpZiAodmFsdWVzID09PSBudWxsKSByZXR1cm47XG5cbiAgICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGgoKTtcbiAgICB2YXIgcHJlc2VydmVkVmFsdWVzID0gdGhpcy5fcHJlc2VydmVkVmFsdWVzO1xuICAgIHZhciBsaW1pdCA9IHRoaXMuX2xpbWl0O1xuICAgIGlmICh2YWx1ZXNbaW5kZXhdID09PSBQRU5ESU5HKSB7XG4gICAgICAgIHZhbHVlc1tpbmRleF0gPSB2YWx1ZTtcbiAgICAgICAgaWYgKGxpbWl0ID49IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2luRmxpZ2h0LS07XG4gICAgICAgICAgICB0aGlzLl9kcmFpblF1ZXVlKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5faXNSZXNvbHZlZCgpKSByZXR1cm47XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAobGltaXQgPj0gMSAmJiB0aGlzLl9pbkZsaWdodCA+PSBsaW1pdCkge1xuICAgICAgICAgICAgdmFsdWVzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcXVldWUucHVzaChpbmRleCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByZXNlcnZlZFZhbHVlcyAhPT0gbnVsbCkgcHJlc2VydmVkVmFsdWVzW2luZGV4XSA9IHZhbHVlO1xuXG4gICAgICAgIHZhciBjYWxsYmFjayA9IHRoaXMuX2NhbGxiYWNrO1xuICAgICAgICB2YXIgcmVjZWl2ZXIgPSB0aGlzLl9wcm9taXNlLl9ib3VuZFRvO1xuICAgICAgICB2YXIgcmV0ID0gdHJ5Q2F0Y2gzKGNhbGxiYWNrLCByZWNlaXZlciwgdmFsdWUsIGluZGV4LCBsZW5ndGgpO1xuICAgICAgICBpZiAocmV0ID09PSBlcnJvck9iaikgcmV0dXJuIHRoaXMuX3JlamVjdChyZXQuZSk7XG5cbiAgICAgICAgdmFyIG1heWJlUHJvbWlzZSA9IGNhc3QocmV0LCB2b2lkIDApO1xuICAgICAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgaWYgKG1heWJlUHJvbWlzZS5pc1BlbmRpbmcoKSkge1xuICAgICAgICAgICAgICAgIGlmIChsaW1pdCA+PSAxKSB0aGlzLl9pbkZsaWdodCsrO1xuICAgICAgICAgICAgICAgIHZhbHVlc1tpbmRleF0gPSBQRU5ESU5HO1xuICAgICAgICAgICAgICAgIHJldHVybiBtYXliZVByb21pc2UuX3Byb3h5UHJvbWlzZUFycmF5KHRoaXMsIGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobWF5YmVQcm9taXNlLmlzRnVsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBtYXliZVByb21pc2UudmFsdWUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWF5YmVQcm9taXNlLl91bnNldFJlamVjdGlvbklzVW5oYW5kbGVkKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlamVjdChtYXliZVByb21pc2UucmVhc29uKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhbHVlc1tpbmRleF0gPSByZXQ7XG4gICAgfVxuICAgIHZhciB0b3RhbFJlc29sdmVkID0gKyt0aGlzLl90b3RhbFJlc29sdmVkO1xuICAgIGlmICh0b3RhbFJlc29sdmVkID49IGxlbmd0aCkge1xuICAgICAgICBpZiAocHJlc2VydmVkVmFsdWVzICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9maWx0ZXIodmFsdWVzLCBwcmVzZXJ2ZWRWYWx1ZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZSh2YWx1ZXMpO1xuICAgICAgICB9XG5cbiAgICB9XG59O1xuXG5NYXBwaW5nUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fZHJhaW5RdWV1ZSA9XG5mdW5jdGlvbiBNYXBwaW5nUHJvbWlzZUFycmF5JF9kcmFpblF1ZXVlKCkge1xuICAgIHZhciBxdWV1ZSA9IHRoaXMuX3F1ZXVlO1xuICAgIHZhciBsaW1pdCA9IHRoaXMuX2xpbWl0O1xuICAgIHZhciB2YWx1ZXMgPSB0aGlzLl92YWx1ZXM7XG4gICAgd2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDAgJiYgdGhpcy5faW5GbGlnaHQgPCBsaW1pdCkge1xuICAgICAgICB2YXIgaW5kZXggPSBxdWV1ZS5wb3AoKTtcbiAgICAgICAgdGhpcy5fcHJvbWlzZUZ1bGZpbGxlZCh2YWx1ZXNbaW5kZXhdLCBpbmRleCk7XG4gICAgfVxufTtcblxuTWFwcGluZ1Byb21pc2VBcnJheS5wcm90b3R5cGUuX2ZpbHRlciA9XG5mdW5jdGlvbiBNYXBwaW5nUHJvbWlzZUFycmF5JF9maWx0ZXIoYm9vbGVhbnMsIHZhbHVlcykge1xuICAgIHZhciBsZW4gPSB2YWx1ZXMubGVuZ3RoO1xuICAgIHZhciByZXQgPSBuZXcgQXJyYXkobGVuKTtcbiAgICB2YXIgaiA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBpZiAoYm9vbGVhbnNbaV0pIHJldFtqKytdID0gdmFsdWVzW2ldO1xuICAgIH1cbiAgICByZXQubGVuZ3RoID0gajtcbiAgICB0aGlzLl9yZXNvbHZlKHJldCk7XG59O1xuXG5NYXBwaW5nUHJvbWlzZUFycmF5LnByb3RvdHlwZS5wcmVzZXJ2ZWRWYWx1ZXMgPVxuZnVuY3Rpb24gTWFwcGluZ1Byb21pc2VBcnJheSRwcmVzZXJ2ZVZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5fcHJlc2VydmVkVmFsdWVzO1xufTtcblxuZnVuY3Rpb24gbWFwKHByb21pc2VzLCBmbiwgb3B0aW9ucywgX2ZpbHRlcikge1xuICAgIHZhciBsaW1pdCA9IHR5cGVvZiBvcHRpb25zID09PSBcIm9iamVjdFwiICYmIG9wdGlvbnMgIT09IG51bGxcbiAgICAgICAgPyBvcHRpb25zLmNvbmN1cnJlbmN5XG4gICAgICAgIDogMDtcbiAgICBsaW1pdCA9IHR5cGVvZiBsaW1pdCA9PT0gXCJudW1iZXJcIiAmJlxuICAgICAgICBpc0Zpbml0ZShsaW1pdCkgJiYgbGltaXQgPj0gMSA/IGxpbWl0IDogMDtcbiAgICByZXR1cm4gbmV3IE1hcHBpbmdQcm9taXNlQXJyYXkocHJvbWlzZXMsIGZuLCBsaW1pdCwgX2ZpbHRlcik7XG59XG5cblByb21pc2UucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uIFByb21pc2UkbWFwKGZuLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gYXBpUmVqZWN0aW9uKFwiZm4gbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuXG4gICAgcmV0dXJuIG1hcCh0aGlzLCBmbiwgb3B0aW9ucywgbnVsbCkucHJvbWlzZSgpO1xufTtcblxuUHJvbWlzZS5tYXAgPSBmdW5jdGlvbiBQcm9taXNlJE1hcChwcm9taXNlcywgZm4sIG9wdGlvbnMsIF9maWx0ZXIpIHtcbiAgICBpZiAodHlwZW9mIGZuICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBhcGlSZWplY3Rpb24oXCJmbiBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgcmV0dXJuIG1hcChwcm9taXNlcywgZm4sIG9wdGlvbnMsIF9maWx0ZXIpLnByb21pc2UoKTtcbn07XG5cblxufTtcbiIsIi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cblwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihQcm9taXNlKSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgYXN5bmMgPSByZXF1aXJlKFwiLi9hc3luYy5qc1wiKTtcbnZhciB0cnlDYXRjaDIgPSB1dGlsLnRyeUNhdGNoMjtcbnZhciB0cnlDYXRjaDEgPSB1dGlsLnRyeUNhdGNoMTtcbnZhciBlcnJvck9iaiA9IHV0aWwuZXJyb3JPYmo7XG5cbmZ1bmN0aW9uIHRocm93ZXIocikge1xuICAgIHRocm93IHI7XG59XG5cbmZ1bmN0aW9uIFByb21pc2UkX3NwcmVhZEFkYXB0ZXIodmFsLCByZWNlaXZlcikge1xuICAgIGlmICghdXRpbC5pc0FycmF5KHZhbCkpIHJldHVybiBQcm9taXNlJF9zdWNjZXNzQWRhcHRlcih2YWwsIHJlY2VpdmVyKTtcbiAgICB2YXIgcmV0ID0gdXRpbC50cnlDYXRjaEFwcGx5KHRoaXMsIFtudWxsXS5jb25jYXQodmFsKSwgcmVjZWl2ZXIpO1xuICAgIGlmIChyZXQgPT09IGVycm9yT2JqKSB7XG4gICAgICAgIGFzeW5jLmludm9rZUxhdGVyKHRocm93ZXIsIHZvaWQgMCwgcmV0LmUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gUHJvbWlzZSRfc3VjY2Vzc0FkYXB0ZXIodmFsLCByZWNlaXZlcikge1xuICAgIHZhciBub2RlYmFjayA9IHRoaXM7XG4gICAgdmFyIHJldCA9IHZhbCA9PT0gdm9pZCAwXG4gICAgICAgID8gdHJ5Q2F0Y2gxKG5vZGViYWNrLCByZWNlaXZlciwgbnVsbClcbiAgICAgICAgOiB0cnlDYXRjaDIobm9kZWJhY2ssIHJlY2VpdmVyLCBudWxsLCB2YWwpO1xuICAgIGlmIChyZXQgPT09IGVycm9yT2JqKSB7XG4gICAgICAgIGFzeW5jLmludm9rZUxhdGVyKHRocm93ZXIsIHZvaWQgMCwgcmV0LmUpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIFByb21pc2UkX2Vycm9yQWRhcHRlcihyZWFzb24sIHJlY2VpdmVyKSB7XG4gICAgdmFyIG5vZGViYWNrID0gdGhpcztcbiAgICB2YXIgcmV0ID0gdHJ5Q2F0Y2gxKG5vZGViYWNrLCByZWNlaXZlciwgcmVhc29uKTtcbiAgICBpZiAocmV0ID09PSBlcnJvck9iaikge1xuICAgICAgICBhc3luYy5pbnZva2VMYXRlcih0aHJvd2VyLCB2b2lkIDAsIHJldC5lKTtcbiAgICB9XG59XG5cblByb21pc2UucHJvdG90eXBlLm5vZGVpZnkgPSBmdW5jdGlvbiBQcm9taXNlJG5vZGVpZnkobm9kZWJhY2ssIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZW9mIG5vZGViYWNrID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB2YXIgYWRhcHRlciA9IFByb21pc2UkX3N1Y2Nlc3NBZGFwdGVyO1xuICAgICAgICBpZiAob3B0aW9ucyAhPT0gdm9pZCAwICYmIE9iamVjdChvcHRpb25zKS5zcHJlYWQpIHtcbiAgICAgICAgICAgIGFkYXB0ZXIgPSBQcm9taXNlJF9zcHJlYWRBZGFwdGVyO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3RoZW4oXG4gICAgICAgICAgICBhZGFwdGVyLFxuICAgICAgICAgICAgUHJvbWlzZSRfZXJyb3JBZGFwdGVyLFxuICAgICAgICAgICAgdm9pZCAwLFxuICAgICAgICAgICAgbm9kZWJhY2ssXG4gICAgICAgICAgICB0aGlzLl9ib3VuZFRvXG4gICAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufTtcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUHJvbWlzZSwgUHJvbWlzZUFycmF5KSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgYXN5bmMgPSByZXF1aXJlKFwiLi9hc3luYy5qc1wiKTtcbnZhciBlcnJvcnMgPSByZXF1aXJlKFwiLi9lcnJvcnMuanNcIik7XG52YXIgdHJ5Q2F0Y2gxID0gdXRpbC50cnlDYXRjaDE7XG52YXIgZXJyb3JPYmogPSB1dGlsLmVycm9yT2JqO1xuXG5Qcm9taXNlLnByb3RvdHlwZS5wcm9ncmVzc2VkID0gZnVuY3Rpb24gUHJvbWlzZSRwcm9ncmVzc2VkKGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5fdGhlbih2b2lkIDAsIHZvaWQgMCwgaGFuZGxlciwgdm9pZCAwLCB2b2lkIDApO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3Byb2dyZXNzID0gZnVuY3Rpb24gUHJvbWlzZSRfcHJvZ3Jlc3MocHJvZ3Jlc3NWYWx1ZSkge1xuICAgIGlmICh0aGlzLl9pc0ZvbGxvd2luZ09yRnVsZmlsbGVkT3JSZWplY3RlZCgpKSByZXR1cm47XG4gICAgdGhpcy5fcHJvZ3Jlc3NVbmNoZWNrZWQocHJvZ3Jlc3NWYWx1ZSk7XG5cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9jbGVhckZpcnN0SGFuZGxlckRhdGEkQmFzZSA9XG5Qcm9taXNlLnByb3RvdHlwZS5fY2xlYXJGaXJzdEhhbmRsZXJEYXRhO1xuUHJvbWlzZS5wcm90b3R5cGUuX2NsZWFyRmlyc3RIYW5kbGVyRGF0YSA9XG5mdW5jdGlvbiBQcm9taXNlJF9jbGVhckZpcnN0SGFuZGxlckRhdGEoKSB7XG4gICAgdGhpcy5fY2xlYXJGaXJzdEhhbmRsZXJEYXRhJEJhc2UoKTtcbiAgICB0aGlzLl9wcm9ncmVzc0hhbmRsZXIwID0gdm9pZCAwO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3Byb2dyZXNzSGFuZGxlckF0ID1cbmZ1bmN0aW9uIFByb21pc2UkX3Byb2dyZXNzSGFuZGxlckF0KGluZGV4KSB7XG4gICAgcmV0dXJuIGluZGV4ID09PSAwXG4gICAgICAgID8gdGhpcy5fcHJvZ3Jlc3NIYW5kbGVyMFxuICAgICAgICA6IHRoaXNbKGluZGV4IDw8IDIpICsgaW5kZXggLSA1ICsgMl07XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fZG9Qcm9ncmVzc1dpdGggPVxuZnVuY3Rpb24gUHJvbWlzZSRfZG9Qcm9ncmVzc1dpdGgocHJvZ3Jlc3Npb24pIHtcbiAgICB2YXIgcHJvZ3Jlc3NWYWx1ZSA9IHByb2dyZXNzaW9uLnZhbHVlO1xuICAgIHZhciBoYW5kbGVyID0gcHJvZ3Jlc3Npb24uaGFuZGxlcjtcbiAgICB2YXIgcHJvbWlzZSA9IHByb2dyZXNzaW9uLnByb21pc2U7XG4gICAgdmFyIHJlY2VpdmVyID0gcHJvZ3Jlc3Npb24ucmVjZWl2ZXI7XG5cbiAgICB2YXIgcmV0ID0gdHJ5Q2F0Y2gxKGhhbmRsZXIsIHJlY2VpdmVyLCBwcm9ncmVzc1ZhbHVlKTtcbiAgICBpZiAocmV0ID09PSBlcnJvck9iaikge1xuICAgICAgICBpZiAocmV0LmUgIT0gbnVsbCAmJlxuICAgICAgICAgICAgcmV0LmUubmFtZSAhPT0gXCJTdG9wUHJvZ3Jlc3NQcm9wYWdhdGlvblwiKSB7XG4gICAgICAgICAgICB2YXIgdHJhY2UgPSBlcnJvcnMuY2FuQXR0YWNoKHJldC5lKVxuICAgICAgICAgICAgICAgID8gcmV0LmUgOiBuZXcgRXJyb3IocmV0LmUgKyBcIlwiKTtcbiAgICAgICAgICAgIHByb21pc2UuX2F0dGFjaEV4dHJhVHJhY2UodHJhY2UpO1xuICAgICAgICAgICAgcHJvbWlzZS5fcHJvZ3Jlc3MocmV0LmUpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChyZXQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIHJldC5fdGhlbihwcm9taXNlLl9wcm9ncmVzcywgbnVsbCwgbnVsbCwgcHJvbWlzZSwgdm9pZCAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlLl9wcm9ncmVzcyhyZXQpO1xuICAgIH1cbn07XG5cblxuUHJvbWlzZS5wcm90b3R5cGUuX3Byb2dyZXNzVW5jaGVja2VkID1cbmZ1bmN0aW9uIFByb21pc2UkX3Byb2dyZXNzVW5jaGVja2VkKHByb2dyZXNzVmFsdWUpIHtcbiAgICBpZiAoIXRoaXMuaXNQZW5kaW5nKCkpIHJldHVybjtcbiAgICB2YXIgbGVuID0gdGhpcy5fbGVuZ3RoKCk7XG4gICAgdmFyIHByb2dyZXNzID0gdGhpcy5fcHJvZ3Jlc3M7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB2YXIgaGFuZGxlciA9IHRoaXMuX3Byb2dyZXNzSGFuZGxlckF0KGkpO1xuICAgICAgICB2YXIgcHJvbWlzZSA9IHRoaXMuX3Byb21pc2VBdChpKTtcbiAgICAgICAgaWYgKCEocHJvbWlzZSBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgICAgICAgICB2YXIgcmVjZWl2ZXIgPSB0aGlzLl9yZWNlaXZlckF0KGkpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICBoYW5kbGVyLmNhbGwocmVjZWl2ZXIsIHByb2dyZXNzVmFsdWUsIHByb21pc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyZWNlaXZlciBpbnN0YW5jZW9mIFByb21pc2UgJiYgcmVjZWl2ZXIuX2lzUHJveGllZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVjZWl2ZXIuX3Byb2dyZXNzVW5jaGVja2VkKHByb2dyZXNzVmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyZWNlaXZlciBpbnN0YW5jZW9mIFByb21pc2VBcnJheSkge1xuICAgICAgICAgICAgICAgIHJlY2VpdmVyLl9wcm9taXNlUHJvZ3Jlc3NlZChwcm9ncmVzc1ZhbHVlLCBwcm9taXNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIGFzeW5jLmludm9rZSh0aGlzLl9kb1Byb2dyZXNzV2l0aCwgdGhpcywge1xuICAgICAgICAgICAgICAgIGhhbmRsZXI6IGhhbmRsZXIsXG4gICAgICAgICAgICAgICAgcHJvbWlzZTogcHJvbWlzZSxcbiAgICAgICAgICAgICAgICByZWNlaXZlcjogdGhpcy5fcmVjZWl2ZXJBdChpKSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogcHJvZ3Jlc3NWYWx1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhc3luYy5pbnZva2UocHJvZ3Jlc3MsIHByb21pc2UsIHByb2dyZXNzVmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxufTtcbn07XG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG52YXIgb2xkO1xuaWYgKHR5cGVvZiBQcm9taXNlICE9PSBcInVuZGVmaW5lZFwiKSBvbGQgPSBQcm9taXNlO1xuZnVuY3Rpb24gbm9Db25mbGljdChibHVlYmlyZCkge1xuICAgIHRyeSB7IGlmIChQcm9taXNlID09PSBibHVlYmlyZCkgUHJvbWlzZSA9IG9sZDsgfVxuICAgIGNhdGNoIChlKSB7fVxuICAgIHJldHVybiBibHVlYmlyZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgYXN5bmMgPSByZXF1aXJlKFwiLi9hc3luYy5qc1wiKTtcbnZhciBlcnJvcnMgPSByZXF1aXJlKFwiLi9lcnJvcnMuanNcIik7XG5cbnZhciBJTlRFUk5BTCA9IGZ1bmN0aW9uKCl7fTtcbnZhciBBUFBMWSA9IHt9O1xudmFyIE5FWFRfRklMVEVSID0ge2U6IG51bGx9O1xuXG52YXIgY2FzdCA9IHJlcXVpcmUoXCIuL3RoZW5hYmxlcy5qc1wiKShQcm9taXNlLCBJTlRFUk5BTCk7XG52YXIgUHJvbWlzZUFycmF5ID0gcmVxdWlyZShcIi4vcHJvbWlzZV9hcnJheS5qc1wiKShQcm9taXNlLCBJTlRFUk5BTCwgY2FzdCk7XG52YXIgQ2FwdHVyZWRUcmFjZSA9IHJlcXVpcmUoXCIuL2NhcHR1cmVkX3RyYWNlLmpzXCIpKCk7XG52YXIgQ2F0Y2hGaWx0ZXIgPSByZXF1aXJlKFwiLi9jYXRjaF9maWx0ZXIuanNcIikoTkVYVF9GSUxURVIpO1xudmFyIFByb21pc2VSZXNvbHZlciA9IHJlcXVpcmUoXCIuL3Byb21pc2VfcmVzb2x2ZXIuanNcIik7XG5cbnZhciBpc0FycmF5ID0gdXRpbC5pc0FycmF5O1xuXG52YXIgZXJyb3JPYmogPSB1dGlsLmVycm9yT2JqO1xudmFyIHRyeUNhdGNoMSA9IHV0aWwudHJ5Q2F0Y2gxO1xudmFyIHRyeUNhdGNoMiA9IHV0aWwudHJ5Q2F0Y2gyO1xudmFyIHRyeUNhdGNoQXBwbHkgPSB1dGlsLnRyeUNhdGNoQXBwbHk7XG52YXIgUmFuZ2VFcnJvciA9IGVycm9ycy5SYW5nZUVycm9yO1xudmFyIFR5cGVFcnJvciA9IGVycm9ycy5UeXBlRXJyb3I7XG52YXIgQ2FuY2VsbGF0aW9uRXJyb3IgPSBlcnJvcnMuQ2FuY2VsbGF0aW9uRXJyb3I7XG52YXIgVGltZW91dEVycm9yID0gZXJyb3JzLlRpbWVvdXRFcnJvcjtcbnZhciBPcGVyYXRpb25hbEVycm9yID0gZXJyb3JzLk9wZXJhdGlvbmFsRXJyb3I7XG52YXIgb3JpZ2luYXRlc0Zyb21SZWplY3Rpb24gPSBlcnJvcnMub3JpZ2luYXRlc0Zyb21SZWplY3Rpb247XG52YXIgbWFya0FzT3JpZ2luYXRpbmdGcm9tUmVqZWN0aW9uID0gZXJyb3JzLm1hcmtBc09yaWdpbmF0aW5nRnJvbVJlamVjdGlvbjtcbnZhciBjYW5BdHRhY2ggPSBlcnJvcnMuY2FuQXR0YWNoO1xudmFyIHRocm93ZXIgPSB1dGlsLnRocm93ZXI7XG52YXIgYXBpUmVqZWN0aW9uID0gcmVxdWlyZShcIi4vZXJyb3JzX2FwaV9yZWplY3Rpb25cIikoUHJvbWlzZSk7XG5cblxudmFyIG1ha2VTZWxmUmVzb2x1dGlvbkVycm9yID0gZnVuY3Rpb24gUHJvbWlzZSRfbWFrZVNlbGZSZXNvbHV0aW9uRXJyb3IoKSB7XG4gICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoXCJjaXJjdWxhciBwcm9taXNlIHJlc29sdXRpb24gY2hhaW5cIik7XG59O1xuXG5mdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG4gICAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJ0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvciByZXF1aXJlcyBhIHJlc29sdmVyIGZ1bmN0aW9uXCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jb25zdHJ1Y3RvciAhPT0gUHJvbWlzZSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwidGhlIHByb21pc2UgY29uc3RydWN0b3IgY2Fubm90IGJlIGludm9rZWQgZGlyZWN0bHlcIik7XG4gICAgfVxuICAgIHRoaXMuX2JpdEZpZWxkID0gMDtcbiAgICB0aGlzLl9mdWxmaWxsbWVudEhhbmRsZXIwID0gdm9pZCAwO1xuICAgIHRoaXMuX3JlamVjdGlvbkhhbmRsZXIwID0gdm9pZCAwO1xuICAgIHRoaXMuX3Byb21pc2UwID0gdm9pZCAwO1xuICAgIHRoaXMuX3JlY2VpdmVyMCA9IHZvaWQgMDtcbiAgICB0aGlzLl9zZXR0bGVkVmFsdWUgPSB2b2lkIDA7XG4gICAgdGhpcy5fYm91bmRUbyA9IHZvaWQgMDtcbiAgICBpZiAocmVzb2x2ZXIgIT09IElOVEVSTkFMKSB0aGlzLl9yZXNvbHZlRnJvbVJlc29sdmVyKHJlc29sdmVyKTtcbn1cblxuZnVuY3Rpb24gcmV0dXJuRmlyc3RFbGVtZW50KGVsZW1lbnRzKSB7XG4gICAgcmV0dXJuIGVsZW1lbnRzWzBdO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24gUHJvbWlzZSRiaW5kKHRoaXNBcmcpIHtcbiAgICB2YXIgbWF5YmVQcm9taXNlID0gY2FzdCh0aGlzQXJnLCB2b2lkIDApO1xuICAgIHZhciByZXQgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gICAgaWYgKG1heWJlUHJvbWlzZSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgdmFyIGJpbmRlciA9IG1heWJlUHJvbWlzZS50aGVuKGZ1bmN0aW9uKHRoaXNBcmcpIHtcbiAgICAgICAgICAgIHJldC5fc2V0Qm91bmRUbyh0aGlzQXJnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHZhciBwID0gUHJvbWlzZS5hbGwoW3RoaXMsIGJpbmRlcl0pLnRoZW4ocmV0dXJuRmlyc3RFbGVtZW50KTtcbiAgICAgICAgcmV0Ll9mb2xsb3cocCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0Ll9mb2xsb3codGhpcyk7XG4gICAgICAgIHJldC5fc2V0Qm91bmRUbyh0aGlzQXJnKTtcbiAgICB9XG4gICAgcmV0Ll9wcm9wYWdhdGVGcm9tKHRoaXMsIDIgfCAxKTtcbiAgICByZXR1cm4gcmV0O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiBQcm9taXNlJHRvU3RyaW5nKCkge1xuICAgIHJldHVybiBcIltvYmplY3QgUHJvbWlzZV1cIjtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmNhdWdodCA9IFByb21pc2UucHJvdG90eXBlW1wiY2F0Y2hcIl0gPVxuZnVuY3Rpb24gUHJvbWlzZSRjYXRjaChmbikge1xuICAgIHZhciBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChsZW4gPiAxKSB7XG4gICAgICAgIHZhciBjYXRjaEluc3RhbmNlcyA9IG5ldyBBcnJheShsZW4gLSAxKSxcbiAgICAgICAgICAgIGogPSAwLCBpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuIC0gMTsgKytpKSB7XG4gICAgICAgICAgICB2YXIgaXRlbSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgY2F0Y2hJbnN0YW5jZXNbaisrXSA9IGl0ZW07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBjYXRjaEZpbHRlclR5cGVFcnJvciA9XG4gICAgICAgICAgICAgICAgICAgIG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICBcIkEgY2F0Y2ggZmlsdGVyIG11c3QgYmUgYW4gZXJyb3IgY29uc3RydWN0b3IgXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICsgXCJvciBhIGZpbHRlciBmdW5jdGlvblwiKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2F0dGFjaEV4dHJhVHJhY2UoY2F0Y2hGaWx0ZXJUeXBlRXJyb3IpO1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChjYXRjaEZpbHRlclR5cGVFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2hJbnN0YW5jZXMubGVuZ3RoID0gajtcbiAgICAgICAgZm4gPSBhcmd1bWVudHNbaV07XG5cbiAgICAgICAgdGhpcy5fcmVzZXRUcmFjZSgpO1xuICAgICAgICB2YXIgY2F0Y2hGaWx0ZXIgPSBuZXcgQ2F0Y2hGaWx0ZXIoY2F0Y2hJbnN0YW5jZXMsIGZuLCB0aGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RoZW4odm9pZCAwLCBjYXRjaEZpbHRlci5kb0ZpbHRlciwgdm9pZCAwLFxuICAgICAgICAgICAgY2F0Y2hGaWx0ZXIsIHZvaWQgMCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90aGVuKHZvaWQgMCwgZm4sIHZvaWQgMCwgdm9pZCAwLCB2b2lkIDApO1xufTtcblxuZnVuY3Rpb24gcmVmbGVjdCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UuUHJvbWlzZUluc3BlY3Rpb24odGhpcyk7XG59XG5cblByb21pc2UucHJvdG90eXBlLnJlZmxlY3QgPSBmdW5jdGlvbiBQcm9taXNlJHJlZmxlY3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RoZW4ocmVmbGVjdCwgcmVmbGVjdCwgdm9pZCAwLCB0aGlzLCB2b2lkIDApO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9XG5mdW5jdGlvbiBQcm9taXNlJHRoZW4oZGlkRnVsZmlsbCwgZGlkUmVqZWN0LCBkaWRQcm9ncmVzcykge1xuICAgIHJldHVybiB0aGlzLl90aGVuKGRpZEZ1bGZpbGwsIGRpZFJlamVjdCwgZGlkUHJvZ3Jlc3MsXG4gICAgICAgIHZvaWQgMCwgdm9pZCAwKTtcbn07XG5cblxuUHJvbWlzZS5wcm90b3R5cGUuZG9uZSA9XG5mdW5jdGlvbiBQcm9taXNlJGRvbmUoZGlkRnVsZmlsbCwgZGlkUmVqZWN0LCBkaWRQcm9ncmVzcykge1xuICAgIHZhciBwcm9taXNlID0gdGhpcy5fdGhlbihkaWRGdWxmaWxsLCBkaWRSZWplY3QsIGRpZFByb2dyZXNzLFxuICAgICAgICB2b2lkIDAsIHZvaWQgMCk7XG4gICAgcHJvbWlzZS5fc2V0SXNGaW5hbCgpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuc3ByZWFkID0gZnVuY3Rpb24gUHJvbWlzZSRzcHJlYWQoZGlkRnVsZmlsbCwgZGlkUmVqZWN0KSB7XG4gICAgcmV0dXJuIHRoaXMuX3RoZW4oZGlkRnVsZmlsbCwgZGlkUmVqZWN0LCB2b2lkIDAsXG4gICAgICAgIEFQUExZLCB2b2lkIDApO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuaXNDYW5jZWxsYWJsZSA9IGZ1bmN0aW9uIFByb21pc2UkaXNDYW5jZWxsYWJsZSgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNSZXNvbHZlZCgpICYmXG4gICAgICAgIHRoaXMuX2NhbmNlbGxhYmxlKCk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiBQcm9taXNlJHRvSlNPTigpIHtcbiAgICB2YXIgcmV0ID0ge1xuICAgICAgICBpc0Z1bGZpbGxlZDogZmFsc2UsXG4gICAgICAgIGlzUmVqZWN0ZWQ6IGZhbHNlLFxuICAgICAgICBmdWxmaWxsbWVudFZhbHVlOiB2b2lkIDAsXG4gICAgICAgIHJlamVjdGlvblJlYXNvbjogdm9pZCAwXG4gICAgfTtcbiAgICBpZiAodGhpcy5pc0Z1bGZpbGxlZCgpKSB7XG4gICAgICAgIHJldC5mdWxmaWxsbWVudFZhbHVlID0gdGhpcy5fc2V0dGxlZFZhbHVlO1xuICAgICAgICByZXQuaXNGdWxmaWxsZWQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgcmV0LnJlamVjdGlvblJlYXNvbiA9IHRoaXMuX3NldHRsZWRWYWx1ZTtcbiAgICAgICAgcmV0LmlzUmVqZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuYWxsID0gZnVuY3Rpb24gUHJvbWlzZSRhbGwoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlQXJyYXkodGhpcykucHJvbWlzZSgpO1xufTtcblxuXG5Qcm9taXNlLmlzID0gZnVuY3Rpb24gUHJvbWlzZSRJcyh2YWwpIHtcbiAgICByZXR1cm4gdmFsIGluc3RhbmNlb2YgUHJvbWlzZTtcbn07XG5cblByb21pc2UuYWxsID0gZnVuY3Rpb24gUHJvbWlzZSRBbGwocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2VBcnJheShwcm9taXNlcykucHJvbWlzZSgpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZXJyb3IgPSBmdW5jdGlvbiBQcm9taXNlJF9lcnJvcihmbikge1xuICAgIHJldHVybiB0aGlzLmNhdWdodChvcmlnaW5hdGVzRnJvbVJlamVjdGlvbiwgZm4pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3Jlc29sdmVGcm9tU3luY1ZhbHVlID1cbmZ1bmN0aW9uIFByb21pc2UkX3Jlc29sdmVGcm9tU3luY1ZhbHVlKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSBlcnJvck9iaikge1xuICAgICAgICB0aGlzLl9jbGVhblZhbHVlcygpO1xuICAgICAgICB0aGlzLl9zZXRSZWplY3RlZCgpO1xuICAgICAgICB2YXIgcmVhc29uID0gdmFsdWUuZTtcbiAgICAgICAgdGhpcy5fc2V0dGxlZFZhbHVlID0gcmVhc29uO1xuICAgICAgICB0aGlzLl90cnlBdHRhY2hFeHRyYVRyYWNlKHJlYXNvbik7XG4gICAgICAgIHRoaXMuX2Vuc3VyZVBvc3NpYmxlUmVqZWN0aW9uSGFuZGxlZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBtYXliZVByb21pc2UgPSBjYXN0KHZhbHVlLCB2b2lkIDApO1xuICAgICAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgdGhpcy5fZm9sbG93KG1heWJlUHJvbWlzZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jbGVhblZhbHVlcygpO1xuICAgICAgICAgICAgdGhpcy5fc2V0RnVsZmlsbGVkKCk7XG4gICAgICAgICAgICB0aGlzLl9zZXR0bGVkVmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblByb21pc2UubWV0aG9kID0gZnVuY3Rpb24gUHJvbWlzZSRfTWV0aG9kKGZuKSB7XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJmbiBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbiBQcm9taXNlJF9tZXRob2QoKSB7XG4gICAgICAgIHZhciB2YWx1ZTtcbiAgICAgICAgc3dpdGNoKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgY2FzZSAwOiB2YWx1ZSA9IHRyeUNhdGNoMShmbiwgdGhpcywgdm9pZCAwKTsgYnJlYWs7XG4gICAgICAgIGNhc2UgMTogdmFsdWUgPSB0cnlDYXRjaDEoZm4sIHRoaXMsIGFyZ3VtZW50c1swXSk7IGJyZWFrO1xuICAgICAgICBjYXNlIDI6IHZhbHVlID0gdHJ5Q2F0Y2gyKGZuLCB0aGlzLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7IGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdmFyICRfbGVuID0gYXJndW1lbnRzLmxlbmd0aDt2YXIgYXJncyA9IG5ldyBBcnJheSgkX2xlbik7IGZvcih2YXIgJF9pID0gMDsgJF9pIDwgJF9sZW47ICsrJF9pKSB7YXJnc1skX2ldID0gYXJndW1lbnRzWyRfaV07fVxuICAgICAgICAgICAgdmFsdWUgPSB0cnlDYXRjaEFwcGx5KGZuLCBhcmdzLCB0aGlzKTsgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJldCA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgICAgICAgcmV0Ll9zZXRUcmFjZSh2b2lkIDApO1xuICAgICAgICByZXQuX3Jlc29sdmVGcm9tU3luY1ZhbHVlKHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9O1xufTtcblxuUHJvbWlzZS5hdHRlbXB0ID0gUHJvbWlzZVtcInRyeVwiXSA9IGZ1bmN0aW9uIFByb21pc2UkX1RyeShmbiwgYXJncywgY3R4KSB7XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBhcGlSZWplY3Rpb24oXCJmbiBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgfVxuICAgIHZhciB2YWx1ZSA9IGlzQXJyYXkoYXJncylcbiAgICAgICAgPyB0cnlDYXRjaEFwcGx5KGZuLCBhcmdzLCBjdHgpXG4gICAgICAgIDogdHJ5Q2F0Y2gxKGZuLCBjdHgsIGFyZ3MpO1xuXG4gICAgdmFyIHJldCA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgICByZXQuX3NldFRyYWNlKHZvaWQgMCk7XG4gICAgcmV0Ll9yZXNvbHZlRnJvbVN5bmNWYWx1ZSh2YWx1ZSk7XG4gICAgcmV0dXJuIHJldDtcbn07XG5cblByb21pc2UuZGVmZXIgPSBQcm9taXNlLnBlbmRpbmcgPSBmdW5jdGlvbiBQcm9taXNlJERlZmVyKCkge1xuICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICAgIHByb21pc2UuX3NldFRyYWNlKHZvaWQgMCk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlUmVzb2x2ZXIocHJvbWlzZSk7XG59O1xuXG5Qcm9taXNlLmJpbmQgPSBmdW5jdGlvbiBQcm9taXNlJEJpbmQodGhpc0FyZykge1xuICAgIHZhciBtYXliZVByb21pc2UgPSBjYXN0KHRoaXNBcmcsIHZvaWQgMCk7XG4gICAgdmFyIHJldCA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgICByZXQuX3NldFRyYWNlKHZvaWQgMCk7XG5cbiAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICB2YXIgcCA9IG1heWJlUHJvbWlzZS50aGVuKGZ1bmN0aW9uKHRoaXNBcmcpIHtcbiAgICAgICAgICAgIHJldC5fc2V0Qm91bmRUbyh0aGlzQXJnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldC5fZm9sbG93KHApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldC5fc2V0Qm91bmRUbyh0aGlzQXJnKTtcbiAgICAgICAgcmV0Ll9zZXRGdWxmaWxsZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbn07XG5cblByb21pc2UuY2FzdCA9IGZ1bmN0aW9uIFByb21pc2UkX0Nhc3Qob2JqKSB7XG4gICAgdmFyIHJldCA9IGNhc3Qob2JqLCB2b2lkIDApO1xuICAgIGlmICghKHJldCBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgICAgIHZhciB2YWwgPSByZXQ7XG4gICAgICAgIHJldCA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgICAgICAgcmV0Ll9zZXRUcmFjZSh2b2lkIDApO1xuICAgICAgICByZXQuX3NldEZ1bGZpbGxlZCgpO1xuICAgICAgICByZXQuX2NsZWFuVmFsdWVzKCk7XG4gICAgICAgIHJldC5fc2V0dGxlZFZhbHVlID0gdmFsO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xufTtcblxuUHJvbWlzZS5yZXNvbHZlID0gUHJvbWlzZS5mdWxmaWxsZWQgPSBQcm9taXNlLmNhc3Q7XG5cblByb21pc2UucmVqZWN0ID0gUHJvbWlzZS5yZWplY3RlZCA9IGZ1bmN0aW9uIFByb21pc2UkUmVqZWN0KHJlYXNvbikge1xuICAgIHZhciByZXQgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gICAgcmV0Ll9zZXRUcmFjZSh2b2lkIDApO1xuICAgIG1hcmtBc09yaWdpbmF0aW5nRnJvbVJlamVjdGlvbihyZWFzb24pO1xuICAgIHJldC5fY2xlYW5WYWx1ZXMoKTtcbiAgICByZXQuX3NldFJlamVjdGVkKCk7XG4gICAgcmV0Ll9zZXR0bGVkVmFsdWUgPSByZWFzb247XG4gICAgaWYgKCFjYW5BdHRhY2gocmVhc29uKSkge1xuICAgICAgICB2YXIgdHJhY2UgPSBuZXcgRXJyb3IocmVhc29uICsgXCJcIik7XG4gICAgICAgIHJldC5fc2V0Q2FycmllZFN0YWNrVHJhY2UodHJhY2UpO1xuICAgIH1cbiAgICByZXQuX2Vuc3VyZVBvc3NpYmxlUmVqZWN0aW9uSGFuZGxlZCgpO1xuICAgIHJldHVybiByZXQ7XG59O1xuXG5Qcm9taXNlLm9uUG9zc2libHlVbmhhbmRsZWRSZWplY3Rpb24gPVxuZnVuY3Rpb24gUHJvbWlzZSRPblBvc3NpYmx5VW5oYW5kbGVkUmVqZWN0aW9uKGZuKSB7XG4gICAgICAgIENhcHR1cmVkVHJhY2UucG9zc2libHlVbmhhbmRsZWRSZWplY3Rpb24gPSB0eXBlb2YgZm4gPT09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gZm4gOiB2b2lkIDA7XG59O1xuXG52YXIgdW5oYW5kbGVkUmVqZWN0aW9uSGFuZGxlZDtcblByb21pc2Uub25VbmhhbmRsZWRSZWplY3Rpb25IYW5kbGVkID1cbmZ1bmN0aW9uIFByb21pc2Ukb25VbmhhbmRsZWRSZWplY3Rpb25IYW5kbGVkKGZuKSB7XG4gICAgdW5oYW5kbGVkUmVqZWN0aW9uSGFuZGxlZCA9IHR5cGVvZiBmbiA9PT0gXCJmdW5jdGlvblwiID8gZm4gOiB2b2lkIDA7XG59O1xuXG52YXIgZGVidWdnaW5nID0gZmFsc2UgfHwgISEoXG4gICAgdHlwZW9mIHByb2Nlc3MgIT09IFwidW5kZWZpbmVkXCIgJiZcbiAgICB0eXBlb2YgcHJvY2Vzcy5leGVjUGF0aCA9PT0gXCJzdHJpbmdcIiAmJlxuICAgIHR5cGVvZiBwcm9jZXNzLmVudiA9PT0gXCJvYmplY3RcIiAmJlxuICAgIChwcm9jZXNzLmVudltcIkJMVUVCSVJEX0RFQlVHXCJdIHx8XG4gICAgICAgIHByb2Nlc3MuZW52W1wiTk9ERV9FTlZcIl0gPT09IFwiZGV2ZWxvcG1lbnRcIilcbik7XG5cblxuUHJvbWlzZS5sb25nU3RhY2tUcmFjZXMgPSBmdW5jdGlvbiBQcm9taXNlJExvbmdTdGFja1RyYWNlcygpIHtcbiAgICBpZiAoYXN5bmMuaGF2ZUl0ZW1zUXVldWVkKCkgJiZcbiAgICAgICAgZGVidWdnaW5nID09PSBmYWxzZVxuICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbm5vdCBlbmFibGUgbG9uZyBzdGFjayB0cmFjZXMgYWZ0ZXIgcHJvbWlzZXMgaGF2ZSBiZWVuIGNyZWF0ZWRcIik7XG4gICAgfVxuICAgIGRlYnVnZ2luZyA9IENhcHR1cmVkVHJhY2UuaXNTdXBwb3J0ZWQoKTtcbn07XG5cblByb21pc2UuaGFzTG9uZ1N0YWNrVHJhY2VzID0gZnVuY3Rpb24gUHJvbWlzZSRIYXNMb25nU3RhY2tUcmFjZXMoKSB7XG4gICAgcmV0dXJuIGRlYnVnZ2luZyAmJiBDYXB0dXJlZFRyYWNlLmlzU3VwcG9ydGVkKCk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fdGhlbiA9XG5mdW5jdGlvbiBQcm9taXNlJF90aGVuKFxuICAgIGRpZEZ1bGZpbGwsXG4gICAgZGlkUmVqZWN0LFxuICAgIGRpZFByb2dyZXNzLFxuICAgIHJlY2VpdmVyLFxuICAgIGludGVybmFsRGF0YVxuKSB7XG4gICAgdmFyIGhhdmVJbnRlcm5hbERhdGEgPSBpbnRlcm5hbERhdGEgIT09IHZvaWQgMDtcbiAgICB2YXIgcmV0ID0gaGF2ZUludGVybmFsRGF0YSA/IGludGVybmFsRGF0YSA6IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblxuICAgIGlmICghaGF2ZUludGVybmFsRGF0YSkge1xuICAgICAgICBpZiAoZGVidWdnaW5nKSB7XG4gICAgICAgICAgICB2YXIgaGF2ZVNhbWVDb250ZXh0ID0gdGhpcy5fcGVla0NvbnRleHQoKSA9PT0gdGhpcy5fdHJhY2VQYXJlbnQ7XG4gICAgICAgICAgICByZXQuX3RyYWNlUGFyZW50ID0gaGF2ZVNhbWVDb250ZXh0ID8gdGhpcy5fdHJhY2VQYXJlbnQgOiB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIHJldC5fcHJvcGFnYXRlRnJvbSh0aGlzLCA3KTtcbiAgICB9XG5cbiAgICB2YXIgY2FsbGJhY2tJbmRleCA9XG4gICAgICAgIHRoaXMuX2FkZENhbGxiYWNrcyhkaWRGdWxmaWxsLCBkaWRSZWplY3QsIGRpZFByb2dyZXNzLCByZXQsIHJlY2VpdmVyKTtcblxuICAgIGlmICh0aGlzLmlzUmVzb2x2ZWQoKSkge1xuICAgICAgICBhc3luYy5pbnZva2UodGhpcy5fcXVldWVTZXR0bGVBdCwgdGhpcywgY2FsbGJhY2tJbmRleCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9sZW5ndGggPSBmdW5jdGlvbiBQcm9taXNlJF9sZW5ndGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2JpdEZpZWxkICYgMjYyMTQzO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2lzRm9sbG93aW5nT3JGdWxmaWxsZWRPclJlamVjdGVkID1cbmZ1bmN0aW9uIFByb21pc2UkX2lzRm9sbG93aW5nT3JGdWxmaWxsZWRPclJlamVjdGVkKCkge1xuICAgIHJldHVybiAodGhpcy5fYml0RmllbGQgJiA5Mzk1MjQwOTYpID4gMDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9pc0ZvbGxvd2luZyA9IGZ1bmN0aW9uIFByb21pc2UkX2lzRm9sbG93aW5nKCkge1xuICAgIHJldHVybiAodGhpcy5fYml0RmllbGQgJiA1MzY4NzA5MTIpID09PSA1MzY4NzA5MTI7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fc2V0TGVuZ3RoID0gZnVuY3Rpb24gUHJvbWlzZSRfc2V0TGVuZ3RoKGxlbikge1xuICAgIHRoaXMuX2JpdEZpZWxkID0gKHRoaXMuX2JpdEZpZWxkICYgLTI2MjE0NCkgfFxuICAgICAgICAobGVuICYgMjYyMTQzKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zZXRGdWxmaWxsZWQgPSBmdW5jdGlvbiBQcm9taXNlJF9zZXRGdWxmaWxsZWQoKSB7XG4gICAgdGhpcy5fYml0RmllbGQgPSB0aGlzLl9iaXRGaWVsZCB8IDI2ODQzNTQ1Njtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zZXRSZWplY3RlZCA9IGZ1bmN0aW9uIFByb21pc2UkX3NldFJlamVjdGVkKCkge1xuICAgIHRoaXMuX2JpdEZpZWxkID0gdGhpcy5fYml0RmllbGQgfCAxMzQyMTc3Mjg7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fc2V0Rm9sbG93aW5nID0gZnVuY3Rpb24gUHJvbWlzZSRfc2V0Rm9sbG93aW5nKCkge1xuICAgIHRoaXMuX2JpdEZpZWxkID0gdGhpcy5fYml0RmllbGQgfCA1MzY4NzA5MTI7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fc2V0SXNGaW5hbCA9IGZ1bmN0aW9uIFByb21pc2UkX3NldElzRmluYWwoKSB7XG4gICAgdGhpcy5fYml0RmllbGQgPSB0aGlzLl9iaXRGaWVsZCB8IDMzNTU0NDMyO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2lzRmluYWwgPSBmdW5jdGlvbiBQcm9taXNlJF9pc0ZpbmFsKCkge1xuICAgIHJldHVybiAodGhpcy5fYml0RmllbGQgJiAzMzU1NDQzMikgPiAwO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2NhbmNlbGxhYmxlID0gZnVuY3Rpb24gUHJvbWlzZSRfY2FuY2VsbGFibGUoKSB7XG4gICAgcmV0dXJuICh0aGlzLl9iaXRGaWVsZCAmIDY3MTA4ODY0KSA+IDA7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fc2V0Q2FuY2VsbGFibGUgPSBmdW5jdGlvbiBQcm9taXNlJF9zZXRDYW5jZWxsYWJsZSgpIHtcbiAgICB0aGlzLl9iaXRGaWVsZCA9IHRoaXMuX2JpdEZpZWxkIHwgNjcxMDg4NjQ7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fdW5zZXRDYW5jZWxsYWJsZSA9IGZ1bmN0aW9uIFByb21pc2UkX3Vuc2V0Q2FuY2VsbGFibGUoKSB7XG4gICAgdGhpcy5fYml0RmllbGQgPSB0aGlzLl9iaXRGaWVsZCAmICh+NjcxMDg4NjQpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3NldFJlamVjdGlvbklzVW5oYW5kbGVkID1cbmZ1bmN0aW9uIFByb21pc2UkX3NldFJlamVjdGlvbklzVW5oYW5kbGVkKCkge1xuICAgIHRoaXMuX2JpdEZpZWxkID0gdGhpcy5fYml0RmllbGQgfCAyMDk3MTUyO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3Vuc2V0UmVqZWN0aW9uSXNVbmhhbmRsZWQgPVxuZnVuY3Rpb24gUHJvbWlzZSRfdW5zZXRSZWplY3Rpb25Jc1VuaGFuZGxlZCgpIHtcbiAgICB0aGlzLl9iaXRGaWVsZCA9IHRoaXMuX2JpdEZpZWxkICYgKH4yMDk3MTUyKTtcbiAgICBpZiAodGhpcy5faXNVbmhhbmRsZWRSZWplY3Rpb25Ob3RpZmllZCgpKSB7XG4gICAgICAgIHRoaXMuX3Vuc2V0VW5oYW5kbGVkUmVqZWN0aW9uSXNOb3RpZmllZCgpO1xuICAgICAgICB0aGlzLl9ub3RpZnlVbmhhbmRsZWRSZWplY3Rpb25Jc0hhbmRsZWQoKTtcbiAgICB9XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5faXNSZWplY3Rpb25VbmhhbmRsZWQgPVxuZnVuY3Rpb24gUHJvbWlzZSRfaXNSZWplY3Rpb25VbmhhbmRsZWQoKSB7XG4gICAgcmV0dXJuICh0aGlzLl9iaXRGaWVsZCAmIDIwOTcxNTIpID4gMDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zZXRVbmhhbmRsZWRSZWplY3Rpb25Jc05vdGlmaWVkID1cbmZ1bmN0aW9uIFByb21pc2UkX3NldFVuaGFuZGxlZFJlamVjdGlvbklzTm90aWZpZWQoKSB7XG4gICAgdGhpcy5fYml0RmllbGQgPSB0aGlzLl9iaXRGaWVsZCB8IDUyNDI4ODtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl91bnNldFVuaGFuZGxlZFJlamVjdGlvbklzTm90aWZpZWQgPVxuZnVuY3Rpb24gUHJvbWlzZSRfdW5zZXRVbmhhbmRsZWRSZWplY3Rpb25Jc05vdGlmaWVkKCkge1xuICAgIHRoaXMuX2JpdEZpZWxkID0gdGhpcy5fYml0RmllbGQgJiAofjUyNDI4OCk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5faXNVbmhhbmRsZWRSZWplY3Rpb25Ob3RpZmllZCA9XG5mdW5jdGlvbiBQcm9taXNlJF9pc1VuaGFuZGxlZFJlamVjdGlvbk5vdGlmaWVkKCkge1xuICAgIHJldHVybiAodGhpcy5fYml0RmllbGQgJiA1MjQyODgpID4gMDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zZXRDYXJyaWVkU3RhY2tUcmFjZSA9XG5mdW5jdGlvbiBQcm9taXNlJF9zZXRDYXJyaWVkU3RhY2tUcmFjZShjYXB0dXJlZFRyYWNlKSB7XG4gICAgdGhpcy5fYml0RmllbGQgPSB0aGlzLl9iaXRGaWVsZCB8IDEwNDg1NzY7XG4gICAgdGhpcy5fZnVsZmlsbG1lbnRIYW5kbGVyMCA9IGNhcHR1cmVkVHJhY2U7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fdW5zZXRDYXJyaWVkU3RhY2tUcmFjZSA9XG5mdW5jdGlvbiBQcm9taXNlJF91bnNldENhcnJpZWRTdGFja1RyYWNlKCkge1xuICAgIHRoaXMuX2JpdEZpZWxkID0gdGhpcy5fYml0RmllbGQgJiAofjEwNDg1NzYpO1xuICAgIHRoaXMuX2Z1bGZpbGxtZW50SGFuZGxlcjAgPSB2b2lkIDA7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5faXNDYXJyeWluZ1N0YWNrVHJhY2UgPVxuZnVuY3Rpb24gUHJvbWlzZSRfaXNDYXJyeWluZ1N0YWNrVHJhY2UoKSB7XG4gICAgcmV0dXJuICh0aGlzLl9iaXRGaWVsZCAmIDEwNDg1NzYpID4gMDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9nZXRDYXJyaWVkU3RhY2tUcmFjZSA9XG5mdW5jdGlvbiBQcm9taXNlJF9nZXRDYXJyaWVkU3RhY2tUcmFjZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faXNDYXJyeWluZ1N0YWNrVHJhY2UoKVxuICAgICAgICA/IHRoaXMuX2Z1bGZpbGxtZW50SGFuZGxlcjBcbiAgICAgICAgOiB2b2lkIDA7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fcmVjZWl2ZXJBdCA9IGZ1bmN0aW9uIFByb21pc2UkX3JlY2VpdmVyQXQoaW5kZXgpIHtcbiAgICB2YXIgcmV0ID0gaW5kZXggPT09IDBcbiAgICAgICAgPyB0aGlzLl9yZWNlaXZlcjBcbiAgICAgICAgOiB0aGlzWyhpbmRleCA8PCAyKSArIGluZGV4IC0gNSArIDRdO1xuICAgIGlmICh0aGlzLl9pc0JvdW5kKCkgJiYgcmV0ID09PSB2b2lkIDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JvdW5kVG87XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fcHJvbWlzZUF0ID0gZnVuY3Rpb24gUHJvbWlzZSRfcHJvbWlzZUF0KGluZGV4KSB7XG4gICAgcmV0dXJuIGluZGV4ID09PSAwXG4gICAgICAgID8gdGhpcy5fcHJvbWlzZTBcbiAgICAgICAgOiB0aGlzWyhpbmRleCA8PCAyKSArIGluZGV4IC0gNSArIDNdO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2Z1bGZpbGxtZW50SGFuZGxlckF0ID1cbmZ1bmN0aW9uIFByb21pc2UkX2Z1bGZpbGxtZW50SGFuZGxlckF0KGluZGV4KSB7XG4gICAgcmV0dXJuIGluZGV4ID09PSAwXG4gICAgICAgID8gdGhpcy5fZnVsZmlsbG1lbnRIYW5kbGVyMFxuICAgICAgICA6IHRoaXNbKGluZGV4IDw8IDIpICsgaW5kZXggLSA1ICsgMF07XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fcmVqZWN0aW9uSGFuZGxlckF0ID1cbmZ1bmN0aW9uIFByb21pc2UkX3JlamVjdGlvbkhhbmRsZXJBdChpbmRleCkge1xuICAgIHJldHVybiBpbmRleCA9PT0gMFxuICAgICAgICA/IHRoaXMuX3JlamVjdGlvbkhhbmRsZXIwXG4gICAgICAgIDogdGhpc1soaW5kZXggPDwgMikgKyBpbmRleCAtIDUgKyAxXTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9hZGRDYWxsYmFja3MgPSBmdW5jdGlvbiBQcm9taXNlJF9hZGRDYWxsYmFja3MoXG4gICAgZnVsZmlsbCxcbiAgICByZWplY3QsXG4gICAgcHJvZ3Jlc3MsXG4gICAgcHJvbWlzZSxcbiAgICByZWNlaXZlclxuKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fbGVuZ3RoKCk7XG5cbiAgICBpZiAoaW5kZXggPj0gMjYyMTQzIC0gNSkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIHRoaXMuX3NldExlbmd0aCgwKTtcbiAgICB9XG5cbiAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgdGhpcy5fcHJvbWlzZTAgPSBwcm9taXNlO1xuICAgICAgICBpZiAocmVjZWl2ZXIgIT09IHZvaWQgMCkgdGhpcy5fcmVjZWl2ZXIwID0gcmVjZWl2ZXI7XG4gICAgICAgIGlmICh0eXBlb2YgZnVsZmlsbCA9PT0gXCJmdW5jdGlvblwiICYmICF0aGlzLl9pc0NhcnJ5aW5nU3RhY2tUcmFjZSgpKVxuICAgICAgICAgICAgdGhpcy5fZnVsZmlsbG1lbnRIYW5kbGVyMCA9IGZ1bGZpbGw7XG4gICAgICAgIGlmICh0eXBlb2YgcmVqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHRoaXMuX3JlamVjdGlvbkhhbmRsZXIwID0gcmVqZWN0O1xuICAgICAgICBpZiAodHlwZW9mIHByb2dyZXNzID09PSBcImZ1bmN0aW9uXCIpIHRoaXMuX3Byb2dyZXNzSGFuZGxlcjAgPSBwcm9ncmVzcztcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYmFzZSA9IChpbmRleCA8PCAyKSArIGluZGV4IC0gNTtcbiAgICAgICAgdGhpc1tiYXNlICsgM10gPSBwcm9taXNlO1xuICAgICAgICB0aGlzW2Jhc2UgKyA0XSA9IHJlY2VpdmVyO1xuICAgICAgICB0aGlzW2Jhc2UgKyAwXSA9IHR5cGVvZiBmdWxmaWxsID09PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBmdWxmaWxsIDogdm9pZCAwO1xuICAgICAgICB0aGlzW2Jhc2UgKyAxXSA9IHR5cGVvZiByZWplY3QgPT09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHJlamVjdCA6IHZvaWQgMDtcbiAgICAgICAgdGhpc1tiYXNlICsgMl0gPSB0eXBlb2YgcHJvZ3Jlc3MgPT09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHByb2dyZXNzIDogdm9pZCAwO1xuICAgIH1cbiAgICB0aGlzLl9zZXRMZW5ndGgoaW5kZXggKyAxKTtcbiAgICByZXR1cm4gaW5kZXg7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fc2V0UHJveHlIYW5kbGVycyA9XG5mdW5jdGlvbiBQcm9taXNlJF9zZXRQcm94eUhhbmRsZXJzKHJlY2VpdmVyLCBwcm9taXNlU2xvdFZhbHVlKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fbGVuZ3RoKCk7XG5cbiAgICBpZiAoaW5kZXggPj0gMjYyMTQzIC0gNSkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIHRoaXMuX3NldExlbmd0aCgwKTtcbiAgICB9XG4gICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgIHRoaXMuX3Byb21pc2UwID0gcHJvbWlzZVNsb3RWYWx1ZTtcbiAgICAgICAgdGhpcy5fcmVjZWl2ZXIwID0gcmVjZWl2ZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGJhc2UgPSAoaW5kZXggPDwgMikgKyBpbmRleCAtIDU7XG4gICAgICAgIHRoaXNbYmFzZSArIDNdID0gcHJvbWlzZVNsb3RWYWx1ZTtcbiAgICAgICAgdGhpc1tiYXNlICsgNF0gPSByZWNlaXZlcjtcbiAgICAgICAgdGhpc1tiYXNlICsgMF0gPVxuICAgICAgICB0aGlzW2Jhc2UgKyAxXSA9XG4gICAgICAgIHRoaXNbYmFzZSArIDJdID0gdm9pZCAwO1xuICAgIH1cbiAgICB0aGlzLl9zZXRMZW5ndGgoaW5kZXggKyAxKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9wcm94eVByb21pc2VBcnJheSA9XG5mdW5jdGlvbiBQcm9taXNlJF9wcm94eVByb21pc2VBcnJheShwcm9taXNlQXJyYXksIGluZGV4KSB7XG4gICAgdGhpcy5fc2V0UHJveHlIYW5kbGVycyhwcm9taXNlQXJyYXksIGluZGV4KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9wcm94eVByb21pc2UgPSBmdW5jdGlvbiBQcm9taXNlJF9wcm94eVByb21pc2UocHJvbWlzZSkge1xuICAgIHByb21pc2UuX3NldFByb3hpZWQoKTtcbiAgICB0aGlzLl9zZXRQcm94eUhhbmRsZXJzKHByb21pc2UsIC0xNSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fc2V0Qm91bmRUbyA9IGZ1bmN0aW9uIFByb21pc2UkX3NldEJvdW5kVG8ob2JqKSB7XG4gICAgaWYgKG9iaiAhPT0gdm9pZCAwKSB7XG4gICAgICAgIHRoaXMuX2JpdEZpZWxkID0gdGhpcy5fYml0RmllbGQgfCA4Mzg4NjA4O1xuICAgICAgICB0aGlzLl9ib3VuZFRvID0gb2JqO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2JpdEZpZWxkID0gdGhpcy5fYml0RmllbGQgJiAofjgzODg2MDgpO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9pc0JvdW5kID0gZnVuY3Rpb24gUHJvbWlzZSRfaXNCb3VuZCgpIHtcbiAgICByZXR1cm4gKHRoaXMuX2JpdEZpZWxkICYgODM4ODYwOCkgPT09IDgzODg2MDg7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fcmVzb2x2ZUZyb21SZXNvbHZlciA9XG5mdW5jdGlvbiBQcm9taXNlJF9yZXNvbHZlRnJvbVJlc29sdmVyKHJlc29sdmVyKSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzO1xuICAgIHRoaXMuX3NldFRyYWNlKHZvaWQgMCk7XG4gICAgdGhpcy5fcHVzaENvbnRleHQoKTtcblxuICAgIGZ1bmN0aW9uIFByb21pc2UkX3Jlc29sdmVyKHZhbCkge1xuICAgICAgICBpZiAocHJvbWlzZS5fdHJ5Rm9sbG93KHZhbCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBwcm9taXNlLl9mdWxmaWxsKHZhbCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIFByb21pc2UkX3JlamVjdGVyKHZhbCkge1xuICAgICAgICB2YXIgdHJhY2UgPSBjYW5BdHRhY2godmFsKSA/IHZhbCA6IG5ldyBFcnJvcih2YWwgKyBcIlwiKTtcbiAgICAgICAgcHJvbWlzZS5fYXR0YWNoRXh0cmFUcmFjZSh0cmFjZSk7XG4gICAgICAgIG1hcmtBc09yaWdpbmF0aW5nRnJvbVJlamVjdGlvbih2YWwpO1xuICAgICAgICBwcm9taXNlLl9yZWplY3QodmFsLCB0cmFjZSA9PT0gdmFsID8gdm9pZCAwIDogdHJhY2UpO1xuICAgIH1cbiAgICB2YXIgciA9IHRyeUNhdGNoMihyZXNvbHZlciwgdm9pZCAwLCBQcm9taXNlJF9yZXNvbHZlciwgUHJvbWlzZSRfcmVqZWN0ZXIpO1xuICAgIHRoaXMuX3BvcENvbnRleHQoKTtcblxuICAgIGlmIChyICE9PSB2b2lkIDAgJiYgciA9PT0gZXJyb3JPYmopIHtcbiAgICAgICAgdmFyIGUgPSByLmU7XG4gICAgICAgIHZhciB0cmFjZSA9IGNhbkF0dGFjaChlKSA/IGUgOiBuZXcgRXJyb3IoZSArIFwiXCIpO1xuICAgICAgICBwcm9taXNlLl9yZWplY3QoZSwgdHJhY2UpO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zcHJlYWRTbG93Q2FzZSA9XG5mdW5jdGlvbiBQcm9taXNlJF9zcHJlYWRTbG93Q2FzZSh0YXJnZXRGbiwgcHJvbWlzZSwgdmFsdWVzLCBib3VuZFRvKSB7XG4gICAgdmFyIHByb21pc2VGb3JBbGwgPSBuZXcgUHJvbWlzZUFycmF5KHZhbHVlcykucHJvbWlzZSgpO1xuICAgIHZhciBwcm9taXNlMiA9IHByb21pc2VGb3JBbGwuX3RoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0YXJnZXRGbi5hcHBseShib3VuZFRvLCBhcmd1bWVudHMpO1xuICAgIH0sIHZvaWQgMCwgdm9pZCAwLCBBUFBMWSwgdm9pZCAwKTtcbiAgICBwcm9taXNlLl9mb2xsb3cocHJvbWlzZTIpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2NhbGxTcHJlYWQgPVxuZnVuY3Rpb24gUHJvbWlzZSRfY2FsbFNwcmVhZChoYW5kbGVyLCBwcm9taXNlLCB2YWx1ZSkge1xuICAgIHZhciBib3VuZFRvID0gdGhpcy5fYm91bmRUbztcbiAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICBpZiAoY2FzdCh2YWx1ZVtpXSwgdm9pZCAwKSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zcHJlYWRTbG93Q2FzZShoYW5kbGVyLCBwcm9taXNlLCB2YWx1ZSwgYm91bmRUbyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHByb21pc2UuX3B1c2hDb250ZXh0KCk7XG4gICAgcmV0dXJuIHRyeUNhdGNoQXBwbHkoaGFuZGxlciwgdmFsdWUsIGJvdW5kVG8pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2NhbGxIYW5kbGVyID1cbmZ1bmN0aW9uIFByb21pc2UkX2NhbGxIYW5kbGVyKFxuICAgIGhhbmRsZXIsIHJlY2VpdmVyLCBwcm9taXNlLCB2YWx1ZSkge1xuICAgIHZhciB4O1xuICAgIGlmIChyZWNlaXZlciA9PT0gQVBQTFkgJiYgIXRoaXMuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgIHggPSB0aGlzLl9jYWxsU3ByZWFkKGhhbmRsZXIsIHByb21pc2UsIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlLl9wdXNoQ29udGV4dCgpO1xuICAgICAgICB4ID0gdHJ5Q2F0Y2gxKGhhbmRsZXIsIHJlY2VpdmVyLCB2YWx1ZSk7XG4gICAgfVxuICAgIHByb21pc2UuX3BvcENvbnRleHQoKTtcbiAgICByZXR1cm4geDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zZXR0bGVQcm9taXNlRnJvbUhhbmRsZXIgPVxuZnVuY3Rpb24gUHJvbWlzZSRfc2V0dGxlUHJvbWlzZUZyb21IYW5kbGVyKFxuICAgIGhhbmRsZXIsIHJlY2VpdmVyLCB2YWx1ZSwgcHJvbWlzZVxuKSB7XG4gICAgaWYgKCEocHJvbWlzZSBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgICAgIGhhbmRsZXIuY2FsbChyZWNlaXZlciwgdmFsdWUsIHByb21pc2UpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChwcm9taXNlLmlzUmVzb2x2ZWQoKSkgcmV0dXJuO1xuICAgIHZhciB4ID0gdGhpcy5fY2FsbEhhbmRsZXIoaGFuZGxlciwgcmVjZWl2ZXIsIHByb21pc2UsIHZhbHVlKTtcbiAgICBpZiAocHJvbWlzZS5faXNGb2xsb3dpbmcoKSkgcmV0dXJuO1xuXG4gICAgaWYgKHggPT09IGVycm9yT2JqIHx8IHggPT09IHByb21pc2UgfHwgeCA9PT0gTkVYVF9GSUxURVIpIHtcbiAgICAgICAgdmFyIGVyciA9IHggPT09IHByb21pc2VcbiAgICAgICAgICAgICAgICAgICAgPyBtYWtlU2VsZlJlc29sdXRpb25FcnJvcigpXG4gICAgICAgICAgICAgICAgICAgIDogeC5lO1xuICAgICAgICB2YXIgdHJhY2UgPSBjYW5BdHRhY2goZXJyKSA/IGVyciA6IG5ldyBFcnJvcihlcnIgKyBcIlwiKTtcbiAgICAgICAgaWYgKHggIT09IE5FWFRfRklMVEVSKSBwcm9taXNlLl9hdHRhY2hFeHRyYVRyYWNlKHRyYWNlKTtcbiAgICAgICAgcHJvbWlzZS5fcmVqZWN0VW5jaGVja2VkKGVyciwgdHJhY2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBjYXN0VmFsdWUgPSBjYXN0KHgsIHByb21pc2UpO1xuICAgICAgICBpZiAoY2FzdFZhbHVlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgaWYgKGNhc3RWYWx1ZS5pc1JlamVjdGVkKCkgJiZcbiAgICAgICAgICAgICAgICAhY2FzdFZhbHVlLl9pc0NhcnJ5aW5nU3RhY2tUcmFjZSgpICYmXG4gICAgICAgICAgICAgICAgIWNhbkF0dGFjaChjYXN0VmFsdWUuX3NldHRsZWRWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgdHJhY2UgPSBuZXcgRXJyb3IoY2FzdFZhbHVlLl9zZXR0bGVkVmFsdWUgKyBcIlwiKTtcbiAgICAgICAgICAgICAgICBwcm9taXNlLl9hdHRhY2hFeHRyYVRyYWNlKHRyYWNlKTtcbiAgICAgICAgICAgICAgICBjYXN0VmFsdWUuX3NldENhcnJpZWRTdGFja1RyYWNlKHRyYWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByb21pc2UuX2ZvbGxvdyhjYXN0VmFsdWUpO1xuICAgICAgICAgICAgcHJvbWlzZS5fcHJvcGFnYXRlRnJvbShjYXN0VmFsdWUsIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZS5fZnVsZmlsbFVuY2hlY2tlZCh4KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9mb2xsb3cgPVxuZnVuY3Rpb24gUHJvbWlzZSRfZm9sbG93KHByb21pc2UpIHtcbiAgICB0aGlzLl9zZXRGb2xsb3dpbmcoKTtcblxuICAgIGlmIChwcm9taXNlLmlzUGVuZGluZygpKSB7XG4gICAgICAgIHRoaXMuX3Byb3BhZ2F0ZUZyb20ocHJvbWlzZSwgMSk7XG4gICAgICAgIHByb21pc2UuX3Byb3h5UHJvbWlzZSh0aGlzKTtcbiAgICB9IGVsc2UgaWYgKHByb21pc2UuaXNGdWxmaWxsZWQoKSkge1xuICAgICAgICB0aGlzLl9mdWxmaWxsVW5jaGVja2VkKHByb21pc2UuX3NldHRsZWRWYWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fcmVqZWN0VW5jaGVja2VkKHByb21pc2UuX3NldHRsZWRWYWx1ZSxcbiAgICAgICAgICAgIHByb21pc2UuX2dldENhcnJpZWRTdGFja1RyYWNlKCkpO1xuICAgIH1cblxuICAgIGlmIChwcm9taXNlLl9pc1JlamVjdGlvblVuaGFuZGxlZCgpKSBwcm9taXNlLl91bnNldFJlamVjdGlvbklzVW5oYW5kbGVkKCk7XG5cbiAgICBpZiAoZGVidWdnaW5nICYmXG4gICAgICAgIHByb21pc2UuX3RyYWNlUGFyZW50ID09IG51bGwpIHtcbiAgICAgICAgcHJvbWlzZS5fdHJhY2VQYXJlbnQgPSB0aGlzO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl90cnlGb2xsb3cgPVxuZnVuY3Rpb24gUHJvbWlzZSRfdHJ5Rm9sbG93KHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuX2lzRm9sbG93aW5nT3JGdWxmaWxsZWRPclJlamVjdGVkKCkgfHxcbiAgICAgICAgdmFsdWUgPT09IHRoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB2YXIgbWF5YmVQcm9taXNlID0gY2FzdCh2YWx1ZSwgdm9pZCAwKTtcbiAgICBpZiAoIShtYXliZVByb21pc2UgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHRoaXMuX2ZvbGxvdyhtYXliZVByb21pc2UpO1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3Jlc2V0VHJhY2UgPSBmdW5jdGlvbiBQcm9taXNlJF9yZXNldFRyYWNlKCkge1xuICAgIGlmIChkZWJ1Z2dpbmcpIHtcbiAgICAgICAgdGhpcy5fdHJhY2UgPSBuZXcgQ2FwdHVyZWRUcmFjZSh0aGlzLl9wZWVrQ29udGV4dCgpID09PSB2b2lkIDApO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zZXRUcmFjZSA9IGZ1bmN0aW9uIFByb21pc2UkX3NldFRyYWNlKHBhcmVudCkge1xuICAgIGlmIChkZWJ1Z2dpbmcpIHtcbiAgICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLl9wZWVrQ29udGV4dCgpO1xuICAgICAgICB0aGlzLl90cmFjZVBhcmVudCA9IGNvbnRleHQ7XG4gICAgICAgIHZhciBpc1RvcExldmVsID0gY29udGV4dCA9PT0gdm9pZCAwO1xuICAgICAgICBpZiAocGFyZW50ICE9PSB2b2lkIDAgJiZcbiAgICAgICAgICAgIHBhcmVudC5fdHJhY2VQYXJlbnQgPT09IGNvbnRleHQpIHtcbiAgICAgICAgICAgIHRoaXMuX3RyYWNlID0gcGFyZW50Ll90cmFjZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3RyYWNlID0gbmV3IENhcHR1cmVkVHJhY2UoaXNUb3BMZXZlbCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fdHJ5QXR0YWNoRXh0cmFUcmFjZSA9XG5mdW5jdGlvbiBQcm9taXNlJF90cnlBdHRhY2hFeHRyYVRyYWNlKGVycm9yKSB7XG4gICAgaWYgKGNhbkF0dGFjaChlcnJvcikpIHtcbiAgICAgICAgdGhpcy5fYXR0YWNoRXh0cmFUcmFjZShlcnJvcik7XG4gICAgfVxufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2F0dGFjaEV4dHJhVHJhY2UgPVxuZnVuY3Rpb24gUHJvbWlzZSRfYXR0YWNoRXh0cmFUcmFjZShlcnJvcikge1xuICAgIGlmIChkZWJ1Z2dpbmcpIHtcbiAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzO1xuICAgICAgICB2YXIgc3RhY2sgPSBlcnJvci5zdGFjaztcbiAgICAgICAgc3RhY2sgPSB0eXBlb2Ygc3RhY2sgPT09IFwic3RyaW5nXCIgPyBzdGFjay5zcGxpdChcIlxcblwiKSA6IFtdO1xuICAgICAgICBDYXB0dXJlZFRyYWNlLnByb3RlY3RFcnJvck1lc3NhZ2VOZXdsaW5lcyhzdGFjayk7XG4gICAgICAgIHZhciBoZWFkZXJMaW5lQ291bnQgPSAxO1xuICAgICAgICB2YXIgY29tYmluZWRUcmFjZXMgPSAxO1xuICAgICAgICB3aGlsZShwcm9taXNlICE9IG51bGwgJiZcbiAgICAgICAgICAgIHByb21pc2UuX3RyYWNlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHN0YWNrID0gQ2FwdHVyZWRUcmFjZS5jb21iaW5lKFxuICAgICAgICAgICAgICAgIHN0YWNrLFxuICAgICAgICAgICAgICAgIHByb21pc2UuX3RyYWNlLnN0YWNrLnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UuX3RyYWNlUGFyZW50O1xuICAgICAgICAgICAgY29tYmluZWRUcmFjZXMrKztcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdGFja1RyYWNlTGltaXQgPSBFcnJvci5zdGFja1RyYWNlTGltaXQgfHwgMTA7XG4gICAgICAgIHZhciBtYXggPSAoc3RhY2tUcmFjZUxpbWl0ICsgaGVhZGVyTGluZUNvdW50KSAqIGNvbWJpbmVkVHJhY2VzO1xuICAgICAgICB2YXIgbGVuID0gc3RhY2subGVuZ3RoO1xuICAgICAgICBpZiAobGVuID4gbWF4KSB7XG4gICAgICAgICAgICBzdGFjay5sZW5ndGggPSBtYXg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGVuID4gMClcbiAgICAgICAgICAgIHN0YWNrWzBdID0gc3RhY2tbMF0uc3BsaXQoXCJcXHUwMDAyXFx1MDAwMFxcdTAwMDFcIikuam9pbihcIlxcblwiKTtcblxuICAgICAgICBpZiAoc3RhY2subGVuZ3RoIDw9IGhlYWRlckxpbmVDb3VudCkge1xuICAgICAgICAgICAgZXJyb3Iuc3RhY2sgPSBcIihObyBzdGFjayB0cmFjZSlcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVycm9yLnN0YWNrID0gc3RhY2suam9pbihcIlxcblwiKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9jbGVhblZhbHVlcyA9IGZ1bmN0aW9uIFByb21pc2UkX2NsZWFuVmFsdWVzKCkge1xuICAgIGlmICh0aGlzLl9jYW5jZWxsYWJsZSgpKSB7XG4gICAgICAgIHRoaXMuX2NhbmNlbGxhdGlvblBhcmVudCA9IHZvaWQgMDtcbiAgICB9XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fcHJvcGFnYXRlRnJvbSA9XG5mdW5jdGlvbiBQcm9taXNlJF9wcm9wYWdhdGVGcm9tKHBhcmVudCwgZmxhZ3MpIHtcbiAgICBpZiAoKGZsYWdzICYgMSkgPiAwICYmIHBhcmVudC5fY2FuY2VsbGFibGUoKSkge1xuICAgICAgICB0aGlzLl9zZXRDYW5jZWxsYWJsZSgpO1xuICAgICAgICB0aGlzLl9jYW5jZWxsYXRpb25QYXJlbnQgPSBwYXJlbnQ7XG4gICAgfVxuICAgIGlmICgoZmxhZ3MgJiA0KSA+IDApIHtcbiAgICAgICAgdGhpcy5fc2V0Qm91bmRUbyhwYXJlbnQuX2JvdW5kVG8pO1xuICAgIH1cbiAgICBpZiAoKGZsYWdzICYgMikgPiAwKSB7XG4gICAgICAgIHRoaXMuX3NldFRyYWNlKHBhcmVudCk7XG4gICAgfVxufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2Z1bGZpbGwgPSBmdW5jdGlvbiBQcm9taXNlJF9mdWxmaWxsKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuX2lzRm9sbG93aW5nT3JGdWxmaWxsZWRPclJlamVjdGVkKCkpIHJldHVybjtcbiAgICB0aGlzLl9mdWxmaWxsVW5jaGVja2VkKHZhbHVlKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9yZWplY3QgPVxuZnVuY3Rpb24gUHJvbWlzZSRfcmVqZWN0KHJlYXNvbiwgY2FycmllZFN0YWNrVHJhY2UpIHtcbiAgICBpZiAodGhpcy5faXNGb2xsb3dpbmdPckZ1bGZpbGxlZE9yUmVqZWN0ZWQoKSkgcmV0dXJuO1xuICAgIHRoaXMuX3JlamVjdFVuY2hlY2tlZChyZWFzb24sIGNhcnJpZWRTdGFja1RyYWNlKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zZXR0bGVQcm9taXNlQXQgPSBmdW5jdGlvbiBQcm9taXNlJF9zZXR0bGVQcm9taXNlQXQoaW5kZXgpIHtcbiAgICB2YXIgaGFuZGxlciA9IHRoaXMuaXNGdWxmaWxsZWQoKVxuICAgICAgICA/IHRoaXMuX2Z1bGZpbGxtZW50SGFuZGxlckF0KGluZGV4KVxuICAgICAgICA6IHRoaXMuX3JlamVjdGlvbkhhbmRsZXJBdChpbmRleCk7XG5cbiAgICB2YXIgdmFsdWUgPSB0aGlzLl9zZXR0bGVkVmFsdWU7XG4gICAgdmFyIHJlY2VpdmVyID0gdGhpcy5fcmVjZWl2ZXJBdChpbmRleCk7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzLl9wcm9taXNlQXQoaW5kZXgpO1xuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhpcy5fc2V0dGxlUHJvbWlzZUZyb21IYW5kbGVyKGhhbmRsZXIsIHJlY2VpdmVyLCB2YWx1ZSwgcHJvbWlzZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGRvbmUgPSBmYWxzZTtcbiAgICAgICAgdmFyIGlzRnVsZmlsbGVkID0gdGhpcy5pc0Z1bGZpbGxlZCgpO1xuICAgICAgICBpZiAocmVjZWl2ZXIgIT09IHZvaWQgMCkge1xuICAgICAgICAgICAgaWYgKHJlY2VpdmVyIGluc3RhbmNlb2YgUHJvbWlzZSAmJlxuICAgICAgICAgICAgICAgIHJlY2VpdmVyLl9pc1Byb3hpZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlY2VpdmVyLl91bnNldFByb3hpZWQoKTtcblxuICAgICAgICAgICAgICAgIGlmIChpc0Z1bGZpbGxlZCkgcmVjZWl2ZXIuX2Z1bGZpbGxVbmNoZWNrZWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGVsc2UgcmVjZWl2ZXIuX3JlamVjdFVuY2hlY2tlZCh2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2V0Q2FycmllZFN0YWNrVHJhY2UoKSk7XG4gICAgICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlY2VpdmVyIGluc3RhbmNlb2YgUHJvbWlzZUFycmF5KSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzRnVsZmlsbGVkKSByZWNlaXZlci5fcHJvbWlzZUZ1bGZpbGxlZCh2YWx1ZSwgcHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgZWxzZSByZWNlaXZlci5fcHJvbWlzZVJlamVjdGVkKHZhbHVlLCBwcm9taXNlKTtcbiAgICAgICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZG9uZSkge1xuICAgICAgICAgICAgaWYgKGlzRnVsZmlsbGVkKSBwcm9taXNlLl9mdWxmaWxsKHZhbHVlKTtcbiAgICAgICAgICAgIGVsc2UgcHJvbWlzZS5fcmVqZWN0KHZhbHVlLCB0aGlzLl9nZXRDYXJyaWVkU3RhY2tUcmFjZSgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpbmRleCA+PSA0KSB7XG4gICAgICAgIHRoaXMuX3F1ZXVlR0MoKTtcbiAgICB9XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5faXNQcm94aWVkID0gZnVuY3Rpb24gUHJvbWlzZSRfaXNQcm94aWVkKCkge1xuICAgIHJldHVybiAodGhpcy5fYml0RmllbGQgJiA0MTk0MzA0KSA9PT0gNDE5NDMwNDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9zZXRQcm94aWVkID0gZnVuY3Rpb24gUHJvbWlzZSRfc2V0UHJveGllZCgpIHtcbiAgICB0aGlzLl9iaXRGaWVsZCA9IHRoaXMuX2JpdEZpZWxkIHwgNDE5NDMwNDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl91bnNldFByb3hpZWQgPSBmdW5jdGlvbiBQcm9taXNlJF91bnNldFByb3hpZWQoKSB7XG4gICAgdGhpcy5fYml0RmllbGQgPSB0aGlzLl9iaXRGaWVsZCAmICh+NDE5NDMwNCk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5faXNHY1F1ZXVlZCA9IGZ1bmN0aW9uIFByb21pc2UkX2lzR2NRdWV1ZWQoKSB7XG4gICAgcmV0dXJuICh0aGlzLl9iaXRGaWVsZCAmIC0xMDczNzQxODI0KSA9PT0gLTEwNzM3NDE4MjQ7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fc2V0R2NRdWV1ZWQgPSBmdW5jdGlvbiBQcm9taXNlJF9zZXRHY1F1ZXVlZCgpIHtcbiAgICB0aGlzLl9iaXRGaWVsZCA9IHRoaXMuX2JpdEZpZWxkIHwgLTEwNzM3NDE4MjQ7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fdW5zZXRHY1F1ZXVlZCA9IGZ1bmN0aW9uIFByb21pc2UkX3Vuc2V0R2NRdWV1ZWQoKSB7XG4gICAgdGhpcy5fYml0RmllbGQgPSB0aGlzLl9iaXRGaWVsZCAmICh+LTEwNzM3NDE4MjQpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3F1ZXVlR0MgPSBmdW5jdGlvbiBQcm9taXNlJF9xdWV1ZUdDKCkge1xuICAgIGlmICh0aGlzLl9pc0djUXVldWVkKCkpIHJldHVybjtcbiAgICB0aGlzLl9zZXRHY1F1ZXVlZCgpO1xuICAgIGFzeW5jLmludm9rZUxhdGVyKHRoaXMuX2djLCB0aGlzLCB2b2lkIDApO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2djID0gZnVuY3Rpb24gUHJvbWlzZSRnYygpIHtcbiAgICB2YXIgbGVuID0gdGhpcy5fbGVuZ3RoKCkgKiA1IC0gNTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzW2ldO1xuICAgIH1cbiAgICB0aGlzLl9jbGVhckZpcnN0SGFuZGxlckRhdGEoKTtcbiAgICB0aGlzLl9zZXRMZW5ndGgoMCk7XG4gICAgdGhpcy5fdW5zZXRHY1F1ZXVlZCgpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX2NsZWFyRmlyc3RIYW5kbGVyRGF0YSA9XG5mdW5jdGlvbiBQcm9taXNlJF9jbGVhckZpcnN0SGFuZGxlckRhdGEoKSB7XG4gICAgdGhpcy5fZnVsZmlsbG1lbnRIYW5kbGVyMCA9IHZvaWQgMDtcbiAgICB0aGlzLl9yZWplY3Rpb25IYW5kbGVyMCA9IHZvaWQgMDtcbiAgICB0aGlzLl9wcm9taXNlMCA9IHZvaWQgMDtcbiAgICB0aGlzLl9yZWNlaXZlcjAgPSB2b2lkIDA7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fcXVldWVTZXR0bGVBdCA9IGZ1bmN0aW9uIFByb21pc2UkX3F1ZXVlU2V0dGxlQXQoaW5kZXgpIHtcbiAgICBpZiAodGhpcy5faXNSZWplY3Rpb25VbmhhbmRsZWQoKSkgdGhpcy5fdW5zZXRSZWplY3Rpb25Jc1VuaGFuZGxlZCgpO1xuICAgIGFzeW5jLmludm9rZSh0aGlzLl9zZXR0bGVQcm9taXNlQXQsIHRoaXMsIGluZGV4KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9mdWxmaWxsVW5jaGVja2VkID1cbmZ1bmN0aW9uIFByb21pc2UkX2Z1bGZpbGxVbmNoZWNrZWQodmFsdWUpIHtcbiAgICBpZiAoIXRoaXMuaXNQZW5kaW5nKCkpIHJldHVybjtcbiAgICBpZiAodmFsdWUgPT09IHRoaXMpIHtcbiAgICAgICAgdmFyIGVyciA9IG1ha2VTZWxmUmVzb2x1dGlvbkVycm9yKCk7XG4gICAgICAgIHRoaXMuX2F0dGFjaEV4dHJhVHJhY2UoZXJyKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlamVjdFVuY2hlY2tlZChlcnIsIHZvaWQgMCk7XG4gICAgfVxuICAgIHRoaXMuX2NsZWFuVmFsdWVzKCk7XG4gICAgdGhpcy5fc2V0RnVsZmlsbGVkKCk7XG4gICAgdGhpcy5fc2V0dGxlZFZhbHVlID0gdmFsdWU7XG4gICAgdmFyIGxlbiA9IHRoaXMuX2xlbmd0aCgpO1xuXG4gICAgaWYgKGxlbiA+IDApIHtcbiAgICAgICAgYXN5bmMuaW52b2tlKHRoaXMuX3NldHRsZVByb21pc2VzLCB0aGlzLCBsZW4pO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9yZWplY3RVbmNoZWNrZWRDaGVja0Vycm9yID1cbmZ1bmN0aW9uIFByb21pc2UkX3JlamVjdFVuY2hlY2tlZENoZWNrRXJyb3IocmVhc29uKSB7XG4gICAgdmFyIHRyYWNlID0gY2FuQXR0YWNoKHJlYXNvbikgPyByZWFzb24gOiBuZXcgRXJyb3IocmVhc29uICsgXCJcIik7XG4gICAgdGhpcy5fcmVqZWN0VW5jaGVja2VkKHJlYXNvbiwgdHJhY2UgPT09IHJlYXNvbiA/IHZvaWQgMCA6IHRyYWNlKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLl9yZWplY3RVbmNoZWNrZWQgPVxuZnVuY3Rpb24gUHJvbWlzZSRfcmVqZWN0VW5jaGVja2VkKHJlYXNvbiwgdHJhY2UpIHtcbiAgICBpZiAoIXRoaXMuaXNQZW5kaW5nKCkpIHJldHVybjtcbiAgICBpZiAocmVhc29uID09PSB0aGlzKSB7XG4gICAgICAgIHZhciBlcnIgPSBtYWtlU2VsZlJlc29sdXRpb25FcnJvcigpO1xuICAgICAgICB0aGlzLl9hdHRhY2hFeHRyYVRyYWNlKGVycik7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWplY3RVbmNoZWNrZWQoZXJyKTtcbiAgICB9XG4gICAgdGhpcy5fY2xlYW5WYWx1ZXMoKTtcbiAgICB0aGlzLl9zZXRSZWplY3RlZCgpO1xuICAgIHRoaXMuX3NldHRsZWRWYWx1ZSA9IHJlYXNvbjtcblxuICAgIGlmICh0aGlzLl9pc0ZpbmFsKCkpIHtcbiAgICAgICAgYXN5bmMuaW52b2tlTGF0ZXIodGhyb3dlciwgdm9pZCAwLCB0cmFjZSA9PT0gdm9pZCAwID8gcmVhc29uIDogdHJhY2UpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBsZW4gPSB0aGlzLl9sZW5ndGgoKTtcblxuICAgIGlmICh0cmFjZSAhPT0gdm9pZCAwKSB0aGlzLl9zZXRDYXJyaWVkU3RhY2tUcmFjZSh0cmFjZSk7XG5cbiAgICBpZiAobGVuID4gMCkge1xuICAgICAgICBhc3luYy5pbnZva2UodGhpcy5fcmVqZWN0UHJvbWlzZXMsIHRoaXMsIG51bGwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2Vuc3VyZVBvc3NpYmxlUmVqZWN0aW9uSGFuZGxlZCgpO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9yZWplY3RQcm9taXNlcyA9IGZ1bmN0aW9uIFByb21pc2UkX3JlamVjdFByb21pc2VzKCkge1xuICAgIHRoaXMuX3NldHRsZVByb21pc2VzKCk7XG4gICAgdGhpcy5fdW5zZXRDYXJyaWVkU3RhY2tUcmFjZSgpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3NldHRsZVByb21pc2VzID0gZnVuY3Rpb24gUHJvbWlzZSRfc2V0dGxlUHJvbWlzZXMoKSB7XG4gICAgdmFyIGxlbiA9IHRoaXMuX2xlbmd0aCgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdGhpcy5fc2V0dGxlUHJvbWlzZUF0KGkpO1xuICAgIH1cbn07XG5cblByb21pc2UucHJvdG90eXBlLl9lbnN1cmVQb3NzaWJsZVJlamVjdGlvbkhhbmRsZWQgPVxuZnVuY3Rpb24gUHJvbWlzZSRfZW5zdXJlUG9zc2libGVSZWplY3Rpb25IYW5kbGVkKCkge1xuICAgIHRoaXMuX3NldFJlamVjdGlvbklzVW5oYW5kbGVkKCk7XG4gICAgaWYgKENhcHR1cmVkVHJhY2UucG9zc2libHlVbmhhbmRsZWRSZWplY3Rpb24gIT09IHZvaWQgMCkge1xuICAgICAgICBhc3luYy5pbnZva2VMYXRlcih0aGlzLl9ub3RpZnlVbmhhbmRsZWRSZWplY3Rpb24sIHRoaXMsIHZvaWQgMCk7XG4gICAgfVxufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX25vdGlmeVVuaGFuZGxlZFJlamVjdGlvbklzSGFuZGxlZCA9XG5mdW5jdGlvbiBQcm9taXNlJF9ub3RpZnlVbmhhbmRsZWRSZWplY3Rpb25Jc0hhbmRsZWQoKSB7XG4gICAgaWYgKHR5cGVvZiB1bmhhbmRsZWRSZWplY3Rpb25IYW5kbGVkID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgYXN5bmMuaW52b2tlTGF0ZXIodW5oYW5kbGVkUmVqZWN0aW9uSGFuZGxlZCwgdm9pZCAwLCB0aGlzKTtcbiAgICB9XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fbm90aWZ5VW5oYW5kbGVkUmVqZWN0aW9uID1cbmZ1bmN0aW9uIFByb21pc2UkX25vdGlmeVVuaGFuZGxlZFJlamVjdGlvbigpIHtcbiAgICBpZiAodGhpcy5faXNSZWplY3Rpb25VbmhhbmRsZWQoKSkge1xuICAgICAgICB2YXIgcmVhc29uID0gdGhpcy5fc2V0dGxlZFZhbHVlO1xuICAgICAgICB2YXIgdHJhY2UgPSB0aGlzLl9nZXRDYXJyaWVkU3RhY2tUcmFjZSgpO1xuXG4gICAgICAgIHRoaXMuX3NldFVuaGFuZGxlZFJlamVjdGlvbklzTm90aWZpZWQoKTtcblxuICAgICAgICBpZiAodHJhY2UgIT09IHZvaWQgMCkge1xuICAgICAgICAgICAgdGhpcy5fdW5zZXRDYXJyaWVkU3RhY2tUcmFjZSgpO1xuICAgICAgICAgICAgcmVhc29uID0gdHJhY2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBDYXB0dXJlZFRyYWNlLnBvc3NpYmx5VW5oYW5kbGVkUmVqZWN0aW9uID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIENhcHR1cmVkVHJhY2UucG9zc2libHlVbmhhbmRsZWRSZWplY3Rpb24ocmVhc29uLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnZhciBjb250ZXh0U3RhY2sgPSBbXTtcblByb21pc2UucHJvdG90eXBlLl9wZWVrQ29udGV4dCA9IGZ1bmN0aW9uIFByb21pc2UkX3BlZWtDb250ZXh0KCkge1xuICAgIHZhciBsYXN0SW5kZXggPSBjb250ZXh0U3RhY2subGVuZ3RoIC0gMTtcbiAgICBpZiAobGFzdEluZGV4ID49IDApIHtcbiAgICAgICAgcmV0dXJuIGNvbnRleHRTdGFja1tsYXN0SW5kZXhdO1xuICAgIH1cbiAgICByZXR1cm4gdm9pZCAwO1xuXG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5fcHVzaENvbnRleHQgPSBmdW5jdGlvbiBQcm9taXNlJF9wdXNoQ29udGV4dCgpIHtcbiAgICBpZiAoIWRlYnVnZ2luZykgcmV0dXJuO1xuICAgIGNvbnRleHRTdGFjay5wdXNoKHRoaXMpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuX3BvcENvbnRleHQgPSBmdW5jdGlvbiBQcm9taXNlJF9wb3BDb250ZXh0KCkge1xuICAgIGlmICghZGVidWdnaW5nKSByZXR1cm47XG4gICAgY29udGV4dFN0YWNrLnBvcCgpO1xufTtcblxuUHJvbWlzZS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24gUHJvbWlzZSROb0NvbmZsaWN0KCkge1xuICAgIHJldHVybiBub0NvbmZsaWN0KFByb21pc2UpO1xufTtcblxuUHJvbWlzZS5zZXRTY2hlZHVsZXIgPSBmdW5jdGlvbihmbikge1xuICAgIGlmICh0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcImZuIG11c3QgYmUgYSBmdW5jdGlvblwiKTtcbiAgICBhc3luYy5fc2NoZWR1bGUgPSBmbjtcbn07XG5cbmlmICghQ2FwdHVyZWRUcmFjZS5pc1N1cHBvcnRlZCgpKSB7XG4gICAgUHJvbWlzZS5sb25nU3RhY2tUcmFjZXMgPSBmdW5jdGlvbigpe307XG4gICAgZGVidWdnaW5nID0gZmFsc2U7XG59XG5cblByb21pc2UuX21ha2VTZWxmUmVzb2x1dGlvbkVycm9yID0gbWFrZVNlbGZSZXNvbHV0aW9uRXJyb3I7XG5yZXF1aXJlKFwiLi9maW5hbGx5LmpzXCIpKFByb21pc2UsIE5FWFRfRklMVEVSLCBjYXN0KTtcbnJlcXVpcmUoXCIuL2RpcmVjdF9yZXNvbHZlLmpzXCIpKFByb21pc2UpO1xucmVxdWlyZShcIi4vc3luY2hyb25vdXNfaW5zcGVjdGlvbi5qc1wiKShQcm9taXNlKTtcbnJlcXVpcmUoXCIuL2pvaW4uanNcIikoUHJvbWlzZSwgUHJvbWlzZUFycmF5LCBjYXN0LCBJTlRFUk5BTCk7XG5Qcm9taXNlLlJhbmdlRXJyb3IgPSBSYW5nZUVycm9yO1xuUHJvbWlzZS5DYW5jZWxsYXRpb25FcnJvciA9IENhbmNlbGxhdGlvbkVycm9yO1xuUHJvbWlzZS5UaW1lb3V0RXJyb3IgPSBUaW1lb3V0RXJyb3I7XG5Qcm9taXNlLlR5cGVFcnJvciA9IFR5cGVFcnJvcjtcblByb21pc2UuT3BlcmF0aW9uYWxFcnJvciA9IE9wZXJhdGlvbmFsRXJyb3I7XG5Qcm9taXNlLlJlamVjdGlvbkVycm9yID0gT3BlcmF0aW9uYWxFcnJvcjtcblByb21pc2UuQWdncmVnYXRlRXJyb3IgPSBlcnJvcnMuQWdncmVnYXRlRXJyb3I7XG5cbnV0aWwudG9GYXN0UHJvcGVydGllcyhQcm9taXNlKTtcbnV0aWwudG9GYXN0UHJvcGVydGllcyhQcm9taXNlLnByb3RvdHlwZSk7XG5Qcm9taXNlLlByb21pc2UgPSBQcm9taXNlO1xucmVxdWlyZSgnLi90aW1lcnMuanMnKShQcm9taXNlLElOVEVSTkFMLGNhc3QpO1xucmVxdWlyZSgnLi9yYWNlLmpzJykoUHJvbWlzZSxJTlRFUk5BTCxjYXN0KTtcbnJlcXVpcmUoJy4vY2FsbF9nZXQuanMnKShQcm9taXNlKTtcbnJlcXVpcmUoJy4vZ2VuZXJhdG9ycy5qcycpKFByb21pc2UsYXBpUmVqZWN0aW9uLElOVEVSTkFMLGNhc3QpO1xucmVxdWlyZSgnLi9tYXAuanMnKShQcm9taXNlLFByb21pc2VBcnJheSxhcGlSZWplY3Rpb24sY2FzdCxJTlRFUk5BTCk7XG5yZXF1aXJlKCcuL25vZGVpZnkuanMnKShQcm9taXNlKTtcbnJlcXVpcmUoJy4vcHJvbWlzaWZ5LmpzJykoUHJvbWlzZSxJTlRFUk5BTCk7XG5yZXF1aXJlKCcuL3Byb3BzLmpzJykoUHJvbWlzZSxQcm9taXNlQXJyYXksY2FzdCk7XG5yZXF1aXJlKCcuL3JlZHVjZS5qcycpKFByb21pc2UsUHJvbWlzZUFycmF5LGFwaVJlamVjdGlvbixjYXN0LElOVEVSTkFMKTtcbnJlcXVpcmUoJy4vc2V0dGxlLmpzJykoUHJvbWlzZSxQcm9taXNlQXJyYXkpO1xucmVxdWlyZSgnLi9zb21lLmpzJykoUHJvbWlzZSxQcm9taXNlQXJyYXksYXBpUmVqZWN0aW9uKTtcbnJlcXVpcmUoJy4vcHJvZ3Jlc3MuanMnKShQcm9taXNlLFByb21pc2VBcnJheSk7XG5yZXF1aXJlKCcuL2NhbmNlbC5qcycpKFByb21pc2UsSU5URVJOQUwpO1xucmVxdWlyZSgnLi9maWx0ZXIuanMnKShQcm9taXNlLElOVEVSTkFMKTtcbnJlcXVpcmUoJy4vYW55LmpzJykoUHJvbWlzZSxQcm9taXNlQXJyYXkpO1xucmVxdWlyZSgnLi9lYWNoLmpzJykoUHJvbWlzZSxJTlRFUk5BTCk7XG5yZXF1aXJlKCcuL3VzaW5nLmpzJykoUHJvbWlzZSxhcGlSZWplY3Rpb24sY2FzdCk7XG5cblByb21pc2UucHJvdG90eXBlID0gUHJvbWlzZS5wcm90b3R5cGU7XG5yZXR1cm4gUHJvbWlzZTtcblxufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJykpIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFByb21pc2UsIElOVEVSTkFMLCBjYXN0KSB7XG52YXIgY2FuQXR0YWNoID0gcmVxdWlyZShcIi4vZXJyb3JzLmpzXCIpLmNhbkF0dGFjaDtcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbC5qc1wiKTtcbnZhciBpc0FycmF5ID0gdXRpbC5pc0FycmF5O1xuXG5mdW5jdGlvbiB0b1Jlc29sdXRpb25WYWx1ZSh2YWwpIHtcbiAgICBzd2l0Y2godmFsKSB7XG4gICAgY2FzZSAtMTogcmV0dXJuIHZvaWQgMDtcbiAgICBjYXNlIC0yOiByZXR1cm4gW107XG4gICAgY2FzZSAtMzogcmV0dXJuIHt9O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gUHJvbWlzZUFycmF5KHZhbHVlcykge1xuICAgIHZhciBwcm9taXNlID0gdGhpcy5fcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgICB2YXIgcGFyZW50ID0gdm9pZCAwO1xuICAgIGlmICh2YWx1ZXMgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIHBhcmVudCA9IHZhbHVlcztcbiAgICAgICAgcHJvbWlzZS5fcHJvcGFnYXRlRnJvbShwYXJlbnQsIDEgfCA0KTtcbiAgICB9XG4gICAgcHJvbWlzZS5fc2V0VHJhY2UocGFyZW50KTtcbiAgICB0aGlzLl92YWx1ZXMgPSB2YWx1ZXM7XG4gICAgdGhpcy5fbGVuZ3RoID0gMDtcbiAgICB0aGlzLl90b3RhbFJlc29sdmVkID0gMDtcbiAgICB0aGlzLl9pbml0KHZvaWQgMCwgLTIpO1xufVxuUHJvbWlzZUFycmF5LnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbiBQcm9taXNlQXJyYXkkbGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLl9sZW5ndGg7XG59O1xuXG5Qcm9taXNlQXJyYXkucHJvdG90eXBlLnByb21pc2UgPSBmdW5jdGlvbiBQcm9taXNlQXJyYXkkcHJvbWlzZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fcHJvbWlzZTtcbn07XG5cblByb21pc2VBcnJheS5wcm90b3R5cGUuX2luaXQgPVxuZnVuY3Rpb24gUHJvbWlzZUFycmF5JF9pbml0KF8sIHJlc29sdmVWYWx1ZUlmRW1wdHkpIHtcbiAgICB2YXIgdmFsdWVzID0gY2FzdCh0aGlzLl92YWx1ZXMsIHZvaWQgMCk7XG4gICAgaWYgKHZhbHVlcyBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgdGhpcy5fdmFsdWVzID0gdmFsdWVzO1xuICAgICAgICB2YWx1ZXMuX3NldEJvdW5kVG8odGhpcy5fcHJvbWlzZS5fYm91bmRUbyk7XG4gICAgICAgIGlmICh2YWx1ZXMuaXNGdWxmaWxsZWQoKSkge1xuICAgICAgICAgICAgdmFsdWVzID0gdmFsdWVzLl9zZXR0bGVkVmFsdWU7XG4gICAgICAgICAgICBpZiAoIWlzQXJyYXkodmFsdWVzKSkge1xuICAgICAgICAgICAgICAgIHZhciBlcnIgPSBuZXcgUHJvbWlzZS5UeXBlRXJyb3IoXCJleHBlY3RpbmcgYW4gYXJyYXksIGEgcHJvbWlzZSBvciBhIHRoZW5hYmxlXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuX19oYXJkUmVqZWN0X18oZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWVzLmlzUGVuZGluZygpKSB7XG4gICAgICAgICAgICB2YWx1ZXMuX3RoZW4oXG4gICAgICAgICAgICAgICAgUHJvbWlzZUFycmF5JF9pbml0LFxuICAgICAgICAgICAgICAgIHRoaXMuX3JlamVjdCxcbiAgICAgICAgICAgICAgICB2b2lkIDAsXG4gICAgICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICAgICByZXNvbHZlVmFsdWVJZkVtcHR5XG4gICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YWx1ZXMuX3Vuc2V0UmVqZWN0aW9uSXNVbmhhbmRsZWQoKTtcbiAgICAgICAgICAgIHRoaXMuX3JlamVjdCh2YWx1ZXMuX3NldHRsZWRWYWx1ZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCFpc0FycmF5KHZhbHVlcykpIHtcbiAgICAgICAgdmFyIGVyciA9IG5ldyBQcm9taXNlLlR5cGVFcnJvcihcImV4cGVjdGluZyBhbiBhcnJheSwgYSBwcm9taXNlIG9yIGEgdGhlbmFibGVcIik7XG4gICAgICAgIHRoaXMuX19oYXJkUmVqZWN0X18oZXJyKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmIChyZXNvbHZlVmFsdWVJZkVtcHR5ID09PSAtNSkge1xuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUVtcHR5QXJyYXkoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmUodG9SZXNvbHV0aW9uVmFsdWUocmVzb2x2ZVZhbHVlSWZFbXB0eSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGxlbiA9IHRoaXMuZ2V0QWN0dWFsTGVuZ3RoKHZhbHVlcy5sZW5ndGgpO1xuICAgIHZhciBuZXdMZW4gPSBsZW47XG4gICAgdmFyIG5ld1ZhbHVlcyA9IHRoaXMuc2hvdWxkQ29weVZhbHVlcygpID8gbmV3IEFycmF5KGxlbikgOiB0aGlzLl92YWx1ZXM7XG4gICAgdmFyIGlzRGlyZWN0U2Nhbk5lZWRlZCA9IGZhbHNlO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgdmFyIG1heWJlUHJvbWlzZSA9IGNhc3QodmFsdWVzW2ldLCB2b2lkIDApO1xuICAgICAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgaWYgKG1heWJlUHJvbWlzZS5pc1BlbmRpbmcoKSkge1xuICAgICAgICAgICAgICAgIG1heWJlUHJvbWlzZS5fcHJveHlQcm9taXNlQXJyYXkodGhpcywgaSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1heWJlUHJvbWlzZS5fdW5zZXRSZWplY3Rpb25Jc1VuaGFuZGxlZCgpO1xuICAgICAgICAgICAgICAgIGlzRGlyZWN0U2Nhbk5lZWRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpc0RpcmVjdFNjYW5OZWVkZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIG5ld1ZhbHVlc1tpXSA9IG1heWJlUHJvbWlzZTtcbiAgICB9XG4gICAgdGhpcy5fdmFsdWVzID0gbmV3VmFsdWVzO1xuICAgIHRoaXMuX2xlbmd0aCA9IG5ld0xlbjtcbiAgICBpZiAoaXNEaXJlY3RTY2FuTmVlZGVkKSB7XG4gICAgICAgIHRoaXMuX3NjYW5EaXJlY3RWYWx1ZXMobGVuKTtcbiAgICB9XG59O1xuXG5Qcm9taXNlQXJyYXkucHJvdG90eXBlLl9zZXR0bGVQcm9taXNlQXQgPVxuZnVuY3Rpb24gUHJvbWlzZUFycmF5JF9zZXR0bGVQcm9taXNlQXQoaW5kZXgpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLl92YWx1ZXNbaW5kZXhdO1xuICAgIGlmICghKHZhbHVlIGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcbiAgICAgICAgdGhpcy5fcHJvbWlzZUZ1bGZpbGxlZCh2YWx1ZSwgaW5kZXgpO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuaXNGdWxmaWxsZWQoKSkge1xuICAgICAgICB0aGlzLl9wcm9taXNlRnVsZmlsbGVkKHZhbHVlLl9zZXR0bGVkVmFsdWUsIGluZGV4KTtcbiAgICB9IGVsc2UgaWYgKHZhbHVlLmlzUmVqZWN0ZWQoKSkge1xuICAgICAgICB0aGlzLl9wcm9taXNlUmVqZWN0ZWQodmFsdWUuX3NldHRsZWRWYWx1ZSwgaW5kZXgpO1xuICAgIH1cbn07XG5cblByb21pc2VBcnJheS5wcm90b3R5cGUuX3NjYW5EaXJlY3RWYWx1ZXMgPVxuZnVuY3Rpb24gUHJvbWlzZUFycmF5JF9zY2FuRGlyZWN0VmFsdWVzKGxlbikge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgaWYgKHRoaXMuX2lzUmVzb2x2ZWQoKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc2V0dGxlUHJvbWlzZUF0KGkpO1xuICAgIH1cbn07XG5cblByb21pc2VBcnJheS5wcm90b3R5cGUuX2lzUmVzb2x2ZWQgPSBmdW5jdGlvbiBQcm9taXNlQXJyYXkkX2lzUmVzb2x2ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3ZhbHVlcyA9PT0gbnVsbDtcbn07XG5cblByb21pc2VBcnJheS5wcm90b3R5cGUuX3Jlc29sdmUgPSBmdW5jdGlvbiBQcm9taXNlQXJyYXkkX3Jlc29sdmUodmFsdWUpIHtcbiAgICB0aGlzLl92YWx1ZXMgPSBudWxsO1xuICAgIHRoaXMuX3Byb21pc2UuX2Z1bGZpbGwodmFsdWUpO1xufTtcblxuUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fX2hhcmRSZWplY3RfXyA9XG5Qcm9taXNlQXJyYXkucHJvdG90eXBlLl9yZWplY3QgPSBmdW5jdGlvbiBQcm9taXNlQXJyYXkkX3JlamVjdChyZWFzb24pIHtcbiAgICB0aGlzLl92YWx1ZXMgPSBudWxsO1xuICAgIHZhciB0cmFjZSA9IGNhbkF0dGFjaChyZWFzb24pID8gcmVhc29uIDogbmV3IEVycm9yKHJlYXNvbiArIFwiXCIpO1xuICAgIHRoaXMuX3Byb21pc2UuX2F0dGFjaEV4dHJhVHJhY2UodHJhY2UpO1xuICAgIHRoaXMuX3Byb21pc2UuX3JlamVjdChyZWFzb24sIHRyYWNlKTtcbn07XG5cblByb21pc2VBcnJheS5wcm90b3R5cGUuX3Byb21pc2VQcm9ncmVzc2VkID1cbmZ1bmN0aW9uIFByb21pc2VBcnJheSRfcHJvbWlzZVByb2dyZXNzZWQocHJvZ3Jlc3NWYWx1ZSwgaW5kZXgpIHtcbiAgICBpZiAodGhpcy5faXNSZXNvbHZlZCgpKSByZXR1cm47XG4gICAgdGhpcy5fcHJvbWlzZS5fcHJvZ3Jlc3Moe1xuICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgIHZhbHVlOiBwcm9ncmVzc1ZhbHVlXG4gICAgfSk7XG59O1xuXG5cblByb21pc2VBcnJheS5wcm90b3R5cGUuX3Byb21pc2VGdWxmaWxsZWQgPVxuZnVuY3Rpb24gUHJvbWlzZUFycmF5JF9wcm9taXNlRnVsZmlsbGVkKHZhbHVlLCBpbmRleCkge1xuICAgIGlmICh0aGlzLl9pc1Jlc29sdmVkKCkpIHJldHVybjtcbiAgICB0aGlzLl92YWx1ZXNbaW5kZXhdID0gdmFsdWU7XG4gICAgdmFyIHRvdGFsUmVzb2x2ZWQgPSArK3RoaXMuX3RvdGFsUmVzb2x2ZWQ7XG4gICAgaWYgKHRvdGFsUmVzb2x2ZWQgPj0gdGhpcy5fbGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuX3Jlc29sdmUodGhpcy5fdmFsdWVzKTtcbiAgICB9XG59O1xuXG5Qcm9taXNlQXJyYXkucHJvdG90eXBlLl9wcm9taXNlUmVqZWN0ZWQgPVxuZnVuY3Rpb24gUHJvbWlzZUFycmF5JF9wcm9taXNlUmVqZWN0ZWQocmVhc29uLCBpbmRleCkge1xuICAgIGlmICh0aGlzLl9pc1Jlc29sdmVkKCkpIHJldHVybjtcbiAgICB0aGlzLl90b3RhbFJlc29sdmVkKys7XG4gICAgdGhpcy5fcmVqZWN0KHJlYXNvbik7XG59O1xuXG5Qcm9taXNlQXJyYXkucHJvdG90eXBlLnNob3VsZENvcHlWYWx1ZXMgPVxuZnVuY3Rpb24gUHJvbWlzZUFycmF5JF9zaG91bGRDb3B5VmFsdWVzKCkge1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuUHJvbWlzZUFycmF5LnByb3RvdHlwZS5nZXRBY3R1YWxMZW5ndGggPVxuZnVuY3Rpb24gUHJvbWlzZUFycmF5JGdldEFjdHVhbExlbmd0aChsZW4pIHtcbiAgICByZXR1cm4gbGVuO1xufTtcblxucmV0dXJuIFByb21pc2VBcnJheTtcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbC5qc1wiKTtcbnZhciBtYXliZVdyYXBBc0Vycm9yID0gdXRpbC5tYXliZVdyYXBBc0Vycm9yO1xudmFyIGVycm9ycyA9IHJlcXVpcmUoXCIuL2Vycm9ycy5qc1wiKTtcbnZhciBUaW1lb3V0RXJyb3IgPSBlcnJvcnMuVGltZW91dEVycm9yO1xudmFyIE9wZXJhdGlvbmFsRXJyb3IgPSBlcnJvcnMuT3BlcmF0aW9uYWxFcnJvcjtcbnZhciBhc3luYyA9IHJlcXVpcmUoXCIuL2FzeW5jLmpzXCIpO1xudmFyIGhhdmVHZXR0ZXJzID0gdXRpbC5oYXZlR2V0dGVycztcbnZhciBlczUgPSByZXF1aXJlKFwiLi9lczUuanNcIik7XG5cbmZ1bmN0aW9uIGlzVW50eXBlZEVycm9yKG9iaikge1xuICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBFcnJvciAmJlxuICAgICAgICBlczUuZ2V0UHJvdG90eXBlT2Yob2JqKSA9PT0gRXJyb3IucHJvdG90eXBlO1xufVxuXG5mdW5jdGlvbiB3cmFwQXNPcGVyYXRpb25hbEVycm9yKG9iaikge1xuICAgIHZhciByZXQ7XG4gICAgaWYgKGlzVW50eXBlZEVycm9yKG9iaikpIHtcbiAgICAgICAgcmV0ID0gbmV3IE9wZXJhdGlvbmFsRXJyb3Iob2JqKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXQgPSBvYmo7XG4gICAgfVxuICAgIGVycm9ycy5tYXJrQXNPcmlnaW5hdGluZ0Zyb21SZWplY3Rpb24ocmV0KTtcbiAgICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBub2RlYmFja0ZvclByb21pc2UocHJvbWlzZSkge1xuICAgIGZ1bmN0aW9uIFByb21pc2VSZXNvbHZlciRfY2FsbGJhY2soZXJyLCB2YWx1ZSkge1xuICAgICAgICBpZiAocHJvbWlzZSA9PT0gbnVsbCkgcmV0dXJuO1xuXG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHZhciB3cmFwcGVkID0gd3JhcEFzT3BlcmF0aW9uYWxFcnJvcihtYXliZVdyYXBBc0Vycm9yKGVycikpO1xuICAgICAgICAgICAgcHJvbWlzZS5fYXR0YWNoRXh0cmFUcmFjZSh3cmFwcGVkKTtcbiAgICAgICAgICAgIHByb21pc2UuX3JlamVjdCh3cmFwcGVkKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdmFyICRfbGVuID0gYXJndW1lbnRzLmxlbmd0aDt2YXIgYXJncyA9IG5ldyBBcnJheSgkX2xlbiAtIDEpOyBmb3IodmFyICRfaSA9IDE7ICRfaSA8ICRfbGVuOyArKyRfaSkge2FyZ3NbJF9pIC0gMV0gPSBhcmd1bWVudHNbJF9pXTt9XG4gICAgICAgICAgICBwcm9taXNlLl9mdWxmaWxsKGFyZ3MpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZS5fZnVsZmlsbCh2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9taXNlID0gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2VSZXNvbHZlciRfY2FsbGJhY2s7XG59XG5cblxudmFyIFByb21pc2VSZXNvbHZlcjtcbmlmICghaGF2ZUdldHRlcnMpIHtcbiAgICBQcm9taXNlUmVzb2x2ZXIgPSBmdW5jdGlvbiBQcm9taXNlUmVzb2x2ZXIocHJvbWlzZSkge1xuICAgICAgICB0aGlzLnByb21pc2UgPSBwcm9taXNlO1xuICAgICAgICB0aGlzLmFzQ2FsbGJhY2sgPSBub2RlYmFja0ZvclByb21pc2UocHJvbWlzZSk7XG4gICAgICAgIHRoaXMuY2FsbGJhY2sgPSB0aGlzLmFzQ2FsbGJhY2s7XG4gICAgfTtcbn1cbmVsc2Uge1xuICAgIFByb21pc2VSZXNvbHZlciA9IGZ1bmN0aW9uIFByb21pc2VSZXNvbHZlcihwcm9taXNlKSB7XG4gICAgICAgIHRoaXMucHJvbWlzZSA9IHByb21pc2U7XG4gICAgfTtcbn1cbmlmIChoYXZlR2V0dGVycykge1xuICAgIHZhciBwcm9wID0ge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGViYWNrRm9yUHJvbWlzZSh0aGlzLnByb21pc2UpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBlczUuZGVmaW5lUHJvcGVydHkoUHJvbWlzZVJlc29sdmVyLnByb3RvdHlwZSwgXCJhc0NhbGxiYWNrXCIsIHByb3ApO1xuICAgIGVzNS5kZWZpbmVQcm9wZXJ0eShQcm9taXNlUmVzb2x2ZXIucHJvdG90eXBlLCBcImNhbGxiYWNrXCIsIHByb3ApO1xufVxuXG5Qcm9taXNlUmVzb2x2ZXIuX25vZGViYWNrRm9yUHJvbWlzZSA9IG5vZGViYWNrRm9yUHJvbWlzZTtcblxuUHJvbWlzZVJlc29sdmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIFByb21pc2VSZXNvbHZlciR0b1N0cmluZygpIHtcbiAgICByZXR1cm4gXCJbb2JqZWN0IFByb21pc2VSZXNvbHZlcl1cIjtcbn07XG5cblByb21pc2VSZXNvbHZlci5wcm90b3R5cGUucmVzb2x2ZSA9XG5Qcm9taXNlUmVzb2x2ZXIucHJvdG90eXBlLmZ1bGZpbGwgPSBmdW5jdGlvbiBQcm9taXNlUmVzb2x2ZXIkcmVzb2x2ZSh2YWx1ZSkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlUmVzb2x2ZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbGxlZ2FsIGludm9jYXRpb24sIHJlc29sdmVyIHJlc29sdmUvcmVqZWN0IG11c3QgYmUgY2FsbGVkIHdpdGhpbiBhIHJlc29sdmVyIGNvbnRleHQuIENvbnNpZGVyIHVzaW5nIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yIGluc3RlYWQuXCIpO1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gdGhpcy5wcm9taXNlO1xuICAgIGlmIChwcm9taXNlLl90cnlGb2xsb3codmFsdWUpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYXN5bmMuaW52b2tlKHByb21pc2UuX2Z1bGZpbGwsIHByb21pc2UsIHZhbHVlKTtcbn07XG5cblByb21pc2VSZXNvbHZlci5wcm90b3R5cGUucmVqZWN0ID0gZnVuY3Rpb24gUHJvbWlzZVJlc29sdmVyJHJlamVjdChyZWFzb24pIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUHJvbWlzZVJlc29sdmVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSWxsZWdhbCBpbnZvY2F0aW9uLCByZXNvbHZlciByZXNvbHZlL3JlamVjdCBtdXN0IGJlIGNhbGxlZCB3aXRoaW4gYSByZXNvbHZlciBjb250ZXh0LiBDb25zaWRlciB1c2luZyB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvciBpbnN0ZWFkLlwiKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMucHJvbWlzZTtcbiAgICBlcnJvcnMubWFya0FzT3JpZ2luYXRpbmdGcm9tUmVqZWN0aW9uKHJlYXNvbik7XG4gICAgdmFyIHRyYWNlID0gZXJyb3JzLmNhbkF0dGFjaChyZWFzb24pID8gcmVhc29uIDogbmV3IEVycm9yKHJlYXNvbiArIFwiXCIpO1xuICAgIHByb21pc2UuX2F0dGFjaEV4dHJhVHJhY2UodHJhY2UpO1xuICAgIGFzeW5jLmludm9rZShwcm9taXNlLl9yZWplY3QsIHByb21pc2UsIHJlYXNvbik7XG4gICAgaWYgKHRyYWNlICE9PSByZWFzb24pIHtcbiAgICAgICAgYXN5bmMuaW52b2tlKHRoaXMuX3NldENhcnJpZWRTdGFja1RyYWNlLCB0aGlzLCB0cmFjZSk7XG4gICAgfVxufTtcblxuUHJvbWlzZVJlc29sdmVyLnByb3RvdHlwZS5wcm9ncmVzcyA9XG5mdW5jdGlvbiBQcm9taXNlUmVzb2x2ZXIkcHJvZ3Jlc3ModmFsdWUpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUHJvbWlzZVJlc29sdmVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSWxsZWdhbCBpbnZvY2F0aW9uLCByZXNvbHZlciByZXNvbHZlL3JlamVjdCBtdXN0IGJlIGNhbGxlZCB3aXRoaW4gYSByZXNvbHZlciBjb250ZXh0LiBDb25zaWRlciB1c2luZyB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvciBpbnN0ZWFkLlwiKTtcbiAgICB9XG4gICAgYXN5bmMuaW52b2tlKHRoaXMucHJvbWlzZS5fcHJvZ3Jlc3MsIHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblxuUHJvbWlzZVJlc29sdmVyLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiBQcm9taXNlUmVzb2x2ZXIkY2FuY2VsKCkge1xuICAgIGFzeW5jLmludm9rZSh0aGlzLnByb21pc2UuY2FuY2VsLCB0aGlzLnByb21pc2UsIHZvaWQgMCk7XG59O1xuXG5Qcm9taXNlUmVzb2x2ZXIucHJvdG90eXBlLnRpbWVvdXQgPSBmdW5jdGlvbiBQcm9taXNlUmVzb2x2ZXIkdGltZW91dCgpIHtcbiAgICB0aGlzLnJlamVjdChuZXcgVGltZW91dEVycm9yKFwidGltZW91dFwiKSk7XG59O1xuXG5Qcm9taXNlUmVzb2x2ZXIucHJvdG90eXBlLmlzUmVzb2x2ZWQgPSBmdW5jdGlvbiBQcm9taXNlUmVzb2x2ZXIkaXNSZXNvbHZlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9taXNlLmlzUmVzb2x2ZWQoKTtcbn07XG5cblByb21pc2VSZXNvbHZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gUHJvbWlzZVJlc29sdmVyJHRvSlNPTigpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9taXNlLnRvSlNPTigpO1xufTtcblxuUHJvbWlzZVJlc29sdmVyLnByb3RvdHlwZS5fc2V0Q2FycmllZFN0YWNrVHJhY2UgPVxuZnVuY3Rpb24gUHJvbWlzZVJlc29sdmVyJF9zZXRDYXJyaWVkU3RhY2tUcmFjZSh0cmFjZSkge1xuICAgIGlmICh0aGlzLnByb21pc2UuaXNSZWplY3RlZCgpKSB7XG4gICAgICAgIHRoaXMucHJvbWlzZS5fc2V0Q2FycmllZFN0YWNrVHJhY2UodHJhY2UpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUHJvbWlzZVJlc29sdmVyO1xuIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFByb21pc2UsIElOVEVSTkFMKSB7XG52YXIgVEhJUyA9IHt9O1xudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsLmpzXCIpO1xudmFyIG5vZGViYWNrRm9yUHJvbWlzZSA9IHJlcXVpcmUoXCIuL3Byb21pc2VfcmVzb2x2ZXIuanNcIilcbiAgICAuX25vZGViYWNrRm9yUHJvbWlzZTtcbnZhciB3aXRoQXBwZW5kZWQgPSB1dGlsLndpdGhBcHBlbmRlZDtcbnZhciBtYXliZVdyYXBBc0Vycm9yID0gdXRpbC5tYXliZVdyYXBBc0Vycm9yO1xudmFyIGNhbkV2YWx1YXRlID0gdXRpbC5jYW5FdmFsdWF0ZTtcbnZhciBUeXBlRXJyb3IgPSByZXF1aXJlKFwiLi9lcnJvcnNcIikuVHlwZUVycm9yO1xudmFyIGRlZmF1bHRTdWZmaXggPSBcIkFzeW5jXCI7XG52YXIgZGVmYXVsdEZpbHRlciA9IGZ1bmN0aW9uKG5hbWUsIGZ1bmMpIHtcbiAgICByZXR1cm4gdXRpbC5pc0lkZW50aWZpZXIobmFtZSkgJiZcbiAgICAgICAgbmFtZS5jaGFyQXQoMCkgIT09IFwiX1wiICYmXG4gICAgICAgICF1dGlsLmlzQ2xhc3MoZnVuYyk7XG59O1xudmFyIGRlZmF1bHRQcm9taXNpZmllZCA9IHtfX2lzUHJvbWlzaWZpZWRfXzogdHJ1ZX07XG5cblxuZnVuY3Rpb24gZXNjYXBlSWRlbnRSZWdleChzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyhbJF0pLywgXCJcXFxcJFwiKTtcbn1cblxuZnVuY3Rpb24gaXNQcm9taXNpZmllZChmbikge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBmbi5fX2lzUHJvbWlzaWZpZWRfXyA9PT0gdHJ1ZTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFzUHJvbWlzaWZpZWQob2JqLCBrZXksIHN1ZmZpeCkge1xuICAgIHZhciB2YWwgPSB1dGlsLmdldERhdGFQcm9wZXJ0eU9yRGVmYXVsdChvYmosIGtleSArIHN1ZmZpeCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdFByb21pc2lmaWVkKTtcbiAgICByZXR1cm4gdmFsID8gaXNQcm9taXNpZmllZCh2YWwpIDogZmFsc2U7XG59XG5mdW5jdGlvbiBjaGVja1ZhbGlkKHJldCwgc3VmZml4LCBzdWZmaXhSZWdleHApIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJldC5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICB2YXIga2V5ID0gcmV0W2ldO1xuICAgICAgICBpZiAoc3VmZml4UmVnZXhwLnRlc3Qoa2V5KSkge1xuICAgICAgICAgICAgdmFyIGtleVdpdGhvdXRBc3luY1N1ZmZpeCA9IGtleS5yZXBsYWNlKHN1ZmZpeFJlZ2V4cCwgXCJcIik7XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHJldC5sZW5ndGg7IGogKz0gMikge1xuICAgICAgICAgICAgICAgIGlmIChyZXRbal0gPT09IGtleVdpdGhvdXRBc3luY1N1ZmZpeCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHByb21pc2lmeSBhbiBBUEkgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0aGF0IGhhcyBub3JtYWwgbWV0aG9kcyB3aXRoICdcIitzdWZmaXgrXCInLXN1ZmZpeFwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHByb21pc2lmaWFibGVNZXRob2RzKG9iaiwgc3VmZml4LCBzdWZmaXhSZWdleHAsIGZpbHRlcikge1xuICAgIHZhciBrZXlzID0gdXRpbC5pbmhlcml0ZWREYXRhS2V5cyhvYmopO1xuICAgIHZhciByZXQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgIHZhciB2YWx1ZSA9IG9ialtrZXldO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICAgICAgICAgICFpc1Byb21pc2lmaWVkKHZhbHVlKSAmJlxuICAgICAgICAgICAgIWhhc1Byb21pc2lmaWVkKG9iaiwga2V5LCBzdWZmaXgpICYmXG4gICAgICAgICAgICBmaWx0ZXIoa2V5LCB2YWx1ZSwgb2JqKSkge1xuICAgICAgICAgICAgcmV0LnB1c2goa2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY2hlY2tWYWxpZChyZXQsIHN1ZmZpeCwgc3VmZml4UmVnZXhwKTtcbiAgICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBzd2l0Y2hDYXNlQXJndW1lbnRPcmRlcihsaWtlbHlBcmd1bWVudENvdW50KSB7XG4gICAgdmFyIHJldCA9IFtsaWtlbHlBcmd1bWVudENvdW50XTtcbiAgICB2YXIgbWluID0gTWF0aC5tYXgoMCwgbGlrZWx5QXJndW1lbnRDb3VudCAtIDEgLSA1KTtcbiAgICBmb3IodmFyIGkgPSBsaWtlbHlBcmd1bWVudENvdW50IC0gMTsgaSA+PSBtaW47IC0taSkge1xuICAgICAgICBpZiAoaSA9PT0gbGlrZWx5QXJndW1lbnRDb3VudCkgY29udGludWU7XG4gICAgICAgIHJldC5wdXNoKGkpO1xuICAgIH1cbiAgICBmb3IodmFyIGkgPSBsaWtlbHlBcmd1bWVudENvdW50ICsgMTsgaSA8PSA1OyArK2kpIHtcbiAgICAgICAgcmV0LnB1c2goaSk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGFyZ3VtZW50U2VxdWVuY2UoYXJndW1lbnRDb3VudCkge1xuICAgIHJldHVybiB1dGlsLmZpbGxlZFJhbmdlKGFyZ3VtZW50Q291bnQsIFwiYXJndW1lbnRzW1wiLCBcIl1cIik7XG59XG5cbmZ1bmN0aW9uIHBhcmFtZXRlckRlY2xhcmF0aW9uKHBhcmFtZXRlckNvdW50KSB7XG4gICAgcmV0dXJuIHV0aWwuZmlsbGVkUmFuZ2UocGFyYW1ldGVyQ291bnQsIFwiX2FyZ1wiLCBcIlwiKTtcbn1cblxuZnVuY3Rpb24gcGFyYW1ldGVyQ291bnQoZm4pIHtcbiAgICBpZiAodHlwZW9mIGZuLmxlbmd0aCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoTWF0aC5taW4oZm4ubGVuZ3RoLCAxMDIzICsgMSksIDApO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVQcm9wZXJ0eUFjY2VzcyhrZXkpIHtcbiAgICBpZiAodXRpbC5pc0lkZW50aWZpZXIoa2V5KSkge1xuICAgICAgICByZXR1cm4gXCIuXCIgKyBrZXk7XG4gICAgfVxuICAgIGVsc2UgcmV0dXJuIFwiWydcIiArIGtleS5yZXBsYWNlKC8oWydcXFxcXSkvZywgXCJcXFxcJDFcIikgKyBcIiddXCI7XG59XG5cbmZ1bmN0aW9uIG1ha2VOb2RlUHJvbWlzaWZpZWRFdmFsKGNhbGxiYWNrLCByZWNlaXZlciwgb3JpZ2luYWxOYW1lLCBmbiwgc3VmZml4KSB7XG4gICAgdmFyIG5ld1BhcmFtZXRlckNvdW50ID0gTWF0aC5tYXgoMCwgcGFyYW1ldGVyQ291bnQoZm4pIC0gMSk7XG4gICAgdmFyIGFyZ3VtZW50T3JkZXIgPSBzd2l0Y2hDYXNlQXJndW1lbnRPcmRlcihuZXdQYXJhbWV0ZXJDb3VudCk7XG4gICAgdmFyIGNhbGxiYWNrTmFtZSA9XG4gICAgICAgICh0eXBlb2Ygb3JpZ2luYWxOYW1lID09PSBcInN0cmluZ1wiICYmIHV0aWwuaXNJZGVudGlmaWVyKG9yaWdpbmFsTmFtZSlcbiAgICAgICAgICAgID8gb3JpZ2luYWxOYW1lICsgc3VmZml4XG4gICAgICAgICAgICA6IFwicHJvbWlzaWZpZWRcIik7XG5cbiAgICBmdW5jdGlvbiBnZW5lcmF0ZUNhbGxGb3JBcmd1bWVudENvdW50KGNvdW50KSB7XG4gICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRTZXF1ZW5jZShjb3VudCkuam9pbihcIiwgXCIpO1xuICAgICAgICB2YXIgY29tbWEgPSBjb3VudCA+IDAgPyBcIiwgXCIgOiBcIlwiO1xuICAgICAgICB2YXIgcmV0O1xuICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICByZXQgPSBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIHRoaXMubWV0aG9kKHt7YXJnc319LCBmbik7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIGJyZWFrOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgXCIucmVwbGFjZShcIi5tZXRob2RcIiwgZ2VuZXJhdGVQcm9wZXJ0eUFjY2VzcyhjYWxsYmFjaykpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlY2VpdmVyID09PSBUSElTKSB7XG4gICAgICAgICAgICByZXQgPSAgXCIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwodGhpcywge3thcmdzfX0sIGZuKTsgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIGJyZWFrOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgXCI7XG4gICAgICAgIH0gZWxzZSBpZiAocmVjZWl2ZXIgIT09IHZvaWQgMCkge1xuICAgICAgICAgICAgcmV0ID0gIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKHJlY2VpdmVyLCB7e2FyZ3N9fSwgZm4pOyAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgICAgICBicmVhazsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIFwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0ID0gIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgICAgICBjYWxsYmFjayh7e2FyZ3N9fSwgZm4pOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgICAgICBicmVhazsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIFwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXQucmVwbGFjZShcInt7YXJnc319XCIsIGFyZ3MpLnJlcGxhY2UoXCIsIFwiLCBjb21tYSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVBcmd1bWVudFN3aXRjaENhc2UoKSB7XG4gICAgICAgIHZhciByZXQgPSBcIlwiO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRPcmRlci5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgcmV0ICs9IFwiY2FzZSBcIiArIGFyZ3VtZW50T3JkZXJbaV0gK1wiOlwiICtcbiAgICAgICAgICAgICAgICBnZW5lcmF0ZUNhbGxGb3JBcmd1bWVudENvdW50KGFyZ3VtZW50T3JkZXJbaV0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjb2RlRm9yQ2FsbDtcbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgY29kZUZvckNhbGwgPSBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgICAgICB0aGlzLnByb3BlcnR5LmFwcGx5KHRoaXMsIGFyZ3MpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIFwiXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoXCIucHJvcGVydHlcIiwgZ2VuZXJhdGVQcm9wZXJ0eUFjY2VzcyhjYWxsYmFjaykpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlY2VpdmVyID09PSBUSElTKSB7XG4gICAgICAgICAgICBjb2RlRm9yQ2FsbCA9IFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb2RlRm9yQ2FsbCA9IFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHJlY2VpdmVyLCBhcmdzKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgXCI7XG4gICAgICAgIH1cblxuICAgICAgICByZXQgKz0gXCIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgZGVmYXVsdDogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGxlbiArIDEpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIHZhciBpID0gMDsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIGFyZ3NbaV0gPSBmbjsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIFtDb2RlRm9yQ2FsbF0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgICAgIGJyZWFrOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXFxuXFxcbiAgICAgICAgXCIucmVwbGFjZShcIltDb2RlRm9yQ2FsbF1cIiwgY29kZUZvckNhbGwpO1xuICAgICAgICByZXR1cm4gcmV0O1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oXCJQcm9taXNlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImNhbGxiYWNrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInJlY2VpdmVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcIndpdGhBcHBlbmRlZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJtYXliZVdyYXBBc0Vycm9yXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcIm5vZGViYWNrRm9yUHJvbWlzZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJJTlRFUk5BTFwiLFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICB2YXIgcmV0ID0gZnVuY3Rpb24gRnVuY3Rpb25OYW1lKFBhcmFtZXRlcnMpIHsgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgJ3VzZSBzdHJpY3QnOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgcHJvbWlzZS5fc2V0VHJhY2Uodm9pZCAwKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgdmFyIGZuID0gbm9kZWJhY2tGb3JQcm9taXNlKHByb21pc2UpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgdHJ5IHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIHN3aXRjaChsZW4pIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgICAgICBbQ29kZUZvclN3aXRjaENhc2VdICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgfSBjYXRjaCAoZSkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIHZhciB3cmFwcGVkID0gbWF5YmVXcmFwQXNFcnJvcihlKTsgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIHByb21pc2UuX2F0dGFjaEV4dHJhVHJhY2Uod3JhcHBlZCk7ICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgICAgIHByb21pc2UuX3JlamVjdCh3cmFwcGVkKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgfSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICAgICAgcmV0dXJuIHByb21pc2U7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICB9OyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICByZXQuX19pc1Byb21pc2lmaWVkX18gPSB0cnVlOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICByZXR1cm4gcmV0OyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcXG5cXFxuICAgICAgICBcIlxuICAgICAgICAucmVwbGFjZShcIkZ1bmN0aW9uTmFtZVwiLCBjYWxsYmFja05hbWUpXG4gICAgICAgIC5yZXBsYWNlKFwiUGFyYW1ldGVyc1wiLCBwYXJhbWV0ZXJEZWNsYXJhdGlvbihuZXdQYXJhbWV0ZXJDb3VudCkpXG4gICAgICAgIC5yZXBsYWNlKFwiW0NvZGVGb3JTd2l0Y2hDYXNlXVwiLCBnZW5lcmF0ZUFyZ3VtZW50U3dpdGNoQ2FzZSgpKSkoXG4gICAgICAgICAgICBQcm9taXNlLFxuICAgICAgICAgICAgY2FsbGJhY2ssXG4gICAgICAgICAgICByZWNlaXZlcixcbiAgICAgICAgICAgIHdpdGhBcHBlbmRlZCxcbiAgICAgICAgICAgIG1heWJlV3JhcEFzRXJyb3IsXG4gICAgICAgICAgICBub2RlYmFja0ZvclByb21pc2UsXG4gICAgICAgICAgICBJTlRFUk5BTFxuICAgICAgICApO1xufVxuXG5mdW5jdGlvbiBtYWtlTm9kZVByb21pc2lmaWVkQ2xvc3VyZShjYWxsYmFjaywgcmVjZWl2ZXIpIHtcbiAgICBmdW5jdGlvbiBwcm9taXNpZmllZCgpIHtcbiAgICAgICAgdmFyIF9yZWNlaXZlciA9IHJlY2VpdmVyO1xuICAgICAgICBpZiAocmVjZWl2ZXIgPT09IFRISVMpIF9yZWNlaXZlciA9IHRoaXM7XG4gICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gX3JlY2VpdmVyW2NhbGxiYWNrXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgICAgICAgcHJvbWlzZS5fc2V0VHJhY2Uodm9pZCAwKTtcbiAgICAgICAgdmFyIGZuID0gbm9kZWJhY2tGb3JQcm9taXNlKHByb21pc2UpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkoX3JlY2VpdmVyLCB3aXRoQXBwZW5kZWQoYXJndW1lbnRzLCBmbikpO1xuICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgIHZhciB3cmFwcGVkID0gbWF5YmVXcmFwQXNFcnJvcihlKTtcbiAgICAgICAgICAgIHByb21pc2UuX2F0dGFjaEV4dHJhVHJhY2Uod3JhcHBlZCk7XG4gICAgICAgICAgICBwcm9taXNlLl9yZWplY3Qod3JhcHBlZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHByb21pc2lmaWVkLl9faXNQcm9taXNpZmllZF9fID0gdHJ1ZTtcbiAgICByZXR1cm4gcHJvbWlzaWZpZWQ7XG59XG5cbnZhciBtYWtlTm9kZVByb21pc2lmaWVkID0gY2FuRXZhbHVhdGVcbiAgICA/IG1ha2VOb2RlUHJvbWlzaWZpZWRFdmFsXG4gICAgOiBtYWtlTm9kZVByb21pc2lmaWVkQ2xvc3VyZTtcblxuZnVuY3Rpb24gcHJvbWlzaWZ5QWxsKG9iaiwgc3VmZml4LCBmaWx0ZXIsIHByb21pc2lmaWVyKSB7XG4gICAgdmFyIHN1ZmZpeFJlZ2V4cCA9IG5ldyBSZWdFeHAoZXNjYXBlSWRlbnRSZWdleChzdWZmaXgpICsgXCIkXCIpO1xuICAgIHZhciBtZXRob2RzID1cbiAgICAgICAgcHJvbWlzaWZpYWJsZU1ldGhvZHMob2JqLCBzdWZmaXgsIHN1ZmZpeFJlZ2V4cCwgZmlsdGVyKTtcblxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBtZXRob2RzLmxlbmd0aDsgaSA8IGxlbjsgaSs9IDIpIHtcbiAgICAgICAgdmFyIGtleSA9IG1ldGhvZHNbaV07XG4gICAgICAgIHZhciBmbiA9IG1ldGhvZHNbaSsxXTtcbiAgICAgICAgdmFyIHByb21pc2lmaWVkS2V5ID0ga2V5ICsgc3VmZml4O1xuICAgICAgICBvYmpbcHJvbWlzaWZpZWRLZXldID0gcHJvbWlzaWZpZXIgPT09IG1ha2VOb2RlUHJvbWlzaWZpZWRcbiAgICAgICAgICAgICAgICA/IG1ha2VOb2RlUHJvbWlzaWZpZWQoa2V5LCBUSElTLCBrZXksIGZuLCBzdWZmaXgpXG4gICAgICAgICAgICAgICAgOiBwcm9taXNpZmllcihmbik7XG4gICAgfVxuICAgIHV0aWwudG9GYXN0UHJvcGVydGllcyhvYmopO1xuICAgIHJldHVybiBvYmo7XG59XG5cbmZ1bmN0aW9uIHByb21pc2lmeShjYWxsYmFjaywgcmVjZWl2ZXIpIHtcbiAgICByZXR1cm4gbWFrZU5vZGVQcm9taXNpZmllZChjYWxsYmFjaywgcmVjZWl2ZXIsIHZvaWQgMCwgY2FsbGJhY2spO1xufVxuXG5Qcm9taXNlLnByb21pc2lmeSA9IGZ1bmN0aW9uIFByb21pc2UkUHJvbWlzaWZ5KGZuLCByZWNlaXZlcikge1xuICAgIGlmICh0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZm4gbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuICAgIH1cbiAgICBpZiAoaXNQcm9taXNpZmllZChmbikpIHtcbiAgICAgICAgcmV0dXJuIGZuO1xuICAgIH1cbiAgICByZXR1cm4gcHJvbWlzaWZ5KGZuLCBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IFRISVMgOiByZWNlaXZlcik7XG59O1xuXG5Qcm9taXNlLnByb21pc2lmeUFsbCA9IGZ1bmN0aW9uIFByb21pc2UkUHJvbWlzaWZ5QWxsKHRhcmdldCwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwidGhlIHRhcmdldCBvZiBwcm9taXNpZnlBbGwgbXVzdCBiZSBhbiBvYmplY3Qgb3IgYSBmdW5jdGlvblwiKTtcbiAgICB9XG4gICAgb3B0aW9ucyA9IE9iamVjdChvcHRpb25zKTtcbiAgICB2YXIgc3VmZml4ID0gb3B0aW9ucy5zdWZmaXg7XG4gICAgaWYgKHR5cGVvZiBzdWZmaXggIT09IFwic3RyaW5nXCIpIHN1ZmZpeCA9IGRlZmF1bHRTdWZmaXg7XG4gICAgdmFyIGZpbHRlciA9IG9wdGlvbnMuZmlsdGVyO1xuICAgIGlmICh0eXBlb2YgZmlsdGVyICE9PSBcImZ1bmN0aW9uXCIpIGZpbHRlciA9IGRlZmF1bHRGaWx0ZXI7XG4gICAgdmFyIHByb21pc2lmaWVyID0gb3B0aW9ucy5wcm9taXNpZmllcjtcbiAgICBpZiAodHlwZW9mIHByb21pc2lmaWVyICE9PSBcImZ1bmN0aW9uXCIpIHByb21pc2lmaWVyID0gbWFrZU5vZGVQcm9taXNpZmllZDtcblxuICAgIGlmICghdXRpbC5pc0lkZW50aWZpZXIoc3VmZml4KSkge1xuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcInN1ZmZpeCBtdXN0IGJlIGEgdmFsaWQgaWRlbnRpZmllclwiKTtcbiAgICB9XG5cbiAgICB2YXIga2V5cyA9IHV0aWwuaW5oZXJpdGVkRGF0YUtleXModGFyZ2V0LCB7aW5jbHVkZUhpZGRlbjogdHJ1ZX0pO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgdmFsdWUgPSB0YXJnZXRba2V5c1tpXV07XG4gICAgICAgIGlmIChrZXlzW2ldICE9PSBcImNvbnN0cnVjdG9yXCIgJiZcbiAgICAgICAgICAgIHV0aWwuaXNDbGFzcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHByb21pc2lmeUFsbCh2YWx1ZS5wcm90b3R5cGUsIHN1ZmZpeCwgZmlsdGVyLCBwcm9taXNpZmllcik7XG4gICAgICAgICAgICBwcm9taXNpZnlBbGwodmFsdWUsIHN1ZmZpeCwgZmlsdGVyLCBwcm9taXNpZmllcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzaWZ5QWxsKHRhcmdldCwgc3VmZml4LCBmaWx0ZXIsIHByb21pc2lmaWVyKTtcbn07XG59O1xuXG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUHJvbWlzZSwgUHJvbWlzZUFycmF5LCBjYXN0KSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgYXBpUmVqZWN0aW9uID0gcmVxdWlyZShcIi4vZXJyb3JzX2FwaV9yZWplY3Rpb25cIikoUHJvbWlzZSk7XG52YXIgaXNPYmplY3QgPSB1dGlsLmlzT2JqZWN0O1xudmFyIGVzNSA9IHJlcXVpcmUoXCIuL2VzNS5qc1wiKTtcblxuZnVuY3Rpb24gUHJvcGVydGllc1Byb21pc2VBcnJheShvYmopIHtcbiAgICB2YXIga2V5cyA9IGVzNS5rZXlzKG9iaik7XG4gICAgdmFyIGxlbiA9IGtleXMubGVuZ3RoO1xuICAgIHZhciB2YWx1ZXMgPSBuZXcgQXJyYXkobGVuICogMik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgdmFsdWVzW2ldID0gb2JqW2tleV07XG4gICAgICAgIHZhbHVlc1tpICsgbGVuXSA9IGtleTtcbiAgICB9XG4gICAgdGhpcy5jb25zdHJ1Y3RvciQodmFsdWVzKTtcbn1cbnV0aWwuaW5oZXJpdHMoUHJvcGVydGllc1Byb21pc2VBcnJheSwgUHJvbWlzZUFycmF5KTtcblxuUHJvcGVydGllc1Byb21pc2VBcnJheS5wcm90b3R5cGUuX2luaXQgPVxuZnVuY3Rpb24gUHJvcGVydGllc1Byb21pc2VBcnJheSRfaW5pdCgpIHtcbiAgICB0aGlzLl9pbml0JCh2b2lkIDAsIC0zKSA7XG59O1xuXG5Qcm9wZXJ0aWVzUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fcHJvbWlzZUZ1bGZpbGxlZCA9XG5mdW5jdGlvbiBQcm9wZXJ0aWVzUHJvbWlzZUFycmF5JF9wcm9taXNlRnVsZmlsbGVkKHZhbHVlLCBpbmRleCkge1xuICAgIGlmICh0aGlzLl9pc1Jlc29sdmVkKCkpIHJldHVybjtcbiAgICB0aGlzLl92YWx1ZXNbaW5kZXhdID0gdmFsdWU7XG4gICAgdmFyIHRvdGFsUmVzb2x2ZWQgPSArK3RoaXMuX3RvdGFsUmVzb2x2ZWQ7XG4gICAgaWYgKHRvdGFsUmVzb2x2ZWQgPj0gdGhpcy5fbGVuZ3RoKSB7XG4gICAgICAgIHZhciB2YWwgPSB7fTtcbiAgICAgICAgdmFyIGtleU9mZnNldCA9IHRoaXMubGVuZ3RoKCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLmxlbmd0aCgpOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgIHZhbFt0aGlzLl92YWx1ZXNbaSArIGtleU9mZnNldF1dID0gdGhpcy5fdmFsdWVzW2ldO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3Jlc29sdmUodmFsKTtcbiAgICB9XG59O1xuXG5Qcm9wZXJ0aWVzUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fcHJvbWlzZVByb2dyZXNzZWQgPVxuZnVuY3Rpb24gUHJvcGVydGllc1Byb21pc2VBcnJheSRfcHJvbWlzZVByb2dyZXNzZWQodmFsdWUsIGluZGV4KSB7XG4gICAgaWYgKHRoaXMuX2lzUmVzb2x2ZWQoKSkgcmV0dXJuO1xuXG4gICAgdGhpcy5fcHJvbWlzZS5fcHJvZ3Jlc3Moe1xuICAgICAgICBrZXk6IHRoaXMuX3ZhbHVlc1tpbmRleCArIHRoaXMubGVuZ3RoKCldLFxuICAgICAgICB2YWx1ZTogdmFsdWVcbiAgICB9KTtcbn07XG5cblByb3BlcnRpZXNQcm9taXNlQXJyYXkucHJvdG90eXBlLnNob3VsZENvcHlWYWx1ZXMgPVxuZnVuY3Rpb24gUHJvcGVydGllc1Byb21pc2VBcnJheSRfc2hvdWxkQ29weVZhbHVlcygpIHtcbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5Qcm9wZXJ0aWVzUHJvbWlzZUFycmF5LnByb3RvdHlwZS5nZXRBY3R1YWxMZW5ndGggPVxuZnVuY3Rpb24gUHJvcGVydGllc1Byb21pc2VBcnJheSRnZXRBY3R1YWxMZW5ndGgobGVuKSB7XG4gICAgcmV0dXJuIGxlbiA+PiAxO1xufTtcblxuZnVuY3Rpb24gUHJvbWlzZSRfUHJvcHMocHJvbWlzZXMpIHtcbiAgICB2YXIgcmV0O1xuICAgIHZhciBjYXN0VmFsdWUgPSBjYXN0KHByb21pc2VzLCB2b2lkIDApO1xuXG4gICAgaWYgKCFpc09iamVjdChjYXN0VmFsdWUpKSB7XG4gICAgICAgIHJldHVybiBhcGlSZWplY3Rpb24oXCJjYW5ub3QgYXdhaXQgcHJvcGVydGllcyBvZiBhIG5vbi1vYmplY3RcIik7XG4gICAgfSBlbHNlIGlmIChjYXN0VmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIHJldCA9IGNhc3RWYWx1ZS5fdGhlbihQcm9taXNlLnByb3BzLCB2b2lkIDAsIHZvaWQgMCwgdm9pZCAwLCB2b2lkIDApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldCA9IG5ldyBQcm9wZXJ0aWVzUHJvbWlzZUFycmF5KGNhc3RWYWx1ZSkucHJvbWlzZSgpO1xuICAgIH1cblxuICAgIGlmIChjYXN0VmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIHJldC5fcHJvcGFnYXRlRnJvbShjYXN0VmFsdWUsIDQpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5wcm9wcyA9IGZ1bmN0aW9uIFByb21pc2UkcHJvcHMoKSB7XG4gICAgcmV0dXJuIFByb21pc2UkX1Byb3BzKHRoaXMpO1xufTtcblxuUHJvbWlzZS5wcm9wcyA9IGZ1bmN0aW9uIFByb21pc2UkUHJvcHMocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gUHJvbWlzZSRfUHJvcHMocHJvbWlzZXMpO1xufTtcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbmZ1bmN0aW9uIGFycmF5Q29weShzcmMsIHNyY0luZGV4LCBkc3QsIGRzdEluZGV4LCBsZW4pIHtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgIGRzdFtqICsgZHN0SW5kZXhdID0gc3JjW2ogKyBzcmNJbmRleF07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBRdWV1ZShjYXBhY2l0eSkge1xuICAgIHRoaXMuX2NhcGFjaXR5ID0gY2FwYWNpdHk7XG4gICAgdGhpcy5fbGVuZ3RoID0gMDtcbiAgICB0aGlzLl9mcm9udCA9IDA7XG4gICAgdGhpcy5fbWFrZUNhcGFjaXR5KCk7XG59XG5cblF1ZXVlLnByb3RvdHlwZS5fd2lsbEJlT3ZlckNhcGFjaXR5ID1cbmZ1bmN0aW9uIFF1ZXVlJF93aWxsQmVPdmVyQ2FwYWNpdHkoc2l6ZSkge1xuICAgIHJldHVybiB0aGlzLl9jYXBhY2l0eSA8IHNpemU7XG59O1xuXG5RdWV1ZS5wcm90b3R5cGUuX3B1c2hPbmUgPSBmdW5jdGlvbiBRdWV1ZSRfcHVzaE9uZShhcmcpIHtcbiAgICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGgoKTtcbiAgICB0aGlzLl9jaGVja0NhcGFjaXR5KGxlbmd0aCArIDEpO1xuICAgIHZhciBpID0gKHRoaXMuX2Zyb250ICsgbGVuZ3RoKSAmICh0aGlzLl9jYXBhY2l0eSAtIDEpO1xuICAgIHRoaXNbaV0gPSBhcmc7XG4gICAgdGhpcy5fbGVuZ3RoID0gbGVuZ3RoICsgMTtcbn07XG5cblF1ZXVlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gUXVldWUkcHVzaChmbiwgcmVjZWl2ZXIsIGFyZykge1xuICAgIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aCgpICsgMztcbiAgICBpZiAodGhpcy5fd2lsbEJlT3ZlckNhcGFjaXR5KGxlbmd0aCkpIHtcbiAgICAgICAgdGhpcy5fcHVzaE9uZShmbik7XG4gICAgICAgIHRoaXMuX3B1c2hPbmUocmVjZWl2ZXIpO1xuICAgICAgICB0aGlzLl9wdXNoT25lKGFyZyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGogPSB0aGlzLl9mcm9udCArIGxlbmd0aCAtIDM7XG4gICAgdGhpcy5fY2hlY2tDYXBhY2l0eShsZW5ndGgpO1xuICAgIHZhciB3cmFwTWFzayA9IHRoaXMuX2NhcGFjaXR5IC0gMTtcbiAgICB0aGlzWyhqICsgMCkgJiB3cmFwTWFza10gPSBmbjtcbiAgICB0aGlzWyhqICsgMSkgJiB3cmFwTWFza10gPSByZWNlaXZlcjtcbiAgICB0aGlzWyhqICsgMikgJiB3cmFwTWFza10gPSBhcmc7XG4gICAgdGhpcy5fbGVuZ3RoID0gbGVuZ3RoO1xufTtcblxuUXVldWUucHJvdG90eXBlLnNoaWZ0ID0gZnVuY3Rpb24gUXVldWUkc2hpZnQoKSB7XG4gICAgdmFyIGZyb250ID0gdGhpcy5fZnJvbnQsXG4gICAgICAgIHJldCA9IHRoaXNbZnJvbnRdO1xuXG4gICAgdGhpc1tmcm9udF0gPSB2b2lkIDA7XG4gICAgdGhpcy5fZnJvbnQgPSAoZnJvbnQgKyAxKSAmICh0aGlzLl9jYXBhY2l0eSAtIDEpO1xuICAgIHRoaXMuX2xlbmd0aC0tO1xuICAgIHJldHVybiByZXQ7XG59O1xuXG5RdWV1ZS5wcm90b3R5cGUubGVuZ3RoID0gZnVuY3Rpb24gUXVldWUkbGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLl9sZW5ndGg7XG59O1xuXG5RdWV1ZS5wcm90b3R5cGUuX21ha2VDYXBhY2l0eSA9IGZ1bmN0aW9uIFF1ZXVlJF9tYWtlQ2FwYWNpdHkoKSB7XG4gICAgdmFyIGxlbiA9IHRoaXMuX2NhcGFjaXR5O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgdGhpc1tpXSA9IHZvaWQgMDtcbiAgICB9XG59O1xuXG5RdWV1ZS5wcm90b3R5cGUuX2NoZWNrQ2FwYWNpdHkgPSBmdW5jdGlvbiBRdWV1ZSRfY2hlY2tDYXBhY2l0eShzaXplKSB7XG4gICAgaWYgKHRoaXMuX2NhcGFjaXR5IDwgc2l6ZSkge1xuICAgICAgICB0aGlzLl9yZXNpemVUbyh0aGlzLl9jYXBhY2l0eSA8PCAzKTtcbiAgICB9XG59O1xuXG5RdWV1ZS5wcm90b3R5cGUuX3Jlc2l6ZVRvID0gZnVuY3Rpb24gUXVldWUkX3Jlc2l6ZVRvKGNhcGFjaXR5KSB7XG4gICAgdmFyIG9sZEZyb250ID0gdGhpcy5fZnJvbnQ7XG4gICAgdmFyIG9sZENhcGFjaXR5ID0gdGhpcy5fY2FwYWNpdHk7XG4gICAgdmFyIG9sZFF1ZXVlID0gbmV3IEFycmF5KG9sZENhcGFjaXR5KTtcbiAgICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGgoKTtcblxuICAgIGFycmF5Q29weSh0aGlzLCAwLCBvbGRRdWV1ZSwgMCwgb2xkQ2FwYWNpdHkpO1xuICAgIHRoaXMuX2NhcGFjaXR5ID0gY2FwYWNpdHk7XG4gICAgdGhpcy5fbWFrZUNhcGFjaXR5KCk7XG4gICAgdGhpcy5fZnJvbnQgPSAwO1xuICAgIGlmIChvbGRGcm9udCArIGxlbmd0aCA8PSBvbGRDYXBhY2l0eSkge1xuICAgICAgICBhcnJheUNvcHkob2xkUXVldWUsIG9sZEZyb250LCB0aGlzLCAwLCBsZW5ndGgpO1xuICAgIH0gZWxzZSB7ICAgICAgICB2YXIgbGVuZ3RoQmVmb3JlV3JhcHBpbmcgPVxuICAgICAgICAgICAgbGVuZ3RoIC0gKChvbGRGcm9udCArIGxlbmd0aCkgJiAob2xkQ2FwYWNpdHkgLSAxKSk7XG5cbiAgICAgICAgYXJyYXlDb3B5KG9sZFF1ZXVlLCBvbGRGcm9udCwgdGhpcywgMCwgbGVuZ3RoQmVmb3JlV3JhcHBpbmcpO1xuICAgICAgICBhcnJheUNvcHkob2xkUXVldWUsIDAsIHRoaXMsIGxlbmd0aEJlZm9yZVdyYXBwaW5nLFxuICAgICAgICAgICAgICAgICAgICBsZW5ndGggLSBsZW5ndGhCZWZvcmVXcmFwcGluZyk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBRdWV1ZTtcbiIsIi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cblwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihQcm9taXNlLCBJTlRFUk5BTCwgY2FzdCkge1xudmFyIGFwaVJlamVjdGlvbiA9IHJlcXVpcmUoXCIuL2Vycm9yc19hcGlfcmVqZWN0aW9uLmpzXCIpKFByb21pc2UpO1xudmFyIGlzQXJyYXkgPSByZXF1aXJlKFwiLi91dGlsLmpzXCIpLmlzQXJyYXk7XG5cbnZhciByYWNlTGF0ZXIgPSBmdW5jdGlvbiBQcm9taXNlJF9yYWNlTGF0ZXIocHJvbWlzZSkge1xuICAgIHJldHVybiBwcm9taXNlLnRoZW4oZnVuY3Rpb24oYXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UkX1JhY2UoYXJyYXksIHByb21pc2UpO1xuICAgIH0pO1xufTtcblxudmFyIGhhc093biA9IHt9Lmhhc093blByb3BlcnR5O1xuZnVuY3Rpb24gUHJvbWlzZSRfUmFjZShwcm9taXNlcywgcGFyZW50KSB7XG4gICAgdmFyIG1heWJlUHJvbWlzZSA9IGNhc3QocHJvbWlzZXMsIHZvaWQgMCk7XG5cbiAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICByZXR1cm4gcmFjZUxhdGVyKG1heWJlUHJvbWlzZSk7XG4gICAgfSBlbHNlIGlmICghaXNBcnJheShwcm9taXNlcykpIHtcbiAgICAgICAgcmV0dXJuIGFwaVJlamVjdGlvbihcImV4cGVjdGluZyBhbiBhcnJheSwgYSBwcm9taXNlIG9yIGEgdGhlbmFibGVcIik7XG4gICAgfVxuXG4gICAgdmFyIHJldCA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgICBpZiAocGFyZW50ICE9PSB2b2lkIDApIHtcbiAgICAgICAgcmV0Ll9wcm9wYWdhdGVGcm9tKHBhcmVudCwgNyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0Ll9zZXRUcmFjZSh2b2lkIDApO1xuICAgIH1cbiAgICB2YXIgZnVsZmlsbCA9IHJldC5fZnVsZmlsbDtcbiAgICB2YXIgcmVqZWN0ID0gcmV0Ll9yZWplY3Q7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHByb21pc2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIHZhciB2YWwgPSBwcm9taXNlc1tpXTtcblxuICAgICAgICBpZiAodmFsID09PSB2b2lkIDAgJiYgIShoYXNPd24uY2FsbChwcm9taXNlcywgaSkpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIFByb21pc2UuY2FzdCh2YWwpLl90aGVuKGZ1bGZpbGwsIHJlamVjdCwgdm9pZCAwLCByZXQsIG51bGwpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xufVxuXG5Qcm9taXNlLnJhY2UgPSBmdW5jdGlvbiBQcm9taXNlJFJhY2UocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gUHJvbWlzZSRfUmFjZShwcm9taXNlcywgdm9pZCAwKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnJhY2UgPSBmdW5jdGlvbiBQcm9taXNlJHJhY2UoKSB7XG4gICAgcmV0dXJuIFByb21pc2UkX1JhY2UodGhpcywgdm9pZCAwKTtcbn07XG5cbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUHJvbWlzZSwgUHJvbWlzZUFycmF5LCBhcGlSZWplY3Rpb24sIGNhc3QsIElOVEVSTkFMKSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgdHJ5Q2F0Y2g0ID0gdXRpbC50cnlDYXRjaDQ7XG52YXIgdHJ5Q2F0Y2gzID0gdXRpbC50cnlDYXRjaDM7XG52YXIgZXJyb3JPYmogPSB1dGlsLmVycm9yT2JqO1xuZnVuY3Rpb24gUmVkdWN0aW9uUHJvbWlzZUFycmF5KHByb21pc2VzLCBmbiwgYWNjdW0sIF9lYWNoKSB7XG4gICAgdGhpcy5jb25zdHJ1Y3RvciQocHJvbWlzZXMpO1xuICAgIHRoaXMuX3ByZXNlcnZlZFZhbHVlcyA9IF9lYWNoID09PSBJTlRFUk5BTCA/IFtdIDogbnVsbDtcbiAgICB0aGlzLl96ZXJvdGhJc0FjY3VtID0gKGFjY3VtID09PSB2b2lkIDApO1xuICAgIHRoaXMuX2dvdEFjY3VtID0gZmFsc2U7XG4gICAgdGhpcy5fcmVkdWNpbmdJbmRleCA9ICh0aGlzLl96ZXJvdGhJc0FjY3VtID8gMSA6IDApO1xuICAgIHRoaXMuX3ZhbHVlc1BoYXNlID0gdW5kZWZpbmVkO1xuXG4gICAgdmFyIG1heWJlUHJvbWlzZSA9IGNhc3QoYWNjdW0sIHZvaWQgMCk7XG4gICAgdmFyIHJlamVjdGVkID0gZmFsc2U7XG4gICAgdmFyIGlzUHJvbWlzZSA9IG1heWJlUHJvbWlzZSBpbnN0YW5jZW9mIFByb21pc2U7XG4gICAgaWYgKGlzUHJvbWlzZSkge1xuICAgICAgICBpZiAobWF5YmVQcm9taXNlLmlzUGVuZGluZygpKSB7XG4gICAgICAgICAgICBtYXliZVByb21pc2UuX3Byb3h5UHJvbWlzZUFycmF5KHRoaXMsIC0xKTtcbiAgICAgICAgfSBlbHNlIGlmIChtYXliZVByb21pc2UuaXNGdWxmaWxsZWQoKSkge1xuICAgICAgICAgICAgYWNjdW0gPSBtYXliZVByb21pc2UudmFsdWUoKTtcbiAgICAgICAgICAgIHRoaXMuX2dvdEFjY3VtID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1heWJlUHJvbWlzZS5fdW5zZXRSZWplY3Rpb25Jc1VuaGFuZGxlZCgpO1xuICAgICAgICAgICAgdGhpcy5fcmVqZWN0KG1heWJlUHJvbWlzZS5yZWFzb24oKSk7XG4gICAgICAgICAgICByZWplY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKCEoaXNQcm9taXNlIHx8IHRoaXMuX3plcm90aElzQWNjdW0pKSB0aGlzLl9nb3RBY2N1bSA9IHRydWU7XG4gICAgdGhpcy5fY2FsbGJhY2sgPSBmbjtcbiAgICB0aGlzLl9hY2N1bSA9IGFjY3VtO1xuICAgIGlmICghcmVqZWN0ZWQpIHRoaXMuX2luaXQkKHZvaWQgMCwgLTUpO1xufVxudXRpbC5pbmhlcml0cyhSZWR1Y3Rpb25Qcm9taXNlQXJyYXksIFByb21pc2VBcnJheSk7XG5cblJlZHVjdGlvblByb21pc2VBcnJheS5wcm90b3R5cGUuX2luaXQgPVxuZnVuY3Rpb24gUmVkdWN0aW9uUHJvbWlzZUFycmF5JF9pbml0KCkge307XG5cblJlZHVjdGlvblByb21pc2VBcnJheS5wcm90b3R5cGUuX3Jlc29sdmVFbXB0eUFycmF5ID1cbmZ1bmN0aW9uIFJlZHVjdGlvblByb21pc2VBcnJheSRfcmVzb2x2ZUVtcHR5QXJyYXkoKSB7XG4gICAgaWYgKHRoaXMuX2dvdEFjY3VtIHx8IHRoaXMuX3plcm90aElzQWNjdW0pIHtcbiAgICAgICAgdGhpcy5fcmVzb2x2ZSh0aGlzLl9wcmVzZXJ2ZWRWYWx1ZXMgIT09IG51bGxcbiAgICAgICAgICAgICAgICAgICAgICAgID8gW10gOiB0aGlzLl9hY2N1bSk7XG4gICAgfVxufTtcblxuUmVkdWN0aW9uUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fcHJvbWlzZUZ1bGZpbGxlZCA9XG5mdW5jdGlvbiBSZWR1Y3Rpb25Qcm9taXNlQXJyYXkkX3Byb21pc2VGdWxmaWxsZWQodmFsdWUsIGluZGV4KSB7XG4gICAgdmFyIHZhbHVlcyA9IHRoaXMuX3ZhbHVlcztcbiAgICBpZiAodmFsdWVzID09PSBudWxsKSByZXR1cm47XG4gICAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoKCk7XG4gICAgdmFyIHByZXNlcnZlZFZhbHVlcyA9IHRoaXMuX3ByZXNlcnZlZFZhbHVlcztcbiAgICB2YXIgaXNFYWNoID0gcHJlc2VydmVkVmFsdWVzICE9PSBudWxsO1xuICAgIHZhciBnb3RBY2N1bSA9IHRoaXMuX2dvdEFjY3VtO1xuICAgIHZhciB2YWx1ZXNQaGFzZSA9IHRoaXMuX3ZhbHVlc1BoYXNlO1xuICAgIHZhciB2YWx1ZXNQaGFzZUluZGV4O1xuICAgIGlmICghdmFsdWVzUGhhc2UpIHtcbiAgICAgICAgdmFsdWVzUGhhc2UgPSB0aGlzLl92YWx1ZXNQaGFzZSA9IEFycmF5KGxlbmd0aCk7XG4gICAgICAgIGZvciAodmFsdWVzUGhhc2VJbmRleD0wOyB2YWx1ZXNQaGFzZUluZGV4PGxlbmd0aDsgKyt2YWx1ZXNQaGFzZUluZGV4KSB7XG4gICAgICAgICAgICB2YWx1ZXNQaGFzZVt2YWx1ZXNQaGFzZUluZGV4XSA9IDA7XG4gICAgICAgIH1cbiAgICB9XG4gICAgdmFsdWVzUGhhc2VJbmRleCA9IHZhbHVlc1BoYXNlW2luZGV4XTtcblxuICAgIGlmIChpbmRleCA9PT0gMCAmJiB0aGlzLl96ZXJvdGhJc0FjY3VtKSB7XG4gICAgICAgIGlmICghZ290QWNjdW0pIHtcbiAgICAgICAgICAgIHRoaXMuX2FjY3VtID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9nb3RBY2N1bSA9IGdvdEFjY3VtID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB2YWx1ZXNQaGFzZVtpbmRleF0gPSAoKHZhbHVlc1BoYXNlSW5kZXggPT09IDApXG4gICAgICAgICAgICA/IDEgOiAyKTtcbiAgICB9IGVsc2UgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgICBpZiAoIWdvdEFjY3VtKSB7XG4gICAgICAgICAgICB0aGlzLl9hY2N1bSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fZ290QWNjdW0gPSBnb3RBY2N1bSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodmFsdWVzUGhhc2VJbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgdmFsdWVzUGhhc2VbaW5kZXhdID0gMTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlc1BoYXNlW2luZGV4XSA9IDI7XG4gICAgICAgICAgICBpZiAoZ290QWNjdW0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hY2N1bSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGlmICghZ290QWNjdW0pIHJldHVybjtcblxuICAgIHZhciBjYWxsYmFjayA9IHRoaXMuX2NhbGxiYWNrO1xuICAgIHZhciByZWNlaXZlciA9IHRoaXMuX3Byb21pc2UuX2JvdW5kVG87XG4gICAgdmFyIHJldDtcblxuICAgIGZvciAodmFyIGkgPSB0aGlzLl9yZWR1Y2luZ0luZGV4OyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFsdWVzUGhhc2VJbmRleCA9IHZhbHVlc1BoYXNlW2ldO1xuICAgICAgICBpZiAodmFsdWVzUGhhc2VJbmRleCA9PT0gMikge1xuICAgICAgICAgICAgdGhpcy5fcmVkdWNpbmdJbmRleCA9IGkgKyAxO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZhbHVlc1BoYXNlSW5kZXggIT09IDEpIHJldHVybjtcblxuICAgICAgICB2YWx1ZSA9IHZhbHVlc1tpXTtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlLmlzRnVsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLl9zZXR0bGVkVmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLmlzUGVuZGluZygpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZS5fdW5zZXRSZWplY3Rpb25Jc1VuaGFuZGxlZCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWplY3QodmFsdWUucmVhc29uKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzRWFjaCkge1xuICAgICAgICAgICAgcHJlc2VydmVkVmFsdWVzLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgcmV0ID0gdHJ5Q2F0Y2gzKGNhbGxiYWNrLCByZWNlaXZlciwgdmFsdWUsIGksIGxlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXQgPSB0cnlDYXRjaDQoY2FsbGJhY2ssIHJlY2VpdmVyLCB0aGlzLl9hY2N1bSwgdmFsdWUsIGksIGxlbmd0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmV0ID09PSBlcnJvck9iaikgcmV0dXJuIHRoaXMuX3JlamVjdChyZXQuZSk7XG5cbiAgICAgICAgdmFyIG1heWJlUHJvbWlzZSA9IGNhc3QocmV0LCB2b2lkIDApO1xuICAgICAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgaWYgKG1heWJlUHJvbWlzZS5pc1BlbmRpbmcoKSkge1xuICAgICAgICAgICAgICAgIHZhbHVlc1BoYXNlW2ldID0gNDtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWF5YmVQcm9taXNlLl9wcm94eVByb21pc2VBcnJheSh0aGlzLCBpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobWF5YmVQcm9taXNlLmlzRnVsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBtYXliZVByb21pc2UudmFsdWUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWF5YmVQcm9taXNlLl91bnNldFJlamVjdGlvbklzVW5oYW5kbGVkKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlamVjdChtYXliZVByb21pc2UucmVhc29uKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcmVkdWNpbmdJbmRleCA9IGkgKyAxO1xuICAgICAgICB0aGlzLl9hY2N1bSA9IHJldDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fcmVkdWNpbmdJbmRleCA8IGxlbmd0aCkgcmV0dXJuO1xuICAgIHRoaXMuX3Jlc29sdmUoaXNFYWNoID8gcHJlc2VydmVkVmFsdWVzIDogdGhpcy5fYWNjdW0pO1xufTtcblxuZnVuY3Rpb24gcmVkdWNlKHByb21pc2VzLCBmbiwgaW5pdGlhbFZhbHVlLCBfZWFjaCkge1xuICAgIGlmICh0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIGFwaVJlamVjdGlvbihcImZuIG11c3QgYmUgYSBmdW5jdGlvblwiKTtcbiAgICB2YXIgYXJyYXkgPSBuZXcgUmVkdWN0aW9uUHJvbWlzZUFycmF5KHByb21pc2VzLCBmbiwgaW5pdGlhbFZhbHVlLCBfZWFjaCk7XG4gICAgcmV0dXJuIGFycmF5LnByb21pc2UoKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUucmVkdWNlID0gZnVuY3Rpb24gUHJvbWlzZSRyZWR1Y2UoZm4sIGluaXRpYWxWYWx1ZSkge1xuICAgIHJldHVybiByZWR1Y2UodGhpcywgZm4sIGluaXRpYWxWYWx1ZSwgbnVsbCk7XG59O1xuXG5Qcm9taXNlLnJlZHVjZSA9IGZ1bmN0aW9uIFByb21pc2UkUmVkdWNlKHByb21pc2VzLCBmbiwgaW5pdGlhbFZhbHVlLCBfZWFjaCkge1xuICAgIHJldHVybiByZWR1Y2UocHJvbWlzZXMsIGZuLCBpbml0aWFsVmFsdWUsIF9lYWNoKTtcbn07XG59O1xuIiwiKGZ1bmN0aW9uIChwcm9jZXNzKXtcbi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cblwidXNlIHN0cmljdFwiO1xudmFyIHNjaGVkdWxlO1xudmFyIF9NdXRhdGlvbk9ic2VydmVyO1xuaWYgKHR5cGVvZiBwcm9jZXNzID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBwcm9jZXNzLnZlcnNpb24gPT09IFwic3RyaW5nXCIpIHtcbiAgICBzY2hlZHVsZSA9IGZ1bmN0aW9uIFByb21pc2UkX1NjaGVkdWxlcihmbikge1xuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKGZuKTtcbiAgICB9O1xufVxuZWxzZSBpZiAoKHR5cGVvZiBNdXRhdGlvbk9ic2VydmVyICE9PSBcInVuZGVmaW5lZFwiICYmXG4gICAgICAgICAoX011dGF0aW9uT2JzZXJ2ZXIgPSBNdXRhdGlvbk9ic2VydmVyKSkgfHxcbiAgICAgICAgICh0eXBlb2YgV2ViS2l0TXV0YXRpb25PYnNlcnZlciAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgICAgICAgKF9NdXRhdGlvbk9ic2VydmVyID0gV2ViS2l0TXV0YXRpb25PYnNlcnZlcikpKSB7XG4gICAgc2NoZWR1bGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICB2YXIgcXVldWVkRm4gPSB2b2lkIDA7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBfTXV0YXRpb25PYnNlcnZlcihcbiAgICAgICAgICAgIGZ1bmN0aW9uIFByb21pc2UkX1NjaGVkdWxlcigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZWRGbjtcbiAgICAgICAgICAgICAgICBxdWV1ZWRGbiA9IHZvaWQgMDtcbiAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICk7XG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUoZGl2LCB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gUHJvbWlzZSRfU2NoZWR1bGVyKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZWRGbiA9IGZuO1xuICAgICAgICAgICAgZGl2LmNsYXNzTGlzdC50b2dnbGUoXCJmb29cIik7XG4gICAgICAgIH07XG5cbiAgICB9KSgpO1xufVxuZWxzZSBpZiAodHlwZW9mIHNldFRpbWVvdXQgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBzY2hlZHVsZSA9IGZ1bmN0aW9uIFByb21pc2UkX1NjaGVkdWxlcihmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufVxuZWxzZSB0aHJvdyBuZXcgRXJyb3IoXCJubyBhc3luYyBzY2hlZHVsZXIgYXZhaWxhYmxlXCIpO1xubW9kdWxlLmV4cG9ydHMgPSBzY2hlZHVsZTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJykpIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9XG4gICAgZnVuY3Rpb24oUHJvbWlzZSwgUHJvbWlzZUFycmF5KSB7XG52YXIgUHJvbWlzZUluc3BlY3Rpb24gPSBQcm9taXNlLlByb21pc2VJbnNwZWN0aW9uO1xudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsLmpzXCIpO1xuXG5mdW5jdGlvbiBTZXR0bGVkUHJvbWlzZUFycmF5KHZhbHVlcykge1xuICAgIHRoaXMuY29uc3RydWN0b3IkKHZhbHVlcyk7XG59XG51dGlsLmluaGVyaXRzKFNldHRsZWRQcm9taXNlQXJyYXksIFByb21pc2VBcnJheSk7XG5cblNldHRsZWRQcm9taXNlQXJyYXkucHJvdG90eXBlLl9wcm9taXNlUmVzb2x2ZWQgPVxuZnVuY3Rpb24gU2V0dGxlZFByb21pc2VBcnJheSRfcHJvbWlzZVJlc29sdmVkKGluZGV4LCBpbnNwZWN0aW9uKSB7XG4gICAgdGhpcy5fdmFsdWVzW2luZGV4XSA9IGluc3BlY3Rpb247XG4gICAgdmFyIHRvdGFsUmVzb2x2ZWQgPSArK3RoaXMuX3RvdGFsUmVzb2x2ZWQ7XG4gICAgaWYgKHRvdGFsUmVzb2x2ZWQgPj0gdGhpcy5fbGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuX3Jlc29sdmUodGhpcy5fdmFsdWVzKTtcbiAgICB9XG59O1xuXG5TZXR0bGVkUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fcHJvbWlzZUZ1bGZpbGxlZCA9XG5mdW5jdGlvbiBTZXR0bGVkUHJvbWlzZUFycmF5JF9wcm9taXNlRnVsZmlsbGVkKHZhbHVlLCBpbmRleCkge1xuICAgIGlmICh0aGlzLl9pc1Jlc29sdmVkKCkpIHJldHVybjtcbiAgICB2YXIgcmV0ID0gbmV3IFByb21pc2VJbnNwZWN0aW9uKCk7XG4gICAgcmV0Ll9iaXRGaWVsZCA9IDI2ODQzNTQ1NjtcbiAgICByZXQuX3NldHRsZWRWYWx1ZSA9IHZhbHVlO1xuICAgIHRoaXMuX3Byb21pc2VSZXNvbHZlZChpbmRleCwgcmV0KTtcbn07XG5TZXR0bGVkUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fcHJvbWlzZVJlamVjdGVkID1cbmZ1bmN0aW9uIFNldHRsZWRQcm9taXNlQXJyYXkkX3Byb21pc2VSZWplY3RlZChyZWFzb24sIGluZGV4KSB7XG4gICAgaWYgKHRoaXMuX2lzUmVzb2x2ZWQoKSkgcmV0dXJuO1xuICAgIHZhciByZXQgPSBuZXcgUHJvbWlzZUluc3BlY3Rpb24oKTtcbiAgICByZXQuX2JpdEZpZWxkID0gMTM0MjE3NzI4O1xuICAgIHJldC5fc2V0dGxlZFZhbHVlID0gcmVhc29uO1xuICAgIHRoaXMuX3Byb21pc2VSZXNvbHZlZChpbmRleCwgcmV0KTtcbn07XG5cblByb21pc2Uuc2V0dGxlID0gZnVuY3Rpb24gUHJvbWlzZSRTZXR0bGUocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gbmV3IFNldHRsZWRQcm9taXNlQXJyYXkocHJvbWlzZXMpLnByb21pc2UoKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnNldHRsZSA9IGZ1bmN0aW9uIFByb21pc2Ukc2V0dGxlKCkge1xuICAgIHJldHVybiBuZXcgU2V0dGxlZFByb21pc2VBcnJheSh0aGlzKS5wcm9taXNlKCk7XG59O1xufTtcbiIsIi8qKlxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKiBcbiAqIENvcHlyaWdodCAoYykgMjAxNCBQZXRrYSBBbnRvbm92XG4gKiBcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczo8L3A+XG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiAgSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICogXG4gKi9cblwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPVxuZnVuY3Rpb24oUHJvbWlzZSwgUHJvbWlzZUFycmF5LCBhcGlSZWplY3Rpb24pIHtcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbC5qc1wiKTtcbnZhciBSYW5nZUVycm9yID0gcmVxdWlyZShcIi4vZXJyb3JzLmpzXCIpLlJhbmdlRXJyb3I7XG52YXIgQWdncmVnYXRlRXJyb3IgPSByZXF1aXJlKFwiLi9lcnJvcnMuanNcIikuQWdncmVnYXRlRXJyb3I7XG52YXIgaXNBcnJheSA9IHV0aWwuaXNBcnJheTtcblxuXG5mdW5jdGlvbiBTb21lUHJvbWlzZUFycmF5KHZhbHVlcykge1xuICAgIHRoaXMuY29uc3RydWN0b3IkKHZhbHVlcyk7XG4gICAgdGhpcy5faG93TWFueSA9IDA7XG4gICAgdGhpcy5fdW53cmFwID0gZmFsc2U7XG4gICAgdGhpcy5faW5pdGlhbGl6ZWQgPSBmYWxzZTtcbn1cbnV0aWwuaW5oZXJpdHMoU29tZVByb21pc2VBcnJheSwgUHJvbWlzZUFycmF5KTtcblxuU29tZVByb21pc2VBcnJheS5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbiBTb21lUHJvbWlzZUFycmF5JF9pbml0KCkge1xuICAgIGlmICghdGhpcy5faW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5faG93TWFueSA9PT0gMCkge1xuICAgICAgICB0aGlzLl9yZXNvbHZlKFtdKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9pbml0JCh2b2lkIDAsIC01KTtcbiAgICB2YXIgaXNBcnJheVJlc29sdmVkID0gaXNBcnJheSh0aGlzLl92YWx1ZXMpO1xuICAgIGlmICghdGhpcy5faXNSZXNvbHZlZCgpICYmXG4gICAgICAgIGlzQXJyYXlSZXNvbHZlZCAmJlxuICAgICAgICB0aGlzLl9ob3dNYW55ID4gdGhpcy5fY2FuUG9zc2libHlGdWxmaWxsKCkpIHtcbiAgICAgICAgdGhpcy5fcmVqZWN0KHRoaXMuX2dldFJhbmdlRXJyb3IodGhpcy5sZW5ndGgoKSkpO1xuICAgIH1cbn07XG5cblNvbWVQcm9taXNlQXJyYXkucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiBTb21lUHJvbWlzZUFycmF5JGluaXQoKSB7XG4gICAgdGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIHRoaXMuX2luaXQoKTtcbn07XG5cblNvbWVQcm9taXNlQXJyYXkucHJvdG90eXBlLnNldFVud3JhcCA9IGZ1bmN0aW9uIFNvbWVQcm9taXNlQXJyYXkkc2V0VW53cmFwKCkge1xuICAgIHRoaXMuX3Vud3JhcCA9IHRydWU7XG59O1xuXG5Tb21lUHJvbWlzZUFycmF5LnByb3RvdHlwZS5ob3dNYW55ID0gZnVuY3Rpb24gU29tZVByb21pc2VBcnJheSRob3dNYW55KCkge1xuICAgIHJldHVybiB0aGlzLl9ob3dNYW55O1xufTtcblxuU29tZVByb21pc2VBcnJheS5wcm90b3R5cGUuc2V0SG93TWFueSA9XG5mdW5jdGlvbiBTb21lUHJvbWlzZUFycmF5JHNldEhvd01hbnkoY291bnQpIHtcbiAgICBpZiAodGhpcy5faXNSZXNvbHZlZCgpKSByZXR1cm47XG4gICAgdGhpcy5faG93TWFueSA9IGNvdW50O1xufTtcblxuU29tZVByb21pc2VBcnJheS5wcm90b3R5cGUuX3Byb21pc2VGdWxmaWxsZWQgPVxuZnVuY3Rpb24gU29tZVByb21pc2VBcnJheSRfcHJvbWlzZUZ1bGZpbGxlZCh2YWx1ZSkge1xuICAgIGlmICh0aGlzLl9pc1Jlc29sdmVkKCkpIHJldHVybjtcbiAgICB0aGlzLl9hZGRGdWxmaWxsZWQodmFsdWUpO1xuICAgIGlmICh0aGlzLl9mdWxmaWxsZWQoKSA9PT0gdGhpcy5ob3dNYW55KCkpIHtcbiAgICAgICAgdGhpcy5fdmFsdWVzLmxlbmd0aCA9IHRoaXMuaG93TWFueSgpO1xuICAgICAgICBpZiAodGhpcy5ob3dNYW55KCkgPT09IDEgJiYgdGhpcy5fdW53cmFwKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNvbHZlKHRoaXMuX3ZhbHVlc1swXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNvbHZlKHRoaXMuX3ZhbHVlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbn07XG5Tb21lUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fcHJvbWlzZVJlamVjdGVkID1cbmZ1bmN0aW9uIFNvbWVQcm9taXNlQXJyYXkkX3Byb21pc2VSZWplY3RlZChyZWFzb24pIHtcbiAgICBpZiAodGhpcy5faXNSZXNvbHZlZCgpKSByZXR1cm47XG4gICAgdGhpcy5fYWRkUmVqZWN0ZWQocmVhc29uKTtcbiAgICBpZiAodGhpcy5ob3dNYW55KCkgPiB0aGlzLl9jYW5Qb3NzaWJseUZ1bGZpbGwoKSkge1xuICAgICAgICB2YXIgZSA9IG5ldyBBZ2dyZWdhdGVFcnJvcigpO1xuICAgICAgICBmb3IgKHZhciBpID0gdGhpcy5sZW5ndGgoKTsgaSA8IHRoaXMuX3ZhbHVlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgZS5wdXNoKHRoaXMuX3ZhbHVlc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVqZWN0KGUpO1xuICAgIH1cbn07XG5cblNvbWVQcm9taXNlQXJyYXkucHJvdG90eXBlLl9mdWxmaWxsZWQgPSBmdW5jdGlvbiBTb21lUHJvbWlzZUFycmF5JF9mdWxmaWxsZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RvdGFsUmVzb2x2ZWQ7XG59O1xuXG5Tb21lUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fcmVqZWN0ZWQgPSBmdW5jdGlvbiBTb21lUHJvbWlzZUFycmF5JF9yZWplY3RlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fdmFsdWVzLmxlbmd0aCAtIHRoaXMubGVuZ3RoKCk7XG59O1xuXG5Tb21lUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fYWRkUmVqZWN0ZWQgPVxuZnVuY3Rpb24gU29tZVByb21pc2VBcnJheSRfYWRkUmVqZWN0ZWQocmVhc29uKSB7XG4gICAgdGhpcy5fdmFsdWVzLnB1c2gocmVhc29uKTtcbn07XG5cblNvbWVQcm9taXNlQXJyYXkucHJvdG90eXBlLl9hZGRGdWxmaWxsZWQgPVxuZnVuY3Rpb24gU29tZVByb21pc2VBcnJheSRfYWRkRnVsZmlsbGVkKHZhbHVlKSB7XG4gICAgdGhpcy5fdmFsdWVzW3RoaXMuX3RvdGFsUmVzb2x2ZWQrK10gPSB2YWx1ZTtcbn07XG5cblNvbWVQcm9taXNlQXJyYXkucHJvdG90eXBlLl9jYW5Qb3NzaWJseUZ1bGZpbGwgPVxuZnVuY3Rpb24gU29tZVByb21pc2VBcnJheSRfY2FuUG9zc2libHlGdWxmaWxsKCkge1xuICAgIHJldHVybiB0aGlzLmxlbmd0aCgpIC0gdGhpcy5fcmVqZWN0ZWQoKTtcbn07XG5cblNvbWVQcm9taXNlQXJyYXkucHJvdG90eXBlLl9nZXRSYW5nZUVycm9yID1cbmZ1bmN0aW9uIFNvbWVQcm9taXNlQXJyYXkkX2dldFJhbmdlRXJyb3IoY291bnQpIHtcbiAgICB2YXIgbWVzc2FnZSA9IFwiSW5wdXQgYXJyYXkgbXVzdCBjb250YWluIGF0IGxlYXN0IFwiICtcbiAgICAgICAgICAgIHRoaXMuX2hvd01hbnkgKyBcIiBpdGVtcyBidXQgY29udGFpbnMgb25seSBcIiArIGNvdW50ICsgXCIgaXRlbXNcIjtcbiAgICByZXR1cm4gbmV3IFJhbmdlRXJyb3IobWVzc2FnZSk7XG59O1xuXG5Tb21lUHJvbWlzZUFycmF5LnByb3RvdHlwZS5fcmVzb2x2ZUVtcHR5QXJyYXkgPVxuZnVuY3Rpb24gU29tZVByb21pc2VBcnJheSRfcmVzb2x2ZUVtcHR5QXJyYXkoKSB7XG4gICAgdGhpcy5fcmVqZWN0KHRoaXMuX2dldFJhbmdlRXJyb3IoMCkpO1xufTtcblxuZnVuY3Rpb24gUHJvbWlzZSRfU29tZShwcm9taXNlcywgaG93TWFueSkge1xuICAgIGlmICgoaG93TWFueSB8IDApICE9PSBob3dNYW55IHx8IGhvd01hbnkgPCAwKSB7XG4gICAgICAgIHJldHVybiBhcGlSZWplY3Rpb24oXCJleHBlY3RpbmcgYSBwb3NpdGl2ZSBpbnRlZ2VyXCIpO1xuICAgIH1cbiAgICB2YXIgcmV0ID0gbmV3IFNvbWVQcm9taXNlQXJyYXkocHJvbWlzZXMpO1xuICAgIHZhciBwcm9taXNlID0gcmV0LnByb21pc2UoKTtcbiAgICBpZiAocHJvbWlzZS5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHJldC5zZXRIb3dNYW55KGhvd01hbnkpO1xuICAgIHJldC5pbml0KCk7XG4gICAgcmV0dXJuIHByb21pc2U7XG59XG5cblByb21pc2Uuc29tZSA9IGZ1bmN0aW9uIFByb21pc2UkU29tZShwcm9taXNlcywgaG93TWFueSkge1xuICAgIHJldHVybiBQcm9taXNlJF9Tb21lKHByb21pc2VzLCBob3dNYW55KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnNvbWUgPSBmdW5jdGlvbiBQcm9taXNlJHNvbWUoaG93TWFueSkge1xuICAgIHJldHVybiBQcm9taXNlJF9Tb21lKHRoaXMsIGhvd01hbnkpO1xufTtcblxuUHJvbWlzZS5fU29tZVByb21pc2VBcnJheSA9IFNvbWVQcm9taXNlQXJyYXk7XG59O1xuIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFByb21pc2UpIHtcbmZ1bmN0aW9uIFByb21pc2VJbnNwZWN0aW9uKHByb21pc2UpIHtcbiAgICBpZiAocHJvbWlzZSAhPT0gdm9pZCAwKSB7XG4gICAgICAgIHRoaXMuX2JpdEZpZWxkID0gcHJvbWlzZS5fYml0RmllbGQ7XG4gICAgICAgIHRoaXMuX3NldHRsZWRWYWx1ZSA9IHByb21pc2UuaXNSZXNvbHZlZCgpXG4gICAgICAgICAgICA/IHByb21pc2UuX3NldHRsZWRWYWx1ZVxuICAgICAgICAgICAgOiB2b2lkIDA7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aGlzLl9iaXRGaWVsZCA9IDA7XG4gICAgICAgIHRoaXMuX3NldHRsZWRWYWx1ZSA9IHZvaWQgMDtcbiAgICB9XG59XG5cblByb21pc2VJbnNwZWN0aW9uLnByb3RvdHlwZS5pc0Z1bGZpbGxlZCA9XG5Qcm9taXNlLnByb3RvdHlwZS5pc0Z1bGZpbGxlZCA9IGZ1bmN0aW9uIFByb21pc2UkaXNGdWxmaWxsZWQoKSB7XG4gICAgcmV0dXJuICh0aGlzLl9iaXRGaWVsZCAmIDI2ODQzNTQ1NikgPiAwO1xufTtcblxuUHJvbWlzZUluc3BlY3Rpb24ucHJvdG90eXBlLmlzUmVqZWN0ZWQgPVxuUHJvbWlzZS5wcm90b3R5cGUuaXNSZWplY3RlZCA9IGZ1bmN0aW9uIFByb21pc2UkaXNSZWplY3RlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMuX2JpdEZpZWxkICYgMTM0MjE3NzI4KSA+IDA7XG59O1xuXG5Qcm9taXNlSW5zcGVjdGlvbi5wcm90b3R5cGUuaXNQZW5kaW5nID1cblByb21pc2UucHJvdG90eXBlLmlzUGVuZGluZyA9IGZ1bmN0aW9uIFByb21pc2UkaXNQZW5kaW5nKCkge1xuICAgIHJldHVybiAodGhpcy5fYml0RmllbGQgJiA0MDI2NTMxODQpID09PSAwO1xufTtcblxuUHJvbWlzZUluc3BlY3Rpb24ucHJvdG90eXBlLnZhbHVlID1cblByb21pc2UucHJvdG90eXBlLnZhbHVlID0gZnVuY3Rpb24gUHJvbWlzZSR2YWx1ZSgpIHtcbiAgICBpZiAoIXRoaXMuaXNGdWxmaWxsZWQoKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IGdldCBmdWxmaWxsbWVudCB2YWx1ZSBvZiBhIG5vbi1mdWxmaWxsZWQgcHJvbWlzZVwiKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3NldHRsZWRWYWx1ZTtcbn07XG5cblByb21pc2VJbnNwZWN0aW9uLnByb3RvdHlwZS5lcnJvciA9XG5Qcm9taXNlSW5zcGVjdGlvbi5wcm90b3R5cGUucmVhc29uID1cblByb21pc2UucHJvdG90eXBlLnJlYXNvbiA9IGZ1bmN0aW9uIFByb21pc2UkcmVhc29uKCkge1xuICAgIGlmICghdGhpcy5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCBnZXQgcmVqZWN0aW9uIHJlYXNvbiBvZiBhIG5vbi1yZWplY3RlZCBwcm9taXNlXCIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc2V0dGxlZFZhbHVlO1xufTtcblxuUHJvbWlzZUluc3BlY3Rpb24ucHJvdG90eXBlLmlzUmVzb2x2ZWQgPVxuUHJvbWlzZS5wcm90b3R5cGUuaXNSZXNvbHZlZCA9IGZ1bmN0aW9uIFByb21pc2UkaXNSZXNvbHZlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMuX2JpdEZpZWxkICYgNDAyNjUzMTg0KSA+IDA7XG59O1xuXG5Qcm9taXNlLlByb21pc2VJbnNwZWN0aW9uID0gUHJvbWlzZUluc3BlY3Rpb247XG59O1xuIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFByb21pc2UsIElOVEVSTkFMKSB7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwuanNcIik7XG52YXIgY2FuQXR0YWNoID0gcmVxdWlyZShcIi4vZXJyb3JzLmpzXCIpLmNhbkF0dGFjaDtcbnZhciBlcnJvck9iaiA9IHV0aWwuZXJyb3JPYmo7XG52YXIgaXNPYmplY3QgPSB1dGlsLmlzT2JqZWN0O1xuXG5mdW5jdGlvbiBnZXRUaGVuKG9iaikge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBvYmoudGhlbjtcbiAgICB9XG4gICAgY2F0Y2goZSkge1xuICAgICAgICBlcnJvck9iai5lID0gZTtcbiAgICAgICAgcmV0dXJuIGVycm9yT2JqO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gUHJvbWlzZSRfQ2FzdChvYmosIG9yaWdpbmFsUHJvbWlzZSkge1xuICAgIGlmIChpc09iamVjdChvYmopKSB7XG4gICAgICAgIGlmIChvYmogaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzQW55Qmx1ZWJpcmRQcm9taXNlKG9iaikpIHtcbiAgICAgICAgICAgIHZhciByZXQgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gICAgICAgICAgICByZXQuX3NldFRyYWNlKHZvaWQgMCk7XG4gICAgICAgICAgICBvYmouX3RoZW4oXG4gICAgICAgICAgICAgICAgcmV0Ll9mdWxmaWxsVW5jaGVja2VkLFxuICAgICAgICAgICAgICAgIHJldC5fcmVqZWN0VW5jaGVja2VkQ2hlY2tFcnJvcixcbiAgICAgICAgICAgICAgICByZXQuX3Byb2dyZXNzVW5jaGVja2VkLFxuICAgICAgICAgICAgICAgIHJldCxcbiAgICAgICAgICAgICAgICBudWxsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0Ll9zZXRGb2xsb3dpbmcoKTtcbiAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHRoZW4gPSBnZXRUaGVuKG9iaik7XG4gICAgICAgIGlmICh0aGVuID09PSBlcnJvck9iaikge1xuICAgICAgICAgICAgaWYgKG9yaWdpbmFsUHJvbWlzZSAhPT0gdm9pZCAwICYmIGNhbkF0dGFjaCh0aGVuLmUpKSB7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxQcm9taXNlLl9hdHRhY2hFeHRyYVRyYWNlKHRoZW4uZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QodGhlbi5lKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGhlbiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZSRfZG9UaGVuYWJsZShvYmosIHRoZW4sIG9yaWdpbmFsUHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbn1cblxudmFyIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcbmZ1bmN0aW9uIGlzQW55Qmx1ZWJpcmRQcm9taXNlKG9iaikge1xuICAgIHJldHVybiBoYXNQcm9wLmNhbGwob2JqLCBcIl9wcm9taXNlMFwiKTtcbn1cblxuZnVuY3Rpb24gUHJvbWlzZSRfZG9UaGVuYWJsZSh4LCB0aGVuLCBvcmlnaW5hbFByb21pc2UpIHtcbiAgICB2YXIgcmVzb2x2ZXIgPSBQcm9taXNlLmRlZmVyKCk7XG4gICAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICAgIHRoZW4uY2FsbChcbiAgICAgICAgICAgIHgsXG4gICAgICAgICAgICBQcm9taXNlJF9yZXNvbHZlRnJvbVRoZW5hYmxlLFxuICAgICAgICAgICAgUHJvbWlzZSRfcmVqZWN0RnJvbVRoZW5hYmxlLFxuICAgICAgICAgICAgUHJvbWlzZSRfcHJvZ3Jlc3NGcm9tVGhlbmFibGVcbiAgICAgICAgKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICB2YXIgdHJhY2UgPSBjYW5BdHRhY2goZSkgPyBlIDogbmV3IEVycm9yKGUgKyBcIlwiKTtcbiAgICAgICAgICAgIGlmIChvcmlnaW5hbFByb21pc2UgIT09IHZvaWQgMCkge1xuICAgICAgICAgICAgICAgIG9yaWdpbmFsUHJvbWlzZS5fYXR0YWNoRXh0cmFUcmFjZSh0cmFjZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXNvbHZlci5wcm9taXNlLl9yZWplY3QoZSwgdHJhY2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXNvbHZlci5wcm9taXNlO1xuXG4gICAgZnVuY3Rpb24gUHJvbWlzZSRfcmVzb2x2ZUZyb21UaGVuYWJsZSh5KSB7XG4gICAgICAgIGlmIChjYWxsZWQpIHJldHVybjtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcblxuICAgICAgICBpZiAoeCA9PT0geSkge1xuICAgICAgICAgICAgdmFyIGUgPSBQcm9taXNlLl9tYWtlU2VsZlJlc29sdXRpb25FcnJvcigpO1xuICAgICAgICAgICAgaWYgKG9yaWdpbmFsUHJvbWlzZSAhPT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxQcm9taXNlLl9hdHRhY2hFeHRyYVRyYWNlKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZXIucHJvbWlzZS5fcmVqZWN0KGUsIHZvaWQgMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmVzb2x2ZXIucmVzb2x2ZSh5KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBQcm9taXNlJF9yZWplY3RGcm9tVGhlbmFibGUocikge1xuICAgICAgICBpZiAoY2FsbGVkKSByZXR1cm47XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIHZhciB0cmFjZSA9IGNhbkF0dGFjaChyKSA/IHIgOiBuZXcgRXJyb3IociArIFwiXCIpO1xuICAgICAgICBpZiAob3JpZ2luYWxQcm9taXNlICE9PSB2b2lkIDApIHtcbiAgICAgICAgICAgIG9yaWdpbmFsUHJvbWlzZS5fYXR0YWNoRXh0cmFUcmFjZSh0cmFjZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzb2x2ZXIucHJvbWlzZS5fcmVqZWN0KHIsIHRyYWNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBQcm9taXNlJF9wcm9ncmVzc0Zyb21UaGVuYWJsZSh2KSB7XG4gICAgICAgIGlmIChjYWxsZWQpIHJldHVybjtcbiAgICAgICAgdmFyIHByb21pc2UgPSByZXNvbHZlci5wcm9taXNlO1xuICAgICAgICBpZiAodHlwZW9mIHByb21pc2UuX3Byb2dyZXNzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHByb21pc2UuX3Byb2dyZXNzKHYpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5yZXR1cm4gUHJvbWlzZSRfQ2FzdDtcbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbnZhciBfc2V0VGltZW91dCA9IGZ1bmN0aW9uKGZuLCBtcykge1xuICAgIHZhciBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIHZhciBhcmcwID0gYXJndW1lbnRzWzJdO1xuICAgIHZhciBhcmcxID0gYXJndW1lbnRzWzNdO1xuICAgIHZhciBhcmcyID0gbGVuID49IDUgPyBhcmd1bWVudHNbNF0gOiB2b2lkIDA7XG4gICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGZuKGFyZzAsIGFyZzEsIGFyZzIpO1xuICAgIH0sIG1zfDApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihQcm9taXNlLCBJTlRFUk5BTCwgY2FzdCkge1xudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsLmpzXCIpO1xudmFyIGVycm9ycyA9IHJlcXVpcmUoXCIuL2Vycm9ycy5qc1wiKTtcbnZhciBhcGlSZWplY3Rpb24gPSByZXF1aXJlKFwiLi9lcnJvcnNfYXBpX3JlamVjdGlvblwiKShQcm9taXNlKTtcbnZhciBUaW1lb3V0RXJyb3IgPSBQcm9taXNlLlRpbWVvdXRFcnJvcjtcblxudmFyIGFmdGVyVGltZW91dCA9IGZ1bmN0aW9uIFByb21pc2UkX2FmdGVyVGltZW91dChwcm9taXNlLCBtZXNzYWdlLCBtcykge1xuICAgIGlmICghcHJvbWlzZS5pc1BlbmRpbmcoKSkgcmV0dXJuO1xuICAgIGlmICh0eXBlb2YgbWVzc2FnZSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICBtZXNzYWdlID0gXCJvcGVyYXRpb24gdGltZWQgb3V0IGFmdGVyXCIgKyBcIiBcIiArIG1zICsgXCIgbXNcIlxuICAgIH1cbiAgICB2YXIgZXJyID0gbmV3IFRpbWVvdXRFcnJvcihtZXNzYWdlKTtcbiAgICBlcnJvcnMubWFya0FzT3JpZ2luYXRpbmdGcm9tUmVqZWN0aW9uKGVycik7XG4gICAgcHJvbWlzZS5fYXR0YWNoRXh0cmFUcmFjZShlcnIpO1xuICAgIHByb21pc2UuX2NhbmNlbChlcnIpO1xufTtcblxudmFyIGFmdGVyRGVsYXkgPSBmdW5jdGlvbiBQcm9taXNlJF9hZnRlckRlbGF5KHZhbHVlLCBwcm9taXNlKSB7XG4gICAgcHJvbWlzZS5fZnVsZmlsbCh2YWx1ZSk7XG59O1xuXG52YXIgZGVsYXkgPSBQcm9taXNlLmRlbGF5ID0gZnVuY3Rpb24gUHJvbWlzZSREZWxheSh2YWx1ZSwgbXMpIHtcbiAgICBpZiAobXMgPT09IHZvaWQgMCkge1xuICAgICAgICBtcyA9IHZhbHVlO1xuICAgICAgICB2YWx1ZSA9IHZvaWQgMDtcbiAgICB9XG4gICAgbXMgPSArbXM7XG4gICAgdmFyIG1heWJlUHJvbWlzZSA9IGNhc3QodmFsdWUsIHZvaWQgMCk7XG4gICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG5cbiAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICBwcm9taXNlLl9wcm9wYWdhdGVGcm9tKG1heWJlUHJvbWlzZSwgNyk7XG4gICAgICAgIHByb21pc2UuX2ZvbGxvdyhtYXliZVByb21pc2UpO1xuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5kZWxheSh2YWx1ZSwgbXMpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlLl9zZXRUcmFjZSh2b2lkIDApO1xuICAgICAgICBfc2V0VGltZW91dChhZnRlckRlbGF5LCBtcywgdmFsdWUsIHByb21pc2UpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmRlbGF5ID0gZnVuY3Rpb24gUHJvbWlzZSRkZWxheShtcykge1xuICAgIHJldHVybiBkZWxheSh0aGlzLCBtcyk7XG59O1xuXG5mdW5jdGlvbiBzdWNjZXNzQ2xlYXIodmFsdWUpIHtcbiAgICB2YXIgaGFuZGxlID0gdGhpcztcbiAgICBpZiAoaGFuZGxlIGluc3RhbmNlb2YgTnVtYmVyKSBoYW5kbGUgPSAraGFuZGxlO1xuICAgIGNsZWFyVGltZW91dChoYW5kbGUpO1xuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gZmFpbHVyZUNsZWFyKHJlYXNvbikge1xuICAgIHZhciBoYW5kbGUgPSB0aGlzO1xuICAgIGlmIChoYW5kbGUgaW5zdGFuY2VvZiBOdW1iZXIpIGhhbmRsZSA9ICtoYW5kbGU7XG4gICAgY2xlYXJUaW1lb3V0KGhhbmRsZSk7XG4gICAgdGhyb3cgcmVhc29uO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS50aW1lb3V0ID0gZnVuY3Rpb24gUHJvbWlzZSR0aW1lb3V0KG1zLCBtZXNzYWdlKSB7XG4gICAgbXMgPSArbXM7XG5cbiAgICB2YXIgcmV0ID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICAgIHJldC5fcHJvcGFnYXRlRnJvbSh0aGlzLCA3KTtcbiAgICByZXQuX2ZvbGxvdyh0aGlzKTtcbiAgICB2YXIgaGFuZGxlID0gX3NldFRpbWVvdXQoYWZ0ZXJUaW1lb3V0LCBtcywgcmV0LCBtZXNzYWdlLCBtcyk7XG4gICAgcmV0dXJuIHJldC5jYW5jZWxsYWJsZSgpXG4gICAgICAgICAgICAgIC5fdGhlbihzdWNjZXNzQ2xlYXIsIGZhaWx1cmVDbGVhciwgdm9pZCAwLCBoYW5kbGUsIHZvaWQgMCk7XG59O1xuXG59O1xuIiwiLyoqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIFxuICogQ29weXJpZ2h0IChjKSAyMDE0IFBldGthIEFudG9ub3ZcbiAqIFxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOjwvcD5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuICBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKiBcbiAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChQcm9taXNlLCBhcGlSZWplY3Rpb24sIGNhc3QpIHtcbiAgICB2YXIgVHlwZUVycm9yID0gcmVxdWlyZShcIi4vZXJyb3JzLmpzXCIpLlR5cGVFcnJvcjtcbiAgICB2YXIgaW5oZXJpdHMgPSByZXF1aXJlKFwiLi91dGlsLmpzXCIpLmluaGVyaXRzO1xuICAgIHZhciBQcm9taXNlSW5zcGVjdGlvbiA9IFByb21pc2UuUHJvbWlzZUluc3BlY3Rpb247XG5cbiAgICBmdW5jdGlvbiBpbnNwZWN0aW9uTWFwcGVyKGluc3BlY3Rpb25zKSB7XG4gICAgICAgIHZhciBsZW4gPSBpbnNwZWN0aW9ucy5sZW5ndGg7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBpbnNwZWN0aW9uID0gaW5zcGVjdGlvbnNbaV07XG4gICAgICAgICAgICBpZiAoaW5zcGVjdGlvbi5pc1JlamVjdGVkKCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoaW5zcGVjdGlvbi5lcnJvcigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGluc3BlY3Rpb25zW2ldID0gaW5zcGVjdGlvbi52YWx1ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbnNwZWN0aW9ucztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0aHJvd2VyKGUpIHtcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe3Rocm93IGU7fSwgMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FzdFByZXNlcnZpbmdEaXNwb3NhYmxlKHRoZW5hYmxlKSB7XG4gICAgICAgIHZhciBtYXliZVByb21pc2UgPSBjYXN0KHRoZW5hYmxlLCB2b2lkIDApO1xuICAgICAgICBpZiAobWF5YmVQcm9taXNlICE9PSB0aGVuYWJsZSAmJlxuICAgICAgICAgICAgdHlwZW9mIHRoZW5hYmxlLl9pc0Rpc3Bvc2FibGUgPT09IFwiZnVuY3Rpb25cIiAmJlxuICAgICAgICAgICAgdHlwZW9mIHRoZW5hYmxlLl9nZXREaXNwb3NlciA9PT0gXCJmdW5jdGlvblwiICYmXG4gICAgICAgICAgICB0aGVuYWJsZS5faXNEaXNwb3NhYmxlKCkpIHtcbiAgICAgICAgICAgIG1heWJlUHJvbWlzZS5fc2V0RGlzcG9zYWJsZSh0aGVuYWJsZS5fZ2V0RGlzcG9zZXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1heWJlUHJvbWlzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZGlzcG9zZShyZXNvdXJjZXMsIGluc3BlY3Rpb24pIHtcbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICB2YXIgbGVuID0gcmVzb3VyY2VzLmxlbmd0aDtcbiAgICAgICAgdmFyIHJldCA9IFByb21pc2UuZGVmZXIoKTtcbiAgICAgICAgZnVuY3Rpb24gaXRlcmF0b3IoKSB7XG4gICAgICAgICAgICBpZiAoaSA+PSBsZW4pIHJldHVybiByZXQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgdmFyIG1heWJlUHJvbWlzZSA9IGNhc3RQcmVzZXJ2aW5nRGlzcG9zYWJsZShyZXNvdXJjZXNbaSsrXSk7XG4gICAgICAgICAgICBpZiAobWF5YmVQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSAmJlxuICAgICAgICAgICAgICAgIG1heWJlUHJvbWlzZS5faXNEaXNwb3NhYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBtYXliZVByb21pc2UgPSBjYXN0KG1heWJlUHJvbWlzZS5fZ2V0RGlzcG9zZXIoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cnlEaXNwb3NlKGluc3BlY3Rpb24pLCB2b2lkIDApO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRocm93ZXIoZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChtYXliZVByb21pc2UgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXliZVByb21pc2UuX3RoZW4oaXRlcmF0b3IsIHRocm93ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgbnVsbCwgbnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaXRlcmF0b3IoKTtcbiAgICAgICAgfVxuICAgICAgICBpdGVyYXRvcigpO1xuICAgICAgICByZXR1cm4gcmV0LnByb21pc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlzcG9zZXJTdWNjZXNzKHZhbHVlKSB7XG4gICAgICAgIHZhciBpbnNwZWN0aW9uID0gbmV3IFByb21pc2VJbnNwZWN0aW9uKCk7XG4gICAgICAgIGluc3BlY3Rpb24uX3NldHRsZWRWYWx1ZSA9IHZhbHVlO1xuICAgICAgICBpbnNwZWN0aW9uLl9iaXRGaWVsZCA9IDI2ODQzNTQ1NjtcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2UodGhpcywgaW5zcGVjdGlvbikudGhlblJldHVybih2YWx1ZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlzcG9zZXJGYWlsKHJlYXNvbikge1xuICAgICAgICB2YXIgaW5zcGVjdGlvbiA9IG5ldyBQcm9taXNlSW5zcGVjdGlvbigpO1xuICAgICAgICBpbnNwZWN0aW9uLl9zZXR0bGVkVmFsdWUgPSByZWFzb247XG4gICAgICAgIGluc3BlY3Rpb24uX2JpdEZpZWxkID0gMTM0MjE3NzI4O1xuICAgICAgICByZXR1cm4gZGlzcG9zZSh0aGlzLCBpbnNwZWN0aW9uKS50aGVuVGhyb3cocmVhc29uKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBEaXNwb3NlcihkYXRhLCBwcm9taXNlKSB7XG4gICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xuICAgICAgICB0aGlzLl9wcm9taXNlID0gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBEaXNwb3Nlci5wcm90b3R5cGUuZGF0YSA9IGZ1bmN0aW9uIERpc3Bvc2VyJGRhdGEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH07XG5cbiAgICBEaXNwb3Nlci5wcm90b3R5cGUucHJvbWlzZSA9IGZ1bmN0aW9uIERpc3Bvc2VyJHByb21pc2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcm9taXNlO1xuICAgIH07XG5cbiAgICBEaXNwb3Nlci5wcm90b3R5cGUucmVzb3VyY2UgPSBmdW5jdGlvbiBEaXNwb3NlciRyZXNvdXJjZSgpIHtcbiAgICAgICAgaWYgKHRoaXMucHJvbWlzZSgpLmlzRnVsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnByb21pc2UoKS52YWx1ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG5cbiAgICBEaXNwb3Nlci5wcm90b3R5cGUudHJ5RGlzcG9zZSA9IGZ1bmN0aW9uKGluc3BlY3Rpb24pIHtcbiAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5yZXNvdXJjZSgpO1xuICAgICAgICB2YXIgcmV0ID0gcmVzb3VyY2UgIT09IG51bGxcbiAgICAgICAgICAgID8gdGhpcy5kb0Rpc3Bvc2UocmVzb3VyY2UsIGluc3BlY3Rpb24pIDogbnVsbDtcbiAgICAgICAgdGhpcy5fcHJvbWlzZS5fdW5zZXREaXNwb3NhYmxlKCk7XG4gICAgICAgIHRoaXMuX2RhdGEgPSB0aGlzLl9wcm9taXNlID0gbnVsbDtcbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9O1xuXG4gICAgRGlzcG9zZXIuaXNEaXNwb3NlciA9IGZ1bmN0aW9uIERpc3Bvc2VyJGlzRGlzcG9zZXIoZCkge1xuICAgICAgICByZXR1cm4gKGQgIT0gbnVsbCAmJlxuICAgICAgICAgICAgICAgIHR5cGVvZiBkLnJlc291cmNlID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICAgICAgICAgICAgICB0eXBlb2YgZC50cnlEaXNwb3NlID09PSBcImZ1bmN0aW9uXCIpO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBGdW5jdGlvbkRpc3Bvc2VyKGZuLCBwcm9taXNlKSB7XG4gICAgICAgIHRoaXMuY29uc3RydWN0b3IkKGZuLCBwcm9taXNlKTtcbiAgICB9XG4gICAgaW5oZXJpdHMoRnVuY3Rpb25EaXNwb3NlciwgRGlzcG9zZXIpO1xuXG4gICAgRnVuY3Rpb25EaXNwb3Nlci5wcm90b3R5cGUuZG9EaXNwb3NlID0gZnVuY3Rpb24gKHJlc291cmNlLCBpbnNwZWN0aW9uKSB7XG4gICAgICAgIHZhciBmbiA9IHRoaXMuZGF0YSgpO1xuICAgICAgICByZXR1cm4gZm4uY2FsbChyZXNvdXJjZSwgcmVzb3VyY2UsIGluc3BlY3Rpb24pO1xuICAgIH07XG5cbiAgICBQcm9taXNlLnVzaW5nID0gZnVuY3Rpb24gUHJvbWlzZSR1c2luZygpIHtcbiAgICAgICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGlmIChsZW4gPCAyKSByZXR1cm4gYXBpUmVqZWN0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ5b3UgbXVzdCBwYXNzIGF0IGxlYXN0IDIgYXJndW1lbnRzIHRvIFByb21pc2UudXNpbmdcIik7XG4gICAgICAgIHZhciBmbiA9IGFyZ3VtZW50c1tsZW4gLSAxXTtcbiAgICAgICAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gYXBpUmVqZWN0aW9uKFwiZm4gbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuICAgICAgICBsZW4tLTtcbiAgICAgICAgdmFyIHJlc291cmNlcyA9IG5ldyBBcnJheShsZW4pO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICBpZiAoRGlzcG9zZXIuaXNEaXNwb3NlcihyZXNvdXJjZSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGlzcG9zZXIgPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICByZXNvdXJjZSA9IHJlc291cmNlLnByb21pc2UoKTtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5fc2V0RGlzcG9zYWJsZShkaXNwb3Nlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXNvdXJjZXNbaV0gPSByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBQcm9taXNlLnNldHRsZShyZXNvdXJjZXMpXG4gICAgICAgICAgICAudGhlbihpbnNwZWN0aW9uTWFwcGVyKVxuICAgICAgICAgICAgLnNwcmVhZChmbilcbiAgICAgICAgICAgIC5fdGhlbihkaXNwb3NlclN1Y2Nlc3MsIGRpc3Bvc2VyRmFpbCwgdm9pZCAwLCByZXNvdXJjZXMsIHZvaWQgMCk7XG4gICAgfTtcblxuICAgIFByb21pc2UucHJvdG90eXBlLl9zZXREaXNwb3NhYmxlID1cbiAgICBmdW5jdGlvbiBQcm9taXNlJF9zZXREaXNwb3NhYmxlKGRpc3Bvc2VyKSB7XG4gICAgICAgIHRoaXMuX2JpdEZpZWxkID0gdGhpcy5fYml0RmllbGQgfCAyNjIxNDQ7XG4gICAgICAgIHRoaXMuX2Rpc3Bvc2VyID0gZGlzcG9zZXI7XG4gICAgfTtcblxuICAgIFByb21pc2UucHJvdG90eXBlLl9pc0Rpc3Bvc2FibGUgPSBmdW5jdGlvbiBQcm9taXNlJF9pc0Rpc3Bvc2FibGUoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5fYml0RmllbGQgJiAyNjIxNDQpID4gMDtcbiAgICB9O1xuXG4gICAgUHJvbWlzZS5wcm90b3R5cGUuX2dldERpc3Bvc2VyID0gZnVuY3Rpb24gUHJvbWlzZSRfZ2V0RGlzcG9zZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kaXNwb3NlcjtcbiAgICB9O1xuXG4gICAgUHJvbWlzZS5wcm90b3R5cGUuX3Vuc2V0RGlzcG9zYWJsZSA9IGZ1bmN0aW9uIFByb21pc2UkX3Vuc2V0RGlzcG9zYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fYml0RmllbGQgPSB0aGlzLl9iaXRGaWVsZCAmICh+MjYyMTQ0KTtcbiAgICAgICAgdGhpcy5fZGlzcG9zZXIgPSB2b2lkIDA7XG4gICAgfTtcblxuICAgIFByb21pc2UucHJvdG90eXBlLmRpc3Bvc2VyID0gZnVuY3Rpb24gUHJvbWlzZSRkaXNwb3Nlcihmbikge1xuICAgICAgICBpZiAodHlwZW9mIGZuID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRnVuY3Rpb25EaXNwb3NlcihmbiwgdGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuICAgIH07XG5cbn07XG4iLCIvKipcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICogXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgUGV0a2EgQW50b25vdlxuICogXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6PC9wPlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cbiAqIFRIRSBTT0ZUV0FSRS5cbiAqIFxuICovXG5cInVzZSBzdHJpY3RcIjtcbnZhciBlczUgPSByZXF1aXJlKFwiLi9lczUuanNcIik7XG52YXIgaGF2ZUdldHRlcnMgPSAoZnVuY3Rpb24oKXtcbiAgICB0cnkge1xuICAgICAgICB2YXIgbyA9IHt9O1xuICAgICAgICBlczUuZGVmaW5lUHJvcGVydHkobywgXCJmXCIsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG8uZiA9PT0gMztcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxufSkoKTtcbnZhciBjYW5FdmFsdWF0ZSA9IHR5cGVvZiBuYXZpZ2F0b3IgPT0gXCJ1bmRlZmluZWRcIjtcbnZhciBlcnJvck9iaiA9IHtlOiB7fX07XG5mdW5jdGlvbiB0cnlDYXRjaDEoZm4sIHJlY2VpdmVyLCBhcmcpIHtcbiAgICB0cnkgeyByZXR1cm4gZm4uY2FsbChyZWNlaXZlciwgYXJnKTsgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGVycm9yT2JqLmUgPSBlO1xuICAgICAgICByZXR1cm4gZXJyb3JPYmo7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cnlDYXRjaDIoZm4sIHJlY2VpdmVyLCBhcmcsIGFyZzIpIHtcbiAgICB0cnkgeyByZXR1cm4gZm4uY2FsbChyZWNlaXZlciwgYXJnLCBhcmcyKTsgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGVycm9yT2JqLmUgPSBlO1xuICAgICAgICByZXR1cm4gZXJyb3JPYmo7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cnlDYXRjaDMoZm4sIHJlY2VpdmVyLCBhcmcsIGFyZzIsIGFyZzMpIHtcbiAgICB0cnkgeyByZXR1cm4gZm4uY2FsbChyZWNlaXZlciwgYXJnLCBhcmcyLCBhcmczKTsgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGVycm9yT2JqLmUgPSBlO1xuICAgICAgICByZXR1cm4gZXJyb3JPYmo7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cnlDYXRjaDQoZm4sIHJlY2VpdmVyLCBhcmcsIGFyZzIsIGFyZzMsIGFyZzQpIHtcbiAgICB0cnkgeyByZXR1cm4gZm4uY2FsbChyZWNlaXZlciwgYXJnLCBhcmcyLCBhcmczLCBhcmc0KTsgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGVycm9yT2JqLmUgPSBlO1xuICAgICAgICByZXR1cm4gZXJyb3JPYmo7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cnlDYXRjaEFwcGx5KGZuLCBhcmdzLCByZWNlaXZlcikge1xuICAgIHRyeSB7IHJldHVybiBmbi5hcHBseShyZWNlaXZlciwgYXJncyk7IH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgICBlcnJvck9iai5lID0gZTtcbiAgICAgICAgcmV0dXJuIGVycm9yT2JqO1xuICAgIH1cbn1cblxudmFyIGluaGVyaXRzID0gZnVuY3Rpb24oQ2hpbGQsIFBhcmVudCkge1xuICAgIHZhciBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgICBmdW5jdGlvbiBUKCkge1xuICAgICAgICB0aGlzLmNvbnN0cnVjdG9yID0gQ2hpbGQ7XG4gICAgICAgIHRoaXMuY29uc3RydWN0b3IkID0gUGFyZW50O1xuICAgICAgICBmb3IgKHZhciBwcm9wZXJ0eU5hbWUgaW4gUGFyZW50LnByb3RvdHlwZSkge1xuICAgICAgICAgICAgaWYgKGhhc1Byb3AuY2FsbChQYXJlbnQucHJvdG90eXBlLCBwcm9wZXJ0eU5hbWUpICYmXG4gICAgICAgICAgICAgICAgcHJvcGVydHlOYW1lLmNoYXJBdChwcm9wZXJ0eU5hbWUubGVuZ3RoLTEpICE9PSBcIiRcIlxuICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICB0aGlzW3Byb3BlcnR5TmFtZSArIFwiJFwiXSA9IFBhcmVudC5wcm90b3R5cGVbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBULnByb3RvdHlwZSA9IFBhcmVudC5wcm90b3R5cGU7XG4gICAgQ2hpbGQucHJvdG90eXBlID0gbmV3IFQoKTtcbiAgICByZXR1cm4gQ2hpbGQucHJvdG90eXBlO1xufTtcblxuZnVuY3Rpb24gYXNTdHJpbmcodmFsKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09IFwic3RyaW5nXCIgPyB2YWwgOiAoXCJcIiArIHZhbCk7XG59XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKHZhbCkge1xuICAgIHJldHVybiB2YWwgPT0gbnVsbCB8fCB2YWwgPT09IHRydWUgfHwgdmFsID09PSBmYWxzZSB8fFxuICAgICAgICB0eXBlb2YgdmFsID09PSBcInN0cmluZ1wiIHx8IHR5cGVvZiB2YWwgPT09IFwibnVtYmVyXCI7XG5cbn1cblxuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgICByZXR1cm4gIWlzUHJpbWl0aXZlKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gbWF5YmVXcmFwQXNFcnJvcihtYXliZUVycm9yKSB7XG4gICAgaWYgKCFpc1ByaW1pdGl2ZShtYXliZUVycm9yKSkgcmV0dXJuIG1heWJlRXJyb3I7XG5cbiAgICByZXR1cm4gbmV3IEVycm9yKGFzU3RyaW5nKG1heWJlRXJyb3IpKTtcbn1cblxuZnVuY3Rpb24gd2l0aEFwcGVuZGVkKHRhcmdldCwgYXBwZW5kZWUpIHtcbiAgICB2YXIgbGVuID0gdGFyZ2V0Lmxlbmd0aDtcbiAgICB2YXIgcmV0ID0gbmV3IEFycmF5KGxlbiArIDEpO1xuICAgIHZhciBpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICByZXRbaV0gPSB0YXJnZXRbaV07XG4gICAgfVxuICAgIHJldFtpXSA9IGFwcGVuZGVlO1xuICAgIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGdldERhdGFQcm9wZXJ0eU9yRGVmYXVsdChvYmosIGtleSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgaWYgKGVzNS5pc0VTNSkge1xuICAgICAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBrZXkpO1xuICAgICAgICBpZiAoZGVzYyAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVzYy5nZXQgPT0gbnVsbCAmJiBkZXNjLnNldCA9PSBudWxsXG4gICAgICAgICAgICAgICAgICAgID8gZGVzYy52YWx1ZVxuICAgICAgICAgICAgICAgICAgICA6IGRlZmF1bHRWYWx1ZTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7fS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSA/IG9ialtrZXldIDogdm9pZCAwO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbm90RW51bWVyYWJsZVByb3Aob2JqLCBuYW1lLCB2YWx1ZSkge1xuICAgIGlmIChpc1ByaW1pdGl2ZShvYmopKSByZXR1cm4gb2JqO1xuICAgIHZhciBkZXNjcmlwdG9yID0ge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfTtcbiAgICBlczUuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCBkZXNjcmlwdG9yKTtcbiAgICByZXR1cm4gb2JqO1xufVxuXG5cbnZhciB3cmFwc1ByaW1pdGl2ZVJlY2VpdmVyID0gKGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzICE9PSBcInN0cmluZ1wiO1xufSkuY2FsbChcInN0cmluZ1wiKTtcblxuZnVuY3Rpb24gdGhyb3dlcihyKSB7XG4gICAgdGhyb3cgcjtcbn1cblxudmFyIGluaGVyaXRlZERhdGFLZXlzID0gKGZ1bmN0aW9uKCkge1xuICAgIGlmIChlczUuaXNFUzUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgICAgICAgICAgdmFyIHJldCA9IFtdO1xuICAgICAgICAgICAgdmFyIHZpc2l0ZWRLZXlzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgICAgICAgIHZhciBnZXRLZXlzID0gT2JqZWN0KG9wdHMpLmluY2x1ZGVIaWRkZW5cbiAgICAgICAgICAgICAgICA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzXG4gICAgICAgICAgICAgICAgOiBPYmplY3Qua2V5cztcbiAgICAgICAgICAgIHdoaWxlIChvYmogIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHZhciBrZXlzO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGtleXMgPSBnZXRLZXlzKG9iaik7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmICh2aXNpdGVkS2V5c1trZXldKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgdmlzaXRlZEtleXNba2V5XSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIGtleSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkZXNjICE9IG51bGwgJiYgZGVzYy5nZXQgPT0gbnVsbCAmJiBkZXNjLnNldCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXQucHVzaChrZXkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9iaiA9IGVzNS5nZXRQcm90b3R5cGVPZihvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgICAgICB2YXIgcmV0ID0gW107XG4gICAgICAgICAgICAvKmpzaGludCBmb3JpbjpmYWxzZSAqL1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgICAgICAgICAgIHJldC5wdXNoKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9O1xuICAgIH1cblxufSkoKTtcblxuZnVuY3Rpb24gaXNDbGFzcyhmbikge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgZm4gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgdmFyIGtleXMgPSBlczUua2V5cyhmbi5wcm90b3R5cGUpO1xuICAgICAgICAgICAgcmV0dXJuIGtleXMubGVuZ3RoID4gMCAmJlxuICAgICAgICAgICAgICAgICAgICEoa2V5cy5sZW5ndGggPT09IDEgJiYga2V5c1swXSA9PT0gXCJjb25zdHJ1Y3RvclwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0b0Zhc3RQcm9wZXJ0aWVzKG9iaikge1xuICAgIC8qanNoaW50IC1XMDI3Ki9cbiAgICBmdW5jdGlvbiBmKCkge31cbiAgICBmLnByb3RvdHlwZSA9IG9iajtcbiAgICByZXR1cm4gZjtcbiAgICBldmFsKG9iaik7XG59XG5cbnZhciByaWRlbnQgPSAvXlthLXokX11bYS16JF8wLTldKiQvaTtcbmZ1bmN0aW9uIGlzSWRlbnRpZmllcihzdHIpIHtcbiAgICByZXR1cm4gcmlkZW50LnRlc3Qoc3RyKTtcbn1cblxuZnVuY3Rpb24gZmlsbGVkUmFuZ2UoY291bnQsIHByZWZpeCwgc3VmZml4KSB7XG4gICAgdmFyIHJldCA9IG5ldyBBcnJheShjb3VudCk7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGNvdW50OyArK2kpIHtcbiAgICAgICAgcmV0W2ldID0gcHJlZml4ICsgaSArIHN1ZmZpeDtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbn1cblxudmFyIHJldCA9IHtcbiAgICBpc0NsYXNzOiBpc0NsYXNzLFxuICAgIGlzSWRlbnRpZmllcjogaXNJZGVudGlmaWVyLFxuICAgIGluaGVyaXRlZERhdGFLZXlzOiBpbmhlcml0ZWREYXRhS2V5cyxcbiAgICBnZXREYXRhUHJvcGVydHlPckRlZmF1bHQ6IGdldERhdGFQcm9wZXJ0eU9yRGVmYXVsdCxcbiAgICB0aHJvd2VyOiB0aHJvd2VyLFxuICAgIGlzQXJyYXk6IGVzNS5pc0FycmF5LFxuICAgIGhhdmVHZXR0ZXJzOiBoYXZlR2V0dGVycyxcbiAgICBub3RFbnVtZXJhYmxlUHJvcDogbm90RW51bWVyYWJsZVByb3AsXG4gICAgaXNQcmltaXRpdmU6IGlzUHJpbWl0aXZlLFxuICAgIGlzT2JqZWN0OiBpc09iamVjdCxcbiAgICBjYW5FdmFsdWF0ZTogY2FuRXZhbHVhdGUsXG4gICAgZXJyb3JPYmo6IGVycm9yT2JqLFxuICAgIHRyeUNhdGNoMTogdHJ5Q2F0Y2gxLFxuICAgIHRyeUNhdGNoMjogdHJ5Q2F0Y2gyLFxuICAgIHRyeUNhdGNoMzogdHJ5Q2F0Y2gzLFxuICAgIHRyeUNhdGNoNDogdHJ5Q2F0Y2g0LFxuICAgIHRyeUNhdGNoQXBwbHk6IHRyeUNhdGNoQXBwbHksXG4gICAgaW5oZXJpdHM6IGluaGVyaXRzLFxuICAgIHdpdGhBcHBlbmRlZDogd2l0aEFwcGVuZGVkLFxuICAgIGFzU3RyaW5nOiBhc1N0cmluZyxcbiAgICBtYXliZVdyYXBBc0Vycm9yOiBtYXliZVdyYXBBc0Vycm9yLFxuICAgIHdyYXBzUHJpbWl0aXZlUmVjZWl2ZXI6IHdyYXBzUHJpbWl0aXZlUmVjZWl2ZXIsXG4gICAgdG9GYXN0UHJvcGVydGllczogdG9GYXN0UHJvcGVydGllcyxcbiAgICBmaWxsZWRSYW5nZTogZmlsbGVkUmFuZ2Vcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcmV0O1xuIiwiLypqc2xpbnQgbm9kZTp0cnVlKi9cbi8qZ2xvYmFscyBSVENQZWVyQ29ubmVjdGlvbiwgbW96UlRDUGVlckNvbm5lY3Rpb24sIHdlYmtpdFJUQ1BlZXJDb25uZWN0aW9uICovXG4vKmdsb2JhbHMgUlRDU2Vzc2lvbkRlc2NyaXB0aW9uLCBtb3pSVENTZXNzaW9uRGVzY3JpcHRpb24gKi9cbi8qZ2xvYmFscyBSVENJY2VDYW5kaWRhdGUsIG1velJUQ0ljZUNhbmRpZGF0ZSAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgbXlSVENQZWVyQ29ubmVjdGlvbiA9IG51bGw7XG52YXIgbXlSVENTZXNzaW9uRGVzY3JpcHRpb24gPSBudWxsO1xudmFyIG15UlRDSWNlQ2FuZGlkYXRlID0gbnVsbDtcblxudmFyIHJlbmFtZUljZVVSTHMgPSBmdW5jdGlvbiAoY29uZmlnKSB7XG4gIGlmICghY29uZmlnKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghY29uZmlnLmljZVNlcnZlcnMpIHtcbiAgICByZXR1cm4gY29uZmlnO1xuICB9XG4gIGNvbmZpZy5pY2VTZXJ2ZXJzLmZvckVhY2goZnVuY3Rpb24gKHNlcnZlcikge1xuICAgIHNlcnZlci51cmwgPSBzZXJ2ZXIudXJscztcbiAgICBkZWxldGUgc2VydmVyLnVybHM7XG4gIH0pO1xuICByZXR1cm4gY29uZmlnO1xufTtcblxudmFyIGZpeENocm9tZVN0YXRzUmVzcG9uc2UgPSBmdW5jdGlvbihyZXNwb25zZSkge1xuICB2YXIgc3RhbmRhcmRSZXBvcnQgPSB7fTtcbiAgdmFyIHJlcG9ydHMgPSByZXNwb25zZS5yZXN1bHQoKTtcbiAgcmVwb3J0cy5mb3JFYWNoKGZ1bmN0aW9uKHJlcG9ydCkge1xuICAgIHZhciBzdGFuZGFyZFN0YXRzID0ge1xuICAgICAgaWQ6IHJlcG9ydC5pZCxcbiAgICAgIHRpbWVzdGFtcDogcmVwb3J0LnRpbWVzdGFtcCxcbiAgICAgIHR5cGU6IHJlcG9ydC50eXBlXG4gICAgfTtcbiAgICByZXBvcnQubmFtZXMoKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHN0YW5kYXJkU3RhdHNbbmFtZV0gPSByZXBvcnQuc3RhdChuYW1lKTtcbiAgICB9KTtcbiAgICBzdGFuZGFyZFJlcG9ydFtzdGFuZGFyZFN0YXRzLmlkXSA9IHN0YW5kYXJkU3RhdHM7XG4gIH0pO1xuXG4gIHJldHVybiBzdGFuZGFyZFJlcG9ydDtcbn07XG5cbnZhciBzZXNzaW9uSGFzRGF0YSA9IGZ1bmN0aW9uKGRlc2MpIHtcbiAgaWYgKCFkZXNjKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciBoYXNEYXRhID0gZmFsc2U7XG4gIHZhciBwcmVmaXggPSAnbT1hcHBsaWNhdGlvbic7XG4gIGRlc2Muc2RwLnNwbGl0KCdcXG4nKS5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICBpZiAobGluZS5zbGljZSgwLCBwcmVmaXgubGVuZ3RoKSA9PT0gcHJlZml4KSB7XG4gICAgICBoYXNEYXRhID0gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gaGFzRGF0YTtcbn07XG5cbi8vIFVuaWZ5IFBlZXJDb25uZWN0aW9uIE9iamVjdC5cbmlmICh0eXBlb2YgUlRDUGVlckNvbm5lY3Rpb24gIT09ICd1bmRlZmluZWQnKSB7XG4gIG15UlRDUGVlckNvbm5lY3Rpb24gPSBSVENQZWVyQ29ubmVjdGlvbjtcbn0gZWxzZSBpZiAodHlwZW9mIG1velJUQ1BlZXJDb25uZWN0aW9uICE9PSAndW5kZWZpbmVkJykge1xuICBteVJUQ1BlZXJDb25uZWN0aW9uID0gZnVuY3Rpb24gKGNvbmZpZ3VyYXRpb24sIGNvbnN0cmFpbnRzKSB7XG4gICAgLy8gRmlyZWZveCB1c2VzICd1cmwnIHJhdGhlciB0aGFuICd1cmxzJyBmb3IgUlRDSWNlU2VydmVyLnVybHNcbiAgICB2YXIgcGMgPSBuZXcgbW96UlRDUGVlckNvbm5lY3Rpb24ocmVuYW1lSWNlVVJMcyhjb25maWd1cmF0aW9uKSwgY29uc3RyYWludHMpO1xuXG4gICAgLy8gRmlyZWZveCBkb2Vzbid0IGZpcmUgJ29ubmVnb3RpYXRpb25uZWVkZWQnIHdoZW4gYSBkYXRhIGNoYW5uZWwgaXMgY3JlYXRlZFxuICAgIC8vIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTg0MDcyOFxuICAgIHZhciBkYXRhRW5hYmxlZCA9IGZhbHNlO1xuICAgIHZhciBib3VuZENyZWF0ZURhdGFDaGFubmVsID0gcGMuY3JlYXRlRGF0YUNoYW5uZWwuYmluZChwYyk7XG4gICAgcGMuY3JlYXRlRGF0YUNoYW5uZWwgPSBmdW5jdGlvbihsYWJlbCwgZGF0YUNoYW5uZWxEaWN0KSB7XG4gICAgICB2YXIgZGMgPSBib3VuZENyZWF0ZURhdGFDaGFubmVsKGxhYmVsLCBkYXRhQ2hhbm5lbERpY3QpO1xuICAgICAgaWYgKCFkYXRhRW5hYmxlZCkge1xuICAgICAgICBkYXRhRW5hYmxlZCA9IHRydWU7XG4gICAgICAgIGlmIChwYy5vbm5lZ290aWF0aW9ubmVlZGVkICYmXG4gICAgICAgICAgICAhc2Vzc2lvbkhhc0RhdGEocGMubG9jYWxEZXNjcmlwdGlvbikgJiZcbiAgICAgICAgICAgICFzZXNzaW9uSGFzRGF0YShwYy5yZW1vdGVEZXNjcmlwdGlvbikpIHtcbiAgICAgICAgICB2YXIgZXZlbnQgPSBuZXcgRXZlbnQoJ25lZ290aWF0aW9ubmVlZGVkJyk7XG4gICAgICAgICAgcGMub25uZWdvdGlhdGlvbm5lZWRlZChldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBkYztcbiAgICB9O1xuXG4gICAgcmV0dXJuIHBjO1xuICB9O1xufSBlbHNlIGlmICh0eXBlb2Ygd2Via2l0UlRDUGVlckNvbm5lY3Rpb24gIT09ICd1bmRlZmluZWQnKSB7XG4gIC8vIENocm9tZSByZXR1cm5zIGEgbm9uc3RhbmRhcmQsIG5vbi1KU09OLWlmaWFibGUgcmVzcG9uc2UgZnJvbSBnZXRTdGF0cy5cbiAgbXlSVENQZWVyQ29ubmVjdGlvbiA9IGZ1bmN0aW9uKGNvbmZpZ3VyYXRpb24sIGNvbnN0cmFpbnRzKSB7XG4gICAgdmFyIHBjID0gbmV3IHdlYmtpdFJUQ1BlZXJDb25uZWN0aW9uKGNvbmZpZ3VyYXRpb24sIGNvbnN0cmFpbnRzKTtcbiAgICB2YXIgYm91bmRHZXRTdGF0cyA9IHBjLmdldFN0YXRzLmJpbmQocGMpO1xuICAgIHBjLmdldFN0YXRzID0gZnVuY3Rpb24oc2VsZWN0b3IsIHN1Y2Nlc3NDYWxsYmFjaywgZmFpbHVyZUNhbGxiYWNrKSB7XG4gICAgICB2YXIgc3VjY2Vzc0NhbGxiYWNrV3JhcHBlciA9IGZ1bmN0aW9uKGNocm9tZVN0YXRzUmVzcG9uc2UpIHtcbiAgICAgICAgc3VjY2Vzc0NhbGxiYWNrKGZpeENocm9tZVN0YXRzUmVzcG9uc2UoY2hyb21lU3RhdHNSZXNwb25zZSkpO1xuICAgICAgfTtcbiAgICAgIC8vIENocm9tZSBhbHNvIHRha2VzIGl0cyBhcmd1bWVudHMgaW4gdGhlIHdyb25nIG9yZGVyLlxuICAgICAgYm91bmRHZXRTdGF0cyhzdWNjZXNzQ2FsbGJhY2tXcmFwcGVyLCBmYWlsdXJlQ2FsbGJhY2ssIHNlbGVjdG9yKTtcbiAgICB9O1xuICAgIHJldHVybiBwYztcbiAgfTtcbn1cblxuLy8gVW5pZnkgU2Vzc2lvbkRlc2NycHRpb24gT2JqZWN0LlxuaWYgKHR5cGVvZiBSVENTZXNzaW9uRGVzY3JpcHRpb24gIT09ICd1bmRlZmluZWQnKSB7XG4gIG15UlRDU2Vzc2lvbkRlc2NyaXB0aW9uID0gUlRDU2Vzc2lvbkRlc2NyaXB0aW9uO1xufSBlbHNlIGlmICh0eXBlb2YgbW96UlRDU2Vzc2lvbkRlc2NyaXB0aW9uICE9PSAndW5kZWZpbmVkJykge1xuICBteVJUQ1Nlc3Npb25EZXNjcmlwdGlvbiA9IG1velJUQ1Nlc3Npb25EZXNjcmlwdGlvbjtcbn1cblxuLy8gVW5pZnkgSWNlQ2FuZGlkYXRlIE9iamVjdC5cbmlmICh0eXBlb2YgUlRDSWNlQ2FuZGlkYXRlICE9PSAndW5kZWZpbmVkJykge1xuICBteVJUQ0ljZUNhbmRpZGF0ZSA9IFJUQ0ljZUNhbmRpZGF0ZTtcbn0gZWxzZSBpZiAodHlwZW9mIG1velJUQ0ljZUNhbmRpZGF0ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgbXlSVENJY2VDYW5kaWRhdGUgPSBtb3pSVENJY2VDYW5kaWRhdGU7XG59XG5cbmV4cG9ydHMuUlRDUGVlckNvbm5lY3Rpb24gPSBteVJUQ1BlZXJDb25uZWN0aW9uO1xuZXhwb3J0cy5SVENTZXNzaW9uRGVzY3JpcHRpb24gPSBteVJUQ1Nlc3Npb25EZXNjcmlwdGlvbjtcbmV4cG9ydHMuUlRDSWNlQ2FuZGlkYXRlID0gbXlSVENJY2VDYW5kaWRhdGU7XG4iLCIvKipcclxuICogQ3JlYXRlZCBieSBKdWxpYW4gb24gMTIvMTAvMjAxNC5cclxuICovXHJcbihmdW5jdGlvbiAoZXhwb3J0cykge1xyXG5cclxuICAgIC8vIHBlcmZvcm1hbmNlLm5vdyBwb2x5ZmlsbFxyXG4gICAgdmFyIHBlcmYgPSBudWxsO1xyXG4gICAgaWYgKHR5cGVvZiBwZXJmb3JtYW5jZSA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICBwZXJmID0ge307XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHBlcmYgPSBwZXJmb3JtYW5jZTtcclxuICAgIH1cclxuXHJcbiAgICBwZXJmLm5vdyA9IHBlcmYubm93IHx8IHBlcmYubW96Tm93IHx8IHBlcmYubXNOb3cgfHwgIHBlcmYub05vdyB8fCBwZXJmLndlYmtpdE5vdyB8fCBEYXRlLm5vdyB8fFxyXG4gICAgICAgIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gc3dhcChhcnJheSwgaSwgaikge1xyXG4gICAgICAgIGlmIChpICE9PSBqKSB7XHJcbiAgICAgICAgICAgIHZhciB0ZW1wID0gYXJyYXlbaV07XHJcbiAgICAgICAgICAgIGFycmF5W2ldID0gYXJyYXlbal07XHJcbiAgICAgICAgICAgIGFycmF5W2pdID0gdGVtcDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLypcclxuICAgIH5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+XHJcbiAgICAgKi9cclxuXHJcbiAgICB2YXIgZ2V0UmFuZG9tSW50ID0gZXhwb3J0cy5nZXRSYW5kb21JbnQgPSBmdW5jdGlvbiAobWluLCBtYXgpIHtcclxuICAgICAgICBpZiAobWluID4gbWF4KSB0aHJvdyBuZXcgRXJyb3IoXCJtaW4gbXVzdCBiZSBzbWFsbGVyIHRoYW4gbWF4ISB7XCIgKyBtaW4gKyBcIj5cIiArIG1heCArIFwifVwiICk7XHJcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSkgKyBtaW47XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuc2FtcGxlID0gZnVuY3Rpb24gKGxpc3QsIG4pIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gW10sIGosaSA9IDAsIEwgPSBuID4gbGlzdC5sZW5ndGggPyBsaXN0Lmxlbmd0aCA6IG4sIHMgPSBsaXN0Lmxlbmd0aCAtIDE7XHJcbiAgICAgICAgZm9yKDtpPEw7aSsrKSB7XHJcbiAgICAgICAgICAgIGogPSBnZXRSYW5kb21JbnQoaSxzKTtcclxuICAgICAgICAgICAgc3dhcChsaXN0LGksaik7XHJcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxpc3RbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmlzU3RyaW5nID0gZnVuY3Rpb24obXlWYXIpIHtcclxuICAgICAgICByZXR1cm4gKHR5cGVvZiBteVZhciA9PT0gJ3N0cmluZycgfHwgbXlWYXIgaW5zdGFuY2VvZiBTdHJpbmcpXHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuYXNzZXJ0TGVuZ3RoID0gZnVuY3Rpb24gKGFyZywgbmJyKSB7XHJcbiAgICAgICAgaWYgKGFyZy5sZW5ndGggPT09IG5icikgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoXCJXcm9uZyBudW1iZXIgb2YgYXJndW1lbnRzOiBleHBlY3RlZDpcIiArIG5iciArIFwiLCBidXQgZ290OiBcIiArIGFyZy5sZW5ndGgpO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmd1aWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGQgPSBwZXJmLm5vdygpO1xyXG4gICAgICAgIHZhciBndWlkID0gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBmdW5jdGlvbiAoYykge1xyXG4gICAgICAgICAgICB2YXIgciA9IChkICsgTWF0aC5yYW5kb20oKSAqIDE2KSAlIDE2IHwgMDtcclxuICAgICAgICAgICAgZCA9IE1hdGguZmxvb3IoZCAvIDE2KTtcclxuICAgICAgICAgICAgcmV0dXJuIChjID09PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpKS50b1N0cmluZygxNik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIGd1aWQ7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMudGltZURpZmZlcmVuY2VJbk1zID0gZnVuY3Rpb24gKHRzQSwgdHNCKSB7XHJcbiAgICAgICAgaWYgKHRzQSBpbnN0YW5jZW9mIERhdGUpe1xyXG4gICAgICAgICAgICB0c0EgPSB0c0EuZ2V0VGltZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHNCIGluc3RhbmNlb2YgRGF0ZSl7XHJcbiAgICAgICAgICAgIHRzQiA9IHRzQi5nZXRUaW1lKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBNYXRoLmFicyh0c0EgLSB0c0IpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIG1pbGxpc2Vjb25kcyB0byBzZWNvbmRzXHJcbiAgICAgKiBAcGFyYW0gbXMge051bWJlcn0gTWlsbGlzXHJcbiAgICAgKi9cclxuICAgIGV4cG9ydHMubXNUb1MgPSBmdW5jdGlvbiAobXMpIHtcclxuICAgICAgICByZXR1cm4gbXMgLyAxMDAwO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmlzRGVmaW5lZCA9IGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgaWYgKG8gPT09IG51bGwpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBpZiAodHlwZW9mIG8gPT09IFwidW5kZWZpbmVkXCIpIHJldHVybiBmYWxzZTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTaGFsbG93IGNsb25lXHJcbiAgICAgKiBAcGFyYW0gbGlzdFxyXG4gICAgICogQHJldHVybnMge0FycmF5fHN0cmluZ3xCbG9ifVxyXG4gICAgICovXHJcbiAgICBleHBvcnRzLmNsb25lQXJyYXkgPSBmdW5jdGlvbiAobGlzdCkge1xyXG4gICAgICAgIHJldHVybiBsaXN0LnNsaWNlKDApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmVtb3ZlcyB0aGUgaXRlbSBhdCB0aGUgcG9zaXRpb24gYW5kIHJlaW5kZXhlcyB0aGUgbGlzdFxyXG4gICAgICogQHBhcmFtIGxpc3RcclxuICAgICAqIEBwYXJhbSBpXHJcbiAgICAgKiBAcmV0dXJucyB7Kn1cclxuICAgICAqL1xyXG4gICAgZXhwb3J0cy5kZWxldGVQb3NpdGlvbiA9IGZ1bmN0aW9uIChsaXN0LCBpKSB7XHJcbiAgICAgICAgaWYgKGkgPCAwIHx8IGkgPj0gbGlzdC5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihcIk91dCBvZiBib3VuZHNcIik7XHJcbiAgICAgICAgbGlzdC5zcGxpY2UoaSwxKTtcclxuICAgICAgICByZXR1cm4gbGlzdDtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3Mgd2VhdGhlciB0aGUgdGhlIG9iamVjdCBpbXBsZW1lbnRzIHRoZSBmdWxsIGludGVyZmFjZSBvciBub3RcclxuICAgICAqIEBwYXJhbSBvIHtPYmplY3R9XHJcbiAgICAgKi9cclxuICAgIHZhciBpbXBsZW1lbnRzID0gZXhwb3J0cy5pbXBsZW1lbnRzID0gZnVuY3Rpb24gKG8sIGEpIHtcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaW1wbGVtZW50cy5hcHBseSh7fSxbb10uY29uY2F0KGEpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGkgPSAxLCBtZXRob2ROYW1lO1xyXG4gICAgICAgIHdoaWxlKChtZXRob2ROYW1lID0gYXJndW1lbnRzW2krK10pKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb1ttZXRob2ROYW1lXSAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5oZXJpdCBzdHVmZiBmcm9tIHBhcmVudFxyXG4gICAgICogQHBhcmFtIGNoaWxkXHJcbiAgICAgKiBAcGFyYW0gcGFyZW50XHJcbiAgICAgKi9cclxuICAgIGV4cG9ydHMuaW5oZXJpdCA9IGZ1bmN0aW9uIChjaGlsZCwgcGFyZW50KSB7XHJcbiAgICAgICAgY2hpbGQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShwYXJlbnQucHJvdG90eXBlKTtcclxuICAgIH07XHJcblxyXG59KSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyB0aGlzWyd5VXRpbHMnXSA9IHt9IDogZXhwb3J0cyk7Il19
