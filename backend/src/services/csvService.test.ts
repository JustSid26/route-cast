import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCsv } from './csvService';

const HEADER = 'customer_name,address,latitude,longitude,weight,volume,priority';

test('parses valid rows', () => {
  const csv = `${HEADER}\nAcme,MG Road,12.97,77.59,100,1.2,2`;
  const r = validateCsv(csv);
  assert.equal(r.rows, 1);
  assert.equal(r.valid.length, 1);
  assert.equal(r.errors.length, 0);
  assert.equal(r.valid[0].customer_name, 'Acme');
});

test('flags out-of-range coordinates', () => {
  const csv = `${HEADER}\nAcme,X,200,77.59,100,1.2,2`;
  const r = validateCsv(csv);
  assert.equal(r.valid.length, 0);
  assert.equal(r.errors.length, 1);
});

test('flags non-numeric coordinates', () => {
  const csv = `${HEADER}\nAcme,X,abc,77.59,100,1.2,2`;
  const r = validateCsv(csv);
  assert.equal(r.errors[0].message, 'latitude and longitude must be valid numbers');
});

test('handles quoted fields with commas', () => {
  const csv = `${HEADER}\n"Acme, Inc.","12 Main St, Bengaluru",12.97,77.59,100,1.2,2`;
  const r = validateCsv(csv);
  assert.equal(r.valid[0].customer_name, 'Acme, Inc.');
  assert.equal(r.valid[0].address, '12 Main St, Bengaluru');
});

test('rejects empty csv', () => {
  assert.throws(() => validateCsv(''));
});

test('rejects missing columns', () => {
  assert.throws(() => validateCsv('customer_name,latitude\nAcme,12.97'));
});
