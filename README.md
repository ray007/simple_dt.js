# js-misc
various javascript mini-polyfills and helpers

## simple_dt.js
SimpleDateFormat: helper for localized date/time formatting

see also:
- http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
- http://userguide.icu-project.org/formatparse/datetime

This relies in part on the availability of `strftime` and `sprintf` and new (polyfilled) JS features.

## mini-pf.js
Contains several mini-polyfills for ES6 and beyond stuff not available in current browsers.
Partially implemented by use of jQuery functions

- Object.assign
- String
  - trim
  - repeat
  - padStart
  - padEnd
  - startsWith
  - endsWith
- Array
  - find
  - findIndex
- Element
  - matches
  - closest
  - remove
