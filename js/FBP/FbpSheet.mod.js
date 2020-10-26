
const processesSym = Symbol("processes list");
const connectionsSym = Symbol("connections list");
const typesTableSym = Symbol("types table");
const listenerSym = Symbol("event listener");
const pendingEventsSym = Symbol("pending events");
const callListenerSym = Symbol("call event listener");
const callListener = Symbol("add event to pending list");
const timeoutSym = Symbol();

const createdProcessesSym = Symbol("untreated process creations");
const updatedProcessesSym = Symbol("untreated process updates");
const deletedProcessesSym = Symbol("untreated process deletions");
const createdPortsSym = Symbol("untreated port creations");
const updatedPortsSym = Symbol("untreated port updates");
const deletedPortsSym = Symbol("untreated port deletions");
const createdConnectionsSym = Symbol("untreated connection creations");
const updatedConnectionsSym = Symbol("untreated connection updates");
const deletedConnectionsSym = Symbol("untreated connection deletions");
const onObjectCreated = Symbol();
const onObjectChanged = Symbol();
const onObjectDeleted = Symbol();

const FbpEventType = {
    PROCESS_CREATED: "process_created",
    PROCESS_DELETED: "process_deleted",
    PROCESS_CHANGED: "process_changed",
    PORT_CREATED: "port_created",
    PORT_DELETED: "port_deleted",
    PORT_CHANGED: "port_changed",
    CONNECTION_CREATED: "connection_created",
    CONNECTION_DELETED: "connection_deleted",
    CONNECTION_CHANGED: "connection_changed",
};
const FBP_EVT = FbpEventType;


class FbpSheet {
    [processesSym] = [];
    [connectionsSym] = [];
    [typesTableSym] = new Map();
    [listenerSym];
    [pendingEventsSym] = [];
    [timeoutSym] = undefined;

    [deletedProcessesSym] = [];
    [updatedProcessesSym] = [];
    [createdProcessesSym] = [];
    [deletedPortsSym] = [];
    [updatedPortsSym] = [];
    [createdPortsSym] = [];
    [deletedConnectionsSym] = [];
    [updatedConnectionsSym] = [];
    [createdConnectionsSym] = [];

    [callListenerSym] = (function() {
        this[timeoutSym] = undefined;
        let a;
        a = this[deletedProcessesSym].splice(0); for(const p of a) this[listenerSym](FBP_EVT.PROCESS_DELETED, p);
        a = this[updatedProcessesSym].splice(0); for(const p of a) this[listenerSym](FBP_EVT.PROCESS_CHANGED, p);
        a = this[createdProcessesSym].splice(0); for(const p of a) this[listenerSym](FBP_EVT.PROCESS_CREATED, p);
        a = this[deletedPortsSym].splice(0); for(const p of a) this[listenerSym](FBP_EVT.PORT_DELETED, p);
        a = this[updatedPortsSym].splice(0); for(const p of a) this[listenerSym](FBP_EVT.PORT_CHANGED, p);
        a = this[createdPortsSym].splice(0); for(const p of a) this[listenerSym](FBP_EVT.PORT_CREATED, p);
        a = this[deletedConnectionsSym].splice(0); for(const c of a) this[listenerSym](FBP_EVT.CONNECTION_DELETED, c);
        a = this[updatedConnectionsSym].splice(0); for(const c of a) this[listenerSym](FBP_EVT.CONNECTION_CHANGED, c);
        a = this[createdConnectionsSym].splice(0); for(const c of a) this[listenerSym](FBP_EVT.CONNECTION_CREATED, c);

    }).bind(this);

    [callListener]() {
        if (this[timeoutSym] === undefined && this[listenerSym])
            this[timeoutSym] = setTimeout(this[callListenerSym]);
    }


    /**
     * @param {function(FbpEventType, FbpProcess|FbpConnection|FbpPort):void | undefined} listener
     */
    constructor(listener = undefined) {
        this.setEventsListener(listener)
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
     * @type {FbpProcess[]}
     */
    get processes() {
        return this[processesSym];
    }
    /**
     * @type {FbpConnection[]}
     */
    get connections() {
        return this[connectionsSym];
    }

    // noinspection JSUnusedGlobalSymbols
    getProcess(id) {
        return this.processes.find(p=>p.id === id);
    }

    isProcessIdTaken(id) {
        let i = this[processesSym].length;
        while(i--) {
            if(this[processesSym][i].id === id)
                return true;
        }
        return false;
    }

    [onObjectCreated](object, createdSym, updatedSym, deletedSym) {
        const idx = this[updatedSym].indexOf(object);
        if(idx >= 0) this[updatedSym].splice(idx, 1);
        this[createdSym].push(object);
        this[callListener]();
    }
    [onObjectChanged](object, createdSym, updatedSym, deletedSym) {
        if(this[updatedSym].includes(object)) return;
        else if(this[createdSym].includes(object)) return;
        else if(this[deletedSym].includes(object)) return;
        this[updatedSym].push(object);
        this[callListener]();
    }
    [onObjectDeleted](object, createdSym, updatedSym, deletedSym) {
        let idx = this[createdSym].indexOf(object);
        if(idx >= 0) this[createdSym].splice(idx, 1);
        else {
            idx = this[updatedSym].indexOf(object);
            if(idx >= 0) this[updatedSym].splice(idx, 1);
            this[deletedSym].push(object);
        }
        this[callListener]();
    }


    onProcessCreated(process) {
        this[processesSym].push(process);
        this[onObjectCreated](process, createdProcessesSym, updatedProcessesSym, deletedProcessesSym);
    }
    onProcessDeleted(process) {
        let idx = this[processesSym].indexOf(process);
        if(idx >= 0) this[processesSym].splice(idx, 1);
        else throw Error("deleted process not in processes array");
        this[onObjectDeleted](process, createdProcessesSym, updatedProcessesSym, deletedProcessesSym);
    }
    onProcessChanged(process) {
        this[onObjectChanged](process, createdProcessesSym, updatedProcessesSym, deletedProcessesSym);
    }

    onPortCreated(port) {
        this[onObjectCreated](port, createdPortsSym, updatedPortsSym, deletedPortsSym);
    }
    onPortDeleted(port) {
        this[onObjectDeleted](port, createdPortsSym, updatedPortsSym, deletedPortsSym);
    }
    onPortChanged(port) {
        this[onObjectChanged](port, createdPortsSym, updatedPortsSym, deletedPortsSym);
    }

    onConnectionCreated(connection) {
        this[connectionsSym].push(connection);
        this[onObjectCreated](connection, createdConnectionsSym, updatedConnectionsSym, deletedConnectionsSym);
    }
    onConnectionDeleted(connection) {
        let idx = this[connectionsSym].indexOf(connection);
        if(idx >= 0) this[connectionsSym].splice(idx, 1);
        else throw Error("deleted connection not in connections array");
        this[onObjectDeleted](connection, createdConnectionsSym, updatedConnectionsSym, deletedConnectionsSym);
    }
    onConnectionChanged(connection) {
        this[onObjectChanged](connection, createdConnectionsSym, updatedConnectionsSym, deletedConnectionsSym);
    }
    exportJSON() {
        return {
            processes: this.processes.map(p=>p.exportJSON()),
            connections: this.connections.map(c=>c.exportJSON())
        };
    }

    setType(name, fbpType) {
        this[typesTableSym].set(name, fbpType);
    }
    getType(name) {
        return this[typesTableSym].get(name);
    }
}
export {FbpSheet, FbpEventType};
