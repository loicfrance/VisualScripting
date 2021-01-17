import Rect from "../../../jslib/geometry2d/Rect.mod.js";
import Vec2 from "../../../jslib/geometry2d/Vec2.mod.js";
import HistoryPile from "../../../jslib/utils/actionsHitory.mod.js";
import {htmlToElements} from "../../../jslib/utils/tools.mod.js";
import FbpConnection from "../FBP/FbpConnection.mod.js";
import FbpProcess from "../FBP/FbpProcess.mod.js";
import ConnectionDisplay, {ConnectionCreator} from "./ConnectionDisplay.mod.js";
import ProcessDisplay from "./ProcessDisplay.mod.js";

//region private attribute symbols
const updateTransform = Symbol("update rect update");
const updateVisibleRect = Symbol("update visible rect");
const updateBackground = Symbol("update background");

const sheetSym = Symbol("FBP sheet");
const parentDesignSheetSym = Symbol("Parent Design sheet");
const editorSym = Symbol("Editor");
const htmlDivSym = Symbol("HTML div");
const processesDivSym = Symbol("Processes HTML div")
const connectionsSvgSym = Symbol("Connections HTML svg")
const overlaySvgSym = Symbol("Overlay HTML svg")

const fbpListenerSym = Symbol("FBP events listener");
const processDisplaysSym = Symbol("Process displays");
const connectionDisplaysSym = Symbol("Connection displays");

const currentActionSym = Symbol("Current action");
const selectionSym = Symbol("Elements selection");
const actionsHistorySym = Symbol("Actions history");
const connectionCreatorMouseMoveSym = Symbol("Connection creator Mouse move listener");

const visibleRectSym = Symbol("Visible design rectangle");
const zoomFactorSym = Symbol("Zoom factor");
const backgroundSym = Symbol("Background drawer");
const resizeListenerSym = Symbol("Div resize listener");
const transformUpdateRequestSym = Symbol("Transform update request timeout");
//endregion

const [templateSVG] = htmlToElements(`
<svg class="connections">
`);

/** @enum */
const DesignActions = {
    MOVE: "move",
    DELETE: "delete",
    CREATE: "create",
    EDIT: "edit",
    CONNECT: "connect",
    DISCONNECT: "disconnect",
}

class DesignSheet {

//##############################################################################
//#                             PRIVATE ATTRIBUTES                             #
//##############################################################################

    [sheetSym];
    [parentDesignSheetSym];
    [editorSym];
    [processesDivSym];
    [connectionsSvgSym];
    [overlaySvgSym];

    [processDisplaysSym] = new Map();
    [connectionDisplaysSym] = new Map();
    [selectionSym] = [];
    [currentActionSym];
    [connectionCreatorMouseMoveSym];

    [visibleRectSym] = new Rect(0,0,0,0);
    [zoomFactorSym] = 1;
    [backgroundSym];

    [transformUpdateRequestSym];

    [actionsHistorySym] = new HistoryPile(100,
        (action)=> {
            //TODO use JSON references instead of objects
            switch(action.type) {
                case DesignActions.CREATE: break;
                case DesignActions.DELETE: break;
                case DesignActions.EDIT: break;
                case DesignActions.MOVE:
                    const {objects, delta} = action;
                    objects.forEach(obj=>obj.move(delta.clone().negate()));
                    break;
                case DesignActions.CONNECT:
                    const {ports} = action;
                    ports[0].disconnect(ports[1]); break;
                default:
                    throw Error("unknown action " + action.type);
            }
        },
        (action)=> {
            //TODO use JSON references instead of objects
            switch(action.type) {
                case DesignActions.CREATE: break;
                case DesignActions.DELETE: break;
                case DesignActions.EDIT: break;
                case DesignActions.MOVE:
                    const {objects, delta} = action;
                    objects.forEach(obj=>obj.move(delta));
                    break;
                case DesignActions.CONNECT:
                    const {ports} = action;
                    ports[0].connect(ports[1]); break;
                default:
                    throw Error("unknown action " + action.type);
            }
        });

//##############################################################################
//#                                CONSTRUCTOR                                 #
//##############################################################################

    constructor(fbpSheet) {
        this.fbpSheet = fbpSheet;
    }

//##############################################################################
//#                                 ACCESSORS                                  #
//##############################################################################

    /** @type {FbpSheet} */
    get fbpSheet() { return this[sheetSym]; }
    set fbpSheet(sheet) {
        this[sheetSym] = sheet;
        sheet.setEventsListener(this[fbpListenerSym]);
        this.refreshFbpDisplay()
    }

    /** @type {DesignSheet} */
    get parentSheet() { return this[parentDesignSheetSym]; }
    set parentSheet(value) {
        this[parentDesignSheetSym] = value;
    }

    /** @type Editor */
    get editor() { return this.parentSheet?.editor ?? this[editorSym]; }
    set editor(value) {
        if(this.parentSheet)
            throw Error("can only set editor of root design sheet");
        this[editorSym] = value;
        this.refreshView();
    }

    /** @type {ProcessDisplay[]} */
    get processDisplays() {
        return [...this[processDisplaysSym].values()];
    }
    /** @type {ConnectionDisplay[]} */

    get connectionDisplays() {
        return [...this[connectionDisplaysSym].values()];
    }

    /** @type {Rect} */
    get visibleRect() { return this[visibleRectSym]; }
    set visibleRect(rect) {
        if(!this.htmlDiv)
            return;
        this.visibleRect.setRect(rect);
        this.zoomFactor = Math.min(
            this.htmlDiv.clientWidth / rect.width,
            this.htmlDiv.clientHeight / rect.height
        );
    }

    /** @type number */
    get zoomFactor() { return this[zoomFactorSym]; }
    set zoomFactor(value) {
        this[zoomFactorSym] = value;
        this.requestTransformUpdate();
    }

    /** @type {HTMLDivElement} */
    get htmlDiv() { return this.editor?.htmlDiv; }

    /** @type {DesignBackground} */
    get background() { return this[backgroundSym]; }
    set background(value) {
        this[backgroundSym] = value;
        this[updateBackground]();
    }

    /** @type HistoryPile */
    get history() { return this[actionsHistorySym]; }

//##############################################################################
//#                               FBP INTERFACE                                #
//##############################################################################

//___________________________________ public ___________________________________
//------------------------------------------------------------------------------

    /**
     * @param {FbpProcess|FbpConnection} fbpObj
     * @return {ProcessDisplay|ConnectionDisplay}
     */
    getDisplay(fbpObj) {
        if (fbpObj instanceof FbpProcess)
            return this.getProcessDisplay(fbpObj);
        else if (fbpObj instanceof FbpConnection)
            return this.getConnectionDisplay(fbpObj);
        else
            throw Error("can only get display for FBP Processes or FBP Connections." +
                `Object ${fbpObj} not compatible.`);
    }

    /**
     * @param {FbpProcess} process
     * @return {ProcessDisplay}
     */
    getProcessDisplay(process) {
        return this[processDisplaysSym].get(process);
    }

    /**
     * @param {FbpConnection} connection
     * @return {ConnectionDisplay}
     */
    getConnectionDisplay(connection) {
        return this[connectionDisplaysSym].get(connection);
    }

    getObjectsInRect(rect) {
        return [
            ...this.processDisplays.filter(display=>display.isInRect(rect)),
            //TODO connections ? other UI elements ?
        ];
    }

    refreshFbpDisplay() {
        if(!this.htmlDiv)
            return;
        this[processesDivSym].innerHTML = '';
        this[connectionsSvgSym].innerHTML = '';
        this.processDisplays.forEach(display=>{
            this[processesDivSym].appendChild(display.elmt);
        });
        this.connectionDisplays.forEach(display=>{
            this[connectionsSvgSym].appendChild(display.path);
        });
    }

    getFBPBoundingRect() {
        const rect = Rect.getUnion(this.processDisplays.map(display=> display.getRect()));
        if(rect) {
            rect.xMin -= 20;
            rect.yMin -= 20;
            rect.xMax += 20;
            rect.yMax += 20;
        }
        return rect;
    }

    /**
     * @param {SVGElement} svgNode
     */
    addOverlaySVGElement(svgNode) {
        this[overlaySvgSym].appendChild(svgNode);
    }

    /**
     * @param {SVGElement} svgNode
     */
    removeOverlaySVGElement(svgNode) {
        this[overlaySvgSym].removeChild(svgNode);
    }

//__________________________________ private ___________________________________
//------------------------------------------------------------------------------

    [fbpListenerSym] = {
        onProcessCreated: (process)=> {
            const display = new ProcessDisplay(this, process);
            this[processDisplaysSym].set(process, display);
            if(this.htmlDiv)
                this[processesDivSym].appendChild(display.elmt);
            //display.elmt.addEventListener('mousedown', this[dragListenerSym]);
        },
        onProcessDeleted: (process)=> {
            const display = this.getProcessDisplay(process);
            this[processDisplaysSym].delete(process);
            if(this.htmlDiv)
                this[processesDivSym].removeChild(display.elmt);
            if(display.selected)
                this.unselect(display);
        },
        onConnectionCreated: (connection)=> {
            const display = new ConnectionDisplay(this, connection);
            this[connectionDisplaysSym].set(connection, display);
            if(this.htmlDiv)
                this[connectionsSvgSym].appendChild(display.path);
        },
        onConnectionDeleted: (connection)=> {
            const display = this.getConnectionDisplay(connection);
            this[connectionDisplaysSym].delete(connection);
            if(this.htmlDiv)
                this[connectionsSvgSym].removeChild(display.path);
        }
    };

//##############################################################################
//#                                 SELECTION                                  #
//##############################################################################

    getSelection() {
        return this[selectionSym].slice();
    }

//__________________________ select/unselect objects ___________________________
//------------------------------------------------------------------------------

    /**
     * @param {(*|*[])} objects
     */
    setSelection(...objects) {
        if(objects.length === 1 && Array.isArray(objects[0]))
            objects = objects[0];
        this.unselect(this[selectionSym].filter(x=>!objects.includes(x)));
        this.select(objects.filter(x=>!this[selectionSym].includes(x)));
    }

    toggleSelection(...objects) {
        if(objects.length === 1 && Array.isArray(objects[0]))
            objects = objects[0];
        const selected = [], unselected = [];
        objects.forEach(p=> (this[selectionSym].includes(p) ? selected : unselected).push(p));
        this.unselect(selected);
        this.select(unselected);
    }

    clearSelection() {
        this.unselect(this[selectionSym]);
    }

    /**
     * @param {(*|*[])} objects
     */
    select(...objects) {
        if(objects.length === 1 && Array.isArray(objects[0]))
            objects = objects[0];
        objects.forEach(obj=> {
            const idx = this[selectionSym].indexOf(obj);
            if (idx === -1)
                this[selectionSym].push(obj);
            if ('selected' in obj)
                obj.selected = true;
        });
        //if(this.getCurrentAction())
        //    this.cancelAction();
    }

    /**
     * @param {(*|*[])} objects
     */
    unselect(...objects) {
        if(objects.length === 1 && Array.isArray(objects[0]))
            objects = objects[0];
        let i = objects.length;
        while(i--) {
            const obj = objects[i];
            const idx = this[selectionSym].indexOf(obj);
            if (idx >= 0)
                this[selectionSym].splice(idx, 1);
            if ('selected' in obj)
                obj.selected = false;
        }
    }

//_______________________________ move selection _______________________________
//------------------------------------------------------------------------------

    moveSelected(delta) {
        this[selectionSym].forEach(obj=> {
            if(obj.move)
                obj.move(delta);
        });
    }

    validateMovement(delta) {
        this[selectionSym].forEach(obj=> {
            if(obj.move)
                obj.validateMovement(delta);
        });
        this[actionsHistorySym].push({
            type: DesignActions.MOVE,
            objects: this[selectionSym].slice(),
            delta: delta
        })
    }

    cancelMovement() {
        this[selectionSym].forEach(obj=> {
            if(obj.move)
                obj.cancelMovement();
        });
    }

//______________________________ other functions _______________________________
//------------------------------------------------------------------------------

    deleteSelected() {
        this[selectionSym].forEach(obj=> {
            if(obj.delete) {
                obj.delete();
            }
        });
    }


//##############################################################################
//#                                   CAMERA                                   #
//##############################################################################

//___________________________________ public ___________________________________
//------------------------------------------------------------------------------

    /**
     * resets all html elements
     */
    refreshView() {
        this[resizeListenerSym].disconnect();
        const div = this.htmlDiv;
        if(div) {
            div.innerHTML = '';
            this[processesDivSym] = document.createElement("div");
            this[processesDivSym].classList.add("processes");
            this[connectionsSvgSym] = templateSVG.cloneNode(true);
            this[overlaySvgSym] = templateSVG.cloneNode(true);
            this[overlaySvgSym].classList.add('selected');
            div.append(this[processesDivSym], this[connectionsSvgSym], this[overlaySvgSym]);
            this[resizeListenerSym].observe(div);
            this.requestTransformUpdate();
            this.refreshFbpDisplay();
        }
    }

    moveVisibleRect(delta) {
        this.visibleRect.move(delta);
        this.requestTransformUpdate();
    }

    zoom(factor, origin = this.visibleRect.center) {
        this.visibleRect.relativeScale(origin, 1/factor);
        this.zoomFactor *= factor;
    }

    requestTransformUpdate() {
        this[updateVisibleRect]();
        if (!this[transformUpdateRequestSym])
            this[transformUpdateRequestSym] = setTimeout(this[updateTransform]);
    }

    pageToFBPCoordinates(pageX, pageY, out = Vec2.zero) {
        if(!this.htmlDiv)
            throw Error("this sheet is not visible");
        const divRect = this.htmlDiv.getBoundingClientRect();
        return this.divToFBPCoordinates(pageX - divRect.left, pageY - divRect.top, out);
    }

    divToFBPCoordinates(clientX, clientY, out = Vec2.zero) {
        const zoom = this.zoomFactor, rect = this.visibleRect;
        return out.setXY(clientX/zoom + rect.xMin, clientY/zoom + rect.yMin);
    }

    pixelToFBPVector(pixelX, pixelY, out = Vec2.zero) {
        const zoom = this.zoomFactor;
        return out.setXY(pixelX/zoom, pixelY/zoom);
    }

//__________________________________ private ___________________________________
//------------------------------------------------------------------------------

    // noinspection JSUnresolvedFunction
    [resizeListenerSym] = new ResizeObserver((evt) => {
        this.requestTransformUpdate();
    });

    [updateVisibleRect]() {
        const {clientWidth: width, clientHeight: height} = this.htmlDiv;
        this.visibleRect.setDimensions(width / this.zoomFactor, height / this.zoomFactor);
    }

    [updateTransform] = ()=> {
        if(!this.htmlDiv)
            return;
        this[updateBackground]();
        const rect = this.visibleRect;
        const viewBox = `${rect.xMin} ${rect.yMin} ${rect.width} ${rect.height}`;
        this[connectionsSvgSym].setAttribute("viewBox", viewBox);
        this[overlaySvgSym].setAttribute("viewBox", viewBox);
        const {x, y} = rect.center;
        this[processesDivSym].style.transform = `scale(${this.zoomFactor})`;
        this[processesDivSym].style.left = `calc(50% - ${x}px)`; // TODO maybe 50% is useless
        this[processesDivSym].style.top  = `calc(50% - ${y}px)`;
        this[processesDivSym].style.transformOrigin = `${x}px ${y}px`;
        this[transformUpdateRequestSym] = undefined;
    }

    [updateBackground]() {
        const bg = this.background;
        if(bg) {
            const rect = this.visibleRect;
            bg.updatePosition(-rect.xMin, -rect.yMin, this.zoomFactor);
        }
    }
}

export default DesignSheet;
export {
    DesignSheet,
    DesignActions
};