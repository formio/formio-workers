class Lambda {
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

Lambda.Tasks = {
  nunjucks: 'nunjucks.js'
};

module.exports = Lambda;
