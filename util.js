const _ = require('lodash');
const moment = require('moment');
const FormioUtils = require('formiojs/utils').default;
const Utils = {
  flattenComponentsForRender(components) {
    const flattened = {};
    FormioUtils.eachComponent(components, function(component, path) {
      // Containers will get rendered as flat.
      if (
        (component.type === 'container') ||
        (component.type === 'button') ||
        (component.type === 'hidden')
      ) {
        return;
      }

      flattened[path] = component;

      if (['datagrid', 'editgrid'].includes(component.type)) {
        return true;
      }
    });
    return flattened;
  },

  renderFormSubmission(data, components) {
    const comps = this.flattenComponentsForRender(components);
    let submission = '<table border="1" style="width:100%">';
    _.each(comps, function(component, key) {
      const cmpValue = this.renderComponentValue(data, key, comps);
      if (typeof cmpValue.value === 'string') {
        submission += '<tr>';
        submission += `<th style="padding: 5px 10px;">${cmpValue.label}</th>`;
        submission += `<td style="width:100%;padding:5px 10px;">${cmpValue.value}</td>`;
        submission += '</tr>';
      }
    }.bind(this));
    submission += '</table>';
    return submission;
  },

  /**
   * Renders a specific component value, which is also able
   * to handle Containers, Data Grids, as well as other more advanced
   * components such as Signatures, Dates, etc.
   *
   * @param data
   * @param key
   * @param components
   * @returns {{label: *, value: *}}
   */
  /* eslint-disable max-statements */
  renderComponentValue(data, key, components) {
    let value = _.get(data, key);
    if (!value) {
      value = '';
    }
    const compValue = {
      label: key,
      value: value
    };
    if (!components.hasOwnProperty(key)) {
      return compValue;
    }
    const component = components[key];
    compValue.label = component.label || component.placeholder || component.key;
    if (component.multiple) {
      components[key].multiple = false;
      compValue.value = _.map(value, function(subValue) {
        const subValues = {};
        subValues[key] = subValue;
        return this.renderComponentValue(subValues, key, components).value;
      }.bind(this)).join(', ');
      return compValue;
    }

    switch (component.type) {
      case 'password':
        compValue.value = '--- PASSWORD ---';
        break;
      case 'address':
        compValue.value = compValue.value ? compValue.value.formatted_address : '';
        break;
      case 'signature':
        // For now, we will just email YES or NO until we can make signatures work for all email clients.
        compValue.value = ((typeof value === 'string') && (value.indexOf('data:') === 0)) ? 'YES' : 'NO';
        break;
      case 'container':
        compValue.value = '<table border="1" style="width:100%">';
        _.each(value, function(subValue, subKey) {
          const subCompValue = this.renderComponentValue(value, subKey, components);
          if (typeof subCompValue.value === 'string') {
            compValue.value += '<tr>';
            compValue.value += `<th style="text-align:right;padding: 5px 10px;">${subCompValue.label}</th>`;
            compValue.value += `<td style="width:100%;padding:5px 10px;">${subCompValue.value}</td>`;
            compValue.value += '</tr>';
          }
        }.bind(this));
        compValue.value += '</table>';
        break;
      case 'editgrid':
      case 'datagrid': {
        const columns = this.flattenComponentsForRender(component.components);
        compValue.value = '<table border="1" style="width:100%">';
        compValue.value += '<tr>';
        _.each(columns, function(column) {
          const subLabel = column.label || column.key;
          compValue.value += `<th style="padding: 5px 10px;">${subLabel}</th>`;
        });
        compValue.value += '</tr>';
        _.each(value, function(subValue) {
          compValue.value += '<tr>';
          _.each(columns, function(column, key) {
            const subCompValue = this.renderComponentValue(subValue, key, columns);
            if (typeof subCompValue.value === 'string') {
              compValue.value += '<td style="padding:5px 10px;">';
              compValue.value += subCompValue.value;
              compValue.value += '</td>';
            }
          }.bind(this));
          compValue.value += '</tr>';
        }.bind(this));
        compValue.value += '</table>';
        break;
      }
      case 'datetime': {
        let dateFormat = '';
        if (component.enableDate) {
          dateFormat = component.format.toUpperCase();
        }
        if (component.enableTime) {
          dateFormat += ' hh:mm:ss A';
        }
        if (dateFormat) {
          compValue.value = moment(value).format(dateFormat);
        }
        break;
      }
      case 'radio':
      case 'select': {
        let values = [];
        if (component.hasOwnProperty('values')) {
          values = component.values;
        }
        else if (component.hasOwnProperty('data') && component.data.values) {
          values = component.data.values;
        }
        for (const i in values) {
          const subCompValue = values[i];
          if (subCompValue.value === value) {
            compValue.value = subCompValue.label;
            break;
          }
        }
        break;
      }
      case 'selectboxes': {
        const selectedValues = [];
        for (const j in component.values) {
          const selectBoxValue = component.values[j];
          if (value[selectBoxValue.value]) {
            selectedValues.push(selectBoxValue.label);
          }
        }
        compValue.value = selectedValues.join(',');
        break;
      }
      case 'file': {
        if (!compValue.value) {
          compValue.value = '';
        }
        else {
          const {
            originalName,
            url,
          } = Array.isArray(compValue.value) ? compValue.value[0] : compValue.value;
          compValue.value = `<a href="${url}" target="_blank">${originalName}</a>`;
        }
        break;
      }
      default:
        if (!component.input) {
          return {value: false};
        }
        break;
    }

    if (component.protected) {
      compValue.value = '--- PROTECTED ---';
    }

    // Ensure the value is a string.
    compValue.value = compValue.value ? compValue.value.toString() : '';
    return compValue;
  },
  /* eslint-enable max-statements */
};

module.exports = Utils;
