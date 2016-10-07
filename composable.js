(function () {

    // Establish the root object, `window` (`self`) in the browser.
    // We use `self` instead of `window` for `WebWorker` support.
    var root = typeof self === 'object' && self.self === self && self;

    // Transformation helper functions
    var isString = function (arg) {
            return typeof arg === 'string';
        },
        isNumber = function (arg) {
            return typeof arg === 'number';
        },
        isFunction = function (arg) {
            return typeof arg === 'function';
        },
        isArray = function (arg) {
            return Array.isArray ? Array.isArray(arg) : Object.prototype.toString.call(arg) === '[object Array]';
        },
        isNodeList = function (arg) {
            return Object.prototype.toString.call(arg) === '[object NodeList]';
        },
        stringIsRegExp = function (string) {
            return /^\/(?:\S|\s)*\/[gimy]{0,4}$/.test(string);
        },
        toRegExp = function (pattern) {
            var patternParts = pattern.split('/');
            var flagPart = patternParts[patternParts.length - 1];
            var patternPart = pattern.slice(1, (flagPart.length + 1) * -1);
            return new RegExp(patternPart, flagPart);
        },
        mapObject = function (object, func) {
            var key, newObject = {};
            for (key in object) {
                if (object.hasOwnProperty(key)) {
                    newObject[key] = func(key, object[key]);
                }
            }
            return newObject;
        },
        filterObject = function (object, func) {
            var key, newObject = {};
            for (key in object) {
                if (object.hasOwnProperty(key) && func(key, object[key])) {
                    newObject[key] = object[key];
                }
            }
            return newObject;
        },
    // FIXME: cachedQueryFactory should not use DOM nodes as keys to the cache.
        cachedQueryFactory = function (cacheKey) {
            return function (selector) {
                var _this = this;
                if (!_this.hasOwnProperty('cache')) {
                    _this.cache = {};
                }
                if (!_this.cache.hasOwnProperty(cacheKey)) {
                    _this.cache[cacheKey] = {};
                }
                return function (node) {
                    if (!node) {
                        return null;
                    }
                    if (!_this.cache[cacheKey].hasOwnProperty(node)) {
                        _this.cache[cacheKey][node] = {};
                    }
                    if (!_this.cache[cacheKey][node].hasOwnProperty(selector)) {
                        _this.cache[cacheKey][node][selector] = node[cacheKey](selector);
                    }
                    return _this.cache[cacheKey][node][selector];
                };
            };
        };

    // Composable transformations
    var transformations = {
        // Global object getters
        window: function () {
            return root;
        },
        document: function () {
            return root.document;
        },

        // DOM node transformations
        querySelectorAll: function (selector) {
            return function (node) {
                return node ? node.querySelectorAll(selector) : null;
            };
        },
        querySelector: function (selector) {
            return function (node) {
                return node ? node.querySelector(selector) : null;
            };
        },
        innerHTML: function (node) {
            return node ? node.innerHTML : null;
        },
        innerText: function (node) {
            return node ? node.innerText || node.textContent : null;
        },
        rootInnerText: function (node) {
            if (!node) return null;

            var textNodes = [];
            for (var i = 0; i < node.childNodes.length; i++) {
                if (node.childNodes[i].nodeType === node.TEXT_NODE) {
                    textNodes.push(Composable.T.trim(Composable.T.innerText(node.childNodes[i])));
                }
            }
            return Composable.T.trim(textNodes.join(' '));
        },
        value: function (node) {
            return node ? node.value : null;
        },
        getAttribute: function (attr) {
            return function (node) {
                return node && node.getAttribute ? node.getAttribute(attr) : null;
            };
        },

        // Number transformations
        toInt: function (item) {
            return isString(item) || isNumber(item) ? parseInt(item, 10) : null;
        },
        toFloat: function (item) {
            return isString(item) || isNumber(item) ? parseFloat(item) : null;
        },
        toFixed: function (precision) {
            var precision = isString(precision) ? parseFloat(precision) : precision;
            return function (item) {
                var float = isString(item) ? parseFloat(item) : item;

                return isNumber(float) && !isNaN(float) ? float.toFixed(precision) : null;
            };
        },
        round: function (item) {
            return isNumber(item) ? Math.round(item) : null;
        },
        multiplyBy: function (factor) {
            return function (number) {
                return isNumber(number) ? factor * number : null;
            };
        },

        // String transformations
        htmlToText: function (html) {
            var div = root.document.createElement('div');
            div.innerHTML = html;
            var firstChild = div.firstChild;
            return firstChild ? firstChild.nodeValue + String() : '';
        },
        reverse: function (item) {
            if (isString(item)) {
                return item.split('').reverse().join('');
            } else if (isArray(item)) {
                return item.reverse();
            }
            return null;
        },
        toString: function (item) {
            return item ? item + String() : null;
        },
        trim: function (text) {
            return isString(text) ? text.trim() : null;
        },
        split: function (delimeter, limit) {
            var args = [delimeter];
            if (typeof limit !== 'undefined') {
                args.push(parseInt(limit, 10));
            }
            return function (text) {
                return isString(text) ? text.split.apply(text, args) : null;
            };
        },
        join: function (delimeter) {
            return function (array) {
                return isArray(array) ? array.join(delimeter) : null;
            };
        },
        replace: function (pattern, replacement) {
            pattern = isString(pattern) && stringIsRegExp(pattern) ? toRegExp(pattern) : pattern;
            return function (text) {
                return isString(text) ? text.replace(pattern, replacement) : null;
            };
        },
        match: function (pattern) {
            pattern = isString(pattern) && stringIsRegExp(pattern) ? toRegExp(pattern) : pattern;
            return function (text) {
                return isString(text) ? text.match(pattern) : null;
            };
        },

        // Array transformations
        getIndex: function (index) {
            index = parseInt(index, 10);
            return function (array) {
                return isArray(array) && array.length > index ? array[index] : null;
            };
        },
        slice: function (start, stop) {
            var args = [parseInt(start, 10)];
            if (typeof stop !== 'undefined') {
                args.push(parseInt(stop, 10));
            }
            return function (input) {
                var output;
                if (isString(input)) {
                    output = input ? String.prototype.slice.apply(input, args) : null;
                } else if (isArray(input) || isNodeList(input)) {
                    // Slice needs to work on NodeList instances
                    output = input ? Array.prototype.slice.apply(input, args) : null;
                }
                return output;
            };
        },

        // Object transformations
        getProperty: function (property) {
            return function (object) {
                return object ? object[property] : null;
            };
        },
        getProperties: function (propertyString) {
            return function (object) {
                if (!object) {
                    return null;
                }
                var properties = propertyString.split('.'),
                    property;
                while (properties.length) {
                    property = properties.shift();
                    object = object ? object[property] : null;
                }
                return object;
            };
        }
    };

    var arrayTransformations = {
        map: function (method) {
            return function (array) {
                return isArray(array) || isNodeList(array) ? Array.prototype.map.call(array, method) : null;
            };
        }
    };

    // Allow usage as a function without `new` operator
    var Composable = function (config) {
        if (!(this instanceof Composable)) {
            return new Composable(config);
        }
        return this.extract(config);
    };

    Composable.__objectMerge = function () {
        var extractedProperties = {};
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] === 'object') {
                for (var key in arguments[i]) {
                    if (arguments[i].hasOwnProperty(key)) {
                        extractedProperties[key] = arguments[i][key];
                    }
                }
            }
        }
        return extractedProperties;
    };

    // Put transformations on Composable object for global referencing without `new` operator
    Composable.prototype.T = Composable.T = Composable.__objectMerge(transformations, arrayTransformations);

    // Extract and format data from the DOM based on config
    Composable.prototype.extract = function (config) {
        var _this = this;

        var filteredConfig = filterObject(config, function (key, spec) {
            return isArray(spec);
        });

        return mapObject(filteredConfig, function (key, spec) {
            var i, item = null;
            for (i = 0; i < spec.length; i += 1) {
                item = _this.applyTransformation(item, spec[i]);
            }
            return item;
        });
    };

    // Apply each transformation to the item, in series
    Composable.prototype.applyTransformation = function (item, transformationInput) {
        var xform = this.getTransformation(transformationInput);
        if (!xform) {
            throw 'Transformation "' + transformationInput + '" invalid';
        }
        return xform(item);
    };

    Composable.prototype.getTransformation = function (transformationInput) {
        if (isFunction(transformationInput)) {
            return transformationInput;
        } else if (!isArray(transformationInput) && !isString(transformationInput)) {
            throw 'Invalid Input Type: ' + typeof transformationInput;
        }

        if (!transformationInput || !transformationInput.length) {
            // either command string is empty or no sub command given in recursion
            return null;
        }

        var transformation;
        if (isArray(transformationInput)) {
            if (transformationInput.length === 1 && this.T.hasOwnProperty(transformationInput[0])) {
                return this.T[transformationInput[0]];
            }
            transformation = this.getTransformationForArrayTransformation(transformationInput);
        } else {
            if (this.T.hasOwnProperty(transformationInput)) {
                return this.T[transformationInput];
            }
            transformation = this.getTransformationForStringTransformation(transformationInput);
        }

        if (!transformation) {
            return null;
        }

        return this.T[transformation.command].apply(this, transformation.args);
    };

    Composable.prototype.getTransformationForArrayTransformation = function (transformationInput) {
        var command = transformationInput[0];
        if (!this.T.hasOwnProperty(command)) {
            return null;
        }

        var args = transformationInput.slice(1);
        if (arrayTransformations.hasOwnProperty(command)) {
            var subCommand = this.getTransformation(args);
            if (subCommand) {
                args = [subCommand];
            }
        }

        return {command: command, args: args};
    };

    Composable.prototype.getTransformationForStringTransformation = function (transformationInput) {
        var transformationArray = transformationInput.split(':');
        var command = transformationArray.shift();
        if (!this.T.hasOwnProperty(command)) {
            return null;
        }

        var commandArgString = transformationArray.join(':');
        var subCommand;
        if (arrayTransformations.hasOwnProperty(command)) {
            subCommand = this.getTransformation(commandArgString);
        }

        var args = subCommand ? [subCommand] : Composable.extractArgs(commandArgString);

        return {command: command, args: args};
    };

    Composable.extractArgs = function (string) {
        string = string || '';
        var argRegexMatch = string.match(/^(\/.*?(?:(?:\\\\)+|[^\\])\/[gimy]{0,4})(?:,|$)/i);

        var args = [];
        if (argRegexMatch && argRegexMatch.length) {
            var regexWithFlagsWithoutComma = string.slice(0, argRegexMatch[1].length);
            args.push(regexWithFlagsWithoutComma);

            var lengthOfRegexWithComma = argRegexMatch[0].length;
            string = string.slice(lengthOfRegexWithComma);
            args = args.concat(string.split(','));
        } else if (string.length) {
            args = args.concat(string.split(','));
        }

        return args;
    };

    Composable.VERSION = '0.4.6';

    // Make the object globally accessible
    root.Composable = Composable;

    // Define it for AMD
    if (typeof define === 'function' && define.amd) {
        define('composable', [], function () {
            return Composable;
        });
    }

}());
