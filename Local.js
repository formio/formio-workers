const workers = require('./workers');
class Local {
  constructor(task) {
    this.task = workers[task];
  }

  start(data) {
    return new Promise((resolve, reject) => {
      try {
        this.task(data, (result) => {
          if (result.resolve) {
            return resolve(result.resolve);
          }
          else {
            return reject(result.error);
          }
        });
      }
      catch (err) {
        resolve(err);
      }
    });
  }
}

Local.Tasks = {
  nunjucks: 'nunjucks.local.js'
};

module.exports = Local;
