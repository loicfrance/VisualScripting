import {PRNG} from "../../../jsLibs_Modules/utils/tools.mod.js";
import {PortValueVisibility} from "../design/DesignPort.mod.js";
import {FbpPassivePort, FbpPacketPort, FbpPortDirection, FbpPassivePassThroughPort} from "./FbpPort.mod.js";

const inputPortsSym = Symbol("Input ports list");
const outputPortsSym = Symbol("Output ports list");
const idSym = Symbol("Process id");
const sheetSym = Symbol("Fbp sheet holding this process");
const nameSym = Symbol("Process name");
const additionalInformationSym = Symbol("additional information");

const Random = new PRNG(0);

function generateProcessId(fbpSheet, id = Random.next())
{
    let nb_tries = 1000;
    while(nb_tries > 0 && fbpSheet.isProcessIdTaken(id)) {
        id = Random.next();
        nb_tries--;
    }
    if(nb_tries === 0 && fbpSheet.isProcessIdTaken(id)) {
        throw Error("Impossible to create an id that is not already taken");
    }
    return id
}


class FbpProcess {
    /** @type {FbpSheet} */
    [sheetSym];
    /** @type {string} */
    [nameSym];
    /** @type {number} */
    [idSym];
    /** @type {FbpPort[]} */
    [inputPortsSym] = [];
    /** @type {FbpPort[]} */
    [outputPortsSym] = [];

    [additionalInformationSym] = new Map();

    /**
     * @constructor
     * @param {FbpSheet} fbpSheet
     * @param {Object} attributes
     * @param {string} attributes.name
     * @param {number?} attributes.id
     * @param {...Object?} portAttributes
     * @param {string} portAttributes.name
     * @param {boolean?} portAttributes.active
     * @param {FbpType} portAttributes.type
     * @param {number?} portAttributes.id
     */
    constructor(fbpSheet, attributes, ...portAttributes) {
        this[sheetSym] = fbpSheet;
        this[nameSym] = attributes.name;
        this[idSym] = generateProcessId(fbpSheet, attributes.hasOwnProperty('id') ? attributes.id : Random.next());
        fbpSheet.onProcessCreated(this);
        // noinspection JSCheckFunctionSignatures
        for(const [key, value] of Object.entries(attributes)) {
            if(key !== 'name' && key !== 'id') {
                this.setInfo(key, value);
            }
        }
        if (portAttributes !== undefined) {
            for (const attrs in portAttributes) {
                this.createPort(attrs)
            }
        }
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    get id() {
        return this[idSym];
    }
    /** @type {FbpSheet} */
    get sheet() {
        return this[sheetSym];
    }
    /** @type {string} */
    get name() {
        return this[nameSym];
    }
    set name(value) {
        this[nameSym] = value;
        this.sheet.onProcessChanged(this);
    }
    // noinspection JSUnusedGlobalSymbols
    get deleted() {
        return this.sheet === undefined;
    }
    get inputSize() {
        return this[inputPortsSym].length;
    }
    // noinspection JSUnusedGlobalSymbols
    get outputSize() {
        return this[outputPortsSym].length;
    }

//######################################################################################################################
//#                                                  PORTS MANAGEMENT                                                  #
//######################################################################################################################

    /**
     * @param name
     * @param direction
     * @return {FbpPacketPort|FbpPassivePort|undefined}
     */
    getPort(name, direction = FbpPortDirection.UNKNOWN) {
        let list;
        switch(direction) {
            case FbpPortDirection.UNKNOWN :
                return this.getPort(name, FbpPortDirection.IN) || this.getPort(name, FbpPortDirection.OUT);
            case FbpPortDirection.IN    : list = this[inputPortsSym]; break;
            case FbpPortDirection.OUT   : list = this[outputPortsSym]; break;
            default : throw Error("invalid direction");
        }
        return list.find(p=>p.name === name);
    }

    createPort(attributes) {
        const passive = attributes.passive;
        const passThrough = attributes.passThrough;
        if (!passive && attributes.passThrough)
            throw new Error("Cannot create active pass-through ports");
        delete(attributes.passive);
        delete(attributes.passThrough);
        return passive ?
            (passThrough ? new FbpPassivePassThroughPort(this, attributes) : new FbpPassivePort(this, attributes))
            : new FbpPacketPort(this, attributes);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {FbpPort|string} port
     */
    deletePort(port) {
        if(port.substr) port = this.getPort(port);
        port.delete();
    }

    clearPorts() {
        let i = this[inputPortsSym].length;
        while(i--)
            this[inputPortsSym][i].delete();

        i = this[outputPortsSym].length;
        while(i--)
            this[outputPortsSym][i].delete();

        if(this[inputPortsSym].length > 0 || this[outputPortsSym].length > 0)
            throw Error("Error when removing ports");
    }
    /**
     * @param index
     * @return {FbpPacketPort|FbpPacketPort}
     */
    getInputPort(index) {
        return this[inputPortsSym][index];
    }

    /**
     * @param index
     * @return {FbpPacketPort|FbpPacketPort}
     */
    getOutputPort(index) {
        return this[outputPortsSym][index];
    }
    // noinspection JSUnusedGlobalSymbols
    sortInputPorts(compareFn) {
        this[inputPortsSym].sort(compareFn);
        this.sheet.onProcessChanged(this);
    }
    // noinspection JSUnusedGlobalSymbols
    sortOutputPorts(compareFn) {
        this[outputPortsSym].sort(compareFn);
        this.sheet.onProcessChanged(this);
    }
    // noinspection JSUnusedGlobalSymbols
    sortPorts(compareFn) {
        this[inputPortsSym].sort(compareFn);
        this[outputPortsSym].sort(compareFn);
        this.sheet.onProcessChanged(this);
    }

    /**
     * @param {FbpPassivePassThroughPort} port
     */
    getPassThroughValue(port) {
        return undefined;
    }
//######################################################################################################################
//#                                                     LISTENERS                                                      #
//######################################################################################################################

    onPortCreated(port) {
        this[port.input ? inputPortsSym : outputPortsSym].push(port);
        this.sheet.onPortCreated(port);
    }

    onPortDeleted(port) {
        const list = this[port.input ? inputPortsSym : outputPortsSym];
        const idx = list.indexOf(port);
        if(idx >= 0)
            this[port.input ? inputPortsSym : outputPortsSym].splice(idx, 1);
        else
            throw Error("this port does not belong to this process");
        this.sheet.onPortDeleted(port);
    }
    onPortChanged(port) {
        this.sheet.onPortChanged(port);
    }

//######################################################################################################################
//#                                                 SAVE/RETRIEVE DATA                                                 #
//######################################################################################################################

    exportJSON() {
        const obj = {
            id: this.id,
            name: this.name
        };
        Object.assign(obj, Object.fromEntries(this[additionalInformationSym].entries()));
        obj.ports = [...this[inputPortsSym].map(p=> p.exportJSON()), ...this[outputPortsSym].map(p=> p.exportJSON())];
        return obj;
    }
    // noinspection JSUnusedGlobalSymbols
    static fromJSON(object) {
        const process = new FbpProcess(object.name, object.id);
        if(object.ports && Array.isArray(object.ports))
            object.ports.forEach(p => process.createPort(p));
    }

    exportOperation() {
        return ""
    }

//######################################################################################################################
//#                                               ADDITIONAL INFORMATION                                               #
//######################################################################################################################

    /**
     * @param {*} key
     * @param {*} value
     */
    setInfo(key, value) {
        if (key in ["name", "id"])
            throw Error("additional information cannot use the reserved keys 'name' or 'id'.");
        if (value !== this.getInfo(key)) {
            this[additionalInformationSym].set(key, value);
            this.sheet.onProcessChanged(this);
        }
    }

    /**
     * @param {*} key
     */
    deleteInfo(key) {
        if (key in this[additionalInformationSym]) {
            this[additionalInformationSym].delete(key);
            this.sheet.onProcessChanged(this);
        }
    }

    /**
     * @param {*} key
     * @param {*} defaultValue?
     * @return {*}
     */
    getInfo(key, defaultValue = undefined) {
        if (this[additionalInformationSym].has(key))
            return this[additionalInformationSym].get(key);
        else
            return defaultValue;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {*[]}
     */
    getAllInfoKeys() {
        return this[additionalInformationSym].keys();
    }

//######################################################################################################################
//#                                                   OTHER METHODS                                                    #
//######################################################################################################################

    delete() {
        this.clearPorts();
        const sheet = this.sheet;
        this[sheetSym] = undefined;
        sheet.onProcessDeleted(this);
    }

    handlePacket(inputPort, msg) {
        // do nothing by default
    }

    toString() {
        return `${this.name}[${this.id.toString(16)}]`;
    }
}

class FbpSheetPortProcess extends FbpProcess {


    /**
     * @param {...Object} inputs
     * @param {string} inputs.name
     * @param {*} inputs.value
     */
    updateFromSheetInputs(...inputs) {
        const activePorts = [];
        inputs.forEach(({name, value}) => {
            const port = this.getPort(name);
            if (port.passive)
                port.value = value;
            else
                activePorts.push({port:port, packet:value})
        });
        activePorts.forEach(({port, packet})=> {
            port.send(packet);
        });
    }
}

export {FbpProcess};