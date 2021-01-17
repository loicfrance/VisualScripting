import {PRNG} from "../../../jslib/utils/tools.mod.js";
import FbpObject from "./FbpObject.mod.js";
import FbpPort, {FbpPortDirection as PORT_DIR, FbpPortDirection} from "./FbpPort.mod.js";

const inputPortsSym = Symbol("Input ports list");
const outputPortsSym = Symbol("Output ports list");
const idSym = Symbol("Process id");
const sheetSym = Symbol("Fbp sheet holding this process");
const nameSym = Symbol("Process name");

const handlerNameSym = Symbol("Process Handler name");
const handlerSym = Symbol("Process Handler");

/**
 * @enum
 */
const FbpProcessChangeReason = {
    SORT_PORTS: "ports_sort",
    PORT_CREATED: "port_created", // arguments: [created port]
    PORT_CHANGED: "port_changed", // arguments: [changed port]
    PORT_DELETED: "port_deleted", // arguments: [deleted port]
}

class FbpProcess extends FbpObject {
    /** @type {FbpSheet} */
    [sheetSym];
    /** @type {string} */
    [nameSym];
    /** @type {number} */
    [idSym];
    /** @type {string} */
    [handlerNameSym];
    /** @type {FbpProcessHandler} */
    [handlerSym];
    /** @type {FbpPort[]} */
    [inputPortsSym] = [];
    /** @type {FbpPort[]} */
    [outputPortsSym] = [];

    /**
     * @constructor
     * @param {FbpSheet} fbpSheet
     * @param {Object} config
     * @param {string} config.name
     * @param {number} [config.id]
     * @param {string} config.handler
     * @param {Object} [config.parameters]
     * @param {...Object} [config.attributes]
     */
    constructor(fbpSheet, config) {
        const {name, id, handler, parameters = {}, ...attributes} = config;
        super(attributes);
        this[sheetSym] = fbpSheet;
        this[nameSym] = name;
        this[idSym] = fbpSheet.generateProcessId(isNaN(id) ? NaN : id);
        if(!handler || !(handler.substr))
            throw Error("handler full name is necessary to create FBP process");
        if(!fbpSheet.libLoader.isHandlerLoaded(handler))
            throw Error(`handler ${handler} needs to be loaded before calling constructor`);
        this[handlerNameSym] = handler;
        this[handlerSym] = fbpSheet.libLoader.getLoadedHandler(handler);
        fbpSheet.onProcessCreated(this);

        if (this.handler.onCreate)
            this.handler.onCreate.call(this, parameters);
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
        this.notifyChange('name');
    }
    /** @type {FbpProcessHandler} */
    get handler() {
        return this[handlerSym] || {};
    }
    get handlerName() {
        return this[handlerNameSym];
    }
    get inputSize() {
        return this[inputPortsSym].length;
    }
    get outputSize() {
        return this[outputPortsSym].length;
    }

//######################################################################################################################
//#                                                  PORTS MANAGEMENT                                                  #
//######################################################################################################################

    /**
     * @param {string} name
     * @param {FbpPortDirection|string} [direction]
     * @return {FbpPort|undefined}
     */
    getPort(name, direction = FbpPortDirection.UNKNOWN) {
        let list;
        if (direction.substr)
            direction = FbpPortDirection.fromString(direction);

        switch(direction) {
            case FbpPortDirection.UNKNOWN :
                return this.getPort(name, FbpPortDirection.IN) || this.getPort(name, FbpPortDirection.OUT);
            case FbpPortDirection.IN    : list = this[inputPortsSym]; break;
            case FbpPortDirection.OUT   : list = this[outputPortsSym]; break;
            default : throw Error("invalid direction");
        }
        return list.find(p=>p.name === name);
    }
    /**
     * @param {Object} attributes - see {@link FbpPort.constructor} constructor for parameters details
     * @return {FbpPort} created port
     */
    createPort(attributes) {
        return new FbpPort(this, attributes);
    }
    /**
     * @param {Object...} attributes - see {@link FbpPort.constructor} constructor for parameters details
     */
    createPorts(...attributes) {
        for (const attrs of attributes) {
            this.createPort(attrs)
        }
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
            this.deletePort(this[inputPortsSym][i]);

        i = this[outputPortsSym].length;
        while(i--)
            this.deletePort(this[outputPortsSym][i]);

        if(this[inputPortsSym].length > 0 || this[outputPortsSym].length > 0)
            throw Error("Error when removing ports");
    }
    /**
     * @param index
     * @return {FbpPort}
     */
    getInputPort(index) {
        return this[inputPortsSym][index];
    }

    /**
     * @param index
     * @return {FbpPort}
     */
    getOutputPort(index) {
        return this[outputPortsSym][index];
    }
    // noinspection JSUnusedGlobalSymbols
    sortInputPorts(compareFn) {
        this[inputPortsSym].sort(compareFn);
        this.notifyChange(FbpProcessChangeReason.SORT_PORTS, PORT_DIR.IN);
    }
    // noinspection JSUnusedGlobalSymbols
    sortOutputPorts(compareFn) {
        this[outputPortsSym].sort(compareFn);
        this.notifyChange(FbpProcessChangeReason.SORT_PORTS, PORT_DIR.OUT);
    }
    // noinspection JSUnusedGlobalSymbols
    sortPorts(compareFn) {
        this[inputPortsSym].sort(compareFn);
        this[outputPortsSym].sort(compareFn);
    }

    /**
     * @param {FbpPort} port
     * @return {any}
     */
    getPassThroughValue(port) {
        if (this.handler.getPassThroughValue)
            return this.handler.getPassThroughValue.call(this, port.name);
        return undefined;
    }
//######################################################################################################################
//#                                                     LISTENERS                                                      #
//######################################################################################################################

    onPortCreated(port) {
        this[port.input ? inputPortsSym : outputPortsSym].push(port);
        this.notifyChange(FbpProcessChangeReason.PORT_CREATED, port);
    }

    onPortDeleted(port) {
        const list = this[port.input ? inputPortsSym : outputPortsSym];
        const idx = list.indexOf(port);
        if(idx >= 0)
            this[port.input ? inputPortsSym : outputPortsSym].splice(idx, 1);
        else
            throw Error("this port does not belong to this process");
        this.notifyChange(FbpProcessChangeReason.PORT_DELETED, port);
    }
    onPortChanged(port, key, ...params) {
        this.notifyChange(FbpProcessChangeReason.PORT_CHANGED, port, key, ...params);
    }
    notifyChange(...args) {
        super.notifyChange(...args);
        if (this.handler.onChange)
            this.handler.onChange.call(this, ...args);
    }

//######################################################################################################################
//#                                                 SAVE/RETRIEVE DATA                                                 #
//######################################################################################################################

    exportJSON() {
        return {
            id: this.id,
            name: this.name,
            ...super.exportJSON(),
            handler: this.handlerName, //TODO
            parameters: (this.handler.exportJSON ? this.handler.exportJSON.call(this) : {}),
            /*
            ports: [
                ...this[inputPortsSym].map(p=> p.exportJSON()),
                ...this[outputPortsSym].map(p=> p.exportJSON())
            ]
            */
        };
    }

    static async fromJSON(fbpSheet, object) {
        const {id, name, handler, parameters, ...attrs/*, ports*/} = object;
        await fbpSheet.libLoader.loadHandler(handler);
        // noinspection UnnecessaryLocalVariableJS
        const process = new FbpProcess(fbpSheet,
            {name, id, handler, parameters, ...attrs},
            /*...ports*/);
        /*
        if(ports && Array.isArray(ports))
            ports.forEach(p => process.createPort(p));
        */
        return process;
    }

    exportOperation() {
        //TODO ask handler
        return ""
    }

//######################################################################################################################
//#                                               ADDITIONAL ATTRIBUTES                                                #
//######################################################################################################################

    setAttr(key, value) {
        if (super.setAttr(key, value)) {
            this.notifyChange();
            return true;
        } else
            return false
    }

    deleteAttr(key) {
        if (super.deleteAttr(key)) {
            this.notifyChange();
            return true;
        } else
            return false
    }
    getReservedKeys() {
        return super.getReservedKeys().concat([
            'name', 'id', 'ports',
        ]);
    }

//######################################################################################################################
//#                                                   OTHER METHODS                                                    #
//######################################################################################################################

    delete() {
        this.clearPorts();
        if(this.handler.onDestroy)
            this.handler.onDestroy.call(this)
        super.delete();
        this.sheet.onProcessDeleted(this);
    }

    /**
     *
     * @param {FbpPort} inputPort
     * @param {*} msg
     */
    handlePacket(inputPort, msg) {
        if(this.handler.onPacket)
            this.handler.onPacket.call(this, inputPort.name, msg)
    }

    toString() {
        return `${this.name}[${this.id.toString(16)}]`;
    }
}
export default FbpProcess;
export {FbpProcess, FbpProcessChangeReason};