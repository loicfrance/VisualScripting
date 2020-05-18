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
const createConnectionSym = Symbol("create a connection");
const defaultValueSym = Symbol("default value");
const processSym = Symbol("process");
const valueSym = Symbol("value");
const runningSym = Symbol("listening on input connections");
const onPacketSym = Symbol("onPacket");
const listenerSym = Symbol("input listener");
const onConnectionAddedSym = Symbol("connection added to port");

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
//#                                                        PORT                                                        #
//######################################################################################################################

class FbpPort {
    [connectionsSym] = [];
    [createConnectionSym](other) {

    }
    /**
     * @constructor
     * @param {FbpProcess} process
     * @param {FbpType} type
     * @param {string} name
     * @param {FbpPortDirection} direction
     */
    constructor(process, type, name, direction) {
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
    [createConnectionSym](other) {
        return new FbpConnection(this, other);
    }
    [onConnectionAddedSym](connection) {
    }
    /**
     * @param {FbpPort} other
     */
    connect(other) {
        if(this.canConnect(other) && other.canConnect(this) && !this.getConnectionWith(other)) {
            const c = this[createConnectionSym](other);
            this.connections.push(c);
            other.connections.push(c);
            this[onConnectionAddedSym](c);
            other[onConnectionAddedSym](c);
            return c;
        }
        else {
            console.error("Unable to connect the two ports");
            return undefined;
        }
    }

    /**
     * @param {FbpPort} other
     * @param {boolean} invokeConnectionDelete
     * @return {FbpConnection|undefined}
     */
    disconnect(other, invokeConnectionDelete = true) {
        let i = this.connections.length;
        while(i--) {
            const c = this.connections[i];
            if(c.connects(this, other)) {
                let j = other.connections.indexOf(c);
                this.connections.splice(i, 1);
                other.connections.splice(j, 1);
                if(invokeConnectionDelete)
                    c.delete(false);
                return c;
            }
        }
        return undefined;
    }

    disconnectAll() {
        let i = this.connections.length;
        while(i--)
            this.connections[i].delete();
        this.connections.splice(0);
    }

//______________________________________________________________________________________________________________________
//--------------------------------------------------- other methods ----------------------------------------------------

    delete() {
        if(this.process) {
            this.disconnectAll();
            const process = this.process;
            this[processSym] = undefined;
            process.removePort(this);
        }
    }

    toString() {
        return this.process.toString() + '#' + (this.input ? '<' : '>') + this.name;
    }

    save() {
        return {
            direction: this.input ? 'in' : 'out',
            name: this.name,
            type: this.type.name,
        }
    }
    saveConnections(array = []) {
        array.push(...this.connections.map(c=>c.save()));
        return array;
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

    [createConnectionSym](other) {
        return new FbpPacketConnection(this, other);
    }
    [onConnectionAddedSym](connection) {
        if(this.input && this.running)
            this[listenerSym](connection);
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

    save() {
        const obj = super.save();
        obj.type = "packet";
        return obj;
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

    [createConnectionSym](other) {
        return new FbpPassiveConnection(this, other);
    }

    save() {
        const obj = super.save();
        obj.type = "passive";
        return obj;
    }
}

export {FbpPort, FbpPacketPort, FbpPassivePort, FbpPortDirection};