"use strict"

var net = require('net');

function stringToBytes (string) {
  let asUtf8 = unescape(encodeURIComponent(string));
  let len = asUtf8.length;
  let arr = [];
  for (var i = 0; i < len; i++) {
    arr.push(asUtf8.charCodeAt(i));
  }
  return arr;
}

function numToUInt8_2 (num) {
  return [
    (num >> 8) & 0xFF,
           num & 0xFF
    ];
}

function UInt8_2ToNum (arr) {
  return (arr[0] << 8) | arr[1];
}

class RQueueMessages {
  /**
   * @param {String} topicStr
   */
  static subscribe(topicStr) {
    let topic = stringToBytes(topicStr);
    let len = numToUInt8_2(topic.length);
    let raw = [];
    raw.push(len[0], len[1], RQueueMessages.SUBSCRIBE);
    Array.prototype.push.apply(raw, topic);
    return new Buffer(raw);
  }

  static notify(topicStr, contentStr) {
    let topic = stringToBytes(topicStr);
    let content = stringToBytes(contentStr);
    let len = numToUInt8_2(topic.length + content.length + 1);
    let raw = [];
    raw.push(len[0], len[1], RQueueMessages.NOTIFICATION, topic.length);
    Array.prototype.push.apply(raw, topic);
    Array.prototype.push.apply(raw, content);
    //`console.log(raw);
    return new Buffer(raw);
  }
}

RQueueMessages.SUBSCRIBE = 1;
RQueueMessages.REMOVE = 3;
RQueueMessages.DEREGISTER  = 5;
RQueueMessages.NOTIFICATION = 7;

class Client {
  /**
   * @param {String} host
   * @param {Int} port
   * @param {Function} [onConnect]
   */
  constructor (host, port, onConnect) {
    let socket = new net.Socket();
    socket.connect({host: host, port: port}, onConnect);

    var buffer = new Buffer([]);

    function getNotify (data) {
      let pLen = UInt8_2ToNum(data.slice(0, 2));
      if (data.length >= (pLen + 3)) {
        let topicLen = data[3];
        let topic = data.slice(4, 4+topicLen);
        let content = data.slice(4+topicLen, pLen + 3);
        buffer = data.slice(pLen + 3);
        return [topic, content];
      } else {
        buffer = data;
        return null;
      }
    }

    var self = this;

    //there is a possible leak here. need to keep parsing until there are no messages
    socket.on('data', function(data) {
      buffer = Buffer.concat([buffer, data]);
      /** @mutates buffer*/
      var notify;
      while (true) {
        notify = getNotify(buffer);
        if (notify) {
          self._onMessage.forEach(func => func.apply(null, notify));
        } else {
          break;
        }
      }

    });

    this.socket = socket;

    /**
     * A list of functions to invoke on each message
     *
     * @type Array<Function>
     */
    this._onMessage = [];
  }

  /**
   * Sets up a call to {func} every time a deserialized message is received
   * @param {(Buffer, Buffer) => *} func
   */
  onMessage(func) {
    this._onMessage.push(func);
  }

  /**
   * @param {Buffer}
   */
  sendBuffer(buffer) {
    this.socket.write(buffer);
  }

  subscribe(topic) {
    this.sendBuffer(RQueueMessages.subscribe(topic));
  }

  notify(topic, content) {
    this.sendBuffer(RQueueMessages.notify(topic, content));
  }
}

module.exports = {
  Client: Client
};
