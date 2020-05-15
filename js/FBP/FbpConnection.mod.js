import AsyncQueue from "../../../jsLibs_Modules/utils/AsyncQueue.mod.js";
import {FbpPacketPort, FbpPassivePort} from "./FbpPort.mod.js";

const startPortSym = Symbol("startPort");
const endPortSym = Symbol("endPort");
const queueSym = Symbol("queue");


class FbpConnection {
    /**
     *
     * @param {FbpPort} port1
     * @param {FbpPort} port2
     */
    constructor(port1, port2) {
        if(port1.input && port2.output) {
            this.startPort = port2;
            this.endPort = port1;
        }
        else if(port1.output && port2.input) {
            this.startPort = port1;
            this.endPort = port2;
        } else
            throw new Error("ports directions are not compatible");
        if(!this.checkPorts()) {
            console.error("Error when connecting the two ports :", this.startPort, this.endPort);
            throw new Error("Error when connecting ports");
        }
    }
    checkPorts() {
        return this.startPort && this.endPort
            && this.startPort.output
            && this.endPort.input
            && this.startPort.type.canBeCastTo(this.endPort.type);
    }

    /**
     * @type {FbpPort} value
     */
    set startPort(value) {
        if(value !== this[startPortSym]) {
            if (value.output) {
                this[startPortSym] = value;
                if(this.endPort !== undefined && !this.checkPorts())
                    console.error("Error when connecting the two ports :", this.startPort, this.endPort);
            } else
                console.error("cannot use input port as connection start port");
        }
    }
    get startPort() { return this[startPortSym]; }

    /**
     * @type {FbpPort} value
     */
    set endPort(value) {
        if(value !== this[startPortSym]) {
            if (value.input) {
                this[endPortSym] = value;
                if(this.startPort !== undefined && !this.checkPorts())
                    console.error("Error when connecting the two ports :", this.startPort, this.endPort);
            } else
                console.error("cannot use output port as connection end port");
        }
    }
    get endPort() { return this[endPortSym]; }

    destroy() {
        this.startPort.removeConnection(this);
        this.startPort = undefined;
        this.endPort.removeConnection(this);
        this.endPort = undefined;
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
}
class FbpPacketConnection extends FbpConnection {
    [queueSym] = new AsyncQueue();

    /**
     * @constructor
     * @param {FbpPacketPort} port1
     * @param {FbpPacketPort} port2
     */
    constructor(port1, port2) {
        super(port1, port2);

        this.startPort.addConnection(this);
        this.endPort.addConnection(this);
    }

    set startPort(port) {
        if(!(port instanceof FbpPacketPort))
            throw new Error("packet connections can only connect packet ports");
        super.startPort = port;
    }
    get startPort() { return super.startPort; }

    /**
     * @type {FbpPort} value
     */
    set endPort(value) {
        if(value !== this[startPortSym] && value.input && value instanceof FbpPacketPort) {
            this.cancelRead();
            super.endPort = value;
        } else if(!(value instanceof FbpPacketPort)) {
            throw new Error("packet connections can only connect packet ports");
        }
    }
    get endPort() { return super.endPort; }

    get pending_values() {
        return this[queueSym].pendingValues;
    }
    get empty() {
        return this[queueSym].empty;
    }
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
    destroy() {
        this.clear();
        this.cancelRead();
        super.destroy();
    }
}
class FbpPassiveConnection extends FbpConnection {
    /**
     * @constructor
     * @param {FbpPassivePort} port1
     * @param {FbpPassivePort} port2
     */
    constructor(port1, port2) {
        super(port1, port2);
        this.startPort.addConnection(this);
        this.endPort.addConnection(this);
    }
    set startPort(port) {
        if(!(port instanceof FbpPassivePort))
            throw new Error("passive connections can only connect passive ports");
        super.startPort = port;
    }
    get startPort() { return super.startPort; }

    set endPort(port) {
        if(!(port instanceof FbpPassivePort))
            throw new Error("passive connections can only connect passive ports");
        super.endPort = port;
    }
    get endPort() { return super.endPort; }
    get value() {
        return this.startPort.value;
    }
}

export {FbpConnection, FbpPacketConnection, FbpPassiveConnection};
export default FbpConnection;