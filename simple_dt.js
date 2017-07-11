/**
 * @constructor
 * http://userguide.icu-project.org/formatparse/datetime
 * http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
 * @param {string} locale
 * @param {boolean=} [utc=false]
 */
var SimpleDateFormat = function(locale, utc) {
	this.locale = locale;
	this.utc = !!utc;
	this.fmt1 = {}; // cache formatters for single ICU pattern part
	this.fmtC = {}; // cache for more complete formatters
	this.prepDateFns();
};
Intl.SimpleDateFormat = SimpleDateFormat;

var formatters = {};
//@DBG@ SimpleDateFormat.formatters = formatters;

/** @static */
Intl.SimpleDateFormat.get = function(locale, utc) {
	var key = (locale || 'default');
	if (utc) key += ':utc';
	return formatters[key] || (formatters[key] = new SimpleDateFormat(locale, utc));
};

/**
 * @typedef {function(!Date):!string}
 */
var dateFmtFn;

/**
 * format given date to pattern
 * @param {!string} pat
 * @param {!Date} d
 * @returns {string}
 */
SimpleDateFormat.prototype.format = function(pat, d) {
	var fmtFn = this.getFormatter(pat);
	return fmtFn(d);
};

/**
 * get formatting function for given pattern
 * @param {string} pat
 * @returns {!dateFmtFn}
 */
SimpleDateFormat.prototype.getFormatter = function(pat) {
	var fnCt = this.fmtC, f = fnCt[pat];
	if (!f && !(pat in fnCt)) {
		if (pat[0] == '#') {
			f = this.mkPatternFormatter(pat.substr(1));
		} else { // autoformat -> DateTimeFormat
			f = this.makeAF(pat);
		}
		fnCt[pat] = f;
	}
	return f;
};

var dateFnParts = ['Date', 'Day', 'FullYear', 'Hours', 'Milliseconds', 'Minutes', 'Month', 'Seconds'];
/**
 * prepare quick get/set function for date parts
 */
SimpleDateFormat.prototype.prepDateFns = function() {
	var dpFn = this.$dpFn = {}, utc = this.utc, dp = Date.prototype;
	dateFnParts.forEach(function(part, i) {
		var fnPart = utc ? ('UTC' + part) : part;
		dpFn['get' + part] = dp['get' + fnPart];
		dpFn['set' + part] = dp['set' + fnPart];
	});
	dpFn.getTimezoneOffset = dp.getTimezoneOffset;
};

/**
 * create formatting function for SDF pattern (not auto-format)
 * @private
 * @param {string} pat SDF pattern input
 * @returns {?dateFmtFn}
 */
SimpleDateFormat.prototype.mkPatternFormatter = function(pat) {
	var rx = /([a-zA-Z'])\1*/g, m, fmtParts = [], i0 = 0, fmtFn = null;
	while (m = rx.exec(pat)) {
		// m: [pat1, sig]
		var pat1 = m[0], sig = m[1], i = rx.lastIndex, l = pat1.length, i1 = i - l;
		// "l" is deprecated
		if (sig == 'l') continue;
		// some formatters are autoformat only
		if ('jJC'.indexOf(sig) >= 0) continue;
		// let's get to work
		if (i1 > i0)
			fmtParts.push(pat.substring(i0, i1));
		if (sig == "'") {
			if (l > 1) fmtParts.push(pat1.substr(0, l >> 1));
			if (l & 1) {
				i1 = pat.indexOf("'", i);
				if (i1 > 0) {
					fmtParts.push(pat.substring(i, i1));
					rx.lastIndex = i = i1;
				}
			}
		} else { // a SimpleDateFormat pattern specifier
			var p1f = this.getFmtSdf1(pat1);
			if (p1f) fmtParts.push(p1f);
		}
		i0 = i;
	}
	// and return a formatting function for all of this
	if (fmtParts.length) {
		if (fmtParts.length > 1) {
			fmtFn = function(d) {
				var s = '', hasFmt = 0;
				fmtParts.forEach(function(x, i) {
					if (x instanceof Function) x = x(d); // use sub-formatter
					else if (x.indexOf('%') >= 0) hasFmt++; // count %
					s += x;
				});
				return hasFmt ? strftime(s, d) : s;
			};
		} else { // length == 1
			var f0 = fmtParts[0];
			fmtFn = (f0 instanceof Function) ? f0 : this.makeSTF(f0);
		}
	}
	return fmtFn;
};

/**
 * get project locale to use with DateTimeFormat (BCP47 tag)
 * @private
 * @param {Object=} o options - may influence locale
 * @returns {string}
 */
SimpleDateFormat.prototype.getLocales = function(o) {
	var prj = lweb.DM.activeProject;
	return this.locale || prj.getLocale();
};

var sdfData = {};
//@DBG@ lweb.sdfData = sdfData;
//--- conversion: SimpleDateFormat -> strftime() ----------------------------
sdfData.st = {}; // st -> store all StrfTime related stuff
var sdfSig = sdfData.st.sig = {}, sdfPat = sdfData.st.pat = {};
//--- era: G - n/a with strftime --------------------------------------------
//--- year: yYuUr -----------------------------------------------------------
sdfSig['y'] = sdfSig['Y'] = function(pat) { return (pat.length > 1) ? '%y' : '%Y'; };
sdfSig['u'] = sdfSig['U'] = sdfSig['r'] = '%Y'; // to avoid errors
//--- quarter: Qq - n/a with strftime ---------------------------------------
sdfSig['q'] = sdfSig['Q'] = null;
//--- month: MLl ------------------------------------------------------------
sdfSig['l'] = '%m'; // "l" - deprecated
sdfPat['M'] = sdfPat['L'] = '%-m';
sdfPat['MM'] = sdfPat['LL'] = '%m';
sdfPat['MMM'] = sdfPat['LLL'] = '%b';
sdfPat['MMMM'] = sdfPat['LLLL'] = '%B';
// 5 letters -> narrow (5 char only)
sdfPat['MMMMM'] = sdfPat['LLLLL'] = null;
//--- week: wW --------------------------------------------------------------
sdfSig['w'] = '%U'; // %W (%V) - should be 2 formatters for 'w' and 'ww'
sdfSig['W'] = null; // week on month
//--- day: dDFg -------------------------------------------------------------
sdfPat['d'] = '%-d';
sdfPat['dd'] = '%d';
sdfSig['D'] = function(pat) { return (pat.length > 1) ? '%j' : '%-j'; }; // not exactly, but close enough
sdfSig['F'] = null; // day of week in month
sdfSig['g'] = null; // julian day
//--- weekday: Eec ----------------------------------------------------------
sdfSig['E'] = function(pat) { return (pat.length == 4) ? '%A' : '%a'; };
sdfSig['e'] = sdfSig['c'] = function(pat) {
	var pl = pat.length;
	return (pl <= 2) ? '%w' : ((pl == 4) ? '%A' : '%a');
};
//--- period: abB -----------------------------------------------------------
sdfSig['a'] = sdfSig['b'] = sdfSig['B'] = '%p'; // ??? %P if 3-char ???
//--- hour: hHkKjJC ---------------------------------------------------------
sdfPat['h'] = '%-I';
sdfPat['hh'] = '%I';
sdfPat['H'] = '%-H';
sdfPat['HH'] = '%H';
sdfSig['k'] = '%k'; // not quite: hours should be 1-24 <- TODO
sdfSig['K'] = '%l'; // or "I", not quite: hours should be zero-based (0-11) <- TODO
sdfPat['j'] = sdfPat['h'];
sdfSig['j'] = function(pat) { return (pat.length > 1) ? '%H' : '%-H'; }; // locale hours
sdfSig['J'] = sdfSig['j'];
sdfSig['C'] = sdfSig['j'];
//--- minute: m -------------------------------------------------------------
sdfPat['m'] = '%-M';
sdfPat['mm'] = '%M';
//--- seconds: sSA ----------------------------------------------------------
sdfPat['s'] = '%-S';
sdfPat['ss'] = '%S';
sdfSig['S'] = null; // fractional second
sdfSig['A'] = null; // milliseconds in day
// sep ???
//--- zone: zZOvVXx ---------------------------------------------------------
sdfSig['z'] = sdfSig['v'] = sdfSig['V'] = '%Z';
sdfSig['Z'] = sdfSig['O'] = sdfSig['X'] = sdfSig['x'] = '%z';
//--- double % to preserve them ---------------------------------------------
sdfSig['%'] = function(pat) { return pat + pat; };

/**
 * convert single format-specifier for SimpleDateFormat for strftime use
 * @private
 * @param {string} pat1
 * @returns {string}
 */
SimpleDateFormat.sdf2st = function(pat1) {
	var sig = pat1[0], stf = sdfPat[pat1] || sdfSig[sig];
	if (stf && (stf instanceof Function))
		stf = stf(pat1);
	return stf;
};

/**
 * get strftime formatter for single SDF pattern
 * @private
 * @param {string} pat1
 * @returns {dateFmtFn}
 */
SimpleDateFormat.prototype.getFmt1ST = function(pat1) {
	var fmt = SimpleDateFormat.sdf2st(pat1);
	return /** @type {dateFmtFn} */ (fmt && this.makeSTF(fmt));
};

/**
 * make strftime based formatter for given strftime format
 * @private
 * @param {string} fmt strftime format string
 * @returns {!dateFmtFn}
 */
SimpleDateFormat.prototype.makeSTF = function(fmt) {
	var fn;
	if (fmt.indexOf('%') >= 0) {
		var utc = this.utc;
		fn = function(d) { return d.strftime(fmt, utc); };
	} else { // no strftime placeholder, create dummy formatter
		fn = function(d) { return this; }.bind(fmt);
	}
	return fn;
};

// helper objects to decide on the right formatter
var dtfData = sdfData.dtf = {};
var dtfStyles = dtfData.styles = ['numeric', '2-digit', 'short', 'long', 'narrow'],
	sdfO = dtfData.sig = {}, sdfFnSig = dtfData.sigFn = {}, sdfFnPat = dtfData.patFn = {};
//--- era: G ------------------------------------------------------------
sdfO['G'] = ['era', 0, 2];
// year: yYuUr
sdfO['y'] = sdfO['Y'] = ['year', function(p) { return (p.length == 2) ? 1 : 0; }];
// ??? u,U,r - n/a
//--- quarter: Qq -------------------------------------------------------
sdfFnSig['Q'] = sdfFnSig['q'] = function(d, pat, utc) {
	var m = utc ? d.getUTCMonth() : d.getMonth(), q = 1 + ~~(m/3), s;
	var pads = ['', '0', 'Q', null, ''], l = pat.length;
	if (l == 4) {
		var dd = new Date(); // abuse strftime's %o formatter
		dd.setDate(q);
		s = dd.strftime('%o') + ' quarter'; // TODO: localize
	} else {
		s = pads[l-1] + q;
	}
	return s;
};
//--- month: MLl --------------------------------------------------------
sdfO['M'] = sdfO['L'] = ['month'];
// ??? l - deprecated
//--- week: wW ----------------------------------------------------------
sdfO['w'] = ['week', 0, 0, 1];
sdfFnSig['w'] = function(d, pat, utc) { // week of year
	var fw = d.strftime('%W', utc); // %U for sunday based weeks
	if (pat.length == 1) fw = '' + (+fw); // kill any potential leading zero
	return fw;
};
sdfFnSig['W'] = function(d, pat, utc) { // week of month - first dirty approx
	return '?'; // better none than wrong, this needs locale data <- TODO !!!
};
//--- day: dDFg ---------------------------------------------------------
sdfO['d'] = ['day', 0, 0, 1];
// D - day of year (num) -> %j
// ??? F - day of week in month (num), ie: "2" for "2nd Wed in July"
sdfFnSig['F'] = function(d, pat, utc) {
	var dm = utc ? d.getUTCDate() : d.getDate();
	return '' + (1 + ~~((dm-1)/7));
};
// g - modified julian day (num)
sdfFnSig['g'] = function(d, pat, utc) {
	var d0 = (+d / 86400000);
	if (!utc) d0 -= (d.getTimezoneOffset() / 1440);
	return '' + ~~(d0 + 2440587.5);
};
//--- weekday: Eec ------------------------------------------------------
sdfO['E'] = ['weekday', 0, 2, 4];
sdfO['e'] = sdfO['c'] = ['weekday', 0, 2, 5]; // TODO: 'numeric' and '2-digit' not valid here ???
// c, cc, e -> numeric: 1 digit
sdfFnPat['c'] = sdfFnPat['cc'] = sdfFnPat['e'] = function(d, pat1, utc) {
	return '' + ((utc ? d.getUTCDay() : d.getDay()) || 7);
};
// ee -> numeric: 2 digits (0pad)
sdfFnPat['ee'] = function(d, pat1, utc) {
	return '0' + ((utc ? d.getUTCDay() : d.getDay()) || 7);
};
//--- period: abB -------------------------------------------------------
sdfO['a'] = sdfO['b'] = sdfO['B'] = ['period'];
//--- hour: hHKkjJC -----------------------------------------------------
sdfO['h'] = sdfO['H'] = sdfO['k'] = sdfO['K'] = sdfO['j'] = sdfO['J'] = sdfO['C'] = ['hour', 0, 0, 1];
//--- minute: m ---------------------------------------------------------
sdfO['m'] = ['minute', 0, 0, 1];
//--- second: sSA -------------------------------------------------------
sdfO['s'] = ['second', 0, 0, 1];
sdfFnSig['S'] = function(d, pat, utc) { // fractional second
	var ms1 = 1000 + d.getMilliseconds(), l = pat.length, s0 = '' + ms1;
	if (l > 3) s0 = s0.padEnd(l+1, '0');
	return s0.substr(1, l);
};
sdfFnSig['A'] = function(d, pat, utc) { // milliseconds in day
	var ms = +d;
	if (utc) ms -= (d.getTimezoneOffset() * 60000); // TZ offset: minutes -> ms
	return ('' + (ms % 86400000)).padStart(pat.length, '0');
};
// sep ???
//--- zone: zZOvVXx -----------------------------------------------------
var iso8601tz = function(d, utc, opts) {
	var tzo = utc ? 0 : d.getTimezoneOffset(), res = '';
	if (opts.z0 && !tzo) return 'Z';
	if (opts.gmt) {
		res = 'GMT';
		if (!tzo) return res;
	}
	// add sign and hours
	res += (tzo > 0) ? '-' : '+'; // strange: tzo < 0 -> GMT+xxx
	if (tzo < 0) // sign handled, make calc easier
		tzo = -tzo;
	var h = ~~(tzo/60), m = 0, s = 0;
	res += ((opts.h2 && h < 10) ? '0' : '') + h; // hours
	// minutes
	m = tzo % 60;
	s = ~~(m * 60);
	if (!opts.noM0 || m || s) {
		if (opts.sep) res += ':';
		res += ((m < 10) ? '0' : '') + m;
		if (opts.secs) {
			if (s) {
				if (opts.sep) res += ':';
				res += ((s < 10) ? '0' : '') + s;
			}
		}
	}
	return res;
};
sdfO['z'] = sdfO['Z'] = sdfO['v'] = ['timeZoneName', 0, 2, 3];
sdfFnSig['Z'] = function(d, pat, utc) {
	var pl = pat.length, l4 = pl == 4;
	var opts = {gmt:l4, h2:!l4, sep: pl>=4, secs: pl>=5, z0: pl>=5};
	return iso8601tz(d, utc, opts);
};
sdfFnSig['O'] = function(d, pat, utc) {
	// all length but 1 and 4 should be an error
	var pl = pat.length, opts = {gmt:true, h2: pl>=3, noM0: pl<3, sep:pl>=3};
	return iso8601tz(d, utc, opts);
};
sdfO['V'] = ['timeZoneName', 0, 3, 3]; // always "long"
sdfO['X'] = sdfO['x'] = ['timeZoneName', 0, 2, 2]; // always "short"
sdfFnSig['X'] = sdfFnSig['x'] = function(d, pat, utc) {
	var pl = pat.length, opts = {
		h2: true, sep: pl>1 && pl&1, noM0: pl==1, secs: pl >= 4, z0: pat[0] == 'X'
	};
	return iso8601tz(d, utc, opts);
};
//-----------------------------------------------------------------------
// which formats suggest 12 hour clock?
sdfO['hour12'] = 'abBhK';
// and which one don't want one?
sdfO['no12h'] = 'Hk';

var hasDTF = !!Intl.DateTimeFormat,
	hasF2P = hasDTF && !!(new Intl.DateTimeFormat())['formatToParts'];

/**
 * make auto formatter
 * @private
 * @param {string} pat
 */
SimpleDateFormat.prototype.makeAF = function(pat) {
	var f;
	if (hasDTF) { // create ICU formatter
		f = this.makeDTF(pat);
	} else { // make strftime based or special formatter
		var o = SimpleDateFormat.dtfOptions(pat), fmt;
		var wantD = o['year'] || o['month'] || o['day'] || o['era'] || o['zone'] || o['week'];
		var wantT = o['hour'] || o['minute'] || o['second'] || o['period'] || ('hour12' in o);
		if (wantD) {
			fmt = wantT ? '%c' : '%D'; // '%F'
		} else { // no date wanted -> show time
			fmt = '%r'; // '%T';
		}
		f = this.makeSTF(fmt);
	}
	return f;
};

/**
 * create instance of Intl.DateTimeFormat for given pattern
 * @private
 * @param {string} pat SDF pattern for autoformat
 * @param {?=} [f1=false] truthy: single pattern to generate formatter for?
 * @returns {?dateFmtFn}
 */
SimpleDateFormat.prototype.makeDTF = function(pat, f1) {
	// prep options
	var o = {}, utc = this.utc, sig = pat[0];
	if (f1) {
		// len=6 only allowed for weekdays, do not use DTF for that
		if (pat.length > 5 && sig != 'S' && sig != 'A') return null;
		if (!SimpleDateFormat.sdf2dtfO(pat, o)) return null;
	} else {
		SimpleDateFormat.dtfOptions(pat, o);
	}
	// prep formatter to work with
	if (utc) o['timeZone'] = 'UTC';
	var fn, dtf = new Intl.DateTimeFormat(this.getLocales(o), o);
	if (f1) { // not auto-formatting
		// some formatters need some more work...
		var dayEraVtz = "vVzGabB".indexOf(sig) >= 0; // day period, era or verbose timezone
		if (dayEraVtz) {
			var part = sdfO[sig][0];
			if (hasF2P) {
				if (part == 'period') part = 'dayperiod';
				fn = function(part, d) {
					var fParts = this['formatToParts'](d),
						r0 = fParts.find(function(pp, i) { return pp['type'] == part; });
					return r0 && r0['value'];
				}.bind(dtf, part);
			} else { // try to extract text from longer string
				fn = function(d) {
					var v0 = this.format(d);
					// replace: all digits followed by non-words chars and whitespace
					return v0.replace(/\s*\d+[^\w\s]*/g, '').trim();
				}.bind(dtf);
			}
		} else { // check some numerics: hours, minutes or seconds - or years!
			var showHours = 'hHkK'.indexOf(sig) >= 0;
			// hour formatters are quite special - move out of here?
			if (showHours) {
				var fnGetHours = this.$dpFn.getHours;
				fn = function(d) {
					var h0 = fnGetHours.call(d);
					// don't show 0 hours -> 12 or 24
					if (!h0 && (sig == 'H' || sig == 'K')) h0 = 24;
					// restrict to 12 hour time
					if (h0 > 12 && (sig == 'h' || sig == 'K')) h0 -= 12;
					// ev. pad to 2 digits
					return (''+h0).padStart(pat.length, '0'); // ((pat.length > 1 && h0 < 10) ? '0' : '') + h0;
				};
			} else if ('sm'.indexOf(sig) >= 0) {
				// minutes and seconds should be numbers - check this
				// internet explorer has a problem with minutes and seconds
				// see https://github.com/Microsoft/ChakraCore/issues/1223
				if (isNaN(dtf.format(new Date()))) return null;
				if (pat.length > 1) {
					// 2-digit minutes or seconds
					fn = function(d) {
						var v = +this.format(d);
						return ((v < 10) ? '0' : '') + v;
					}.bind(dtf);
				}
			}
			else if (pat.length == 5 && (sig == 'y' || sig == 'Y')) {
				// ??? use NumberFormat if negative years are fixed upstream ???
				fn = function(d) { return this.format(d).padStart(5, '0'); }.bind(dtf);
			}
		}
	}
	return fn || dtf.format.bind(dtf);
};

/**
 * update DTF options for single SDF pattern (updateFmtOpts)
 * @private
 * @static
 * @param {string} pat pattern
 * @param {Object} o dtf options to construct
 * @returns {Object} DTF options object (if pat was found)
 */
SimpleDateFormat.sdf2dtfO = function(pat, o) {
	// no DTF options for week
	var sig = pat[0], noDtf = 'wW'.indexOf(sig) >= 0;
	var pDef = !noDtf && sdfO[sig];
	if (pDef) {
		var prop = pDef[0], offset = pDef[1], idx;
		if (offset && offset instanceof Function) {
			idx = offset(pat);
		} else {
			idx = pat.length - 1;
			if (offset) idx += offset;
			var min = pDef[2];
			if (min && idx < min) idx = min;
			var max = pDef[3];
			if (max && idx > max) idx = max;
		}
		o[prop] = dtfStyles[idx];
		// not for iso8601 TZ
		if (sig == 'x' || sig == 'X' || (sig == 'Z' && pat.length >= 3))
			return null;
		// any preference regarding 12/24 hour clock found?
		if (sdfO['hour12'].indexOf(sig) >= 0)
			o['hour12'] = true;
		else if (sdfO['no12h'].indexOf(sig) >= 0)
			o['hour12'] = false;
		// no period w/o hour
		if (o['period'] && !o['hour'])
			o['hour'] = 'numeric';
	} else o = null;
	return o;
};

/**
 * get DTF options for auto-formatting
 * @private
 * @param {!string} pat input pattern
 * @param {Object=} o options to update if given
 * @returns {Object} options
 */
SimpleDateFormat.dtfOptions = function(pat, o) {
	if (!o) o = {};
	var oRx = /([a-zA-Z])\1*/g, m;
	while (m = oRx.exec(pat)) { // m: [pat1, sig]
		SimpleDateFormat.sdf2dtfO(m[0], o);
	}
	return o;
};

/**
 * get formatter for single SimpleDateFormat specifier
 * @private
 * @param {string} pat1
 * @returns {dateFmtFn|string}
 */
SimpleDateFormat.prototype.getFmtSdf1 = function(pat1) {
	var fnCt = this.fmt1, fmtFn = fnCt[pat1];
	if (!fmtFn && !(pat1 in fnCt)) {
		fmtFn = fnCt[pat1] = this.getFmt1Fn(pat1);
	}
	return fmtFn;
};

/**
 * get non-DTF formatter for single SDF pattern
 * @private
 * @param {string} pat1
 * @returns {dateFmtFn}
 */
SimpleDateFormat.prototype.getFmt1Fn = function(pat1) {
	return (hasDTF && this.makeDTF(pat1, 1))
		|| this.getPatFn(pat1) || this.getFmt1ST(pat1);
};

/**
 * get pre-defined formatting function for pattern
 * @private
 * @param {string} pat1
 * @returns {dateFmtFn}
 */
SimpleDateFormat.prototype.getPatFn = function(pat1) {
	var fn, utc = this.utc, sig = pat1[0];
	if (pat1.length > 5 && 'eEc'.indexOf(sig) >= 0) {
		// weekday: 6-len e, E or c
		var fShort = this.getFmt1Fn(pat1.substr(0,3));
		if (fShort(new Date()).length > 2) {
			fn = function(d) { return fShort(d).substr(0,2); };
		} else {
			fn = fShort;
		}
	} else { // length 1..5 (as usual)
		var fnSdf = sdfFnPat[pat1];
		if (fnSdf) {
			fn = function(d) { return fnSdf(d, pat1, utc); };
		} else {
			fnSdf = sdfFnSig[sig];
			fn = fnSdf && function(d) { return fnSdf(d, pat1, utc); };
		}
	}
	return fn;
};
