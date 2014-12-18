!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Network=e()}}(function(){var define,module,exports;return function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}({1:[function(require,module,exports){function EventEmitter(){this._events=this._events||{};this._maxListeners=this._maxListeners||undefined}module.exports=EventEmitter;EventEmitter.EventEmitter=EventEmitter;EventEmitter.prototype._events=undefined;EventEmitter.prototype._maxListeners=undefined;EventEmitter.defaultMaxListeners=10;EventEmitter.prototype.setMaxListeners=function(n){if(!isNumber(n)||n<0||isNaN(n))throw TypeError("n must be a positive number");this._maxListeners=n;return this};EventEmitter.prototype.emit=function(type){var er,handler,len,args,i,listeners;if(!this._events)this._events={};if(type==="error"){if(!this._events.error||isObject(this._events.error)&&!this._events.error.length){er=arguments[1];if(er instanceof Error){throw er}throw TypeError('Uncaught, unspecified "error" event.')}}handler=this._events[type];if(isUndefined(handler))return false;if(isFunction(handler)){switch(arguments.length){case 1:handler.call(this);break;case 2:handler.call(this,arguments[1]);break;case 3:handler.call(this,arguments[1],arguments[2]);break;default:len=arguments.length;args=new Array(len-1);for(i=1;i<len;i++)args[i-1]=arguments[i];handler.apply(this,args)}}else if(isObject(handler)){len=arguments.length;args=new Array(len-1);for(i=1;i<len;i++)args[i-1]=arguments[i];listeners=handler.slice();len=listeners.length;for(i=0;i<len;i++)listeners[i].apply(this,args)}return true};EventEmitter.prototype.addListener=function(type,listener){var m;if(!isFunction(listener))throw TypeError("listener must be a function");if(!this._events)this._events={};if(this._events.newListener)this.emit("newListener",type,isFunction(listener.listener)?listener.listener:listener);if(!this._events[type])this._events[type]=listener;else if(isObject(this._events[type]))this._events[type].push(listener);else this._events[type]=[this._events[type],listener];if(isObject(this._events[type])&&!this._events[type].warned){var m;if(!isUndefined(this._maxListeners)){m=this._maxListeners}else{m=EventEmitter.defaultMaxListeners}if(m&&m>0&&this._events[type].length>m){this._events[type].warned=true;console.error("(node) warning: possible EventEmitter memory "+"leak detected. %d listeners added. "+"Use emitter.setMaxListeners() to increase limit.",this._events[type].length);if(typeof console.trace==="function"){console.trace()}}}return this};EventEmitter.prototype.on=EventEmitter.prototype.addListener;EventEmitter.prototype.once=function(type,listener){if(!isFunction(listener))throw TypeError("listener must be a function");var fired=false;function g(){this.removeListener(type,g);if(!fired){fired=true;listener.apply(this,arguments)}}g.listener=listener;this.on(type,g);return this};EventEmitter.prototype.removeListener=function(type,listener){var list,position,length,i;if(!isFunction(listener))throw TypeError("listener must be a function");if(!this._events||!this._events[type])return this;list=this._events[type];length=list.length;position=-1;if(list===listener||isFunction(list.listener)&&list.listener===listener){delete this._events[type];if(this._events.removeListener)this.emit("removeListener",type,listener)}else if(isObject(list)){for(i=length;i-->0;){if(list[i]===listener||list[i].listener&&list[i].listener===listener){position=i;break}}if(position<0)return this;if(list.length===1){list.length=0;delete this._events[type]}else{list.splice(position,1)}if(this._events.removeListener)this.emit("removeListener",type,listener)}return this};EventEmitter.prototype.removeAllListeners=function(type){var key,listeners;if(!this._events)return this;if(!this._events.removeListener){if(arguments.length===0)this._events={};else if(this._events[type])delete this._events[type];return this}if(arguments.length===0){for(key in this._events){if(key==="removeListener")continue;this.removeAllListeners(key)}this.removeAllListeners("removeListener");this._events={};return this}listeners=this._events[type];if(isFunction(listeners)){this.removeListener(type,listeners)}else{while(listeners.length)this.removeListener(type,listeners[listeners.length-1])}delete this._events[type];return this};EventEmitter.prototype.listeners=function(type){var ret;if(!this._events||!this._events[type])ret=[];else if(isFunction(this._events[type]))ret=[this._events[type]];else ret=this._events[type].slice();return ret};EventEmitter.listenerCount=function(emitter,type){var ret;if(!emitter._events||!emitter._events[type])ret=0;else if(isFunction(emitter._events[type]))ret=1;else ret=emitter._events[type].length;return ret};function isFunction(arg){return typeof arg==="function"}function isNumber(arg){return typeof arg==="number"}function isObject(arg){return typeof arg==="object"&&arg!==null}function isUndefined(arg){return arg===void 0}},{}],2:[function(require,module,exports){exports.Interface=["stopPropagation","test1","test2"]},{}],3:[function(require,module,exports){var Utils=require("yutils");var IBroadcastDefinition=require("./broadcastDefinition.js").Interface;var PrimitiveBroadcastDef=require("./primitiveBroadcastDefinition.js").Def;var EventEmitter=require("events").EventEmitter2;var Network=function(broadcastDefinition){EventEmitter.call(this);this.broadcastDefinition=broadcastDefinition};Utils.inherit(Network,EventEmitter);Network.prototype.broadcast=function(msg){};Network.prototype.membership=function(){};exports.init=function(broadcastDefinition){if(!Utils.isDefined(broadcastDefinition)){broadcastDefinition=new PrimitiveBroadcastDef}if(!Utils.implements(broadcastDefinition,IBroadcastDefinition)){throw new Error("the Broadcast-Definition must define the correct interface!")}return new Network(broadcastDefinition)}},{"./IBroadcastDefinition.js":2,"./primitiveBroadcastDefinition.js":4,events:1,yutils:5}],4:[function(require,module,exports){},{}],5:[function(require,module,exports){(function(exports){var perf=null;if(typeof performance==="undefined"){perf={}}else{perf=performance}perf.now=perf.now||perf.mozNow||perf.msNow||perf.oNow||perf.webkitNow||Date.now||function(){return(new Date).getTime()};function swap(array,i,j){if(i!==j){var temp=array[i];array[i]=array[j];array[j]=temp}}var getRandomInt=exports.getRandomInt=function(min,max){if(min>max)throw new Error("min must be smaller than max! {"+min+">"+max+"}");return Math.floor(Math.random()*(max-min+1))+min};exports.sample=function(list,n){var result=[],j,i=0,L=n>list.length?list.length:n,s=list.length-1;for(;i<L;i++){j=getRandomInt(i,s);swap(list,i,j);result.push(list[i])}return result};exports.isString=function(myVar){return typeof myVar==="string"||myVar instanceof String};exports.assertLength=function(arg,nbr){if(arg.length===nbr)return true;else throw new Error("Wrong number of arguments: expected:"+nbr+", but got: "+arg.length)};exports.guid=function(){var d=perf.now();var guid="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=(d+Math.random()*16)%16|0;d=Math.floor(d/16);return(c==="x"?r:r&3|8).toString(16)});return guid};exports.timeDifferenceInMs=function(tsA,tsB){if(tsA instanceof Date){tsA=tsA.getTime()}if(tsB instanceof Date){tsB=tsB.getTime()}return Math.abs(tsA-tsB)};exports.msToS=function(ms){return ms/1e3};exports.isDefined=function(o){if(o===null)return false;if(typeof o==="undefined")return false;return true};exports.cloneArray=function(list){return list.slice(0)};exports.deletePosition=function(list,i){if(i<0||i>=list.length)throw new Error("Out of bounds");list.splice(i,1);return list};var implements=exports.implements=function(o,a){if(Array.isArray(a)){return implements.apply({},[o].concat(a))}var i=1,methodName;while(methodName=arguments[i++]){if(typeof o[methodName]!=="function"){return false}}return true};exports.inherit=function(child,parent){child.prototype=Object.create(parent.prototype)}})(typeof exports==="undefined"?this["yUtils"]={}:exports)},{}]},{},[3])(3)});