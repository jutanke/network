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