import {loadString} from "../../../jslib/utils/tools.mod.js";
import FbpLoader from "./FbpLibLoader.mod.js";
import {FbpSheet} from "./FbpSheet.mod.js";
import FbpType from "./FbpType.mod.js";


const typesTableSym = Symbol("fbp types table");
const sheetsTableSym = Symbol("fbp sheets table");
const libLoaderSym = Symbol("FBP Lib Loader");

class FbpEnvironment {

    [typesTableSym] = new Map();
    [sheetsTableSym] = new Map();
    [libLoaderSym];

    constructor() {
        this[libLoaderSym] = new FbpLoader();
    }

    /**
     * @type FbpLoader
     * @readonly
     */
    get libLoader() {
        return this[libLoaderSym];
    }

//##############################################################################
//#                                   SHEETS                                   #
//##############################################################################

    getSheet(name) {
        return this[sheetsTableSym].get(name);
    }
    hasSheet(name) {
        return this[sheetsTableSym].has(name);
    }
    clearAllSheet() {
        this[sheetsTableSym].clear();
    }

    createSheet(name) {
        if (this.hasSheet(name))
            throw Error(`an fbp sheet with name "${name}" already exists`);
        const sheet = new FbpSheet(this);
        this[sheetsTableSym].set(name, sheet);
        return sheet;
    }
    deleteSheet(name) {
        const sheet = this.getSheet(name);
        this[sheetsTableSym].delete(name);
    }

    async importSheet(name, url) {
        const sheet = this.createSheet(name);
        const jsonString = await loadString(url);
        await sheet.importJSON(JSON.parse(jsonString));
    }

//##############################################################################
//#                                   TYPES                                    #
//##############################################################################

    setType(name, fbpType) {
        if (fbpType)
            this[typesTableSym].set(name, fbpType);
        else
            this[typesTableSym].delete(name);
    }
    getType(name) {
        return this[typesTableSym].get(name);
    }
    hasType(name) {
        return this[typesTableSym].has(name);
    }
    setTypes(typesTable, override=true) {
        typesTable.forEach((type, name) => {
            if (override || !(this.hasType(name)))
                this.setType(name, type);
        });
    }
    clearAllTypes() {
        return this[typesTableSym].clear();
    }
    async importTypes(libPath, override = true) {
        /** @type TypesModule */
        const types = await this.libLoader.loadTypesLib(libPath);
        this.setTypes(types.getTypes(FbpType), override);
    }
}

export default FbpEnvironment;
export {
  FbpEnvironment
};