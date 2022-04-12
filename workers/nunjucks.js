'use strict';

const nunjucks = require('nunjucks');
const dateFilter = require('nunjucks-date-filter');
const _ = require('lodash');
const util = require('./util');
const macros = require('./macros/macros');
const {VM} = require('vm2');

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

// Remove onChange events from all renderer displays.
_.each(Formio.Displays.displays, (display) => {
  display.prototype.onChange = _.noop;
});

const vm = new VM({
  timeout: 250,
  sandbox: {
    result: null,
  },
  fixAsync: true
});

Formio.Utils.Evaluator.noeval = true;
Formio.Utils.Evaluator.evaluator = function(func, args) {
  return function() {
    let result = null;
    /* eslint-disable no-empty */
    try {
      vm.freeze(args, 'args');

      result = vm.run(`result = (function({${_.keys(args).join(',')}}) {${func}})(args);`);
    }
    catch (err) {}
    /* eslint-enable no-empty */
    return result;
  };
};

// Configure nunjucks to not watch any files
const environment = nunjucks.configure([], {
  watch: false,
  autoescape: false,
});

environment.addFilter('is_string', (obj) => _.isString(obj));

environment.addFilter('is_array', (obj) => _.isArray(obj));

environment.addFilter('is_object', (obj) => _.isPlainObject(obj));

environment.addFilter('date', dateFilter);

environment.addFilter('submissionTable', (obj, components, formInstance) => {
  const view = formInstance
    ? util.getEmailViewForSubmission(formInstance)
    : util.renderFormSubmission(obj, components);

  return new nunjucks.runtime.SafeString(view);
});

environment.addFilter('componentValue', (obj, key, components) => {
  const compValue = util.renderComponentValue(obj, key, components);
  return new nunjucks.runtime.SafeString(compValue.value);
});

environment.addFilter('componentLabel', (key, components) => {
  if (!components.hasOwnProperty(key)) {
    return key;
  }

  const component = components[key];
  return component.label || component.placeholder || component.key;
});

const getScript = (data) => {
  if (_.isString(data)) {
    // Script to render a single string.
    return `
      environment.params = context;
      output = environment.renderString(context.sanitize(input), context);
    `;
  }

  // Script to render an object of properties.
  return `
    environment.params = context;
    var rendered = {};
    for (let prop in input) {
      if (input.hasOwnProperty(prop)) {
        rendered[prop] = input[prop];
        if (prop === 'html') {
          rendered[prop] = environment.renderString(context.macros + context.sanitize(rendered[prop]), context);
        }
        rendered[prop] = environment.renderString(context.macros + context.sanitize(rendered[prop]), context);
      }
    }
    output = rendered;
  `;
};

module.exports = (worker) => {
  const {
    render,
    context = {},
  } = worker;

  if (context._private) {
    delete context._private;
  }

  context.macros = macros;

  context.renderValue = (value, data) => value
    .toString()
    .replace(/{{\s*(.*?)\s*}}/g, (match, $1) => _.get(data, $1.replaceAll('?.', '.')));

  // Strip away macros and escape breakout attempts.
  context.sanitize = (input) => input
    .replace(/{{(.*(\.constructor|\]\().*)}}/g, '{% raw %}{{$1}}{% endraw %}');

  const vm = new VM({
    timeout: 15000,
    sandbox: {
      input: render,
      output: (typeof render === 'string' ? '' : {})
    },
    fixAsync: true
  });

  vm.freeze(environment, 'environment');

  let renderMethod = 'static';
  if (process.env.RENDER_METHOD) {
    renderMethod = process.env.RENDER_METHOD;
  }
  else if (render && render.renderingMethod) {
    renderMethod = render.renderingMethod;
  }
  if (renderMethod === 'static') {
    vm.freeze(context, 'context');

    try {
      return Promise.resolve(vm.run(getScript(render)));
    }
    catch (e) {
      console.log(e.message);
      console.log(e.stack);
      return Promise.resolve(e.message);
    }
  }

  const unsets = [];
  const conditionallyInvisibleComponents = [];
  let unsetsEnabled = false;

  return Formio.Formio.createForm(context.form, {
    server: true,
    noDefaults: true,
    hooks: {
      setDataValue: function(value, key, data) {
        if (!unsetsEnabled) {
          return value;
        }

        // Check if this component is not persistent.
        if (this.component.hasOwnProperty('persistent') &&
          (!this.component.persistent || this.component.persistent === 'client-only')
        ) {
          unsets.push({key, data});
        }
        // Check if this component is conditionally hidden and does not set clearOnHide to false.
        else if (
          (!this.component.hasOwnProperty('clearOnHide') || this.component.clearOnHide) &&
          (!this.conditionallyVisible() || !this.parentVisible)
        ) {
          conditionallyInvisibleComponents.push({component: this, key, data});
        }
        else if (
          this.component.type === 'password' && value === this.defaultValue
        ) {
          unsets.push({key, data});
        }
        return value;
      }
    },
  })
    .then((form) => {
      // Set the submission data
      form.data = context.data;

      // Perform calculations and conditions.
      form.checkConditions();
      form.calculateValue();

      // Reset the data
      form.data = {};

      // Set the value to the submission.
      unsetsEnabled = true;
      form.setValue({
        data: context.data,
      }, {
        sanitize: true,
      });

      // Check the visibility of conditionally visible components after unconditionally visible
      _.forEach(conditionallyInvisibleComponents, ({component, key, data}) => {
        if (!component.conditionallyVisible() || !component.parentVisible) {
          unsets.push({key, data});
        }
      });

      unsets.forEach((unset) => _.unset(unset.data, unset.key));

      context.formInstance = form;
      vm.freeze(context, 'context');

      try {
        return Promise.resolve(vm.run(getScript(render)));
      }
      catch (e) {
        console.log(e.message);
        console.log(e.stack);
        return Promise.resolve(e.message);
      }
    });
};

