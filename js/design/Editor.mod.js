import Rect from "../../../jslib/geometry2d/Rect.mod.js";
import Vec2 from "../../../jslib/geometry2d/Vec2.mod.js";
import {KeyMap, MouseButton} from "../../../jslib/utils/input.mod.js";
import {loadString, requestFilesFromUser, textFileUserDownload} from "../../../jslib/utils/tools.mod.js";
import CameraController from "./CameraController.mod.js";
import {ConnectionCreator} from "./fbp/ConnectionDisplay.mod.js";
import DesignSheet from "./DesignSheet.mod.js";
import {dragListener} from "./designUtils.mod.js";
import PortDisplay from "./fbp/PortDisplay.mod.js";
import {FbpSheet} from "../FBP/FbpSheet.mod.js";
import {createElement} from "../../../jslib/utils/createHtml.mod.js";

//region private attribute symbols
const htmlDivSym = Symbol("HTML div");
const designSheetSym = Symbol("Design sheet");
const cameraSym = Symbol("Camera controller");
const hoveredObjectSym = Symbol("Hovered object");
const userSelectionDragListenerSym = Symbol("User selection drag listener");
const objectDragListenerSym = Symbol("Object drag listener");
const currentActionSym = Symbol("Current action");
const selectionRectSym = Symbol("Selection SVG rectangle");
const connectionCreatorSym = Symbol("Connection creator");
const keyMapSym = Symbol("Keymap");
const backgroundSym = Symbol("Background drawer");

const addDivListener = Symbol("add listener to main sheet HTML div");
const removeDivListener = Symbol("remove listener from main sheet HTML div");
const updateBackground = Symbol("update background");

const showSelectionRect = Symbol("Show selection rectangle");
const hideSelectionRect = Symbol("Hide selection rectangle");
const createConnection = Symbol("Create connection");

const keyMapCallback = Symbol("Keymap callback");
//endregion

const SVG_NS = "http://www.w3.org/2000/svg";

class Editor {

//##############################################################################
//#                             PRIVATE ATTRIBUTES                             #
//##############################################################################

    [htmlDivSym];
    [designSheetSym];
    [cameraSym] = new CameraController({
        maxRect: new Rect(-2e3, -2e3, 2e3, 2e3)
    });
    [backgroundSym];
    [connectionCreatorSym];

    [hoveredObjectSym];


//##############################################################################
//#                                CONSTRUCTOR                                 #
//##############################################################################

    constructor(config = {}) {
        this.htmlDiv = createElement("div", {class: "editor", tabindex: "-1"});
        this.camera.editor = this;
        const {camera = true, userMove = true, userEdit = true, shortKeys = true} = config;
        if (camera) {
            this.camera.enable();
        }
        if (userMove) {
            this.enableUserSelection();
            this.enableUserMovement();
        }
        if (shortKeys) {
            this.enableKeyboardShortcuts();
        }
        if (userEdit) {
            this.enableUserSelection();
            //TODO
        }
    }

//region accessors
//##############################################################################
//#                                 ACCESSORS                                  #
//##############################################################################

    /** @type HTMLDivElement */
    get htmlDiv() { return this[htmlDivSym]; }
    set htmlDiv(value) {
        if(this.htmlDiv)
            this.htmlDiv.innerHTML = "";
        this[htmlDivSym] = value;
        this.designSheet?.refreshView();
    }

    /** @type {DesignSheet} */
    get designSheet() { return this[designSheetSym]; }
    set designSheet(value) {
        if (value !== this[designSheetSym]) {
            if(this[designSheetSym]) {
                this[designSheetSym].editor = undefined;
                //TODO
                //disable all mouse & keyboard listeners
            }
            if(value) {
                this[designSheetSym] = value;
                value.editor = this;
                //TODO
                //enable mouse & keyboard listeners
            }
            this.camera.refreshListeners();
        }
    }

    /**
     *  @type {FbpSheet}
     *  @readonly
     */
    get fbpSheet() { return this.designSheet.fbpSheet; }

    /**
     * @type {CameraController}
     * @readonly
     */
    get camera() { return this[cameraSym]; }

    /** @type DesignBackground */
    get background() {
        return this[backgroundSym];
    }
    set background(value) {
        this[backgroundSym] = value;
        this[updateBackground]();
    }

    get hoveredObject() { return this[hoveredObjectSym]; }

//endregion

//region user inputs
//##############################################################################
//#                                USER INPUTS                                 #
//##############################################################################

//_____________________________ keyboard shortcuts _____________________________
//------------------------------------------------------------------------------

    setKeyboardShortcuts(mapping) {
        this[keyMapSym].setMapping(mapping);
    }

    enableKeyboardShortcuts() {
        if(!this[keyMapSym])
            this[keyMapSym] = new KeyMap({callback: this[keyMapCallback]});
        this[keyMapSym].enable(this.htmlDiv, 'keydown');
    }

    disableKeyboardShortcuts() {
        this[keyMapSym].disable(this.htmlDiv, 'keydown');
    }

    [keyMapCallback] = (action, evt)=> {
        if(evt.isComposing || evt.target.isContentEditable || evt.defaultPrevented) return;
        const sheet = this.designSheet;
        const visibleRect = sheet.visibleRect;
        const dX = Math.ceil(visibleRect.width/50)*5;
        const dY = Math.ceil(visibleRect.height/50)*5;
        switch(action) {
            case "cancel"       :
                //TODO first cancel editor-level actions (rectangle selection, objects drag, connection creation)
                this.stopConnectionCreation();
                break;
            case "connect"      : this[createConnection](); break;
            case "undo"         : break;
            case "redo"         : break;
            case "copy"         : break;
            case "paste"        : break;
            case "cut"          : break;
            case "delete"       : sheet.deleteSelected(); break;
            case "move-left"    : sheet.moveSelected(new Vec2(-dX,0)); break;
            case "move-up"      : sheet.moveSelected(new Vec2(0,-dY)); break;
            case "move-right"   : sheet.moveSelected(new Vec2(dX,0)); break;
            case "move-down"    : sheet.moveSelected(new Vec2(0,dX)); break;
            case "zoom-in"      : this.zoom(this.camera.zoomInFactor); break;
            case "zoom-out"     : this.zoom(this.camera.zoomOutFactor); break;
            case "view-left"    : this.translateView(new Vec2(-dX,0)); break;
            case "view-up"      : this.translateView(new Vec2(0,-dY)); break;
            case "view-right"   : this.translateView(new Vec2(dX,0)); break;
            case "view-down"    : this.translateView(new Vec2(0,dX)); break;
            case "view-full"    : this.viewFull(); break;
            case "save"         : this.saveSheet(); evt.preventDefault(); break;
            default : break;
        }
    }

//_______________________________ user selection _______________________________
//------------------------------------------------------------------------------

    enableUserSelection() {
        this[addDivListener]('mousedown', this[userSelectionDragListenerSym]);
    }

    disableUserSelection() {
        this[removeDivListener]('mousedown', this[userSelectionDragListenerSym]);
    }

    [userSelectionDragListenerSym] = (()=>{
        const startPos = Vec2.zero;
        let shiftKey;
        return dragListener.bind(this, {
            positionTransform: (evt, pagePos)=> {
                return this.designSheet.pageToFBPCoordinates(pagePos.x, pagePos.y, pagePos);
            },
            onStart: (evt, pos) => {
                if(evt.target !== this.htmlDiv)
                    return false;
                startPos.set(pos);
                shiftKey = evt.shiftKey || evt.ctrlKey;
                if(!(shiftKey))
                    this.designSheet.clearSelection();
                this.stopConnectionCreation();
                return true;
            },
            onMove: (evt, pos, delta)=> {
                const sheet = this.designSheet;
                const rect = Rect.createFromPoints([startPos, pos]);
                const processes = sheet.getObjectsInRect(rect);
                this[showSelectionRect](rect);
                if (shiftKey)
                    sheet.select(...processes);
                else sheet.setSelection(...processes);
                //TODO unselect objects that exit rectangle before mouse is released
            },
            onStop: ()=> {
                this[hideSelectionRect]();
            }
        });
    })();

    /** @param {Rect} rect */
    [showSelectionRect](rect) {
        if(!this[selectionRectSym]) {
            this[selectionRectSym] = document.createElementNS(SVG_NS, 'rect');
            this[selectionRectSym].style.fill = "transparent";
            this[selectionRectSym].style.stroke = "white";
            this[selectionRectSym].style.strokeWidth = "2";
        }
        this[selectionRectSym].setAttribute('x', rect.xMin);
        this[selectionRectSym].setAttribute('y', rect.yMin);
        this[selectionRectSym].setAttribute('width', rect.width);
        this[selectionRectSym].setAttribute('height', rect.height);
        if(this.designSheet)
            this.designSheet.addOverlaySVGElement(this[selectionRectSym]);
    }

    [hideSelectionRect]() {
        if(this.designSheet && this[selectionRectSym] && this[selectionRectSym].parentElement)
            this.designSheet.removeOverlaySVGElement(this[selectionRectSym]);
    }

//_____________________________ user objects drag ______________________________
//------------------------------------------------------------------------------

    enableUserMovement() {
        this[addDivListener]('mousedown', this[objectDragListenerSym]);
    }

    disableUserMovement() {
        this[removeDivListener]('mousedown', this[objectDragListenerSym]);
    }

    [objectDragListenerSym] = (()=>{
        const movement = Vec2.zero;
        let startSheet;
        return dragListener.bind(this, {
            buttonMask: MouseButton.LEFT, cursor: 'grabbing',
            positionTransform: (evt, pagePos)=>
                this.designSheet.pageToFBPCoordinates(pagePos.x, pagePos.y, pagePos),

            onStart: (evt)=> {
                if(evt.target.isContentEditable || evt.defaultPrevented || evt.target instanceof HTMLButtonElement)
                    return false;
                if(evt.target === this.htmlDiv
                    || !this.htmlDiv.contains(evt.target))
                    return false;
                evt.preventDefault();
                startSheet = this.designSheet;
                this.stopConnectionCreation();
            },

            onMove: (evt, pos, delta) => {
                movement.add(delta);
                const rounded = movement.clone().mul(0.2).roundedVec().mul(5);
                if(!rounded.isZero()) {
                    movement.remove(rounded);
                    if(this.designSheet === startSheet)
                        this.designSheet.moveSelected(rounded);
                }
            },
            onStop: (evt)=> {
                if(this.designSheet === startSheet)
                    this.designSheet.validateMovement(movement);
                movement.reset();
            }
        });
    })();

//___________________________ other private methods ____________________________
//------------------------------------------------------------------------------

    [addDivListener](event, listener) {
        this.htmlDiv.addEventListener(event, listener);
    }

    [removeDivListener](event, listener) {
        this.htmlDiv.removeEventListener(event, listener);
    }

//endregion

//region design callbacks
//##############################################################################
//#                           CALLBACKS FROM DESIGN                            #
//##############################################################################

    onObjectHover(object) {
        this[hoveredObjectSym] = object;
    }
    /**
     * @param {*} object
     * @param {MouseEvent} evt
     */
    onObjectClick(object, evt) {
        if (evt.shiftKey) this.designSheet.toggleSelection(object);
        else this.designSheet.setSelection(object);
    }

    /**
     * @param {PortDisplay} portDisplay
     * @param {MouseEvent} evt
     */
    onPortBulletMouseEvent(portDisplay, evt) {
        if(this[connectionCreatorSym])
            return this[connectionCreatorSym].onPortMouseEvent(portDisplay, evt);
        else if (evt.type === 'mousedown' && !portDisplay.fbpPort.connectionFull) {
            this.startConnectionCreation(portDisplay);
        }
    }

//endregion

//region camera
//##############################################################################
//#                                   CAMERA                                   #
//##############################################################################

    viewFull() {
        this.designSheet.visibleRect = this.designSheet.getFBPBoundingRect();
        this.onViewChange();
    }

    zoom(factor, origin = this.designSheet.center) {
        this.designSheet.zoom(factor, origin);
        this.onViewChange();
    }

    translateView(delta) {
        this.designSheet.translateView(delta);
        this.onViewChange();
    }

    onViewChange() {
        this.camera.checkVisibleRect();
        this[updateBackground]();
    }

    [updateBackground]() {
        const bg = this.background;
        if(bg) {
            const rect = this.designSheet.visibleRect;
            //const center = this.designSheet.center;
            bg.updatePosition(-rect.xMin, -rect.yMin, this.designSheet.zoomFactor);
        }
    }
//endregion

//region general actions
//##############################################################################
//#                              GENERAL ACTIONS                               #
//##############################################################################

    saveSheet(name="sheet.json") {
        textFileUserDownload(JSON.stringify(this.fbpSheet.exportJSON(),
            (key, value) =>
                (key === "id" && value instanceof Number) ? "#"+value.toString(16)
                    : value
            ,
            2),
            name
        );
    }

    cancelAction() {
        if (this[connectionCreatorSym]) {
            this.stopConnectionCreation();
        }
        else if(this.designSheet.getSelection()) {
            this.designSheet.clearSelection();
        }
    }

    [createConnection](portDisplay = this.hoveredObject, closeIfConnect = true) {
        if (!(portDisplay instanceof PortDisplay))
            return;
        if (this[connectionCreatorSym]) {
            if (this[connectionCreatorSym].canConnect(portDisplay)) {
                this[connectionCreatorSym].connect(portDisplay);
                if  (closeIfConnect)
                    this.stopConnectionCreation();
            }
        } else {
            this.startConnectionCreation(portDisplay);
        }
    }

    startConnectionCreation(portDisplay) {
        if(this[connectionCreatorSym] || portDisplay.fbpPort.connectionFull)
            return;
        this[connectionCreatorSym] = new ConnectionCreator(portDisplay);
        this[connectionCreatorSym].show();
        this[connectionCreatorSym].followCursor();
    }

    stopConnectionCreation() {
        if(!this[connectionCreatorSym])
            return;
        this[connectionCreatorSym].delete();
        this[connectionCreatorSym] = undefined;
    }

    focus() {
        this.htmlDiv.focus();
    }
}

export default Editor;
export {
    Editor,
};