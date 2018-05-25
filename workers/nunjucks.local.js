'use strict';

module.exports = (worker, done) => {
  const nunjucks = require('./nunjucks')(worker);
  const clone = require('clone');
  const script = new Function('clone', 'environment', 'input', 'context', 'output', `${nunjucks.script};return output`);
  let result = null;
  try {
    result = script(
      nunjucks.context.clone,
      nunjucks.context.environment,
      nunjucks.context.input,
      nunjucks.context.context,
      nunjucks.context.output,
    );
  }
  catch (e) {
    console.log(e.message);
    console.log(e.stack);
    return done({resolve: null});
  }
  return done({resolve: result});
};
