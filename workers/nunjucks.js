'use strict';

const nunjucks = require('nunjucks');
const dateFilter = require('nunjucks-date-filter');
const _ = require('lodash');
const util = require('./util');
const macros = require('./macros/macros');
const vmUtil = require('vm-utils');
const {Isolate} = require('vm-utils');
const Formio = require('../Formio');

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
      output = unescape(environment.renderString(sanitize(input), context));
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
          rendered[prop] = unescape(environment.renderString(context.macros + sanitize(rendered[prop]), context));
        }
        rendered[prop] = unescape(environment.renderString(context.macros + sanitize(rendered[prop]), context));
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

  // Strip away macros and escape breakout attempts.
  const sanitize = (input) => input
    .replace(/{{(.*(\.constructor|\]\().*)}}/g, '{% raw %}{{$1}}{% endraw %}');

  // Unescape HTML sequences
  const unescape = (str) => str
    .replace(/&lt;/g , '<')
    .replace(/&gt;/g , '>')
    .replace(/&quot;/g , '\"')
    .replace(/&#39;/g , '\'')
    .replace(/&amp;/g , '&');

  const isolate = new Isolate({memoryLimit: 8});
  const isolateContext = isolate.createContextSync();
  vmUtil.transferSync('input', render, isolateContext);
  vmUtil.transferSync('output', (typeof render === 'string' ? '' : {}), isolateContext);
  vmUtil.freezeSync('environment', environment, isolateContext);
  vmUtil.freezeSync('sanitize', sanitize, isolateContext);
  vmUtil.freezeSync('unescape', unescape, isolateContext);

  let renderMethod = 'static';
  if (process.env.RENDER_METHOD) {
    renderMethod = process.env.RENDER_METHOD;
  }
  else if (render && render.renderingMethod) {
    renderMethod = render.renderingMethod;
  }
  if (renderMethod === 'static') {
    vmUtil.transferSync('context', context, isolateContext);

    try {
      const script = getScript(render);
      return Promise.resolve(isolateContext.evalSync(script, {timeout: 15000, copy: true}));
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

  try {
    const {premium} = require('@formio/premium/dist/premium-server.min.js');

    if (premium) {
      Formio.Formio.use(premium);
    }
  } catch {} // Skip connecting premium components if this file does not exist

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
      vmUtil.transferSync('context', context, isolateContext);

      try {
        return Promise.resolve(isolateContext.evalSync(getScript(render), {timeout: 15000, copy: true}));
      }
      catch (e) {
        console.log(e.message);
        console.log(e.stack);
        return Promise.resolve(e.message);
      }
    });
};

