import {PRNG} from "../../../jslib/utils/tools.mod.js";
import FbpConnection from "./FbpConnection.mod.js";
import FbpObject from "./FbpObject.mod.js";
import {FbpPortDirection} from "./FbpPort.mod.js";
import FbpProcess from "./FbpProcess.mod.js";
//import {FbpSheetPortProcess, FbpSubSheetProcess} from "./process-lib/FbpSheetPortProcess.mod.js";

const environmentSym = Symbol("FBP environment");
const processesSym = Symbol("processes list");
const connectionsSym = Symbol("connections list");
const listenerSym = Symbol("event listener");
const pendingEventsSym = Symbol("pending events");
const callListenerSym = Symbol("call event listener");
const callListener = Symbol("add event to pending list");
const timeoutSym = Symbol();

const createdProcessesSym = Symbol("untreated process creations");
const deletedProcessesSym = Symbol("untreated process deletions");
const createdPortsSym = Symbol("untreated port creations");
const deletedPortsSym = Symbol("untreated port deletions");
const createdConnectionsSym = Symbol("untreated connection creations");
const deletedConnectionsSym = Symbol("untreated connection deletions");
const onObjectCreated = Symbol();
const onObjectDeleted = Symbol();
const getQueueWithObjectSym = Symbol();

const PRNGSym = Symbol("Random number generator");

const FbpEventType = {
    PROCESS_CREATED: "process_created",
    PROCESS_DELETED: "process_deleted",
    CONNECTION_CREATED: "connection_created",
    CONNECTION_DELETED: "connection_deleted",
};
const FBP_EVT = FbpEventType;

/**
 * @typedef FbpSheetListener
 * @property {function(FbpProcess)} onProcessCreated
 * @property {function(FbpProcess)} onProcessDeleted
 * @property {function(FbpConnection)} onConnectionCreated
 * @property {function(FbpConnection)} onConnectionDeleted
 */


class FbpSheet extends FbpObject {
    [processesSym] = new Map();
    [connectionsSym] = [];
    [listenerSym];
    [pendingEventsSym] = [];
    [timeoutSym] = undefined;
    [PRNGSym] = new PRNG(0);

    [deletedProcessesSym] = [];
    [createdProcessesSym] = [];
    [deletedPortsSym] = [];
    [createdPortsSym] = [];
    [deletedConnectionsSym] = [];
    [createdConnectionsSym] = [];

    [callListenerSym] = ()=> {
        this[timeoutSym] = undefined;
        const listener = this[listenerSym];
        const deletedProcs = this[deletedProcessesSym].splice(0);
        const createdProcs = this[createdProcessesSym].splice(0);
        const deletedConns = this[deletedConnectionsSym].splice(0);
        const createdConns = this[createdConnectionsSym].splice(0);
        for(const p of deletedProcs) listener.onProcessDeleted(p);
        for(const p of createdProcs) listener.onProcessCreated(p);
        for(const c of deletedConns) listener.onConnectionDeleted(c);
        for(const c of createdConns) listener.onConnectionCreated(c);
    };

    [callListener]() {
        if (this[timeoutSym] === undefined && this[listenerSym])
            this[timeoutSym] = setTimeout(this[callListenerSym]);
    }


    /**
     * @param {FbpEnvironment} environment
     * @param {FbpSheetListener} listener
     */
    constructor(environment, listener = undefined) {
        super();
        this[environmentSym] = environment;
        this.setEventsListener(listener);

    }

    /**
     * @param {FbpSheetListener} listener
     */
    setEventsListener(listener) {
        this[listenerSym] = listener;
        this[callListener]();
    }

    /** @type FbpEnvironment */
    get env() {
        return this[environmentSym];
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @type {Map<number, FbpProcess>}
     */
    get processes() {
        return this[processesSym];
    }
    /** @type {FbpConnection[]} */
    get connections() {
        return this[connectionsSym];
    }
    /** @type {FbpLoader} */
    get libLoader() {
        return this.env.libLoader;
    }

    // noinspection JSUnusedGlobalSymbols
    getProcess(id) {
        return this.processes.get(id);
    }

    isProcessIdTaken(id) {
        return this.processes.has(id);
    }
    generateProcessId(id = NaN) {
        let nb_trials = 10000;
        if (!isNaN(id) && !this.isProcessIdTaken(id))
            return id;
        do {
            id = this[PRNGSym].next();
        } while(this.isProcessIdTaken(id) && (--nb_trials) > 0);
        if (nb_trials === 0) {
            throw Error("cannot find unused process id after 10000 trials");
        }
        return id;
    }
    [getQueueWithObjectSym](object, createdSym, deletedSym) {
        return  this[createdSym].includes(object) ? this[createdSym] :
                this[deletedSym].includes(object) ? this[deletedSym] : undefined;
    }

    [onObjectCreated](object, createdSym, deletedSym) {
        this[createdSym].push(object);
        this[callListener]();
    }
    [onObjectDeleted](object, createdSym, deletedSym) {
        let idx = this[createdSym].indexOf(object);
        if(idx >= 0) this[createdSym].splice(idx, 1);
        this[deletedSym].push(object);
        this[callListener]();
    }

    onProcessCreated(process) {
        this.processes.set(process.id, process);
        this[onObjectCreated](process, createdProcessesSym, deletedProcessesSym);
    }
    onProcessDeleted(process) {
        this.processes.delete(process.id);
        this[onObjectDeleted](process, createdProcessesSym, deletedProcessesSym);
    }

    onConnectionCreated(connection) {
        this[connectionsSym].push(connection);
        this[onObjectCreated](connection, createdConnectionsSym, deletedConnectionsSym);
    }
    onConnectionDeleted(connection) {
        let idx = this[connectionsSym].indexOf(connection);
        if(idx >= 0) this[connectionsSym].splice(idx, 1);
        else throw Error("deleted connection not in connections array");
        this[onObjectDeleted](connection, createdConnectionsSym, deletedConnectionsSym);
    }
    clearProcesses() {
        const processes = this[processesSym].values();
        for(let p of processes) {
            p.delete();
        }
        if(this[connectionsSym].length > 0) {
            throw Error("Error : remaining connections after fbp sheet clean");
        }
    }
    exportJSON() {
        return {
            processes: Array.from(this.processes).map(([id,p])=>p.exportJSON()),
            connections: this.connections.map(c=>c.exportJSON())
        };
    }
    createProcess(config) {
        return new FbpProcess(this, config);
    }
    createProcesses(...configs) {
        return configs.map(this.createProcess.bind(this));
    }

    /**
     * @param {Object|string} object
     * @return {Promise<void>}
     */
    async importJSON(object) {
        if(object.substr)
            object = JSON.parse(object);
        const {processes, connections} = object;
        for(let p of processes) {
            // noinspection ES6MissingAwait
            FbpProcess.fromJSON(this, p);
        }
        await this.libLoader.finishLoadings();
        for(let c of connections) {
            FbpConnection.fromJSON(this, c);
        }
    }

    /**
     * @deprecated use fbpSheet.env.getType instead
     * @param name
     * @return {any}
     */
    getType(name) {
        console.warn("use of deprecated function FbpSheet.getType");
        return this.env.getType(name);
    }

    /**
     * @deprecated use fbpSheet.env.hasType instead
     * @param name
     * @return {Promise<boolean> | boolean}
     */
    hasType(name) {
        console.warn("use of deprecated function FbpSheet.hasType");
        return this.env.has(name);
    }

    /**
     * @deprecated use fbpSheet.env.setTypes instead
     * @param typesTable
     * @param override
     */
    setTypes(typesTable, override=true) {
        console.warn("use of deprecated function FbpSheet.setTypes");
        this.env.setTypes(typesTable, override);
    }
}
export {FbpSheet, FbpEventType};
