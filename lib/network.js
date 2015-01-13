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
        var originalMessage;
        if (!bdef.stopPropagation(message)) {
            originalMessage = bdef.removeDecoration(message);
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
