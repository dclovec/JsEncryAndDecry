(function(root, factory) {
    if (typeof exports === "object") {
        // CommonJS
        module.exports = exports = factory();
    } else if (typeof define === "function" && define.amd) {
        // AMD
        define(factory);
    } else {
        // Global (browser)
        window.SHA3 = factory();
    }
}(this, function() {
    function core() {

        /**
         * CryptoJS core components.
         */
        var CryptoJS = CryptoJS || (function(Math, undefined) {
            /**
             * CryptoJS namespace.
             */
            var C = {};

            /**
             * Library namespace.
             */
            var C_lib = C.lib = {};

            /**
             * Base object for prototypal inheritance.
             */
            var Base = C_lib.Base = (function() {
                function F() {}

                return {
                    /**
                     * Creates a new object that inherits from this object.
                     *
                     * @param {Object} overrides Properties to copy into the new object.
                     *
                     * @return {Object} The new object.
                     *
                     * @static
                     *
                     * @example
                     *
                     *     var MyType = CryptoJS.lib.Base.extend({
                     *         field: 'value',
                     *
                     *         method: function () {
                     *         }
                     *     });
                     */
                    extend: function(overrides) {
                        // Spawn
                        F.prototype = this;
                        var subtype = new F();

                        // Augment
                        if (overrides) {
                            subtype.mixIn(overrides);
                        }

                        // Create default initializer
                        if (!subtype.hasOwnProperty('init')) {
                            subtype.init = function() {
                                subtype.$super.init.apply(this, arguments);
                            };
                        }

                        // Initializer's prototype is the subtype object
                        subtype.init.prototype = subtype;

                        // Reference supertype
                        subtype.$super = this;

                        return subtype;
                    },

                    /**
                     * Extends this object and runs the init method.
                     * Arguments to create() will be passed to init().
                     *
                     * @return {Object} The new object.
                     *
                     * @static
                     *
                     * @example
                     *
                     *     var instance = MyType.create();
                     */
                    create: function() {
                        var instance = this.extend();
                        instance.init.apply(instance, arguments);

                        return instance;
                    },

                    /**
                     * Initializes a newly created object.
                     * Override this method to add some logic when your objects are created.
                     *
                     * @example
                     *
                     *     var MyType = CryptoJS.lib.Base.extend({
                     *         init: function () {
                     *             // ...
                     *         }
                     *     });
                     */
                    init: function() {},

                    /**
                     * Copies properties into this object.
                     *
                     * @param {Object} properties The properties to mix in.
                     *
                     * @example
                     *
                     *     MyType.mixIn({
                     *         field: 'value'
                     *     });
                     */
                    mixIn: function(properties) {
                        for (var propertyName in properties) {
                            if (properties.hasOwnProperty(propertyName)) {
                                this[propertyName] = properties[propertyName];
                            }
                        }

                        // IE won't copy toString using the loop above
                        if (properties.hasOwnProperty('toString')) {
                            this.toString = properties.toString;
                        }
                    },

                    /**
                     * Creates a copy of this object.
                     *
                     * @return {Object} The clone.
                     *
                     * @example
                     *
                     *     var clone = instance.clone();
                     */
                    clone: function() {
                        return this.init.prototype.extend(this);
                    }
                };
            }());

            /**
             * An array of 32-bit words.
             *
             * @property {Array} words The array of 32-bit words.
             * @property {number} sigBytes The number of significant bytes in this word array.
             */
            var WordArray = C_lib.WordArray = Base.extend({
                /**
                 * Initializes a newly created word array.
                 *
                 * @param {Array} words (Optional) An array of 32-bit words.
                 * @param {number} sigBytes (Optional) The number of significant bytes in the words.
                 *
                 * @example
                 *
                 *     var wordArray = CryptoJS.lib.WordArray.create();
                 *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
                 *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
                 */
                init: function(words, sigBytes) {
                    words = this.words = words || [];

                    if (sigBytes != undefined) {
                        this.sigBytes = sigBytes;
                    } else {
                        this.sigBytes = words.length * 4;
                    }
                },

                /**
                 * Converts this word array to a string.
                 *
                 * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
                 *
                 * @return {string} The stringified word array.
                 *
                 * @example
                 *
                 *     var string = wordArray + '';
                 *     var string = wordArray.toString();
                 *     var string = wordArray.toString(CryptoJS.enc.Utf8);
                 */
                toString: function(encoder) {
                    return (encoder || Hex).stringify(this);
                },

                /**
                 * Concatenates a word array to this word array.
                 *
                 * @param {WordArray} wordArray The word array to append.
                 *
                 * @return {WordArray} This word array.
                 *
                 * @example
                 *
                 *     wordArray1.concat(wordArray2);
                 */
                concat: function(wordArray) {
                    // Shortcuts
                    var thisWords = this.words;
                    var thatWords = wordArray.words;
                    var thisSigBytes = this.sigBytes;
                    var thatSigBytes = wordArray.sigBytes;

                    // Clamp excess bits
                    this.clamp();

                    // Concat
                    if (thisSigBytes % 4) {
                        // Copy one byte at a time
                        for (var i = 0; i < thatSigBytes; i++) {
                            var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                            thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
                        }
                    } else {
                        // Copy one word at a time
                        for (var i = 0; i < thatSigBytes; i += 4) {
                            thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
                        }
                    }
                    this.sigBytes += thatSigBytes;

                    // Chainable
                    return this;
                },

                /**
                 * Removes insignificant bits.
                 *
                 * @example
                 *
                 *     wordArray.clamp();
                 */
                clamp: function() {
                    // Shortcuts
                    var words = this.words;
                    var sigBytes = this.sigBytes;

                    // Clamp
                    words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
                    words.length = Math.ceil(sigBytes / 4);
                },

                /**
                 * Creates a copy of this word array.
                 *
                 * @return {WordArray} The clone.
                 *
                 * @example
                 *
                 *     var clone = wordArray.clone();
                 */
                clone: function() {
                    var clone = Base.clone.call(this);
                    clone.words = this.words.slice(0);

                    return clone;
                },

                /**
                 * Creates a word array filled with random bytes.
                 *
                 * @param {number} nBytes The number of random bytes to generate.
                 *
                 * @return {WordArray} The random word array.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var wordArray = CryptoJS.lib.WordArray.random(16);
                 */
                random: function(nBytes) {
                    var words = [];

                    var r = (function(m_w) {
                        var m_w = m_w;
                        var m_z = 0x3ade68b1;
                        var mask = 0xffffffff;

                        return function() {
                            m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 0x10)) & mask;
                            m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 0x10)) & mask;
                            var result = ((m_z << 0x10) + m_w) & mask;
                            result /= 0x100000000;
                            result += 0.5;
                            return result * (Math.random() > .5 ? 1 : -1);
                        }
                    });

                    for (var i = 0, rcache; i < nBytes; i += 4) {
                        var _r = r((rcache || Math.random()) * 0x100000000);

                        rcache = _r() * 0x3ade67b7;
                        words.push((_r() * 0x100000000) | 0);
                    }

                    return new WordArray.init(words, nBytes);
                }
            });

            /**
             * Encoder namespace.
             */
            var C_enc = C.enc = {};

            /**
             * Hex encoding strategy.
             */
            var Hex = C_enc.Hex = {
                /**
                 * Converts a word array to a hex string.
                 *
                 * @param {WordArray} wordArray The word array.
                 *
                 * @return {string} The hex string.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
                 */
                stringify: function(wordArray) {
                    // Shortcuts
                    var words = wordArray.words;
                    var sigBytes = wordArray.sigBytes;

                    // Convert
                    var hexChars = [];
                    for (var i = 0; i < sigBytes; i++) {
                        var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                        hexChars.push((bite >>> 4).toString(16));
                        hexChars.push((bite & 0x0f).toString(16));
                    }

                    return hexChars.join('');
                },

                /**
                 * Converts a hex string to a word array.
                 *
                 * @param {string} hexStr The hex string.
                 *
                 * @return {WordArray} The word array.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
                 */
                parse: function(hexStr) {
                    // Shortcut
                    var hexStrLength = hexStr.length;

                    // Convert
                    var words = [];
                    for (var i = 0; i < hexStrLength; i += 2) {
                        words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
                    }

                    return new WordArray.init(words, hexStrLength / 2);
                }
            };

            /**
             * Latin1 encoding strategy.
             */
            var Latin1 = C_enc.Latin1 = {
                /**
                 * Converts a word array to a Latin1 string.
                 *
                 * @param {WordArray} wordArray The word array.
                 *
                 * @return {string} The Latin1 string.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
                 */
                stringify: function(wordArray) {
                    // Shortcuts
                    var words = wordArray.words;
                    var sigBytes = wordArray.sigBytes;

                    // Convert
                    var latin1Chars = [];
                    for (var i = 0; i < sigBytes; i++) {
                        var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                        latin1Chars.push(String.fromCharCode(bite));
                    }

                    return latin1Chars.join('');
                },

                /**
                 * Converts a Latin1 string to a word array.
                 *
                 * @param {string} latin1Str The Latin1 string.
                 *
                 * @return {WordArray} The word array.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
                 */
                parse: function(latin1Str) {
                    // Shortcut
                    var latin1StrLength = latin1Str.length;

                    // Convert
                    var words = [];
                    for (var i = 0; i < latin1StrLength; i++) {
                        words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
                    }

                    return new WordArray.init(words, latin1StrLength);
                }
            };

            /**
             * UTF-8 encoding strategy.
             */
            var Utf8 = C_enc.Utf8 = {
                /**
                 * Converts a word array to a UTF-8 string.
                 *
                 * @param {WordArray} wordArray The word array.
                 *
                 * @return {string} The UTF-8 string.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
                 */
                stringify: function(wordArray) {
                    try {
                        return decodeURIComponent(escape(Latin1.stringify(wordArray)));
                    } catch (e) {
                        throw new Error('Malformed UTF-8 data');
                    }
                },

                /**
                 * Converts a UTF-8 string to a word array.
                 *
                 * @param {string} utf8Str The UTF-8 string.
                 *
                 * @return {WordArray} The word array.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
                 */
                parse: function(utf8Str) {
                    return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
                }
            };

            /**
             * Abstract buffered block algorithm template.
             *
             * The property blockSize must be implemented in a concrete subtype.
             *
             * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
             */
            var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
                /**
                 * Resets this block algorithm's data buffer to its initial state.
                 *
                 * @example
                 *
                 *     bufferedBlockAlgorithm.reset();
                 */
                reset: function() {
                    // Initial values
                    this._data = new WordArray.init();
                    this._nDataBytes = 0;
                },

                /**
                 * Adds new data to this block algorithm's buffer.
                 *
                 * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
                 *
                 * @example
                 *
                 *     bufferedBlockAlgorithm._append('data');
                 *     bufferedBlockAlgorithm._append(wordArray);
                 */
                _append: function(data) {
                    // Convert string to WordArray, else assume WordArray already
                    if (typeof data == 'string') {
                        data = Utf8.parse(data);
                    }

                    // Append
                    this._data.concat(data);
                    this._nDataBytes += data.sigBytes;
                },

                /**
                 * Processes available data blocks.
                 *
                 * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
                 *
                 * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
                 *
                 * @return {WordArray} The processed data.
                 *
                 * @example
                 *
                 *     var processedData = bufferedBlockAlgorithm._process();
                 *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
                 */
                _process: function(doFlush) {
                    // Shortcuts
                    var data = this._data;
                    var dataWords = data.words;
                    var dataSigBytes = data.sigBytes;
                    var blockSize = this.blockSize;
                    var blockSizeBytes = blockSize * 4;

                    // Count blocks ready
                    var nBlocksReady = dataSigBytes / blockSizeBytes;
                    if (doFlush) {
                        // Round up to include partial blocks
                        nBlocksReady = Math.ceil(nBlocksReady);
                    } else {
                        // Round down to include only full blocks,
                        // less the number of blocks that must remain in the buffer
                        nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
                    }

                    // Count words ready
                    var nWordsReady = nBlocksReady * blockSize;

                    // Count bytes ready
                    var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

                    // Process blocks
                    if (nWordsReady) {
                        for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                            // Perform concrete-algorithm logic
                            this._doProcessBlock(dataWords, offset);
                        }

                        // Remove processed words
                        var processedWords = dataWords.splice(0, nWordsReady);
                        data.sigBytes -= nBytesReady;
                    }

                    // Return processed words
                    return new WordArray.init(processedWords, nBytesReady);
                },

                /**
                 * Creates a copy of this object.
                 *
                 * @return {Object} The clone.
                 *
                 * @example
                 *
                 *     var clone = bufferedBlockAlgorithm.clone();
                 */
                clone: function() {
                    var clone = Base.clone.call(this);
                    clone._data = this._data.clone();

                    return clone;
                },

                _minBufferSize: 0
            });

            /**
             * Abstract hasher template.
             *
             * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
             */
            var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
                /**
                 * Configuration options.
                 */
                cfg: Base.extend(),

                /**
                 * Initializes a newly created hasher.
                 *
                 * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
                 *
                 * @example
                 *
                 *     var hasher = CryptoJS.algo.SHA256.create();
                 */
                init: function(cfg) {
                    // Apply config defaults
                    this.cfg = this.cfg.extend(cfg);

                    // Set initial values
                    this.reset();
                },

                /**
                 * Resets this hasher to its initial state.
                 *
                 * @example
                 *
                 *     hasher.reset();
                 */
                reset: function() {
                    // Reset data buffer
                    BufferedBlockAlgorithm.reset.call(this);

                    // Perform concrete-hasher logic
                    this._doReset();
                },

                /**
                 * Updates this hasher with a message.
                 *
                 * @param {WordArray|string} messageUpdate The message to append.
                 *
                 * @return {Hasher} This hasher.
                 *
                 * @example
                 *
                 *     hasher.update('message');
                 *     hasher.update(wordArray);
                 */
                update: function(messageUpdate) {
                    // Append
                    this._append(messageUpdate);

                    // Update the hash
                    this._process();

                    // Chainable
                    return this;
                },

                /**
                 * Finalizes the hash computation.
                 * Note that the finalize operation is effectively a destructive, read-once operation.
                 *
                 * @param {WordArray|string} messageUpdate (Optional) A final message update.
                 *
                 * @return {WordArray} The hash.
                 *
                 * @example
                 *
                 *     var hash = hasher.finalize();
                 *     var hash = hasher.finalize('message');
                 *     var hash = hasher.finalize(wordArray);
                 */
                finalize: function(messageUpdate) {
                    // Final message update
                    if (messageUpdate) {
                        this._append(messageUpdate);
                    }

                    // Perform concrete-hasher logic
                    var hash = this._doFinalize();

                    return hash;
                },

                blockSize: 512 / 32,

                /**
                 * Creates a shortcut function to a hasher's object interface.
                 *
                 * @param {Hasher} hasher The hasher to create a helper for.
                 *
                 * @return {Function} The shortcut function.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
                 */
                _createHelper: function(hasher) {
                    return function(message, cfg) {
                        return new hasher.init(cfg).finalize(message);
                    };
                },

                /**
                 * Creates a shortcut function to the HMAC's object interface.
                 *
                 * @param {Hasher} hasher The hasher to use in this HMAC helper.
                 *
                 * @return {Function} The shortcut function.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
                 */
                _createHmacHelper: function(hasher) {
                    return function(message, key) {
                        return new C_algo.HMAC.init(hasher, key).finalize(message);
                    };
                }
            });

            /**
             * Algorithm namespace.
             */
            var C_algo = C.algo = {};

            return C;
        }(Math));

        return CryptoJS;

    }

    function x64Core() {
        var CryptoJS = core();

        (function(undefined) {
            // Shortcuts
            var C = CryptoJS;
            var C_lib = C.lib;
            var Base = C_lib.Base;
            var X32WordArray = C_lib.WordArray;

            /**
             * x64 namespace.
             */
            var C_x64 = C.x64 = {};

            /**
             * A 64-bit word.
             */
            var X64Word = C_x64.Word = Base.extend({
                /**
                 * Initializes a newly created 64-bit word.
                 *
                 * @param {number} high The high 32 bits.
                 * @param {number} low The low 32 bits.
                 *
                 * @example
                 *
                 *     var x64Word = CryptoJS.x64.Word.create(0x00010203, 0x04050607);
                 */
                init: function(high, low) {
                    this.high = high;
                    this.low = low;
                }

                /**
                 * Bitwise NOTs this word.
                 *
                 * @return {X64Word} A new x64-Word object after negating.
                 *
                 * @example
                 *
                 *     var negated = x64Word.not();
                 */
                // not: function () {
                // var high = ~this.high;
                // var low = ~this.low;

                // return X64Word.create(high, low);
                // },

                /**
                 * Bitwise ANDs this word with the passed word.
                 *
                 * @param {X64Word} word The x64-Word to AND with this word.
                 *
                 * @return {X64Word} A new x64-Word object after ANDing.
                 *
                 * @example
                 *
                 *     var anded = x64Word.and(anotherX64Word);
                 */
                // and: function (word) {
                // var high = this.high & word.high;
                // var low = this.low & word.low;

                // return X64Word.create(high, low);
                // },

                /**
                 * Bitwise ORs this word with the passed word.
                 *
                 * @param {X64Word} word The x64-Word to OR with this word.
                 *
                 * @return {X64Word} A new x64-Word object after ORing.
                 *
                 * @example
                 *
                 *     var ored = x64Word.or(anotherX64Word);
                 */
                // or: function (word) {
                // var high = this.high | word.high;
                // var low = this.low | word.low;

                // return X64Word.create(high, low);
                // },

                /**
                 * Bitwise XORs this word with the passed word.
                 *
                 * @param {X64Word} word The x64-Word to XOR with this word.
                 *
                 * @return {X64Word} A new x64-Word object after XORing.
                 *
                 * @example
                 *
                 *     var xored = x64Word.xor(anotherX64Word);
                 */
                // xor: function (word) {
                // var high = this.high ^ word.high;
                // var low = this.low ^ word.low;

                // return X64Word.create(high, low);
                // },

                /**
                 * Shifts this word n bits to the left.
                 *
                 * @param {number} n The number of bits to shift.
                 *
                 * @return {X64Word} A new x64-Word object after shifting.
                 *
                 * @example
                 *
                 *     var shifted = x64Word.shiftL(25);
                 */
                // shiftL: function (n) {
                // if (n < 32) {
                // var high = (this.high << n) | (this.low >>> (32 - n));
                // var low = this.low << n;
                // } else {
                // var high = this.low << (n - 32);
                // var low = 0;
                // }

                // return X64Word.create(high, low);
                // },

                /**
                 * Shifts this word n bits to the right.
                 *
                 * @param {number} n The number of bits to shift.
                 *
                 * @return {X64Word} A new x64-Word object after shifting.
                 *
                 * @example
                 *
                 *     var shifted = x64Word.shiftR(7);
                 */
                // shiftR: function (n) {
                // if (n < 32) {
                // var low = (this.low >>> n) | (this.high << (32 - n));
                // var high = this.high >>> n;
                // } else {
                // var low = this.high >>> (n - 32);
                // var high = 0;
                // }

                // return X64Word.create(high, low);
                // },

                /**
                 * Rotates this word n bits to the left.
                 *
                 * @param {number} n The number of bits to rotate.
                 *
                 * @return {X64Word} A new x64-Word object after rotating.
                 *
                 * @example
                 *
                 *     var rotated = x64Word.rotL(25);
                 */
                // rotL: function (n) {
                // return this.shiftL(n).or(this.shiftR(64 - n));
                // },

                /**
                 * Rotates this word n bits to the right.
                 *
                 * @param {number} n The number of bits to rotate.
                 *
                 * @return {X64Word} A new x64-Word object after rotating.
                 *
                 * @example
                 *
                 *     var rotated = x64Word.rotR(7);
                 */
                // rotR: function (n) {
                // return this.shiftR(n).or(this.shiftL(64 - n));
                // },

                /**
                 * Adds this word with the passed word.
                 *
                 * @param {X64Word} word The x64-Word to add with this word.
                 *
                 * @return {X64Word} A new x64-Word object after adding.
                 *
                 * @example
                 *
                 *     var added = x64Word.add(anotherX64Word);
                 */
                // add: function (word) {
                // var low = (this.low + word.low) | 0;
                // var carry = (low >>> 0) < (this.low >>> 0) ? 1 : 0;
                // var high = (this.high + word.high + carry) | 0;

                // return X64Word.create(high, low);
                // }
            });

            /**
             * An array of 64-bit words.
             *
             * @property {Array} words The array of CryptoJS.x64.Word objects.
             * @property {number} sigBytes The number of significant bytes in this word array.
             */
            var X64WordArray = C_x64.WordArray = Base.extend({
                /**
                 * Initializes a newly created word array.
                 *
                 * @param {Array} words (Optional) An array of CryptoJS.x64.Word objects.
                 * @param {number} sigBytes (Optional) The number of significant bytes in the words.
                 *
                 * @example
                 *
                 *     var wordArray = CryptoJS.x64.WordArray.create();
                 *
                 *     var wordArray = CryptoJS.x64.WordArray.create([
                 *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
                 *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
                 *     ]);
                 *
                 *     var wordArray = CryptoJS.x64.WordArray.create([
                 *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
                 *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
                 *     ], 10);
                 */
                init: function(words, sigBytes) {
                    words = this.words = words || [];

                    if (sigBytes != undefined) {
                        this.sigBytes = sigBytes;
                    } else {
                        this.sigBytes = words.length * 8;
                    }
                },

                /**
                 * Converts this 64-bit word array to a 32-bit word array.
                 *
                 * @return {CryptoJS.lib.WordArray} This word array's data as a 32-bit word array.
                 *
                 * @example
                 *
                 *     var x32WordArray = x64WordArray.toX32();
                 */
                toX32: function() {
                    // Shortcuts
                    var x64Words = this.words;
                    var x64WordsLength = x64Words.length;

                    // Convert
                    var x32Words = [];
                    for (var i = 0; i < x64WordsLength; i++) {
                        var x64Word = x64Words[i];
                        x32Words.push(x64Word.high);
                        x32Words.push(x64Word.low);
                    }

                    return X32WordArray.create(x32Words, this.sigBytes);
                },

                /**
                 * Creates a copy of this word array.
                 *
                 * @return {X64WordArray} The clone.
                 *
                 * @example
                 *
                 *     var clone = x64WordArray.clone();
                 */
                clone: function() {
                    var clone = Base.clone.call(this);

                    // Clone "words" array
                    var words = clone.words = this.words.slice(0);

                    // Clone each X64Word object
                    var wordsLength = words.length;
                    for (var i = 0; i < wordsLength; i++) {
                        words[i] = words[i].clone();
                    }

                    return clone;
                }
            });
        }());

        return CryptoJS;

    }

    var CryptoJS = x64Core();

    (function(Math) {
        // Shortcuts
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var Hasher = C_lib.Hasher;
        var C_x64 = C.x64;
        var X64Word = C_x64.Word;
        var C_algo = C.algo;

        // Constants tables
        var RHO_OFFSETS = [];
        var PI_INDEXES = [];
        var ROUND_CONSTANTS = [];

        // Compute Constants
        (function() {
            // Compute rho offset constants
            var x = 1,
                y = 0;
            for (var t = 0; t < 24; t++) {
                RHO_OFFSETS[x + 5 * y] = ((t + 1) * (t + 2) / 2) % 64;

                var newX = y % 5;
                var newY = (2 * x + 3 * y) % 5;
                x = newX;
                y = newY;
            }

            // Compute pi index constants
            for (var x = 0; x < 5; x++) {
                for (var y = 0; y < 5; y++) {
                    PI_INDEXES[x + 5 * y] = y + ((2 * x + 3 * y) % 5) * 5;
                }
            }

            // Compute round constants
            var LFSR = 0x01;
            for (var i = 0; i < 24; i++) {
                var roundConstantMsw = 0;
                var roundConstantLsw = 0;

                for (var j = 0; j < 7; j++) {
                    if (LFSR & 0x01) {
                        var bitPosition = (1 << j) - 1;
                        if (bitPosition < 32) {
                            roundConstantLsw ^= 1 << bitPosition;
                        } else /* if (bitPosition >= 32) */ {
                            roundConstantMsw ^= 1 << (bitPosition - 32);
                        }
                    }

                    // Compute next LFSR
                    if (LFSR & 0x80) {
                        // Primitive polynomial over GF(2): x^8 + x^6 + x^5 + x^4 + 1
                        LFSR = (LFSR << 1) ^ 0x71;
                    } else {
                        LFSR <<= 1;
                    }
                }

                ROUND_CONSTANTS[i] = X64Word.create(roundConstantMsw, roundConstantLsw);
            }
        }());

        // Reusable objects for temporary values
        var T = [];
        (function() {
            for (var i = 0; i < 25; i++) {
                T[i] = X64Word.create();
            }
        }());

        /**
         * SHA-3 hash algorithm.
         */
        var SHA3 = C_algo.SHA3 = Hasher.extend({
            /**
             * Configuration options.
             *
             * @property {number} outputLength
             *   The desired number of bits in the output hash.
             *   Only values permitted are: 224, 256, 384, 512.
             *   Default: 512
             */
            cfg: Hasher.cfg.extend({
                outputLength: 512
            }),

            _doReset: function() {
                var state = this._state = []
                for (var i = 0; i < 25; i++) {
                    state[i] = new X64Word.init();
                }

                this.blockSize = (1600 - 2 * this.cfg.outputLength) / 32;
            },

            _doProcessBlock: function(M, offset) {
                // Shortcuts
                var state = this._state;
                var nBlockSizeLanes = this.blockSize / 2;

                // Absorb
                for (var i = 0; i < nBlockSizeLanes; i++) {
                    // Shortcuts
                    var M2i = M[offset + 2 * i];
                    var M2i1 = M[offset + 2 * i + 1];

                    // Swap endian
                    M2i = (
                        (((M2i << 8) | (M2i >>> 24)) & 0x00ff00ff) |
                        (((M2i << 24) | (M2i >>> 8)) & 0xff00ff00)
                    );
                    M2i1 = (
                        (((M2i1 << 8) | (M2i1 >>> 24)) & 0x00ff00ff) |
                        (((M2i1 << 24) | (M2i1 >>> 8)) & 0xff00ff00)
                    );

                    // Absorb message into state
                    var lane = state[i];
                    lane.high ^= M2i1;
                    lane.low ^= M2i;
                }

                // Rounds
                for (var round = 0; round < 24; round++) {
                    // Theta
                    for (var x = 0; x < 5; x++) {
                        // Mix column lanes
                        var tMsw = 0,
                            tLsw = 0;
                        for (var y = 0; y < 5; y++) {
                            var lane = state[x + 5 * y];
                            tMsw ^= lane.high;
                            tLsw ^= lane.low;
                        }

                        // Temporary values
                        var Tx = T[x];
                        Tx.high = tMsw;
                        Tx.low = tLsw;
                    }
                    for (var x = 0; x < 5; x++) {
                        // Shortcuts
                        var Tx4 = T[(x + 4) % 5];
                        var Tx1 = T[(x + 1) % 5];
                        var Tx1Msw = Tx1.high;
                        var Tx1Lsw = Tx1.low;

                        // Mix surrounding columns
                        var tMsw = Tx4.high ^ ((Tx1Msw << 1) | (Tx1Lsw >>> 31));
                        var tLsw = Tx4.low ^ ((Tx1Lsw << 1) | (Tx1Msw >>> 31));
                        for (var y = 0; y < 5; y++) {
                            var lane = state[x + 5 * y];
                            lane.high ^= tMsw;
                            lane.low ^= tLsw;
                        }
                    }

                    // Rho Pi
                    for (var laneIndex = 1; laneIndex < 25; laneIndex++) {
                        // Shortcuts
                        var lane = state[laneIndex];
                        var laneMsw = lane.high;
                        var laneLsw = lane.low;
                        var rhoOffset = RHO_OFFSETS[laneIndex];

                        // Rotate lanes
                        if (rhoOffset < 32) {
                            var tMsw = (laneMsw << rhoOffset) | (laneLsw >>> (32 - rhoOffset));
                            var tLsw = (laneLsw << rhoOffset) | (laneMsw >>> (32 - rhoOffset));
                        } else /* if (rhoOffset >= 32) */ {
                            var tMsw = (laneLsw << (rhoOffset - 32)) | (laneMsw >>> (64 - rhoOffset));
                            var tLsw = (laneMsw << (rhoOffset - 32)) | (laneLsw >>> (64 - rhoOffset));
                        }

                        // Transpose lanes
                        var TPiLane = T[PI_INDEXES[laneIndex]];
                        TPiLane.high = tMsw;
                        TPiLane.low = tLsw;
                    }

                    // Rho pi at x = y = 0
                    var T0 = T[0];
                    var state0 = state[0];
                    T0.high = state0.high;
                    T0.low = state0.low;

                    // Chi
                    for (var x = 0; x < 5; x++) {
                        for (var y = 0; y < 5; y++) {
                            // Shortcuts
                            var laneIndex = x + 5 * y;
                            var lane = state[laneIndex];
                            var TLane = T[laneIndex];
                            var Tx1Lane = T[((x + 1) % 5) + 5 * y];
                            var Tx2Lane = T[((x + 2) % 5) + 5 * y];

                            // Mix rows
                            lane.high = TLane.high ^ (~Tx1Lane.high & Tx2Lane.high);
                            lane.low = TLane.low ^ (~Tx1Lane.low & Tx2Lane.low);
                        }
                    }

                    // Iota
                    var lane = state[0];
                    var roundConstant = ROUND_CONSTANTS[round];
                    lane.high ^= roundConstant.high;
                    lane.low ^= roundConstant.low;;
                }
            },

            _doFinalize: function() {
                // Shortcuts
                var data = this._data;
                var dataWords = data.words;
                var nBitsTotal = this._nDataBytes * 8;
                var nBitsLeft = data.sigBytes * 8;
                var blockSizeBits = this.blockSize * 32;

                // Add padding
                dataWords[nBitsLeft >>> 5] |= 0x1 << (24 - nBitsLeft % 32);
                dataWords[((Math.ceil((nBitsLeft + 1) / blockSizeBits) * blockSizeBits) >>> 5) - 1] |= 0x80;
                data.sigBytes = dataWords.length * 4;

                // Hash final blocks
                this._process();

                // Shortcuts
                var state = this._state;
                var outputLengthBytes = this.cfg.outputLength / 8;
                var outputLengthLanes = outputLengthBytes / 8;

                // Squeeze
                var hashWords = [];
                for (var i = 0; i < outputLengthLanes; i++) {
                    // Shortcuts
                    var lane = state[i];
                    var laneMsw = lane.high;
                    var laneLsw = lane.low;

                    // Swap endian
                    laneMsw = (
                        (((laneMsw << 8) | (laneMsw >>> 24)) & 0x00ff00ff) |
                        (((laneMsw << 24) | (laneMsw >>> 8)) & 0xff00ff00)
                    );
                    laneLsw = (
                        (((laneLsw << 8) | (laneLsw >>> 24)) & 0x00ff00ff) |
                        (((laneLsw << 24) | (laneLsw >>> 8)) & 0xff00ff00)
                    );

                    // Squeeze state to retrieve hash
                    hashWords.push(laneLsw);
                    hashWords.push(laneMsw);
                }

                // Return final computed hash
                return new WordArray.init(hashWords, outputLengthBytes);
            },

            clone: function() {
                var clone = Hasher.clone.call(this);

                var state = clone._state = this._state.slice(0);
                for (var i = 0; i < 25; i++) {
                    state[i] = state[i].clone();
                }

                return clone;
            }
        });

        /**
         * Shortcut function to the hasher's object interface.
         *
         * @param {WordArray|string} message The message to hash.
         *
         * @return {WordArray} The hash.
         *
         * @static
         *
         * @example
         *
         *     var hash = CryptoJS.SHA3('message');
         *     var hash = CryptoJS.SHA3(wordArray);
         */
        C.SHA3 = Hasher._createHelper(SHA3);

        /**
         * Shortcut function to the HMAC's object interface.
         *
         * @param {WordArray|string} message The message to hash.
         * @param {WordArray|string} key The secret key.
         *
         * @return {WordArray} The HMAC.
         *
         * @static
         *
         * @example
         *
         *     var hmac = CryptoJS.HmacSHA3(message, key);
         */
        C.HmacSHA3 = Hasher._createHmacHelper(SHA3);
    }(Math));

    return CryptoJS.SHA3;

}));