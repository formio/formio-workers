const vm = require('vm');
module.exports = (worker, done) => {
  require('./nunjucks')(worker)
    .then((nunjucks) => {
      const script = new vm.Script(nunjucks.script);

      try {
        script.runInContext(vm.createContext(nunjucks.context), {timeout: 15000});
      }
      catch (e) {
        console.log(e.message);
        console.log(e.stack);
        return done({resolve: null});
      }

      return done({resolve: nunjucks.context.output});
    });
};
