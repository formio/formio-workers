'use strict';
const nunjucks = require('nunjucks');
const dateFilter = require('nunjucks-date-filter');
const _ = require('lodash');
const util = require('./util');
const macros = require('./macros/macros');
const { VM } = require('vm2');

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
  const getScript = (data) => {
    if (typeof data === 'string') {
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

  const render = worker.render;
  const context = worker.context || {};
  if (context._private) {
    delete context._private;
  }
  context.macros = macros;
  context.renderValue = function(value, data) {
    return value.toString().replace(/({{\s*(.*?)\s*}})/g, (match, $1, $2) => {
      let dataPath = $2;
      if ($2.indexOf('?') !== -1) {
          dataPath = $2.replace(/\?\./g, '.');
      }
      return _.get(data, dataPath);
    });
  };
  context.sanitize = function(input) {
    // Strip away macros and escape breakout attempts.
    return input
      .replace(/{%\s*macro[^%]*%}/g, '')
      .replace(/{{(.*(\.constructor|\]\().*)}}/g, '{% raw %}{{$1}}{% endraw %}');
  };

  let output = '';
  const vm = (new VM({
    timeout: 15000,
    sandbox: {
      input: render,
      output: (typeof render === 'string' ? '' : {})
    },
    fixAsync: true
  }))

  vm.freeze(environment, 'environment');
  vm.freeze(context, 'context');

  try {
    output = vm.run(getScript(render));
  }
  catch (e) {
    console.log(e.message);
    console.log(e.stack);
    output = e.message;
  }

  return output;
};

