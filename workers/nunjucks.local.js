'use strict';

module.exports = (worker, done) => {
  const nunjucks = require('./nunjucks')(worker);
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
  catch (err) {
    console.log(err.message);
    console.log(err.stack);
    return done({error: err, resolve: null});
  }
  return done({resolve: result});
};
