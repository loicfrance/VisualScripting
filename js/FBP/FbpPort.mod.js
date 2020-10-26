import {FbpPacketConnection, FbpPassiveConnection} from "./FbpConnection.mod.js";


const FbpPortDirection = {
    IN      : 0,
    OUT     : 1,
    UNKNOWN : 2,
    isDirectionValid: (dir) => (dir === FbpPortDirection.IN)
                            || (dir === FbpPortDirection.OUT),
};

const nameSym = Symbol("name");
const typeSym = Symbol("type");
const directionSym = Symbol("direction");
const connectionsSym = Symbol("connections");
const createConnectionSym = Symbol("create a connection");
const processSym = Symbol("process");
const runningSym = Symbol("listening on input connections");
const onPacketSym = Symbol("onPacket");
const listenerSym = Symbol("input listener");

const additionalInformationSym = Symbol("additional information");

async function inputConnectionListener(connection) {
    let loop = true;
    while(loop) {
        await connection.read().then(
            (packet)=> {
                this[onPacketSym](packet);
            },
            ()=> { loop = false; }
        );
    }
}

//######################################################################################################################
//#######################################################        #######################################################
//#######################################################  PORT  #######################################################
//#######################################################        #######################################################
//######################################################################################################################

class FbpPort {
    [nameSym];
    [typeSym];
    /**
     * @type {FbpConnection}
     */
    [directionSym];

    /**
     * @type {FbpProcess}
     */
    [processSym];
    [connectionsSym] = [];

    [additionalInformationSym] = new Map();
    /**
     * @constructor
     * @param {FbpProcess} process
     * @param {Object} attributes
     * @param {FbpType|string} attributes.type
     * @param {string} attributes.name
     * @param {FbpPortDirection} attributes.direction
     */
    constructor(process, attributes) {
        if(!FbpPortDirection.isDirectionValid(attributes.direction))
            throw Error("the specified direction is not valid");
        if(process.getPort(attributes.name))
            throw Error(`the port name ${attributes.name} is already taken for this process`);

        this[processSym] = process;
        this[directionSym] = attributes.direction;
        this[typeSym] = (attributes.type.substr) ? this.sheet.getType(attributes.type) : attributes.type;
        this[nameSym] = attributes.name;
        this.process.onPortCreated(this);
        // noinspection JSCheckFunctionSignatures
        for(const [key, value] of Object.entries(attributes)) {
            if(key !== 'name' && key !== 'type' && key !== 'direction') {
                this.setInfo(key, value);
            }
        }
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    /**
     * @type {string}
     */
    set name(value) {
        const p = this.process.getPort(value);
        if(p && p !== this)
            throw Error(`the port name ${value} is already taken for this process`);
        if(p === undefined)
            this[nameSym] = value;
            this.process.onPortChanged(this);
    }
    get name() { return this[nameSym]; }

    /**
     * @type {FbpType|string}
     */
    set type(value) {
        if(value.substr)
            value = this.sheet.getType(value);
        this[typeSym] = value;
        this.process.onPortChanged(this);
    }
    get type() { return this[typeSym]; }

    /** @type {FbpPortDirection} */
    get direction() { return this[directionSym]; }

    /** @type {boolean} */
    get input() { return this.direction === FbpPortDirection.IN; }

    /** @type {boolean} */
    get output() { return this.direction === FbpPortDirection.OUT; }

    /** @type {FbpProcess} */
    get process() { return this[processSym]; }

    /** @type {FbpConnection[]} */
    get connections() { return this[connectionsSym]; }

    get connectionFull() {
        return false;
    }
    get passive() {
        return false;
    }

    // noinspection JSUnusedGlobalSymbols
    /** @type {boolean} */
    get deleted() {
        return this.process === undefined;
    }

    /** @type {FbpSheet} */
    get sheet() {
        return this.process.sheet;
    }

//######################################################################################################################
//#                                               CONNECTIONS MANAGEMENT                                               #
//######################################################################################################################

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
        return undefined;
    }

    /**
     * @param {FbpPort} port
     * @return {boolean}
     */
    connectedTo(port) {
        return this.getConnectionWith(port) !== undefined;
    }

    /**
     * @param {FbpPort} other
     */
    [createConnectionSym](other) {
        throw Error("this method must be overridden");
    }
    /**
     * @param {FbpPort} other
     */
    connect(other) {
        if(this.canConnect(other) && other.canConnect(this) && !this.getConnectionWith(other)) {
            const connection = this[createConnectionSym](other);
            this.onConnected(connection, other);
            other.onConnected(connection, this);
        }
        else {
            console.error("Unable to connect the two ports");
            return undefined;
        }
    }
    /**
     * @param {FbpConnection} connection
     * @param {FbpPort} otherPort
     */
    onConnected(connection, otherPort) {
        this.connections.push(connection);
    }

    /**
     * @param {FbpConnection} connection
     * @param {FbpPort} otherPort
     */
    onDisconnected(connection, otherPort) {
        let idx = this.connections.indexOf(connection);
        if(idx >= 0) {
            this.connections.splice(idx, 1);
        }
    }
    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {FbpPort} other
     * @return {FbpConnection|undefined}
     */
    disconnect(other) {
        let i = this.connections.length;
        while(i--) {
            const c = this.connections[i];
            if(c.connects(this, other)) {
                c.delete();
                return c;
            }
        }
        return undefined;
    }

    disconnectAll() {
        let i = this.connections.length;
        while(i--)
            this.connections[i].delete();
        if(this.connections.length > 0) {
            throw Error("Error when removing connections");
        }
    }

//######################################################################################################################
//#                                               ADDITIONAL INFORMATION                                               #
//######################################################################################################################

    /**
     * @param {*} key
     * @param {*} value
     */
    setInfo(key, value) {
        if(key.substr) {
            switch(key.toLowerCase()) {
                case "name":
                case "datatype":
                case "direction":
                    throw Error(`the key '${key}' is reserved`);
                default : break;
            }
        }
        if(value !== this.getInfo(key)) {
            this[additionalInformationSym].set(key, value);
            this.process.onPortChanged(this);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {*} key
     */
    deleteInfo(key) {
        if (key in this[additionalInformationSym]) {
            this[additionalInformationSym].delete(key);
            this.process.onPortChanged(this);
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
        if(this.process) {
            this.disconnectAll();
            const process = this.process;
            this[processSym] = undefined;
            process.onPortDeleted(this);
        } else throw Error("port already deleted");
    }

    toString() {
        return this.process.toString() + '#' + this.name;
    }

    exportJSON() {
        const obj = {
            direction: this.input ? 'in' : 'out',
            name: this.name,
            datatype: this.type.name,
            type: this.constructor.name
        };
        Object.assign(obj, Object.fromEntries(this[additionalInformationSym].entries()));
        return obj;
    }
}

//######################################################################################################################
//###################################################                ###################################################
//###################################################  PACKETS PORT  ###################################################
//###################################################                ###################################################
//######################################################################################################################

class FbpPacketPort extends FbpPort {

    [listenerSym] = inputConnectionListener.bind(this);

    constructor(process, attributes) {
        super(process, attributes);
        this.start();
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

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

//######################################################################################################################
//#                                               CONNECTIONS MANAGEMENT                                               #
//######################################################################################################################

    canConnect(other) {
        return (other instanceof FbpPacketPort) && super.canConnect(other);
    }

    [createConnectionSym](other) {
        return new FbpPacketConnection(this, other);
    }
    onConnected(connection, otherPort) {
        super.onConnected(connection, otherPort);
        if(this.input && this.running)
            this[listenerSym](connection);
    }

//######################################################################################################################
//#                                                PACKETS TRANSMISSION                                                #
//######################################################################################################################

    start() {
        if(!this.running && this.input) {
            this[runningSym] = true;
            this.connections.forEach(this[listenerSym]);
        }
    }

    // noinspection JSUnusedGlobalSymbols
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
//###################################################                ###################################################
//###################################################  PASSIVE PORT  ###################################################
//###################################################                ###################################################
//######################################################################################################################

class FbpPassivePort extends FbpPort {

    /**
     * @constructor
     * @param {FbpProcess} process
     * @param {Object} attributes
     * @param {FbpType|string} attributes.type
     * @param {string} attributes.name
     * @param {FbpPortDirection} attributes.direction
     * @param {*} attributes.defaultValue
     */
    constructor(process, attributes) {
        const defaultValue = attributes.defaultValue;
        delete (attributes.defaultValue);
        super(process, attributes);
        this.value = defaultValue;
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    /**
     * @type {FbpPassiveConnection[]}
     */
    get connections() {
        // noinspection JSValidateTypes
        return super.connections;
    }

    get value() {
        return (this.input && this.connections.length === 1) ? this.connections[0].value : this.defaultValue;
    }

    set value(value) {
        super.setInfo("defaultValue", value);
    }

    get defaultValue() {
        return this.getInfo("defaultValue");
    }
    get connectionFull() {
        return this.input && this[connectionsSym].length === 1;
    }
    get passive() {
        return true;
    }

//######################################################################################################################
//#                                               CONNECTIONS MANAGEMENT                                               #
//######################################################################################################################

    canConnect(other) {
        return (other instanceof FbpPassivePort) && !this.connectionFull && !other.connectionFull
            && super.canConnect(other);
    }

    [createConnectionSym](other) {
        return new FbpPassiveConnection(this, other);
    }

//######################################################################################################################
//#                                                   OTHER METHODS                                                    #
//######################################################################################################################
    /**
     * @param {*} key
     * @param {*} value
     */
    setInfo(key, value) {
        if(key.substr) {
            switch(key.toLowerCase()) {
                case "defaultvalue":
                    throw Error(`the key '${key}' is reserved`);
                default : break;
            }
        }
        super.setInfo(key, value);
    }
}
class FbpPassivePassThroughPort extends FbpPassivePort {

    /**
     * @constructor
     * @param {FbpProcess} process
     * @param {Object} attributes
     * @param {FbpType|string} attributes.type
     * @param {string} attributes.name
     * @param {FbpPortDirection} attributes.direction
     * @param {*} attributes.defaultValue
     */
    constructor(process, attributes) {
        if (attributes.direction === FbpPortDirection.IN)
            throw Error("PassThrough ports can only be created with Passive Output ports");
        super(process, attributes);
    }
    set value(value) {
        super.value = value;
    }
    get value() {
        const result = this.process.getPassThroughValue(this);
        if (result === undefined)
            return super.value;
        else
            return result;
    }

}

export {FbpPacketPort, FbpPassivePort, FbpPassivePassThroughPort, FbpPortDirection};