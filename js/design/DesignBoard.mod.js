import {Vec2, Rect} from "../../../jsLibs_Modules/geometry2d/geometry2d.mod.js";
import HistoryPile from "../../../jsLibs_Modules/utils/actionsHitory.mod.js";
import {KeyMap, MouseButton} from "../../../jsLibs_Modules/utils/input.mod.js";
import {loadString} from "../../../jsLibs_Modules/utils/tools.mod.js";
import {FbpProcess} from "../FBP/FbpProcess.mod.js";
import {FbpEventType} from "../FBP/FbpSheet.mod.js";
import DesignProcess from "./DesignProcess.mod.js";
import DesignViewPort from "./DesignViewPort.mod.js";
import DesignConnection, {ConnectionCreator, ConnectionsManager} from "./DesignConnection.mod.js";
import {DesignAction, dragListener} from "./designUtils.mod.js";

let shortcuts = loadString("assets/shortcuts.json").then(
    /** @param {string} text */
    text=> {
    shortcuts = new Map(Object.entries(JSON.parse(text)));
});


function JSONReplacer(key, value) {
    switch(key) {
        case 'id' : return value.toString(16);
        default : break;
    }
    if(value instanceof Vec2)
        return value.toString();

    return value;
}

const processesMapSym = Symbol("Design processes map");
const connectionsMapSym = Symbol("Design connections map");
const fbpSheetSym = Symbol("FBP sheet");
const fbpListenerSym = Symbol("FBP events listener");

const onProcessCreatedSym = Symbol();
const onProcessDeletedSym = Symbol();
const onProcessChangedSym = Symbol();
const onPortCreatedSym = Symbol();
const onPortDeletedSym = Symbol();
const onPortChangedSym = Symbol();
const onConnectionCreatedSym = Symbol();
const onConnectionDeletedSym = Symbol();
const onConnectionChangedSym = Symbol();

const keyMapSym = Symbol("Keymap");
const keyMapCallbackSym = Symbol("Keymap callback");
const initKeyMapSym = Symbol("init Keymap");
const initDragSelectionSym = Symbol("init drag selection");
const dragListenerSym = Symbol("process dragging listener");
const accumulatedMovementDeltaSym = Symbol("Accumulated selection movement");

const actionsHistorySym = Symbol("Actions history");
const onUndoSym = Symbol("undo callback");
const onRedoSym = Symbol("redo callback");

class DesignBoard {
    /** @type Map */
    [processesMapSym] = new Map();
    /** @type Map */
    [connectionsMapSym] = new Map();
    /** @type FbpSheet */
    [fbpSheetSym];

    [accumulatedMovementDeltaSym] = Vec2.zero;

    [actionsHistorySym] = new HistoryPile(100, this[onUndoSym].bind(this), this[onRedoSym].bind(this));

    currentAction = undefined;

    /** @type {*[]} */
    selected = [];
    /** @type {*} */
    hovered = undefined;
    /** @type {ConnectionCreator|undefined} */
    connectionCreator = undefined;

//######################################################################################################################
//#                                                    CONSTRUCTOR                                                     #
//######################################################################################################################

    /**
     * @constructor
     * @param {HTMLDivElement} div
     */
    constructor(div) {
        this.viewPort = new DesignViewPort(div, {
            maxRect: Rect.createFromCenterWidthHeight(Vec2.ZERO, 4000, 4000),
            minWidth: 200,
            minHeight: 200,
            cameraListener: (zoom, visibleRect)=> { }
        });
        if(shortcuts instanceof Promise)
            shortcuts.then(this[initKeyMapSym].bind(this));
        else this[initKeyMapSym]();

        this[initDragSelectionSym]();

        if(document.activeElement === document.body) {
            this.globalDiv.focus();
        }
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    /** @type {HTMLDivElement} */
    get globalDiv() {
        return this.viewPort.globalDiv;
    }

    /** @type {FbpSheet} */
    set fbpSheet(value) {
        this[fbpSheetSym] = value;
        value.setEventsListener(this[fbpListenerSym]);
        //this.update(); TODO update design processes and connection when new fbp sheet is loaded
    }
    get fbpSheet() {
        return this[fbpSheetSym];
    }

    /** @type {DesignProcess[]} */
    get designProcesses() {
        return [...this[processesMapSym].values()];
    }
    get designConnections() {
        return [...this[connectionsMapSym].values()];
    }
//######################################################################################################################
//#                                                   LINK WITH FBP                                                    #
//######################################################################################################################
    /**
     * @param {FbpProcess} process - Fbp process
     * @return {undefined|DesignProcess}
     */
    getDesignProcess(process) {
        if(process instanceof FbpProcess) {
            return this[processesMapSym].get(process);
        } else {
            throw Error("parameter must be an FBP process");
        }
    }

    /**
     * @param {FbpConnection} connection
     * @return {undefined|DesignConnection}
     */
    getDesignConnection(connection) {
        return this[connectionsMapSym].get(connection);
    }
    getDesignConnections(designProcess) {
        return [...this[connectionsMapSym].values()].filter(
            (c)=> c.startProcess === designProcess || c.endProcess === designProcess
        );
    }
    [onProcessCreatedSym](process) {
        const dp = new DesignProcess(this, process);
        this[processesMapSym].set(process, dp);
        dp.elmt.addEventListener('mousedown', this[dragListenerSym]);
    }
    [onProcessChangedSym](process) { this.getDesignProcess(process).update(this); }
    [onProcessDeletedSym](process) {
        this.getDesignProcess(process).onFbpProcessDeleted(this);
        this[processesMapSym].delete(process);
    }

    [onPortCreatedSym](port) { this.getDesignProcess(port.process).onFbpPortCreated(port); }
    [onPortChangedSym](port) { this.getDesignProcess(port.process).onFbpPortChanged(port); }
    [onPortDeletedSym](port) { this.getDesignProcess(port.process).onFbpPortDeleted(port); }

    [onConnectionCreatedSym](connection) {
        this[connectionsMapSym].set(connection, new DesignConnection(this, connection));
    }
    [onConnectionChangedSym](connection) { this.getDesignConnection(connection).update(); }
    [onConnectionDeletedSym](connection) {
        this.getDesignConnection(connection).onFbpConnectionDeleted(this);
        this[connectionsMapSym].delete(connection);
    }

    [fbpListenerSym] = (
        /**
         * @param {FbpEventType} evtType
         * @param {FbpProcess|FbpConnection} object
         */
        function(evtType, object) {
        setTimeout(()=> {
            switch(evtType) {
                case FbpEventType.PROCESS_CREATED       : this[onProcessCreatedSym](object); break;
                case FbpEventType.PROCESS_DELETED       : this[onProcessDeletedSym](object); break;
                case FbpEventType.PROCESS_CHANGED       : this[onProcessChangedSym](object); break;
                case FbpEventType.PORT_CREATED          : this[onPortCreatedSym](object); break;
                case FbpEventType.PORT_DELETED          : this[onPortDeletedSym](object); break;
                case FbpEventType.PORT_CHANGED          : this[onPortChangedSym](object); break;
                case FbpEventType.CONNECTION_CREATED    : this[onConnectionCreatedSym](object); break;
                case FbpEventType.CONNECTION_DELETED    : this[onConnectionDeletedSym](object); break;
                case FbpEventType.CONNECTION_CHANGED    : this[onConnectionChangedSym](object); break;
                default : throw Error("unknown event : " + evtType);
            }
        });
    }).bind(this);

//######################################################################################################################
//#                                                INTERFACE LISTENERS                                                 #
//######################################################################################################################

    [keyMapCallbackSym](action, evt) {
        if(evt.isComposing || evt.target.isContentEditable) return;
        if(evt.defaultPrevented) return;
        switch(action) {
            case "cancel"       :
                this.cancelAction();
                break;
            case "connect"      : break;
            case "undo"         : break;
            case "redo"         : break;
            case "copy"         : break;
            case "paste"        : break;
            case "cut"          : break;
            case "delete"       : this.deleteSelected(); break;
            case "move-left"    : break;
            case "move-up"      : break;
            case "move-right"   : break;
            case "move-down"    : break;
            case "zoom-in"      : break;
            case "zoom-out"     : break;
            case "view-left"    : break;
            case "view-up"      : break;
            case "view-right"   : break;
            case "view-down"    : break;
            case "view-full"    : break;
            case "save"         :
                console.log(JSON.stringify(this.fbpSheet.toJSON(), JSONReplacer));
                evt.preventDefault();
                break;
            default : break;
        }
    }

    [initKeyMapSym]() {
        this[keyMapSym] = new KeyMap({
            mapping: shortcuts,
            callback: this[keyMapCallbackSym].bind(this)
        });
        this[keyMapSym].enable(this.globalDiv, 'keydown');
    }

    [initDragSelectionSym]() {
        const startPos = Vec2.zero;
        let shiftKey = false;
        this.globalDiv.addEventListener('mousedown', dragListener.bind(this, {
            onStart: (evt, pos) => {
                if(evt.target !== this.globalDiv) return false;
                this.pixelToDesignCoordinatesTransform(pos, startPos);
                shiftKey = evt.shiftKey || evt.ctrlKey;
                if(!(shiftKey))
                    this.clearSelection();
                return evt.target === this.globalDiv;
            },
            onMove: (evt, pos)=> {
                const selectionRect = Rect.createFromPoints([startPos,
                    this.viewPort.pageToDesignCoordinatesTransform(pos.x, pos.y)]);
                const processes = this.designProcesses.filter(p => p.isInRect(selectionRect));
                this.viewPort.showSelectionRect(selectionRect);
                if (shiftKey)
                    this.select(...processes);
                else this.setSelection(...processes);
            },
            onStop: ()=> {
                this.viewPort.hideSelectionRect();
            }
        }));
        window.addEventListener('mousemove', (evt)=> {
            if(this.connectionCreator) {
                const pos = new Vec2(evt.pageX, evt.pageY);
                this.connectionCreator.update(
                    this.viewPort.pageToDesignCoordinatesTransform(pos.x, pos.y, pos));
            }
        });
    }

    [dragListenerSym] = dragListener.bind(this, {
        buttonMask: MouseButton.LEFT, cursor: 'grabbing',
        onStart: (evt)=> {
            if(evt.target.isContentEditable || evt.defaultPrevented || evt.target instanceof HTMLButtonElement)
                return false;
            evt.preventDefault();
        },
        onMove: (evt, pos, delta) => {
            this[accumulatedMovementDeltaSym].add(delta.mul(1/this.viewPort.zoomFactor)); // TODO maybe replace by viewport.pixelToDesignVectorTransform
            const rounded = this[accumulatedMovementDeltaSym].clone().mul(0.2).roundedVec().mul(5);
            if(!rounded.isZero()) {
                this[accumulatedMovementDeltaSym].remove(rounded);
                if(this.currentAction === undefined)
                    this.startAction(DesignAction.MOVE_SELECTED);
                this.moveSelected(rounded);
            }
        },
        onStop: (evt)=> {
            if(this.currentAction === DesignAction.MOVE_SELECTED)
                this.validateAction(); //TODO not consistent with previous methods
            this[accumulatedMovementDeltaSym].reset();
        }
    });

    /**
     * @param {*} object
     * @param {MouseEvent} evt
     */
    onObjectClick(object, evt) {
        if(evt.shiftKey)  this.toggleSelection(object);
        else this.setSelection(object);
    }

    /**
     * @param {DesignPort} port
     * @param {MouseEvent} evt
     */
    onPortBulletMouseEvent(port, evt) {
        if(this.connectionCreator)
            this.connectionCreator = this.connectionCreator.onPortMouseEvent(port, evt);
        else if (evt.type === 'mousedown' && !port.fbpPort.connectionFull)
            this.connectionCreator = new ConnectionCreator(this, port);
    }

//######################################################################################################################
//#                                                      ACTIONS                                                       #
//######################################################################################################################
    /**
     *
     * @param {DesignAction} action
     */
    startAction(action) {
        if(this.currentAction !== undefined)
            throw Error("the previous action has not been validated nor canceled");
        this.currentAction = action;
    }
    validateAction() {
        switch(this.currentAction) {
            case DesignAction.MOVE_SELECTED :
                this.validateMovement();
                break;
            default : throw Error("unknown action " + this.currentAction);
        }
        this.currentAction = undefined;
    }
    cancelAction() {
        switch(this.currentAction) {
            case DesignAction.MOVE_SELECTED : this.cancelMovement(); break;
            case undefined : this.clearSelection(); break;
            default : throw Error("unknown action " + this.currentAction);
        }
        this.currentAction = undefined;
    }
    [onUndoSym](action) {
        switch(action.type) {
            case DesignAction.MOVE_SELECTED :
                const delta = action.delta.clone().mul(-1);
                for(const obj of action.objects) {
                    if(obj.move) obj.move(delta);
                }
                break;
            case DesignAction.DELETE_SELECTED :
                break;
        }
    }
    [onRedoSym](action) {
        switch(action.type) {
            case DesignAction.MOVE_SELECTED :
                break;
            case DesignAction.DELETE_SELECTED :
                break;
        }
    }
    undo() { this[actionsHistorySym].undo(); }
    redo() { this[actionsHistorySym].redo(); }

//######################################################################################################################
//#                                                     SELECTION                                                      #
//######################################################################################################################

    setSelection(...objects) {
        this.unselect(...this.selected.filter(p=>!objects.includes(p)));
        this.select(...objects.filter(p=>!this.selected.includes(p)));
    }
    clearSelection() {
        this.unselect(...this.selected);
    }
    toggleSelection(...objects) {
        const selected = [], unselected = [];
        objects.forEach(p=> (this.selected.includes(p) ? selected : unselected).push(p));
        this.unselect(...selected);
        this.select(...unselected);
    }
    unselect(...objects) {
        objects.forEach(obj=> {
            const idx = this.selected.indexOf(obj);
            if(idx >= 0) {
                this.selected.splice(idx, 1);
            }
            if('selected' in obj)
                obj.selected = false;
        });
        this.cancelConnectionCreation();
    }
    select(...objects) {
        objects.forEach(obj=> {
            const idx = this.selected.indexOf(obj);
            if(idx === -1) {
                this.selected.push(obj);
            }
            if('selected' in obj)
                obj.selected = true;
        });
        this.cancelConnectionCreation();
    }

    cancelConnectionCreation() {
        if(this.connectionCreator) {
            this.connectionCreator.delete();
            this.connectionCreator = undefined;
        }
    }
    moveSelected(delta) {
        if(this.currentAction !== DesignAction.MOVE_SELECTED)
            throw Error("startSelectionMovement() must be called before moveSelected()");
        this.selected.forEach(obj=> {
            if(obj.move)
                obj.move(delta);
        });
    }
    validateMovement() {
        this.selected.forEach(obj=> {
            if(obj.move)
                obj.validateMovement();
        });
        this[actionsHistorySym].push({
            type: DesignAction.MOVE_SELECTED,
            delta: this[accumulatedMovementDeltaSym],
            objects: this.selected,
        });
    }
    cancelMovement() {
        this.selected.forEach(obj=> {
            if(obj.move)
                obj.cancelMovement();
        });
    }

    deleteSelected() {
        this.selected.forEach(obj=> {
            if(obj.delete) {
                obj.delete();
            }
        });
        this[actionsHistorySym].push({
            type: DesignAction.DELETE_SELECTED,
            objects: this.selected, // TODO maybe use JSON instead of deleted objects
        });
    }

    /**
     * @deprecated
     */
    pixelToDesignCoordinatesTransform(pixel, out = Vec2.zero) {
        return this.viewPort.pageToDesignCoordinatesTransform(pixel.x, pixel.y, out);
    }
}

export default DesignBoard;