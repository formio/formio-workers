const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const app = express();
app.use(bodyParser.json({
  limit: '16mb'
}));
app.use(methodOverride('X-HTTP-Method-Override'));

let Worker = process.env.LAMBDA ? require('./Local') : require('./Thread');

app.post('/worker/:worker', (req, res, next) => {
  if (!req.query.key || req.query.key !== process.env.KEY) {
    return res.status(401).send('Unauthorized');
  }
  return next();
}, (req, res) => {
  if (!req.params.worker || !Worker.Tasks.hasOwnProperty(req.params.worker)) {
    return res.status(400).send('Unknown worker');
  }

  try {
    new Worker(Worker.Tasks[req.params.worker]).start(req.body).then((response) => {
      res.json(response);
    }).catch((error) => {
      res.status(400).send(error.message);
    });
  }
  catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = app;
