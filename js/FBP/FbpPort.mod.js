import FbpConnection from "./FbpConnection.mod.js";
import FbpObject from "./FbpObject.mod.js";
import FbpType from "./FbpType.mod.js";

/**
 * Enum for FBP port direction (IN, OUT or UNKNOWN)
 * @enum {number}
 * @readonly
 */
const FbpPortDirection = {
    IN      : 0,
    OUT     : 1,
    UNKNOWN : 2,
    isDirectionValid(dir) {
        return (dir === FbpPortDirection.IN)
            || (dir === FbpPortDirection.OUT);
    },
    fromString(str) {
      switch(str.toLowerCase()) {
          case 'in' :
          case 'input' :
              return FbpPortDirection.IN;
          case 'out':
          case 'output':
              return FbpPortDirection.OUT;
      }
    }
};

/**
 * @enum
 */
const FbpPortChangeReason = {
    VALUE: "value",
    NAME: "name",
    DATA_TYPE: "type",
    PASS_THROUGH: "pass-through",
    CONNECTED: "connected", // arguments: [created connection], [other port]
    DISCONNECTED: "disconnected", // arguments: [deleted connection], [other port]
}

const nameSym = Symbol("name");
const dataTypeSym = Symbol("type");
const directionSym = Symbol("direction");
const connectionsSym = Symbol("connections");
const processSym = Symbol("process");
const listenerSym = Symbol("input listener");
const activeSym = Symbol("active port");
const passThroughSym = Symbol("pass-through port");
const storedValueSym = Symbol("stored value for passive ports");
const passThroughLockSym = Symbol("pass-through loc to check cycles");


async function inputConnectionListener(connection) {
    let loop = true;
    while(loop) {
        await connection.read().then(
            (packet)=> {
                this.onInputPacketReceived(packet);
            },
            ()=> { loop = false; }
        );
    }
}

class FbpPort extends FbpObject {
    [nameSym];
    [dataTypeSym];
    [directionSym];
    [processSym];
    [connectionsSym] = [];
    [activeSym];
    [passThroughSym];
    [storedValueSym];
    [listenerSym] = inputConnectionListener.bind(this);
    [passThroughLockSym] = false;

    /**
     * @constructor
     * @param {FbpProcess} process - process this port will belong to
     * @param {Object} options
     * @param {string} options.name - name (unique within the process ports) of the port
     * @param {FbpType|string} options.dataType - type of the data handled by the port
     * @param {FbpPortDirection|string} options.direction - direction of the communication.
     *        {@link FbpPortDirection.IN}, {@link FbpPortDirection.OUT},
     *        "in", "out", "input" or "output".
     * @param {boolean} [options.active=false] - true if the port sends or receives packets
     *        false if it stores data statically (passive port).
     * @param {boolean} [options.passThrough=false] - true if the output passive port is a window
     *        to the process that must provide the value when asked.
     * @param {Object...} [options.attributes] - additional attributes to store
     */
    constructor(process, {
        name, dataType, direction,
        active = false, passThrough = false,
        ...attributes
    }) {

        const dir = direction.substr ? FbpPortDirection.fromString(direction) : direction;
        if(!FbpPortDirection.isDirectionValid(dir))
            throw Error(`invalid direction: ${direction}`);

        super(attributes);
        this[directionSym] = dir;
        this[processSym] = process;
        this[activeSym] = active;
        this.name = name;
        this.dataType = dataType;
        this.passThrough = passThrough;
        process.onPortCreated(this);
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    /** @type {string} */
    set name(name) {
        if(name !== this.name) {
            const p = this.process.getPort(name);
            if (p && p !== this)
                throw Error(`the port name ${name} is already taken for this process`);
            this[nameSym] = name;
            this.notifyChange(FbpPortChangeReason.NAME);
        }
    }

    /** @type {string} */
    get name() {
        return this[nameSym];
    }

    /** @type {FbpType|string} */
    set dataType(type) {
        if (type instanceof FbpType)
            type = type.name;
        if(this[dataTypeSym] !== type) {
            this[dataTypeSym] = type;
            this.notifyChange(FbpPortChangeReason.DATA_TYPE);
        }
    }

    /** @type {FbpType} */
    get dataType() {
        return this.sheet.getType(this[dataTypeSym]);
    }

    /** @type {FbpPortDirection} */
    get direction() {
        return this[directionSym];
    }

    /** @type {boolean} */
    get input() {
        return this.direction === FbpPortDirection.IN;
    }

    /** @type {boolean} */
    get output() {
        return this.direction === FbpPortDirection.OUT;
    }

    /** @type {FbpProcess} */
    get process() {
        return this[processSym];
    }

    /** @type {FbpConnection[]} */
    get connections() {
        return this[connectionsSym];
    }

    /** @type {boolean} */
    get connectionFull() {
        return this.passive ?
            this.input && this[connectionsSym].length === 1 :
            false;
    }

    /** @type {boolean} */
    get active() {
        return this[activeSym];
    }

    /** @type {boolean} */
    get passive() {
        return !this.active;
    }

    /** @type {boolean} */
    get passThrough() {
        return this[passThroughSym];
    }

    /** @type {boolean} */
    set passThrough(pt) {
        if(pt !== this.passThrough) {
            if (pt && (this.active || this.input))
                throw Error(`pass-through ports can only be passive output`);
            this[passThroughSym] = !!pt;
            this.notifyChange(FbpPortChangeReason.PASS_THROUGH);
        }

    }

    /** @type {FbpSheet} */
    get sheet() {
        return this.process.sheet;
    }

    /**
     * @return {*}
     */
    get value() {
        if(this.active)
            throw Error("port value can only be retrieved with passive ports");
        if (this.input) {
            return this.connections.length === 1
                ? this.connections[0].value
                : this.defaultValue;
        } else if (this.passThrough) {
            if(this[passThroughLockSym])
                throw Error(`Pass-Through cycle failed for port ${this.toString()}`);
            return this.process.getPassThroughValue(this);
        } else {
            return this[storedValueSym];
        }
    }

    set value(value) {
        if(this.active)
            throw Error("port value can only be set with passive ports");
        this[storedValueSym] = value;
        this.notifyChange(FbpPortChangeReason.VALUE);
    }

    get defaultValue() {
        if(this.active || this.output)
            throw Error("default value is only available with passive input ports." +
                " Use value accessor for passive output port");
        return this[storedValueSym];
    }

//######################################################################################################################
//#                                               CONNECTIONS MANAGEMENT                                               #
//######################################################################################################################

    /**
     * @param {FbpPort} other
     * @return {boolean}
     */
    canConnect(other) {
        if(this.active === other.active) {
            if (this.output)
                return other.input && this.dataType.canBeCastTo(other.dataType);
            else
                return other.output && other.dataType.canBeCastTo(this.dataType);
        }
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
     * @param {FbpConnection} connection
     * @param {FbpPort} otherPort
     */
    onConnect(connection, otherPort) {
        this.connections.push(connection);
        if(this.active && this.input)
            this[listenerSym](connection);
        this.notifyChange(FbpPortChangeReason.CONNECTED, connection, otherPort);
    }
    /**
     * @param {FbpPort} other
     * @return {FbpConnection} created connection
     */
    connect(other) {
        const connection = this.getConnectionWith(other);
        if(connection)
            return connection;

        const canConnect = this.canConnect(other) && other.canConnect(this);
        if (!canConnect)
            throw Error(`ports ${this} and ${other} cannot connect`);
        if(this.connectionFull)
            throw Error(`port ${this} has reached maximum connections number`);
        if(other.connectionFull)
            throw Error(`port ${other} has reached maximum connections number`);

        return new FbpConnection(this, other);
    }

    /**
     * @param {FbpConnection} connection
     * @param {FbpPort} otherPort
     */
    onDisconnect(connection, otherPort) {
        let idx = this.connections.indexOf(connection);
        if(idx >= 0) {
            this.connections.splice(idx, 1);
        }
        this.notifyChange(FbpPortChangeReason.DISCONNECTED, connection, otherPort);
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
        while (i--)
            this.connections[i].delete();
        if (this.connections.length > 0) {
            throw Error("Error when removing connections");
        }
    }

//######################################################################################################################
//#                                               ADDITIONAL ATTRIBUTES                                                #
//######################################################################################################################

    getReservedKeys() {
        return super.getReservedKeys().concat([
            'name', 'type', 'direction', 'datatype'
        ]);
    }

//######################################################################################################################
//#                                                   OTHER METHODS                                                    #
//######################################################################################################################

    notifyChange(key, ...params) {
        if(this.process)
            this.process.onPortChanged(this, key, ...params);
        super.notifyChange(key, ...params);
    }

    checkPassThroughCycle() {
        if(this.passThrough) {
            this[passThroughLockSym] = true;
            let result = null;
            try {
                const x = this.process.getPassThroughValue(this);
            } catch(e) {
                result = e;
            }
            this[passThroughLockSym] = false;
            return result;
        }
    }

    delete() {
        this.disconnectAll();
        super.delete();
        this.process.onPortDeleted(this);
    }

    toString() {
        return this.process.toString() + '#' + this.name;
    }

    exportJSON() {
        return {
            direction: this.input ? 'in' : 'out',
            name: this.name,
            datatype: this.type,
            type: this.constructor.name,
            ...super.exportJSON()
        };
    }

    send(packet) {
        if (this.active && this.output)
            this.connections.forEach(c => c.write(packet));
        else throw Error("Passive and input ports cannot send packets");
    }
    onInputPacketReceived(packet) {
        if(this.active && this.input)
            this.process.handlePacket(this, packet);
        else throw Error("Passive and output ports cannot receive packets");
    }
}
// noinspection JSUnusedGlobalSymbols
export default FbpPort;
export {FbpPort, FbpPortDirection, FbpPortChangeReason};