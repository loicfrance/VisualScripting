import FbpType from "../FBP/FbpType.mod.js";
import {hashCode, PRNG} from "../../../jsLibs_Modules/utils/tools.mod.js";
import {HSVtoRGB} from "../../../jsLibs_Modules/utils/colors.mod.js";

const defaultValueSym = Symbol();


class DesignType extends FbpType {
    constructor({
            name,
            inherited = undefined,
            color = undefined,
            defaultValue = undefined
        }) {
        // noinspection JSCheckFunctionSignatures
        super(...arguments);
        if(color) {
            this.color = color;
        } else {
            const prng = new PRNG(hashCode(name));

            this.color = HSVtoRGB(
                prng.nextFloat(),
                1-prng.nextRangedFloat(0, 0.5),
                1-prng.nextRangedFloat(0, 0.5));
        }
        this[defaultValueSym] = defaultValue;
    }

    /**
     * @return {*}
     */
    get defaultValue() {
        return this[defaultValueSym];
    }

    /**
     * @param {FbpType} type
     * @return {boolean}
     */
    canBeCastTo(type) {
        switch(type.name) {
            case 'void' : return true;
            case 'any' : return this.name !== 'void';
            default : return super.canBeCastTo(type);
        }
    }

    /**
     * @param {string} string
     * @return {*}
     */
    parse(string) {
        switch(this.name) {
            case 'void': return undefined;
            case 'any' : return string;
            case 'string' : return string;
            case 'json' : return JSON.parse(string);
            default : return string;
        }
    }
    toJSON(key) {
        if (key) {
            return this.name;
        } else return {
            name: this.name,
            color: this.color
        };
    }
}
class NumberDesignType extends DesignType {
    constructor({name, color}) {
        const options = arguments[0];
        options.defaultValue = 0;
        // noinspection JSCheckFunctionSignatures
        super(options);
    }
    canBeCastTo(type) {
        if(type.inheritFrom(typesTable['number']))
            return true;
        else return super.canBeCastTo(type);
    }
    parse(string) {
        switch(this.name) {
            case 'int' : return parseInt(string);
            case 'short' : return parseInt(string) & 0xFFFF;
            case 'char' : return parseInt(string) & 0xFF;
            case 'float' : return parseFloat(string);
            default : return this.parseFloat(string);
        }
    }
    toJSON(key) {
        const result = super.toJSON(key);
        if(result.substr)
            return result;
        else {
            result.category = 'number';
            return result;
        }
    }
}

const typesTable = {
    void: new DesignType({name: 'void', color: '#FFF'}),
    any: new DesignType({name: 'any', color: '#888'}),
    string: new DesignType({name: 'string', color: '#0A0', defaultValue: ''}),
    number: new NumberDesignType({name: 'number', color: '#00f'}),
    addType(type) {
        this[type.name] = type;
    },
};

typesTable.addType(new NumberDesignType({name: 'int', color: '#04f'}));
typesTable.addType(new NumberDesignType({name: 'short', color: '#06f'}));
typesTable.addType(new NumberDesignType({name: 'char', color: '#08f'}));
typesTable.addType(new NumberDesignType({name: 'float', color: '#0CF'}));

export default DesignType;
export {
    DesignType,
    typesTable
}