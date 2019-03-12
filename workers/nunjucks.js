'use strict';
const nunjucks = require('nunjucks');
const dateFilter = require('nunjucks-date-filter');
const _ = require('lodash');
const util = require('../util');
const macros = require('./macros/macros');

// Configure nunjucks to not watch any files
const environment = nunjucks.configure([], {
  watch: false,
  autoescape: false
});

environment.addFilter('is_string', function(obj) {
  return _.isString(obj);
});

environment.addFilter('is_array', function(obj) {
  return _.isArray(obj);
});

environment.addFilter('is_object', function(obj) {
  return _.isPlainObject(obj);
});

environment.addFilter('date', dateFilter);

environment.addFilter('submissionTable', function(obj, components) {
  return new nunjucks.runtime.SafeString(util.renderFormSubmission(obj, components));
});

environment.addFilter('componentValue', function(obj, key, components) {
  const compValue = util.renderComponentValue(obj, key, components);
  return new nunjucks.runtime.SafeString(compValue.value);
});

environment.addFilter('componentLabel', function(key, components) {
  let label = key;
  if (!components.hasOwnProperty(key)) {
    return label;
  }
  const component = components[key];
  label = component.label || component.placeholder || component.key;
  return label;
});

module.exports = (worker) => {
  const filters = worker.filters || {};
  Object.keys(filters).forEach(filter => {
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

  const getScript = (data) => {
    if (typeof data === 'string') {
      // Script to render a single string.
      return `
        environment.params = clone(context);
        if (context._private) {
          delete context._private;
        }
        output = environment.renderString(input, context);
      `;
    }

    // Script to render an object of properties.
    return `
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
    `;
  };

  const render = worker.render;
  const context = worker.context || {};
  context.macros = macros;

  // Convert all toString functions back to functions.
  const functions = worker._functions || [];
  functions.forEach(key => {
    context[key] = new Function(`return ${context[key].toString()}`)();
  });

  // Build the sandbox context with our dependencies
  return {
    script: getScript(render),
    context: {
      clone: _.cloneDeep.bind(_),
      environment,
      input: render,
      context,
      output: (typeof render === 'string' ? '' : {})
    }
  };
};

