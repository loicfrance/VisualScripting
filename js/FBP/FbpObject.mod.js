
const attrSym = Symbol("attributes");
const displaySym = Symbol("Fbp Object display object");

// noinspection JSUnusedGlobalSymbols
/**
 * @typedef FbpObjectDisplay
 * @property {function()} onDestroy
 *           called when the object is disconnected from the display
 * @property {function(string, ...any?)} [onChange]
 *           called when the object is modified, with the modified object
 *           or attribute's name
 */

/**
 * @enum
 */
const FbpObjectChangeReason = {
    ATTRIBUTE: "attr"
};

class FbpObject {
    [attrSym] = new Map();
    [displaySym] = null;

    /**
     * @param {Object?} attributes
     */
    constructor(attributes) {
        if(attributes) {
            for (const [key, value] of Object.entries(attributes))
                this.setAttr(key, value);
        }
    }

//##############################################################################
//#                                  DISPLAY                                   #
//##############################################################################

    /** @type {FbpObjectDisplay|null} */
    set display(obj) {
        if(this[displaySym])
            this[displaySym].onDestroy();
        if(obj) {
            if (!(obj.onDestroy))
                throw Error("display object must have \"onDestroy\" functions");
            this[displaySym] = obj;
        }
    }
    /** @type {FbpObjectDisplay|null} */
    get display() {
        return this[displaySym];
    }
    createDisplay(constructor, ...params) {
        this.display = new constructor(this, params);
        return this.display;
    }

    notifyChange(key, ...params) {
        const display = this.display;
        if(display && display.onChange)
            display.onChange(key, ...params);
    }

//##############################################################################
//#                                 ATTRIBUTES                                 #
//##############################################################################

    /**
     * @param {*} key
     * @param {*} value
     * @return {boolean} true if the attribute didn't already have this value,
     *                   false otherwise
     */
    setAttr(key, value) {
        if (this.getReservedKeys().indexOf(key) >= 0)
            throw Error(`the key '${key}' is reserved`);

        if (value !== this.getAttr(key)) {
            this[attrSym].set(key, value);
            this.notifyChange(FbpObjectChangeReason.ATTRIBUTE, key);
            return true;
        }
        return false;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {*} key
     * @return {boolean} true if an attribute with this key existed,
     *                   false otherwise
     */
    deleteAttr(key) {
        if (this.hasAttr(key)) {
            this[attrSym].delete(key);
            this.notifyChange(FbpObjectChangeReason.ATTRIBUTE, key);
            return true;
        }
        return false
    }

    /**
     * @param {*} key
     * @param {*} defaultValue?
     * @return {*}
     */
    getAttr(key, defaultValue = undefined) {
        if (this.hasAttr(key))
            return this[attrSym].get(key);
        else
            return defaultValue;
    }

    /**
     * @param {*} key
     * @return {boolean} true is an attribute with the specified key exists for this object
     */
    hasAttr(key) {
        return this[attrSym].has(key);
    }

    /**
     * @return {*[]}
     */
    getAllAttrKeys() {
        return this[attrSym].keys();
    }

    /**
     * @return {*[]}
     */
    getReservedKeys() {
        return ['display'];
    }

//##############################################################################
//#                               OTHER METHODS                                #
//##############################################################################

    delete() {
        this.display = null;
    }

    exportJSON() {
        return Object.fromEntries(this[attrSym].entries());
    }
}
export default FbpObject;
export {FbpObject, FbpObjectChangeReason};