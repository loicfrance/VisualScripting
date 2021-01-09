import {PRNG} from "../../../jslib/utils/tools.mod.js";
import FbpConnection from "./FbpConnection.mod.js";
import {FbpPortDirection} from "./FbpPort.mod.js";
import FbpProcess from "./FbpProcess.mod.js";
//import {FbpSheetPortProcess, FbpSubSheetProcess} from "./process-lib/FbpSheetPortProcess.mod.js";

const processesSym = Symbol("processes list");
const connectionsSym = Symbol("connections list");
const typesTableSym = Symbol("types table");
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

const libLoaderSym = Symbol();

const PRNGSym = Symbol("Random number generator");

const FbpEventType = {
    PROCESS_CREATED: "process_created",
    PROCESS_DELETED: "process_deleted",
    CONNECTION_CREATED: "connection_created",
    CONNECTION_DELETED: "connection_deleted",
};
const FBP_EVT = FbpEventType;


class FbpSheet {
    [processesSym] = new Map();
    [connectionsSym] = [];
    [typesTableSym] = new Map();
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

    [libLoaderSym];

    [callListenerSym] = (function() {
        this[timeoutSym] = undefined;
        for(const p of this[deletedProcessesSym].splice(0)) this[listenerSym](FBP_EVT.PROCESS_DELETED, p);
        for(const p of this[createdProcessesSym].splice(0)) this[listenerSym](FBP_EVT.PROCESS_CREATED, p);
        for(const c of this[deletedConnectionsSym].splice(0)) this[listenerSym](FBP_EVT.CONNECTION_DELETED, c);
        for(const c of this[createdConnectionsSym].splice(0)) this[listenerSym](FBP_EVT.CONNECTION_CREATED, c);
    }).bind(this);

    [callListener]() {
        if (this[timeoutSym] === undefined && this[listenerSym])
            this[timeoutSym] = setTimeout(this[callListenerSym]);
    }


    /**
     * @param {function(FbpEventType, FbpProcess|FbpConnection|FbpPort):void | undefined} listener
     */
    constructor(listener = undefined) {
        this.setEventsListener(listener);
    }

    /**
     * @param {function(FbpEventType, FbpProcess|FbpConnection|FbpPort):void | undefined} listener
     */
    setEventsListener(listener) {
        this[listenerSym] = listener;
        this[callListener]();
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
        return this[libLoaderSym];
    }
    /** @param {FbpLoader} loader */
    set libLoader(loader) {
        this[libLoaderSym] = loader;
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
    async importJSON(object) {
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

    setType(name, fbpType) {
        this[typesTableSym].set(name, fbpType);
    }
    getType(name) {
        return this[typesTableSym].get(name);
    }
    hasType(name) {
        return this[typesTableSym].has(name);
    }
    clearTypes() {
        return this[typesTableSym].clear();
    }
    setTypes(typesTable, override=true) {
        typesTable.forEach((type, name) => {
            if (override || !(this.hasType(name)))
                this.setType(name, type);
        });
    }
}
export {FbpSheet, FbpEventType};
