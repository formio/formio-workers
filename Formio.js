'use strict';

require('./workers/util');
const _ = require('lodash');
const vmUtil = require('./vmUtil');
const {Isolate} = require('./vmUtil');

const isolate = new Isolate({memoryLimit: 8});
const context = isolate.createContextSync();
vmUtil.transferSync('result', null, context);

// Define a few global noop placeholder shims and import the component classes
global.Text              = class {};
global.HTMLElement       = class {};
global.HTMLCanvasElement = class {};
global.navigator         = {userAgent: ''};
global.document          = {
  createElement: () => ({}),
  cookie: '',
  getElementsByTagName: () => [],
  documentElement: {
    style: [],
    firstElementChild: {appendChild: () => {}}
  }
};
global.window            = {addEventListener: () => {}, Event: function() {}, navigator: global.navigator};
global.btoa = (str) => {
  return (str instanceof Buffer) ?
    str.toString('base64') :
    Buffer.from(str.toString(), 'binary').toString('base64');
};
global.self = global;
const Formio = require('formiojs/formio.form.js');
global.Formio = Formio.Formio;

const zones = require('moment-timezone/data/packed/latest.json');
Formio.Utils.moment.tz.load(zones);
Formio.Utils.moment.zonesLoaded = true;

// Remove onChange events from all renderer displays.
_.each(Formio.Displays.displays, (display) => {
  display.prototype.onChange = _.noop;
});

Formio.Utils.Evaluator.noeval = true;
Formio.Utils.Evaluator.evaluator = function(func, args) {
  return function() {
    let result = null;
    /* eslint-disable no-empty */
    try {
      vmUtil.freezeSync('args', args, context);
      result = context.evalSync(`result = (function({${_.keys(args).join(',')}}) {${func}})(args);`, {
        timeout: 250,
        copy: true
      });
    }
    catch (err) {}
    /* eslint-enable no-empty */
    return result;
  };
};

module.exports = Formio;
