import {FbpPort} from "./FbpPort.mod.js";

const inputPortsSym = Symbol("input ports list");
const outputPortsSym = Symbol("output ports list");

class FbpProcess {
    /** @type {string} */
    name;
    /** @type {FbpPort[]} */
    [inputPortsSym] = [];
    /** @type {FbpPort[]} */
    [outputPortsSym] = [];

    /**
     * @constructor
     * @param {string} name
     */
    constructor(name) {
        this.name = name;
    }
/*
    getInputPort(index) {
        return this[inputPortsSym][index];
    }
    getOutputPort(index) {
        return this[outputPortsSym][index];
    }
    getPortIndex(port) {
        if(port.output)
            return this[outputPortsSym].indexOf(port);
        else return this[inputPortsSym].indexOf(port);
    }
*/
    /**
     * @param {FbpPort} port
     */
    addPort(port) {
        if(port.output)
            this[outputPortsSym].push(port);
        else this[inputPortsSym].push(port);
    }
    removePort(port) {
        const idx = this.getPortIndex(port);
        if(idx >= 0) {
            port.disconnectAll();
            if(port.output)
                this[outputPortsSym].splice(idx, 1);
            else this[inputPortsSym].splice(idx, 1);
        }
    }

    handlePacket(inputPort, msg) { }
}

export {FbpProcess};
export default FbpProcess;