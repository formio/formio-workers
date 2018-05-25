class Local {
  constructor(task) {
    this.task = require('./workers/' + task);
  }

  start(data) {
    return new Promise((resolve, reject) => {
      this.task(data, (result) => {
        if (result.resolve) {
          return resolve(result.resolve);
        }
        else {
          return reject('An error occurred within worker');
        }
      });
    });
  }
}

Local.Tasks = {
  nunjucks: 'nunjucks.local.js'
};

module.exports = Local;
