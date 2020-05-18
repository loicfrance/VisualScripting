import {PRNG} from "../../../jsLibs_Modules/utils/tools.mod.js";
import {FbpPassivePort, FbpPacketPort, FbpPortDirection} from "./FbpPort.mod.js";

const inputPortsSym = Symbol("input ports list");
const outputPortsSym = Symbol("output ports list");
const idSym = Symbol("Process id");

const Random = new PRNG(0);

class FbpProcess {
    /** @type {string} */
    name;
    /** @type {number} */
    [idSym];
    /** @type {FbpPort[]} */
    [inputPortsSym] = [];
    /** @type {FbpPort[]} */
    [outputPortsSym] = [];

    /**
     * @constructor
     * @param {string} name
     * @param id
     */
    constructor(name, id = Random.next()) {
        this.name = name;
        this[idSym] = id;
    }
    get id() {
        return this[idSym];
    }
    /**
     * @param {FbpPort} port
     */
    addPort(port) {
        if(port.output)
            this[outputPortsSym].push(port);
        else this[inputPortsSym].push(port);
    }
    createPort({passive, type, name, direction, baseValue = undefined}) {
        const p = passive ? new FbpPassivePort(this, type, name, direction, baseValue)
                          : new FbpPacketPort(this, type, name, direction);
        this[direction === FbpPortDirection.OUT ? outputPortsSym : inputPortsSym].push(p);
    }
    removePort(port) {
        const idx = this[port.input ? inputPortsSym : outputPortsSym].indexOf(port);
        if(idx >= 0) {
            this[port.input ? inputPortsSym : outputPortsSym].splice(idx, 1);
            port.disconnectAll();
        }
    }
    clearPorts() {
        let i = this[inputPortsSym].length;
        while(i--) this[inputPortsSym][i].disconnectAll();
        this[inputPortsSym].splice(0);

        i = this[outputPortsSym].length;
        while(i--) this[outputPortsSym][i].disconnectAll();
        this[outputPortsSym].splice(0);
    }

    delete() {
        this.clearPorts();
    }

    handlePacket(inputPort, msg) { }

    toString() {
        return `${this.name}[${this.id.toString(16)}]`;
    }
    save() {
        return {
            id: this.id,
            name: this.name,
            ports: [...this[inputPortsSym].map(p=> p.save()), ...this[outputPortsSym].map(p=> p.save())]
        }
    }
    saveOutputConnections(array = []) {
        this[outputPortsSym].forEach(p=>p.saveConnections(array));
    }
    saveInputConnections(array = []) {
        this[inputPortsSym].forEach(p=>p.saveConnections(array));
    }
    static fromJSON(object) {
        const process = new FbpProcess(object.name, object.id);
        if(object.ports && Array.isArray(object.ports))
            object.ports.forEach(p => process.createPort(p));
    }
}

export {FbpProcess};
export default FbpProcess;