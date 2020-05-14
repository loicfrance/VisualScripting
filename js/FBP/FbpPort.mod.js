import {FbpConnection, FbpPacketConnection, FbpPassiveConnection} from "./FbpConnection.mod.js";


const FbpPortDirection = {
    IN      : 0,
    OUT     : 1,
    isDirectionValid: (dir) => (dir === FbpPortDirection.IN)
                            || (dir === FbpPortDirection.OUT),
};

const nameSym = Symbol("name");
const typeSym = Symbol("type");
const directionSym = Symbol("direction");
const connectionsSym = Symbol("connections");
const defaultValueSym = Symbol("default value");
const processSym = Symbol("process");
const valueSym = Symbol("value");
const runningSym = Symbol("listening on input connections");
const onPacketSym = Symbol("onPacket");
const listenerSym = Symbol("input listener");

async function inputConnectionListener(connection) {
    let loop = true;
    while(loop) {
        await connection.read().then(
            (packet)=> {
                this[onPacketSym](packet);
            },
            ()=> {
                console.log("connection ", connection, " lost.");
                loop = false;
            }
        );
    }
}

//######################################################################################################################
//#                                                        PORT                                                        #
//######################################################################################################################

class FbpPort {
    [connectionsSym] = [];
    /**
     * @constructor
     * @param {FbpProcess} process
     * @param {FbpType} type
     * @param {string} name
     * @param {FbpPortDirection} direction
     * @param {boolean} active
     * @param baseValue
     */
    constructor(process, type, name, direction, active = true, baseValue = undefined) {
        this.name = name;
        this.type = type;
        this[directionSym] = direction;

        /**
         * @type {FbpProcess}
         */
        this[processSym] = process;

        /**
         * @type {FbpConnection}
         */
    }
//______________________________________________________________________________________________________________________
//----------------------------------------------------- accessors ------------------------------------------------------
    /**
     * @type {string}
     */
    set name(value) { this[nameSym] = value; }
    get name() { return this[nameSym]; }

    /**
     * @type {FbpType}
     */
    set type(value) { this[typeSym] = value;}
    get type() { return this[typeSym]; }

    /**
     * @type {FbpPortDirection}
     */
    get direction() { return this[directionSym]; }
    get input() { return this.direction === FbpPortDirection.IN; }
    get output() { return this.direction === FbpPortDirection.OUT; }

    /**
     * @type {FbpProcess}
     */
    get process() { return this[processSym]; }

    /**
     * @type {FbpConnection[]}
     */
    get connections() { return this[connectionsSym]; }
//______________________________________________________________________________________________________________________
//----------------------------------------------- connection management ------------------------------------------------

    /**
     * Only to be used by {@link FbpConnection} contructor
     * @param connection
     */
    addConnection(connection) {
        this.connections.push(connection);
    }
    /**
     * Only to be used by {@link FbpConnection#destroy} method
     * @param connection
     */
    removeConnection(connection) {
        const idx = this.connections.indexOf(connection);
        if (idx >= 0) {
            this.connections.splice(idx, 1);
        }
        else
            console.error("specified connection is not linked to this port");
    }
    /**
     * @param {FbpPort} other
     * @return {boolean}
     */
    canConnect(other) {
        if(this.output && other.input)
            return this.type.canBeCastTo(other.type);
        else if(this.input && other.output)
            return other.type.canBeCastTo(this.type);
        else return false;
    }
    /**
     * @param {FbpPort} port
     * @return {FbpConnection}
     */
    getConnectionWith(port) {
        let i = this.connections.length;
        while(i--) {
            if (this.connections[i].connects(this, port))
                return this.connections[i];
        }
        return null;
    }
    /**
     * @param {FbpPort} other
     */
    connect(other) {
        if(this.canConnect(other) && !this.getConnectionWith(other))
            return new FbpConnection(this, other);
        else {
            console.error("Unable to connect the two ports");
            return undefined;
        }
    }

    disconnect(other) {
        let i = this.connections.length;
        while(i--) {
            if(this.connections[i].connects(this, other)) {
                this.connections[i].destroy();
                return this.connections[i];
            }
        }
        return undefined;
    }

    disconnectAll() {
        let i = this.connections.length;
        while(i--)
            this.connections[i].destroy();
    }
}

//######################################################################################################################
//#                                                    PACKET PORT                                                     #
//######################################################################################################################

class FbpPacketPort extends FbpPort {

    [listenerSym] = inputConnectionListener.bind(this);

    constructor(process, type, name, direction) {
        super(process, type, name, direction);
        this.start();
    }

    /**
     * @returns {FbpPacketConnection[]}
     */
    get connections() {
        // noinspection JSValidateTypes
        return super.connections;
    }

    get running() {
        return this[runningSym];
    }

    canConnect(other) {
        return (other instanceof FbpPacketPort) && super.canConnect(other);
    }

    /**
     * Only to be used by {@link FbpConnection} contructor
     * @param connection
     */
    addConnection(connection) {
        if(!(connection instanceof FbpPacketConnection))
            throw new Error("Packet ports can only be used with packet connections");

        super.addConnection(connection);
        if(this.input && this.running) {
            this[listenerSym](connection);
        }
    }
    // noinspection JSCheckFunctionSignatures
    /**
     * @param {FbpPacketPort} other
     */
    connect(other) {
        if(this.canConnect(other) && !this.getConnectionWith(other)) {
            return new FbpPacketConnection(this, other);
        } else {
            console.error("Unable to connect the two ports");
            return undefined;
        }
    }

    start() {
        if(!this.running && this.input) {
            this[runningSym] = true;
            this.connections.forEach(this[listenerSym]);
        }
    }

    stop() {
        if(this.running) {
            this[runningSym] = false;
            this.connections.forEach(c => {
                c.cancelRead();
            });
        }
    }

    send(packet) {
        if (this.output)
            this.connections.forEach(c => c.write(packet));
        else throw Error("Input ports cannot send packets");
    }

    [onPacketSym](packet) {
        if(this.input)
            this.process.handlePacket(this, packet);
        else throw Error("Output ports cannot receive packets");
    }
}

//######################################################################################################################
//#                                                    PASSIVE PORT                                                    #
//######################################################################################################################

class FbpPassivePort extends FbpPort {

    [defaultValueSym] = undefined;

    /**
     * @constructor
     * @param {FbpProcess} process
     * @param {FbpType} type
     * @param {string} name
     * @param {FbpPortDirection} direction
     * @param {*} defaultValue
     */
    constructor(process, type, name, direction, defaultValue = undefined) {
        super(process, type, name, direction);
        this[defaultValueSym] = defaultValue;
    }

    /**
     * @type {FbpPassiveConnection[]}
     */
    get connections() {
        // noinspection JSValidateTypes
        return super.connections;
    }

    get value() {
        return (this.input && this.connections.length === 1) ? this.connections[0].value : this[defaultValueSym];
    }

    set value(value) {
        this[defaultValueSym] = value;
    }

    get defaultValue() {
        return this[defaultValueSym];
    }

    canConnect(other) {
        return (other instanceof FbpPassivePort) && super.canConnect(other);
    }

    /**
     * Only to be used by {@link FbpConnection} contructor
     * @param connection
     */
    addConnection(connection) {
        if(!(connection instanceof FbpPassiveConnection))
            throw new Error("Passive ports can only be used with passive connections");
        if(this.input && this.connections.length > 0)
            throw new Error("Input passive ports can only be connected to 1 output (passive) port");
        super.addConnection(connection);
        if(this.input && this.running) {
            this[listenerSym](connection);
        }
    }

    // noinspection JSCheckFunctionSignatures
    /**
     * @param {FbpPassivePort} other
     */
    connect(other) {
        if(this.canConnect(other) && !this.getConnectionWith(other)) {
            return new FbpPassiveConnection(this, other);
        } else {
            console.error("Unable to connect the two ports");
            return undefined;
        }
    }
}

export {FbpPort, FbpPacketPort, FbpPassivePort, FbpPortDirection};