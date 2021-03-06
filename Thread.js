'use strict';

const path = require('path');
const Threads = require('threads');
const config = Threads.config;
const Spawn = Threads.spawn;

config.set({
  basepath: {
    node: path.join(__dirname, 'workers')
  }
});

class Thread {
  constructor(task) {
    this.task = task;

    let options = undefined;
    // Check if debug is an argument.
    if (process.execArgv.reduce((prev, cur) => (prev || cur.indexOf('--debug') !== -1), false)) {
      options = {execArgv: [`--debug=${Math.floor(Math.random() * (65535 - 1025)) + 1024}`]};
    }

    this._thread = new Spawn(task, [], options);
  }

  start(data) {
    // Stringify all custom functions and let the thread know, since you cant pass functions to a child process.
    const functions = [];
    Object.keys(data.context || {}).forEach(key => {
      if (typeof data.context[key] === 'function') {
        data.context[key] = data.context[key].toString();
        functions.push(key);
      }
    });
    data._functions = functions;

    return new Promise((resolve, reject) => {
      this._thread.send(data)
      .on('message', message => {
        // Kill the worker process.
        this._thread.kill();

        if (message.hasOwnProperty('resolve')) {
          return resolve(message.resolve);
        }
        if (message.hasOwnProperty('reject')) {
          return reject(message.reject);
        }

        return reject(new Error(`Unknown response given from child thread of ${this.task}`));
      })
      .on('error', error => {
        this._thread.kill();
        return reject(error);
      })
      .on('exit', response => {
        this._thread.kill();
      });
    });
  }
}

Thread.Tasks = {
  nunjucks: 'nunjucks.worker.js'
};

module.exports = Thread;
