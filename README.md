#network.js

API for arbitrary Network implementations between clients (Peer-to-Peer).

The API needs implementations of the following interfaces:

##BroadcastDefinition

###stopPropagation
gets called when a broadcast message reaches this node. This function evaluates if the node should propagate the message further or if it should stop sending it. This is defined by either returning {true} (Stop) or {false} (Keep propagating)
```javascript
...
MyBroadcastDefinition.prototype.stopPropagation = function(message) {
    // the message is decorated!
    var doIKnowTheMessage = doIKnow(message.MY_MSG_ID); // depends on your implementation
    return doIKnowTheMessage;
}
```

###decorateBroadcastMessage
before a message is broadcast, it gets decorated by the Broadcast definition. Here we can add additional values. This function only gets called when a peer starts a NEW BROADCAST. It will not be called when a peer simply propagates another peers broadcast.
```javascript
...
MyBroadcastDefinition.prototype.decorateBroadcastMessage = function(message){
    // Decorate the message so that we can figure out what message this is
    var newMessage = {
        MY_MSG_ID : generateMessageID(), // we must define this
        payload: message // piggyback the message
    }
    return newMessage;
}
```

###removeDecoration
Remove the decoration of the message so that the application can interact with the broadcast message transparently. This gets called whenever a broadcast message hits a peer and is propagated to the application.
```javascript
...
MyBroadcastDefinition.prototype.decorateBroadcastMessage = function(message){
    // we want to return the message in its "original" representation so that
    // this detection is hidden away from the application
    return message.payload;
}
```