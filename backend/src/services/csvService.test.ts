import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCsv, parseUsualRoute } from './csvService';
import { DeliveryStop } from '../types';

const HEADER = 'customer_name,address,latitude,longitude,weight,volume,priority';

const STOPS: DeliveryStop[] = [
  { delivery_id: 'a', customer_name: 'Acme', latitude: 12.97, longitude: 77.59, weight: 10, sequence: 1 },
  { delivery_id: 'b', customer_name: 'Bharat', latitude: 12.95, longitude: 77.62, weight: 20, sequence: 2 },
  { delivery_id: 'c', customer_name: 'Crown', latitude: 12.93, longitude: 77.60, weight: 30, sequence: 3 },
];

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

test('parseUsualRoute reorders by sequence, matching by delivery_id', () => {
  const csv = 'sequence,delivery_id\n2,b\n1,c\n3,a';
  const ordered = parseUsualRoute(csv, STOPS);
  assert.deepEqual(ordered.map((s) => s.delivery_id), ['c', 'b', 'a']);
});

test('parseUsualRoute matches by customer_name (case-insensitive)', () => {
  const csv = 'sequence,customer_name\n1,acme\n2,BHARAT\n3,Crown';
  const ordered = parseUsualRoute(csv, STOPS);
  assert.deepEqual(ordered.map((s) => s.delivery_id), ['a', 'b', 'c']);
});

test('parseUsualRoute rejects an unknown stop', () => {
  assert.throws(() => parseUsualRoute('sequence,delivery_id\n1,a\n2,b\n3,zzz', STOPS), /not part of this route/);
});

test('parseUsualRoute rejects a route missing stops', () => {
  assert.throws(() => parseUsualRoute('sequence,delivery_id\n1,a\n2,b', STOPS), /missing/);
});

test('parseUsualRoute rejects duplicate stops', () => {
  assert.throws(() => parseUsualRoute('sequence,delivery_id\n1,a\n2,a\n3,b', STOPS), /more than once/);
});

test('parseUsualRoute requires a sequence column', () => {
  assert.throws(() => parseUsualRoute('delivery_id\na\nb\nc', STOPS), /sequence/);
});
