//--- Object ----------------------------------------------------------------

if (!Object.assign) {
	//Object.assign = $.extend;
	Object.assign = function(dst, src) { return /** @type {!Object} */ ($.extend.apply(null, arguments)); };
}

//--- String ----------------------------------------------------------------

if (!String.prototype.trim) { // ??? only very old IE ???
	String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g, ''); };
}
function _repeatTo(str, tLen) {
	var l1 = str.length;
	if (!l1 || !tLen) return '';
	if (tLen >= l1) {
		while (l1 < tLen) {
			var l2 = l1 << 1; // double it
			str += (tLen <= l2) ? str : str.substr(0, tLen - l1);
			l1 = l2;
		}
	} else { // target length < initial length
		str = str.substr(0, tLen);
	}
	return str;
}
if (!String.prototype.repeat) {
	String.prototype.repeat = function(cnt) {
		return _repeatTo(this, this.length*cnt); // Array(cnt+1).join(this);
	};
}
// from ECMAScript 2017
if (!String.prototype.padStart) {
	String.prototype.padStart = function padStart(tLen, padS) {
		tLen -= this.length;
		return (tLen > 0) ? (_repeatTo(padS || ' ', tLen) + this) : this;
	};
}
if (!String.prototype.padEnd) {
	String.prototype.padEnd = function padStart(tLen, padS) {
		tLen -= this.length;
		return (tLen > 0) ? (this + _repeatTo(padS || ' ', tLen)) : this;
	};
}

//--- Array -----------------------------------------------------------------

if (!Array.prototype.find) {
	//** @type function(Function, Object=) */
	Array.prototype.find = function(predicate, thisArg) {
		var o;
		this.some(function(item, i) {
			if (predicate.call(thisArg, item, i, this)) {
				o = item;
				return true;
			}
		}, this);
		return o;
	};
}

if (!Array.prototype.findIndex) {
	//** @type function(Function, Object=) */
	Array.prototype.findIndex = function(predicate, thisArg) {
		var idx = -1;
		this.some(function(item, i) {
			if (predicate.call(thisArg, item, i, this)) {
				idx = i;
				return true;
			}
		}, this);
		return idx;
	};
}

//--- Element ---------------------------------------------------------------

var pfFnMatches = null;
if (!Element.prototype.matches) {
	// does the element match the given selector
	Element.prototype.matches =
		Element.prototype.matchesSelector ||
		Element.prototype.mozMatchesSelector ||
		Element.prototype.msMatchesSelector ||
		Element.prototype.oMatchesSelector ||
		Element.prototype.webkitMatchesSelector ||
		(pfFnMatches = function(s) { return $(this).is(s); });
}

if (!Element.prototype.closest) {
	// find closest ancestor matching selector
	if (pfFnMatches) {
		// no native "matches", do not use it for closest()
		Element.prototype.closest = function(sel) {
			return $(this).closest(sel)[0];
		};
	} else {
		Element.prototype.closest = function(sel) {
			var el = this;
			while (el) {
				if (el.nodeType == 1 && el.matches(sel))
					break;
				el = el.parentNode;
			}
			return /** @type {Element} */ (el);
		};
	}
}

if (!Element.prototype.remove) {
	// remove this (current) element from dom
	Element.prototype.remove = function() {
		var p = this.parentElement || this.parentNode;
		p && p.removeChild(this);
	}
}
