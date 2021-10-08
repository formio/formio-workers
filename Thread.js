'use strict';

const Worker  = require('./Worker');
const Tasks = {
  nunjucks: `./workers/nunjucks.js`
};
class Local {
  constructor(task) {
    this.task = Tasks[task] || '';
  }

  async start(data) {
    if (!this.task) {
      return 'Unknown worker';
    }
    return Worker(this.task, data);
  }
}

module.exports = Local;
