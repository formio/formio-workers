const _ = require('lodash');
const moment = require('moment');
const FormioUtils = require('formiojs/utils').default;
const Utils = {
  flattenComponentsForRender(components) {
    const flattened = {};

    FormioUtils.eachComponent(components, (component, path) => {
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

  renderFormSubmission(data, formInstance) {
    return formInstance.getView(formInstance.data, {
      email: true,
    });
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
      value,
    };
    if (!components.hasOwnProperty(key)) {
      return compValue;
    }
    const component = components[key];
    compValue.label = component.label || component.placeholder || component.key;
    if (component.multiple) {
      components[key].multiple = false;
      compValue.value = _.map(value, (subValue) => {
        const subValues = {};
        subValues[key] = subValue;
        return this.renderComponentValue(subValues, key, components).value;
      }).join(', ');
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
        compValue.value = (_.isString(value) && value.startsWith('data:')) ? 'YES' : 'NO';
        break;
      case 'container':
        compValue.value = '<table border="1" style="width:100%">';
        _.each(value, (subValue, subKey) => {
          const subCompValue = this.renderComponentValue(value, subKey, components);
          if (_.isString(subCompValue.value)) {
            compValue.value += '<tr>';
            compValue.value += `<th style="text-align:right;padding: 5px 10px;">${subCompValue.label}</th>`;
            compValue.value += `<td style="width:100%;padding:5px 10px;">${subCompValue.value}</td>`;
            compValue.value += '</tr>';
          }
        });
        compValue.value += '</table>';
        break;
      case 'editgrid':
      case 'datagrid': {
        const columns = this.flattenComponentsForRender(component.components);
        compValue.value = '<table border="1" style="width:100%">';
        compValue.value += '<tr>';
        _.each(columns, (column) => {
          const subLabel = column.label || column.key;
          compValue.value += `<th style="padding: 5px 10px;">${subLabel}</th>`;
        });
        compValue.value += '</tr>';
        _.each(value, (subValue) => {
          compValue.value += '<tr>';
          _.each(columns, (column, key) => {
            const subCompValue = this.renderComponentValue(subValue, key, columns);
            if (typeof subCompValue.value === 'string') {
              compValue.value += '<td style="padding:5px 10px;">';
              compValue.value += subCompValue.value;
              compValue.value += '</td>';
            }
          });
          compValue.value += '</tr>';
        });
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
        const file = Array.isArray(compValue.value) ? compValue.value[0] : compValue.value;
        if (file) {
          compValue.value = `<a href="${file.url}" target="_blank" download="${file.originalName}">${file.originalName}</a>`;
        }
        else {
          compValue.value = '';
        }
        break;
      }
      case 'survey': {
        compValue.value = '<table border="1" style="width:100%">';

        compValue.value += `
          <thead>
            <tr>
              <th>Question</th>
              <th>Value</th>
            </tr>
          </thead>
        `;

        compValue.value += '<tbody>';
        _.forIn(value, (value, key) => {
          const question = _.find(component.questions, ['value', key]);
          const answer = _.find(component.values, ['value', value]);

          if (!question || !answer) {
            return;
          }

          compValue.value += '<tr>';
          compValue.value += `<td style="text-align:center;padding: 5px 10px;">${question.label}</td>`;
          compValue.value += `<td style="text-align:center;padding: 5px 10px;">${answer.label}</td>`;
          compValue.value += '</tr>';
        });
        compValue.value += '</tbody></table>';

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
    compValue.value = compValue.value
      ? (_.isObject(compValue.value) ? JSON.stringify(compValue.value) : compValue.value.toString())
      : '';

    return compValue;
  },
  /* eslint-enable max-statements */
};

module.exports = Utils;
