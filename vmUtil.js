'use strict';

const {Isolate} = require('isolated-vm');

async function _transfer(key, value, dest, visited, c) {
  // Handle circular links
  if (visited.has(value)) {
    await c.evalClosure(`${dest}['${key}'] = eval($0)`, [visited.get(value)]);
    return;
  }

  // Handle functions and primitives
  if (typeof value !== 'object' || value === null) {
    await c.evalClosure(`${dest}['${key}'] = $0`, [value]);
    if (typeof value === 'function') {
      // Bind functions
      await c.evalClosure(`${dest}['${key}'] = ${dest}['${key}'].bind(${dest})`, []);
    }
    // Handle primitives
    if (
      value === null ||
      value === undefined ||
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'undefined'
    ) {
      // Primitives are transferable
      return;
    }
  }
  // Handle arrays
  else if (value instanceof Array) {
    await c.evalClosure(`${dest}['${key}'] = []`, []);
  }
  // Handle objects
  else if (typeof value === 'object') {
    await c.evalClosure(`${dest}['${key}'] = {}`, []);
    // Transfer prototype
    for (let p in value.__proto__) {
      await c.evalClosure(`${dest}['${key}']['${p}'] = $0`, [value.__proto__[p]])
    }
  }

  // Add to map for resolving circluar links
  visited.set(value, `${dest}['${key}']`);
  // Recursive call on child properties
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
  // Handle circular links
  if (visited.has(value)) {
    c.evalClosureSync(`${dest}['${key}'] = eval($0)`, [visited.get(value)]);
    return;
  }

  // const ref = parentRef.getSync(key, {reference: true});

  // Handle function
  if (typeof value === 'function') {
    // Bind functions
    c.evalClosureSync(`${dest}['${key}'] = $0`, [value]);
  }
  // Handle primitives
  else if (typeof value !== 'object' || value === null) {
    c.evalClosureSync(`${dest}['${key}'] = $0`, [value]);
    // Handle primitives
    if (
      value === null ||
      value === undefined ||
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'undefined'
    ) {
      // Primitives are transferable
      return;
    }
  }
  // Handle arrays
  else if (value instanceof Array) {
    c.evalClosureSync(`${dest}['${key}'] = []`, []);
  }
  // Handle objects
  else if (typeof value === 'object') {
    c.evalClosureSync(`${dest}['${key}'] = {}`, []);
    // Transfer prototype
    for (let p in value.__proto__) {
      if (typeof value.__proto__[p] === 'function') {
        // TODO: check which isolate is used for executing callbacks
        c.evalClosureSync(`${dest}['${key}']['${p}'] = $0`, [(...args) => value.__proto__[p].apply(value, args)])
      }
      else {
        c.evalClosureSync(`${dest}['${key}']['${p}'] = $0`, [value.__proto__[p]]);
      }
    }
  }

  // Add to map for resolving circluar links
  visited.set(value, `${dest}['${key}']`);
  // Recursive call on child properties
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
