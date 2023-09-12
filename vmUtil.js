'use strict';

const {Isolate} = require('isolated-vm');

async function _transfer(key, value, dest, visited, c) {
  if (visited.has(value)) {
    await c.evalClosure(`${dest}['${key}'] = eval($0)`, [visited.get(value)]);
    return;
  }

  if (typeof value !== 'object' || value === null) {
    await c.evalClosure(`${dest}['${key}'] = $0`, [value]);
    if (
      value === null ||
      value === undefined ||
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'undefined'
    ) {
      // primitives are transferable
      return;
    }
  }
  else if (value instanceof Object) {
    await c.evalClosure(`${dest}['${key}'] = {}`, []);
  }
  else if (value instanceof Array) {
    await c.evalClosure(`${dest}['${key}'] = []`, []);
  }

  visited.set(value, `${dest}['${key}']`);

  for (const p of Object.keys(value)) {
    await _transfer(p, value[p], `${dest}['${key}']`, visited, c);
  }
}

async function transfer(name, value, context) {
  await _transfer(name, value, 'globalThis', new Map(), context);
}

async function freeze(name, value, context) {
  await transfer(name, value, context);
  await context.evalClosure(`Object.freeze(${name})`);
}

function _transferSync(key, value, dest, visited, c) {
  if (visited.has(value)) {
    c.evalClosureSync(`${dest}['${key}'] = eval($0)`, [visited.get(value)]);
    return;
  }

  if (typeof value !== 'object' || value === null) {
    c.evalClosureSync(`${dest}['${key}'] = $0`, [value]);
    if (
      value === null ||
      value === undefined ||
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'undefined'
    ) {
      // primitives are transferable
      return;
    }
  }
  else if (value instanceof Object) {
    c.evalClosureSync(`${dest}['${key}'] = {}`, []);
  }
  else if (value instanceof Array) {
    c.evalClosureSync(`${dest}['${key}'] = []`, []);
  }

  visited.set(value, `${dest}['${key}']`);
  for (const p of Object.keys(value)) {
    _transferSync(p, value[p], `${dest}['${key}']`, visited, c);
  }
}

function transferSync(name, value, context) {
   _transferSync(name, value, 'globalThis', new Map(), context);
}

function freezeSync(name, value, context) {
  transferSync(name, value, context);
  context.evalClosureSync(`Object.freeze(${name})`);
}

module.exports = {
  transfer,
  freeze,
  transferSync,
  freezeSync,
  Isolate
};
