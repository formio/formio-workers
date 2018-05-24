require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const app = express();
app.use(bodyParser.json({
  limit: '16mb'
}));
app.use(methodOverride('X-HTTP-Method-Override'));
const Thread = require('formio/src/worker/Thread');

app.post('worker/:worker', (req, res, next) => {
  if (!req.query.key || req.query.key !== process.env.KEY) {
    return res.status(401).send('Unauthorized');
  }
  return next();
}, (req, res) => {
  if (!req.params.worker || Thread.Tasks.hasOwnProperty(req.params.worker)) {
    return res.status(400).send('Unknown worker');
  }

  try {
    new Thread(Thread.Tasks[req.params.worker]).start(req.body).then((response) => {
      res.json(response);
    }).catch((error) => {
      res.status(400).send(error);
    });
  }
  catch (err) {
    res.status(500).send(err);
  }
});

app.listen(process.env.PORT, () => console.log('Template Service Listening on ' + process.env.PORT));

