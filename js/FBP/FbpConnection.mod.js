import AsyncQueue from "../../../jslib/utils/AsyncQueue.mod.js";
import {FbpPort, FbpPortDirection} from "./FbpPort.mod.js";
import FbpObject from "./FbpObject.mod.js";

const startPortSym = Symbol("startPort");
const endPortSym = Symbol("endPort");
const queueSym = Symbol("queue");

const portRegexp = /^([^\[]+)\[([^\]]+)]#(.+)$/;

class FbpConnection extends FbpObject {
    [startPortSym];
    [endPortSym];
    [queueSym] = new AsyncQueue();

    /**
     * @param {FbpPort} port1
     * @param {FbpPort} port2
     * @param {Object?} attributes
     */
    constructor(port1, port2, attributes) {
        super(attributes)

        if(port1.input && port2.output) {
            this[startPortSym] = port2;
            this[endPortSym] = port1;
        } else {
            this[startPortSym] = port1;
            this[endPortSym] = port2;
        }
        if(!this.checkPorts()) {
            console.error("Error when connecting the two ports :", this.startPort, this.endPort);
            throw Error("Error when connecting ports");
        }
        this.sheet.onConnectionCreated(this);
        port1.onConnect(this, port2);
        port2.onConnect(this, port1);

        if(this[startPortSym].passThrough) {
            const cycleError = this[startPortSym].checkPassThroughCycle();
            if (cycleError) {
                this.delete();
                throw cycleError;
            }
        }
    }

//##############################################################################
//#                                 ACCESSORS                                  #
//##############################################################################

//________________________________base accessors________________________________
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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
    get passive() {
        return this.startPort.passive;
    }
    /** @type {boolean} */
    get active() {
        return this.startPort.active;
    }

//_______________________________active accessors_______________________________
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    // noinspection JSUnusedGlobalSymbols
    /** @type {number} */
    get pending_values() {
        return this[queueSym].pendingValues;
    }
    // noinspection JSUnusedGlobalSymbols
    /** @type {boolean} */
    get empty() {
        return this[queueSym].empty;
    }
//______________________________passive accessors_______________________________
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    /** @type {any} */
    get value() {
        if(this.active)
            throw Error("can only get the value for passive connections");
        return this.startPort.value;
    }

//######################################################################################################################
//#                                                  PORTS MANAGEMENT                                                  #
//######################################################################################################################

    checkPorts() {
        const port0 = this.startPort, port1 = this.endPort;
        return port0 && port1 && port0.output && port1.input
            && port0.canConnect(port1);
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
//#                                               ADDITIONAL ATTRIBUTES                                                #
//######################################################################################################################

    getReservedKeys() {
        return super.getReservedKeys().concat([
            'from', 'to', 'type'
        ]);
    }

//######################################################################################################################
//#                                                PACKET TRANSMISSION                                                 #
//######################################################################################################################

    write(packet) {
        if(this.passive)
            throw Error("can only write packet for active connections");
        this[queueSym].write(packet);
    }
    async read() {
        if(this.passive)
            throw Error("can only write packet for active connections");
        return this[queueSym].read();
    }
    cancelRead() {
        if(this.passive)
            throw Error("can only write packet for active connections");
        this[queueSym].cancelRead();
    }
    clear() {
        if(this.passive)
            throw Error("can only write packet for active connections");
        this[queueSym].clear();
    }

//######################################################################################################################
//#                                                   OTHER METHODS                                                    #
//######################################################################################################################

    delete() {
        if (this.active) {
            this.clear();
            this.cancelRead();
        }
        super.delete();
        this.startPort.onDisconnect(this, this.endPort);
        this.endPort.onDisconnect(this, this.startPort);
        this.sheet.onConnectionDeleted(this);
    }

    exportJSON() {
        return {
            from: this.startPort.toString(),
            to: this.endPort.toString(),
            ...super.exportJSON()
        };
    }

    // noinspection JSUnusedGlobalSymbols,DuplicatedCode
    static fromJSON(sheet, object) {
        const {from, to, ...attrs} = object;
        const [, , startProcessId, startPortName] = from.match(portRegexp);
        if(!startProcessId || !startPortName)
            throw Error(`parsing error: ${from} does not fit in the required pattern`);
        const [, , endProcessId, endPortName] = to.match(portRegexp);
        if(!endProcessId || !endPortName)
            throw Error(`parsing error: ${to} does not fit in the required pattern`);

        const startProcess = sheet.getProcess(Number.parseInt(startProcessId, 16));
        if(startProcess === undefined) throw Error("unknown process " + startProcessId);
        const endProcess = sheet.getProcess(Number.parseInt(endProcessId, 16));
        if(endProcess === undefined) throw Error("unknown process " + endProcessId);

        const startPort = startProcess.getPort(startPortName, FbpPortDirection.OUT);
        if(startPort === undefined) throw Error("unknown port " + startPort);
        const endPort = endProcess.getPort(endPortName, FbpPortDirection.IN);
        if(endPort === undefined) throw Error("unknown port " + endPort);

        return new FbpConnection(startPort, endPort, attrs);
    }
}
export default FbpConnection;
export {FbpConnection};