const Worker  = require('./Worker');
const Tasks = {
  nunjucks: `./workers/nunjucks.js`
};
class Local {
  constructor(task) {
    this.task = Tasks[task] ? Tasks[task] : '';
  }

  async start(data) {
    if (!this.task) {
      return 'Unknown worker';
    }
    // Stringify all custom functions and let the thread know, since you cant pass functions to a child process.
    const functions = [];
    Object.keys(data.context || {}).forEach(key => {
      if (typeof data.context[key] === 'function') {
        data.context[key] = data.context[key].toString();
        functions.push(key);
      }
    });
    data._functions = functions;
    return Worker(this.task, data);
  }
}

module.exports = Local;
