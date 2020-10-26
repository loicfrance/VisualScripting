import AsyncQueue from "../../../jsLibs_Modules/utils/AsyncQueue.mod.js";
import {FbpPacketPort, FbpPassivePort, FbpPortDirection} from "./FbpPort.mod.js";

const startPortSym = Symbol("startPort");
const endPortSym = Symbol("endPort");
const queueSym = Symbol("queue");
const additionalInformationSym = Symbol("additional information");

const portRegexp = /^([^\[]+)\[([^\]]+)]#(.+)$/g.compile();

//######################################################################################################################
//#################################################                   ##################################################
//#################################################  BASE CONNECTION  ##################################################
//#################################################                   ##################################################
//######################################################################################################################

class FbpConnection {
    [startPortSym];
    [endPortSym];
    [additionalInformationSym] = new Map();

    /**
     * @param {FbpPort} port1
     * @param {FbpPort} port2
     */
    constructor(port1, port2) {
        if(port1.input && port2.output) {
            this[startPortSym] = port2;
            this[endPortSym] = port1;
        } else {
            this[startPortSym] = port1;
            this[endPortSym] = port2;
        }
        if(!this.checkPorts()) {
            console.error("Error when connecting the two ports :", this.startPort, this.endPort);
            throw new Error("Error when connecting ports");
        }
        this.sheet.onConnectionCreated(this);
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    /** @type {FbpPort} */
    get startPort() { return this[startPortSym]; }

    /** @type {FbpPort} */
    get endPort() { return this[endPortSym]; }

    /** @type {FbpProcess} */
    get startProcess() { return this.startPort.process; }

    /** @type {FbpProcess} */
    get endProcess() { return this.endPort.process; }

    /** @type {FbpSheet} */
    get sheet() { return this.startProcess.sheet; }

    /** @type {boolean} */
    get deleted() {
        return this.startPort === undefined;
    }

//######################################################################################################################
//#                                                  PORTS MANAGEMENT                                                  #
//######################################################################################################################

    checkPorts() {
        return this.startPort && this.endPort
            && this.startPort.output
            && this.endPort.input
            && this.startPort.type.canBeCastTo(this.endPort.type);
    }

    /**
     * @param {FbpPort} port1
     * @param {FbpPort} port2
     * @returns {boolean}
     */
    connects(port1, port2) {
        if(port1.output)
            return this.startPort === port1 && this.endPort === port2;
        else
            return this.startPort === port2 && this.endPort === port1;
    }

//######################################################################################################################
//#                                               ADDITIONAL INFORMATION                                               #
//######################################################################################################################

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {*} key
     * @param {*} value
     */
    setInfo(key, value) {
        if(value !== this.getInfo(key)) {
            this[additionalInformationSym].set(key, value);
            this.sheet.onConnectionChanged(this);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {*} key
     */
    deleteInfo(key) {
        if (key in this[additionalInformationSym]) {
            this[additionalInformationSym].delete(key);
            this.sheet.onConnectionChanged(this);
        }
    }

    /**
     * @param {*} key
     * @param {*} defaultValue?
     * @return {*}
     */
    getInfo(key, defaultValue = undefined) {
        if(this[additionalInformationSym].has(key))
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
        this.sheet.onConnectionDeleted(this);
        this.startPort.onDisconnected(this, this.endPort);
        this.endPort.onDisconnected(this, this.startPort);
        this[startPortSym] = undefined;
        this[endPortSym] = undefined;
    }

    exportJSON() {
        const obj = {
            from: this.startPort.toString(),
            to: this.endPort.toString(),
            type: (this instanceof FbpPassiveConnection) ? 'passive' :
                  (this instanceof FbpPacketConnection) ? 'packet' : 'unknown',
        };
        Object.assign(obj, Object.fromEntries(this[additionalInformationSym].entries()));
        return obj;
    }
    static fromJSON(sheet, object) {
        const [, startProcessId, startPortName] = object.from.match(portRegexp);
        if(!startProcessId || !startPortName)
            throw Error(`parsing error: ${object.from} does not fit in the required pattern`);
        const [, endProcessId, endPortName] = object.to.match(portRegexp);
        if(!endProcessId || !endPortName)
            throw Error(`parsing error: ${object.to} does not fit in the required pattern`);

        const startProcess = sheet.getProcess(startProcessId);
        if(startProcess === undefined) throw Error("unknown process " + startProcessId);
        const endProcess = sheet.getProcess(endProcessId);
        if(endProcess === undefined) throw Error("unknown process " + endProcessId);

        const startPort = startProcess.getPort(startPortName, FbpPortDirection.OUT);
        if(startPort === undefined) throw Error("unknown port " + startPort);
        const endPort = endProcess.getPort(endPortName, FbpPortDirection.IN);
        if(endPort === undefined) throw Error("unknown port " + endPort);

        switch(object.type) {
            case 'passive' : return new FbpPassiveConnection(startPort, endPort);
            case 'packet' : return new FbpPacketConnection(startPort, endPort);
            default : throw Error("unknown connection type: " + object.type);
        }
    }
}

//######################################################################################################################
//################################################                      ################################################
//################################################  PACKETS CONNECTION  ################################################
//################################################                      ################################################
//######################################################################################################################

class FbpPacketConnection extends FbpConnection {
    [queueSym] = new AsyncQueue();

    /**
     * @constructor
     * @param {FbpPacketPort} port1
     * @param {FbpPacketPort} port2
     */
    constructor(port1, port2) {
        if(!(port1 instanceof FbpPacketPort) || !(port2 instanceof FbpPacketPort))
            throw Error("packet connections can only connect packet ports");
        super(port1, port2);
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    // noinspection JSUnusedGlobalSymbols
    get pending_values() {
        return this[queueSym].pendingValues;
    }
    // noinspection JSUnusedGlobalSymbols
    get empty() {
        return this[queueSym].empty;
    }

//######################################################################################################################
//#                                                PACKET TRANSMISSION                                                 #
//######################################################################################################################

    write(packet) {
        this[queueSym].write(packet);
    }
    async read() {
        return this[queueSym].read();
    }
    cancelRead() {
        this[queueSym].cancelRead();
    }
    clear() {
        this[queueSym].clear();
    }

//######################################################################################################################
//#                                                   OTHER METHODS                                                    #
//######################################################################################################################

    delete() {
        this.clear();
        this.cancelRead();
        super.delete(...arguments);
    }
}

//######################################################################################################################
//################################################                      ################################################
//################################################  PASSIVE CONNECTION  ################################################
//################################################                      ################################################
//######################################################################################################################

class FbpPassiveConnection extends FbpConnection {
    /**
     * @constructor
     * @param {FbpPassivePort} port1
     * @param {FbpPassivePort} port2
     */
    constructor(port1, port2) {
        if(!(port1 instanceof FbpPassivePort) || !(port2 instanceof FbpPassivePort))
        throw Error("passive connections can only connect passive ports");
        super(port1, port2);
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    get value() {
        return this.startPort.value;
    }
}

export {FbpPacketConnection, FbpPassiveConnection};