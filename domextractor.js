(function () {

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
            return Object.prototype.toString.call(arg) === '[object Array]';
        },
        stringIsRegExp = function (string) {
            return /^\/(\S|\s)*\/[gimy]{0,4}$/.test(string);
        },
        toRegExp = function (pattern) {
            var patternArray = pattern.split('/');
            return new RegExp(patternArray[1], patternArray[2]);
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
        transformations = {
            // DOM node transformations
            querySelectorAll: function (selector) {
                return function (node) {
                    return node && node.querySelectorAll(selector);
                };
            },
            querySelector: function (selector) {
                return function (node) {
                    return node && node.querySelector(selector);
                };
            },
            innerHTML: function (node) {
                return node && node.innerHTML;
            },
            innerText: function (node) {
                return node && (node.innerText || node.textContent);
            },
            value: function (node) {
                return node && node.value;
            },
            getAttribute: function (attr) {
                return function (node) {
                    return node && node.getAttribute && node.getAttribute(attr);
                };
            },

            // Number transformations
            toInt: function (item) {
                return isString(item) && parseInt(item, 10);
            },
            toFloat: function (item) {
                return isString(item) && parseFloat(item);
            },
            round: function (item) {
                return isNumber(item) && Math.round(item);
            },
            multiplyBy: function (factor) {
                return function (number) {
                    return isNumber(number) && factor * number;
                };
            },

            // String transformations
            htmlToText: function (html) {
                var div = this.document.createElement('div');
                div.innerHTML = html;
                return div.firstChild.nodeValue + String();
            },
            toString: function (item) {
                return item + String();
            },
            trim: function (text) {
                return isString(text) && text.trim();
            },
            split: function (delimeter, limit) {
                var args = [delimeter];
                if (typeof limit !== 'undefined') {
                    args.push(parseInt(limit, 10));
                }
                return function (text) {
                    return isString(text) && text.split.apply(text, args);
                };
            },
            replace: function (pattern, replacement) {
                pattern = isString(pattern) && stringIsRegExp(pattern) ? toRegExp(pattern) : pattern;
                return function (text) {
                    return isString(text) && text.replace(pattern, replacement);
                };
            },
            match: function (pattern) {
                pattern = isString(pattern) && stringIsRegExp(pattern) ? toRegExp(pattern) : pattern;
                return function (text) {
                    return isString(text) && text.match(pattern);
                };
            },

            // Array transformations
            getIndex: function (index) {
                index = parseInt(index, 10);
                return function (array) {
                    return isArray(array) && array.length > index && array[index];
                };
            },
            slice: function (start, stop) {
                var args = [parseInt(start, 10)];
                if (typeof stop !== 'undefined') {
                    args.push(parseInt(stop, 10));
                }
                return function (array) {
                    return array.slice.apply(array, args);
                };
            }
        },
        DomExtractor = function (rootNode, config) {
            if (!(this instanceof DomExtractor)) {
                return new DomExtractor(rootNode, config);
            }
            this.rootNode = rootNode;
            this.document = this.rootNode.ownerDocument || this.rootNode;
            return this.extract(config);
        };

    DomExtractor.prototype.transformations = DomExtractor.transformations = transformations;

    // Extract and format data from the DOM based on config
    DomExtractor.prototype.extract = function (config) {
        var _this = this;
        var memoizedSelections = {};

        var filteredConfig = filterObject(config, function (key, spec) {
            return !spec.condition || spec.condition();
        });

        var extractFromDOM = function (key, spec) {
            var output = _this.rootNode;

            if (spec.selector) {
                // Don't query the DOM for the same selector again
                if (!memoizedSelections.hasOwnProperty(spec.selector)) {
                    memoizedSelections[spec.selector] = output.querySelector(spec.selector);
                }
                output = memoizedSelections[spec.selector];
            }

            if (spec.transformations) {
                output = _this.applyTransformations(spec.transformations, output);
            }
            return output;
        };
        return mapObject(filteredConfig, extractFromDOM);
    };

    // If a transformation has static arguments, use them to make a transformation
    // function to apply to the item
    DomExtractor.prototype.parseTransformation = function (transformationString) {
        var transformationArray = transformationString.split(':');
        var transformationName = transformationArray.shift();
        var transformationArgs = transformationArray.join(':').split(',');
        return this.transformations[transformationName].apply(this, transformationArgs);
    };

    // Apply each transformation to the item, in series
    DomExtractor.prototype.applyTransformations = function (transformations, item) {
        var i, transformation;
        for (i = 0; i < transformations.length; i += 1) {
            if (this.transformations.hasOwnProperty(transformations[i])) {
                item = this.transformations[transformations[i]](item);
            } else if (transformations[i].indexOf(':') > -1) {
                transformation = this.parseTransformation(transformations[i]);
                item = transformation(item);
            } else if (isFunction(transformations[i])) {
                item = transformations[i](item);
            } else {
                throw 'Transformation ' + transformations[i] + ' not implemented';
            }
        }
        return item;
    };

    // Establish the root object, `window` (`self`) in the browser.
    // We use `self` instead of `window` for `WebWorker` support.
    var root = typeof self === 'object' && self.self === self && self;
    root.domExtractor = DomExtractor;

    if (typeof define === 'function' && define.amd) {
        define('domextractor', [], function () {
            return DomExtractor;
        });
    }

}());
