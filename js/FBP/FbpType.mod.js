import FbpObject from "./FbpObject.mod.js";

const inheritSym = Symbol("inherit from");
const castToSym = Symbol("cast to");

const registeredTypesSym = Symbol("registered types");

const getParentSym = Symbol("get parent type by index");
const defaultValueSym = Symbol("default value");

const nameSym = Symbol("name");


class FbpType extends FbpObject {
    [inheritSym] = [];
    [castToSym] = new Map();
    [defaultValueSym];
    [nameSym];
    typesTable;

    /**
     * @constructor
     * @param {Map<string, FbpType>} typesTable
     * @param {string} [name]
     * @param {any} defaultValue
     * @param {string[]|string} [inheritFrom]
     * @param {Map<string, function>} [castTo]
     * @param {function(string):any} [parse]
     * @param {function(any):string} [str]
     * @param {Object} [attributes]
     */
    constructor(typesTable, {name=undefined, defaultValue, inheritFrom, castTo,
                parse, str, ...attributes}) {
        const inheritances = [];
        if (inheritFrom) {
            if (Array.isArray(inheritFrom))
                inheritances.push(...inheritFrom);
            else if (inheritFrom.substr)
                inheritances.push(inheritFrom);
            else
                throw Error("inheritance must be type name or an array of type names");
        }

        super(attributes);
        this.typesTable = typesTable
        this[nameSym] = name;
        this.addInheritances(...inheritances);

        if (castTo)
           this[castToSym].forEach((v,k)=> this.setCast(k, v));

        this[defaultValueSym] = defaultValue;
        if(str)
            this.str = str;
        if(parse)
            this.parse = parse;
        //TODO parse, toString
    }

    getReservedKeys() {
        return super.getReservedKeys().concat([
            'inheritFrom',
            'castTo'
        ]);
    }
    get defaultValue() {
        return this[defaultValueSym];
    }

    get name() {
        return this[nameSym];
    }

    addInheritances(...parentTypes) {
        this[inheritSym].push(...parentTypes);
    }

    setCast(toType, castFunction) {
        this[castToSym].set(toType, castFunction);
    }
    [getParentSym](idx) {
        return this.typesTable.get(this[inheritSym][idx]);
    }

    /**
     * @param {string|FbpType} type
     * @return {boolean}
     */
    inheritFrom(type) {
        if(type instanceof FbpType)
            type = type[nameSym];
        if(this[inheritSym].includes(type))
            return true;
        let i = this[inheritSym].length;
        while(i--) {
            if(this[getParentSym](i).inheritFrom(type))
                return true;
        }
        return false;
    }

    /**
     * @param {string|FbpType} type
     * @returns {boolean}
     */
    canBeCastTo(type) {
        if(type instanceof FbpType)
            type = type.name;
        return type === this.name || this.inheritFrom(type) || this[castToSym].has(type);
    }

    /**
     * @param {*} object
     * @param {string} toType
     * @return {*}
     */
    cast(object, toType) {
        if(toType instanceof FbpType)
            toType = toType[nameSym];
        const caster = this[castToSym].get(toType);
        if (caster)
            return caster(object)
        return object;
    }
}

export default FbpType;