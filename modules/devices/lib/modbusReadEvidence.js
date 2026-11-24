// @ts-check
'use strict';

// Keep proof local to the actual snapshot. It cannot survive JSON/cache copies,
// and does not add data points or change the enumerable measurement contract.
/** @type {WeakMap<object, Map<string, object>>} */
const responses = new WeakMap();

/** Record only decoded values from one completed, validated register response.
 * @param {object} values @param {string[]} ids @returns {void}
 */
function recordReadResponse(values, ids) {
  let samples = responses.get(values);
  if (!samples) { samples = new Map(); responses.set(values, samples); }
  const response = {};
  for (const id of ids) samples.set(id, response);
}

/** A poll can contain several replies, including adaptive split fallback.
 * Context-sensitive registers must originate in the same actual response.
 * @param {object} values @param {string} target @param {string} context @returns {boolean}
 */
function hasSameReadResponse(values, target, context) {
  const samples = responses.get(values);
  const response = samples?.get(target);
  return !!response && response === samples?.get(context);
}

module.exports = { recordReadResponse, hasSameReadResponse };
