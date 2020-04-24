'use strict';
const nunjucks = require('nunjucks');
const dateFilter = require('nunjucks-date-filter');
const _ = require('lodash');
const vm = require('vm');

const util = require('../util');

const macros = require('./macros/macros');

// Define a few global noop placeholder shims and import the component classes
global.Text              = class {};
global.HTMLElement       = class {};
global.HTMLCanvasElement = class {};
global.navigator         = {userAgent: ''};
global.document          = {
  createElement: () => ({}),
  cookie: '',
  getElementsByTagName: () => [],
  documentElement: {style: []},
};
global.window            = {addEventListener: () => {}, Event: {}, navigator: global.navigator};
const Formio = require('formiojs/formio.form.js');

// Remove onChange events from all renderer displays.
_.each(Formio.Displays.displays, (display) => {
  display.prototype.onChange = _.noop;
});

Formio.Utils.Evaluator.noeval = true;
Formio.Utils.Evaluator.evaluator = function(func, args) {
  return function() {
    const params = _.keys(args);
    const sandbox = vm.createContext({
      result: null,
      args,
    });
    /* eslint-disable no-empty */
    try {
      const script = new vm.Script(`result = (function({${params.join(',')}}) {${func}})(args);`);
      script.runInContext(sandbox, {
        timeout: 250
      });
    }
    catch (err) {}
    /* eslint-enable no-empty */
    return sandbox.result;
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

environment.addFilter('submissionTable', (obj, components) =>
  new nunjucks.runtime.SafeString(util.renderFormSubmission(obj, components))
);

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

module.exports = (worker) => {
  const filters = worker.filters || {};
  Object.keys(filters).forEach((filter) => {
    try {
      // Essentially eval, but it only gets executed in a vm within a child process.
      environment.addFilter(filter, new Function(`return ${filters[filter].toString()}`)());
    }
    catch (e) {
      // TODO: Add user logs to fix issues with email templates.
      /* eslint-disable no-console */
      console.log(e);
      /* eslint-enable no-console */
    }
  });

  const getScript = (data) => (
    _.isString(data)
      // Script to render a single string.
      ? (`
          environment.params = clone(context);
          if (context._private) {
            delete context._private;
          }
          output = environment.renderString(input, context);
      `)

    // Script to render an object of properties.
      : (`
          environment.params = clone(context);
          if (context._private) {
            delete context._private;
          }
          context._rendered = {};
          for (let prop in input) {
            if (input.hasOwnProperty(prop)) {
              var macros = '';
              var template = input[prop];
              if (prop === 'html') {
                macros = context.macros;
                if (template.substr(0, 29) !== '{% macro dataValue(dValue) %}') {
                  template = environment.renderString(macros + template, context);
                }
                else {
                  template = environment.renderString(template, context);
                }
              }
              context._rendered[prop] = output[prop] = environment.renderString(macros + template, context);
            }
          }
      `)
  );

  const {
    render,
    context = {},
    _functions: functions = [],
  } = worker;
  context.macros = macros;

  // Convert all toString functions back to functions.
  functions.forEach((key) => {
    context[key] = new Function(`return ${context[key].toString()}`)();
  });

  // Build the sandbox context with our dependencies
  let unsetsEnabled = false;
  return Formio.Formio.createForm(context.form, {
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
          unsets.push({key, data});
        }
        return value;
      }
    }
  })
    .then((form) => {
      // Set the submission data
      form.data = context.data;

      // Perform calculations and conditions.
      form.calculateValue();
      form.checkConditions();

      // Reset the data
      form.data = {};

      // Set the value to the submission.
      unsetsEnabled = true;
      form.setValue({
        data: context.data,
      }, {
        sanitize: true
      });

      return {
        script: getScript(render),
        context: {
          clone: _.cloneDeep.bind(_),
          formInstance: form,
          environment,
          input: render,
          context: {
            ...context,
            formInstance: form,
          },
          output: (_.isString(render) ? '' : {}),
        },
      };
    });
};
