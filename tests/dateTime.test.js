import test from 'node:test';
import assert from 'node:assert/strict';
import {
  syncGoogleTime,
  isGoogleTimeSynced,
  getGoogleTimeDate,
  getISTDateTimeString,
  formatSurveyTime,
  formatSurveyDateTime
} from '../src/utils/dateTime.js';

test('syncGoogleTime sets server offset correctly', () => {
  const futureTime = Date.now() + 50000;
  syncGoogleTime(futureTime);
  assert.equal(isGoogleTimeSynced(), true);
  const diff = Math.abs(getGoogleTimeDate().getTime() - futureTime);
  assert.ok(diff < 1000, `Expected time difference to be minimal, got ${diff}`);
});

test('getISTDateTimeString formats date into YYYY-MM-DD HH:mm:ss format', () => {
  const d = new Date('2026-09-19T13:01:49.000Z');
  const str = getISTDateTimeString(d);
  assert.match(str, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('formatSurveyTime formats timestamps into 12-hour AM/PM format', () => {
  assert.equal(formatSurveyTime('-'), '-');
  assert.equal(formatSurveyTime(''), '-');
  assert.equal(formatSurveyTime(null), '-');
  assert.equal(formatSurveyTime(undefined), '-');

  // Format with HH:mm string
  const formatted = formatSurveyTime('2026-09-19 14:30:00');
  assert.equal(formatted, '02:30 PM');

  const formattedMorning = formatSurveyTime('2026-09-19 09:15:00');
  assert.equal(formattedMorning, '09:15 AM');
});

test('formatSurveyDateTime formats date and time together', () => {
  assert.equal(formatSurveyDateTime('-'), '-');
  assert.equal(formatSurveyDateTime(''), '-');

  const result = formatSurveyDateTime('2026-09-19 13:01:49');
  assert.match(result, /19\/09\/2026/);
  assert.match(result, /01:01 PM/);
});
