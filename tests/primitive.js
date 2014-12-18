/**
 * Created by Julian on 12/18/2014.
 */
var PrimitiveBroadcastDefinition = require("./../lib/primitiveBroadcastDefinition.js").Def;

var def = new PrimitiveBroadcastDefinition();

console.log(def.decorateBroadcastMessage("LOOL"));
console.log(def.decorateBroadcastMessage("Demo"));
console.log(def.decorateBroadcastMessage("Hallo"));