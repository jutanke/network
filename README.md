#network.js

API for arbitrary Network implementations between clients (Peer-to-Peer).

```html
<head>
    ...
    <script src="your/path/network.bundle.js"></script>
    <script src="...jquery.js"></script>
    ...
    ...
    <body>
        ...
    </body>
    <script>
        $(function(){
            
            // e.g. Cyclon)
            var cyclon = new Cyclon(..);
            var vv = new VVBroadcastDefinition(..);
            
            var network = Network.init({
                membership : cyclon,
                broadcastDefinition: vv
            });
            
            network.ready(function(){
                // when we get this callback the program is ready to 
                // communicate!
            });
            
            //TODO: we need to do the handshake
        });
    <script>
</head>
```

The API needs implementations of the following interfaces:

##Interface: BroadcastDefinition

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

##Interface: Membership


###launch (handshaking step 1)
Starts the Handshaking. This must be done once to connect to the network. {launch} takes a callback as parameter that gets called when the ICE-Candidates are gathered. The {offer} that is created must be transmitted to the other peer (How this is done is out of the scope of this library) in order to initiate the handshake.
```javascript
...
// onOffer is a function callback (parameter: string)
MyMembership.prototype.launch = function(onOffer) {
    // create an offer and get a string blob
    MyWebRTC.createOffer();
    MyWebRTC.on("allicecandidates+offer", onOffer);
}
```

###answer (handshaking step 2)
Upon receiving an offer from {launch} through the signaling service the peer creates a fitting answer. This answer is propagated to the application with a callback that must be provided to this function. The answer must be send back to the communication initiator.
```javascript
MyMembership.prototype.answer = function(offer, onOffer){
    MyWebRTC.createAnswer(offer);
    MyWebRTC.on("answercreated", onOffer);
}
```

###handshake (handshaking step 3)
This is the final handshake-function that gets called after an answer is received
```javascript
MyMembership.prototype.handshake = function(answer){
    MyWebRTC.acceptAnswer(answer);
}
```

###on
Implement {event.EventEmitter}. We expect the following events:
* {*statechange*}: applies when the state changes: @params = ["disconnect", "partial", "connect"]
* {*receive*}: message is send. This is already filtered: @params = (sender {Peer}, message {Object||String}
* {*churn*}: a received message, unfiltered by BroadcastDef: @params: (sender {Peer}, message {Object||String}

###ready
This function checks if the membership protocol is already connected to the network and is "ready" or if the handshake is still pending.
The parameter is a callback that gets called as soon as the peer is connected to the network.
This function must apply the callback immediately, if it is ready!
```javascript
MyMembership.prototype.ready = function(callback){
    if (MyWebRTC.handshakeIsDone()) {
        callback();
    } else {
        MyWebRTC.on("loaded", callback);
    }
}
```