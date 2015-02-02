/**
 * Created by Julian on 12/18/2014.
 */
exports.Interface = [
    
    /*
      Starts the Handshaking. This must be done once to connect to the network.
      {launch} takes a callback as parameter that gets called when the 
      ICE-Candidates are gathered.
      The {offer} that is created must be transmitted to the other peer
      (How this is done is out of the scope of this library) in order to
      initiate the handshake.
    */
    "launch",
    
    /*
      Implement {event.EventEmitter}
      We expect the following events:
      {statechange}: applies when the state changes: 
      @params = ["disconnect", "partial", "connect"]
      {receive}: message is send. This is already filtered:
      @params = (sender {Peer}, message {Object||String}
      {churn}: a received message, unfiltered by BroadcastDef:
      @params: (sender {Peer}, message {Object||String}
    */
    "on",
    
    /*
      This is the final handshake-function that gets called after an answer
      is received
    */
    "handshake",
    
    /*
      Peer-Sampling-Service-function. When provided with a parameter n, a
      given number of randomly sampled peers is returned, otherwise the whole
      PartialView of the RPS is returned.
      The returned value should be a list of Objects that have a
      "send"- function to send data to the peers.
    */
    "getPeers",
    
    /*
      Upon receiving an offer from {launch} through the signaling service 
      the peer creates a fitting answer.
      This answer is propagated to the application with a callback that must
      be provided to this function.
      The answer must be send back to the communication initiator.
    */
    "answer",
    
    /*
      This function checks if the membership protocol is already connected to
      the network and is "ready" or if the handshake is still pending.
      The parameter is a callback that gets called as soon as the peer is 
      connected to the network.
      This function must apply the callback immediately, if it is ready!
      
      var membership = new Membership(...);
      
      membership.ready(function(){
      // The membership system is ready and can be used
      });
    */
    "ready",
    
    /*
      Among other, this function removes all the peers from the peer
      partialView and inView. At the end of this function, the event 
      "stateChange" should be emitted with "disconnect" as argument.
    */
    "disconnect"
];
