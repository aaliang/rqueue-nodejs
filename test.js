var rqueue = require('./lib');

var client = new rqueue.Client(
    '0.0.0.0',
    6567,
    () => console.log('ok'));

client.subscribe("turtles");

client.onMessage(function (topic, content) {
  console.log(topic.toString(), content.toString());
});

setInterval(() => {
  console.log('sending');
  client.notify("turtles", "are awesome");
}, 1000);
