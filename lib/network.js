/**
 * Created by Julian on 12/18/2014.
 */
var Utils = require("yutils");
var BroadcastDefinition = require("./../interface/broadcastDefinition.js").Interface;
var PrimitiveBroadcastDef = require("./primitiveBroadcastDefinition.js").Def;
var EventEmitter = require('events').EventEmitter2;

var Cyclon = require("cyclonp2p").Class;

/**
 *
 * @constructor
 */
var Network = function (bdef) {
    EventEmitter.call(this);
    this.broadcastDefinition = bdef;
    //this._membership =
};
Utils.inherit(Network, EventEmitter);

/**
 * Send a broadcast to the network
 * @param msg
 */
Network.prototype.broadcast = function(msg) {

};

/**
 * return the current membership protocol
 */
Network.prototype.membership = function () {

};

/************************************
 *              A P I               *
 ************************************/
/**
 *
 * @param bdef {IBroadcastDefinition}
 * @returns {Network}
 */
exports.init = function (bdef) {
    if (!Utils.isDefined(bdef)) {
        bdef = new PrimitiveBroadcastDef();
    }
    if (!Utils.implements(bdef, BroadcastDefinition)) {
        throw new Error("the Broadcast-Definition must define the correct interface!");
    }
    return new Network(bdef);
};