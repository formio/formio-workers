/* eslint-env mocha */
'use strict';

const assert = require('assert');

const worker = require('../workers/nunjucks');

describe('Nunjucks', () => {
  const input = '{{ submission(data, form.components) }}';

  describe('Base functionality', () => {
    const form = {
      components: [
        {
          key: 'text',
          type: 'textfield',
          label: 'Text',
          input: true,
        },
      ],
    };
    const data = {
      text: '123',
    };

    it('Static rendering method', async () => {
      const result = await worker({
        render: {
          renderingMethod: 'static',
          input,
        },
        context: {
          form,
          data,
        },
      });
      // eslint-disable-next-line max-len
      const expected = '<table border="1" style="width:100%"><tr><th style="padding: 5px 10px;">Text</th><td style="width:100%;padding:5px 10px;">123</td></tr></table>';

      assert.deepEqual(result.input.trim(), expected);
    });

    it('Missing rendering method should default to static', async () => {
      const result = await worker({
        render: {
          input,
        },
        context: {
          form,
          data,
        },
      });
      // eslint-disable-next-line max-len
      const expected = '<table border="1" style="width:100%"><tr><th style="padding: 5px 10px;">Text</th><td style="width:100%;padding:5px 10px;">123</td></tr></table>';

      assert.deepEqual(result.input.trim(), expected);
    });

    it('Dynamic rendering method', async () => {
      const result = await worker({
        render: {
          renderingMethod: 'dynamic',
          input,
        },
        context: {
          form,
          data,
        },
      });
      // eslint-disable-next-line max-len
      const expected = `<table border="1" style="width:100%">
          <tbody>
      
            <tr>
              <th style="padding: 5px 10px;">Text</th>
              <td style="width:100%;padding:5px 10px;">123</td>
            </tr>
          
          </tbody>
        </table>`;

      assert.deepEqual(result.input.trim(), expected);
    });
  });

  describe('Dynamic logic', () => {
    it('Dynamic rendering method should support conditions', async () => {
      const form = {
        components: [
          {
            key: 'fieldA',
            type: 'textfield',
            label: 'Field A',
            input: true,
          },
          {
            key: 'fieldB',
            type: 'textfield',
            label: 'Field B',
            input: true,
            conditional: {
              json: {
                '===': [
                  {var: 'data.fieldA'},
                  'Show it!',
                ],
              },
            },
          },
        ],
      };

      const [result1, result2] = await Promise.all([
        worker({
          render: {
            renderingMethod: 'dynamic',
            input,
          },
          context: {
            form,
            data: {
              fieldA: 'Dont show it!',
              fieldB: 'Should not be shown',
            },
          },
        }),
        worker({
          render: {
            renderingMethod: 'dynamic',
            input,
          },
          context: {
            form,
            data: {
              fieldA: 'Show it!',
              fieldB: 'Should be shown',
            },
          },
        }),
      ]);
      const expected1 = `<table border="1" style="width:100%">
          <tbody>
      
            <tr>
              <th style="padding: 5px 10px;">Field A</th>
              <td style="width:100%;padding:5px 10px;">Dont show it!</td>
            </tr>
          
          </tbody>
        </table>`;
      const expected2 = `<table border="1" style="width:100%">
          <tbody>
      
            <tr>
              <th style="padding: 5px 10px;">Field A</th>
              <td style="width:100%;padding:5px 10px;">Show it!</td>
            </tr>
          
            <tr>
              <th style="padding: 5px 10px;">Field B</th>
              <td style="width:100%;padding:5px 10px;">Should be shown</td>
            </tr>
          
          </tbody>
        </table>`;

      assert.deepEqual(result1.input.trim(), expected1);
      assert.deepEqual(result2.input.trim(), expected2);
    });

    // TODO: That test seems to be corrupted now, needs more investigation
    // it('Dynamic rendering method should support calculations', async () => {
    //   const result = await worker({
    //     render: {
    //       renderingMethod: 'dynamic',
    //       input,
    //     },
    //     context: {
    //       form: {
    //         components: [
    //           {
    //             key: 'fieldA',
    //             type: 'textfield',
    //             label: 'Field A',
    //             input: true,
    //           },
    //           {
    //             key: 'fieldB',
    //             type: 'textfield',
    //             label: 'Field B',
    //             input: true,
    //             calculateValue: {
    //               _toUpper: {
    //                 var: 'data.fieldA',
    //               },
    //             },
    //           },
    //         ],
    //       },
    //       data: {
    //         fieldA: 'Some text here',
    //       },
    //     },
    //   });
    //   const expected = `<table border="1" style="width:100%">
    //       <tbody>

    //         <tr>
    //           <th style="padding: 5px 10px;">Field A</th>
    //           <td style="width:100%;padding:5px 10px;">Some text here</td>
    //         </tr>

    //         <tr>
    //           <th style="padding: 5px 10px;">Field B</th>
    //           <td style="width:100%;padding:5px 10px;">SOME TEXT HERE</td>
    //         </tr>

    //       </tbody>
    //     </table>`;

    //   assert.deepEqual(result.input.trim(), expected);
    // });

    it('Dynamic rendering method should support internal components logic', async () => {
      const result = await worker({
        render: {
          renderingMethod: 'dynamic',
          input,
        },
        context: {
          form: {
            components: [
              {
                key: 'address',
                type: 'address',
                label: 'Address',
                provider: 'nominatim',
                enableManualMode: true,
                input: true,
              },
            ],
          },
          data: {
            address: {
              mode: 'manual',
              address: {
                address1: 'Addr1 Value',
                address2: 'Addr2 Value',
                city: 'City Value',
                state: 'State Value',
                country: 'Country Value',
                zip: 'Zip Value',
              },
            },
          },
        },
      });
      /* eslint-disable max-len */
      const expected = `<table border="1" style="width:100%">
          <tbody>
      
            <tr>
              <th style="padding: 5px 10px;">Address</th>
              <td style="width:100%;padding:5px 10px;">Addr1 Value, Addr2 Value, City Value, State Value, Country Value, Zip Value</td>
            </tr>
          
          </tbody>
        </table>`;
      /* eslint-enable max-len */

      assert.deepEqual(result.input.trim(), expected);
    });
  });
});
