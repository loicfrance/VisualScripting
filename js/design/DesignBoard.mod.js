import {Vec2, Rect, Circle} from "../../../jsLibs_Modules/geometry2d/geometry2d.mod.js";
import {InputManager, KeyMap} from "../../../jsLibs_Modules/utils/input.mod.js";
import DesignViewPort from "./DesignCameraManager.mod.js";
import {ConnectionCreator, ConnectionsManager} from "./DesignConnection.mod.js";
import {DesignProcess} from "./DesignProcess.mod.js";
import {dragListener} from "./designUtils.mod.js";

const zoomSym = Symbol("zoom");
const centerSym = Symbol("center");

class DesignBoard {
    processes = [];
    /**
     * @type {ConnectionsManager}
     */
    connectionsManager = new ConnectionsManager();
    globalDiv;
    processDiv;
    /** @type {*[]} */
    selected = [];
    /** @type {*} */
    hovered = undefined;
    /** @type {ConnectionCreator|undefined} */
    connectionCreator = undefined;

    keyMap = new KeyMap({
        mapping: {
            "escape"    : {code: 'Escape'},
            "connect"   : {key: 'C'},
            "undo"      : {key: 'Z', ctrlKey: true},
            "redo"      : [{key: 'Y', ctrlKey: true}, {key: 'Z', ctrlKey: true, shiftKey: true}],
            "copy"      : {key: 'C', ctrlKey: true},
            "paste"     : {key: 'V', ctrlKey: true},
            "cut"       : {key: 'X', ctrlKey: true},
            "delete"    : [{code: 'Backspace'}, {code: 'Delete'}],
            "move-left" : {code: 'ArrowLeft', ctrlKey:true},
            "move-up"   : {code: 'ArrowUp', ctrlKey:true},
            "move-right": {code: 'ArrowRight', ctrlKey:true},
            "move-down" : {code: 'ArrowDown', ctrlKey:true},
            "zoom-in"   : {key: '+'},
            "zoom-out"  : {key: '-'},
            "view-left" : {code: 'ArrowLeft'},
            "view-up"   : {code: 'ArrowUp'},
            "view-right": {code: 'ArrowRight'},
            "view-down" : {code: 'ArrowDown'},
            "view-full" : {key: 'F'},
            "save"      : {key: 'S', ctrlKey: true},
        },
        callback: (action, evt)=> {
            if(evt.isComposing || evt.target.isContentEditable) return;
            if(evt.defaultPrevented) return;
            switch(action) {
                case "escape"       :
                    this.clearSelection();
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
                case "save"         : console.log(this.exportJSON()); break;
                default : break;
            }
        }
    });
//######################################################################################################################
//#                                                    CONSTRUCTOR                                                     #
//######################################################################################################################

    /**
     * @constructor
     * @param {HTMLDivElement} div
     */
    constructor(div) {
        this.globalDiv = div;
        this.processDiv = div.querySelector('.processes');
        this.globalDiv.appendChild(this.connectionsManager.elmt);
        this.globalDiv.appendChild(this.connectionsManager.selectedLayer);
        this.center = Vec2.ZERO;
        this.zoom = 1;
        this.viewPort = new DesignViewPort(div,
            {
                maxRect: Rect.createFromCenterWidthHeight(Vec2.ZERO, 4000, 4000),
                minWidth: 200,
                minHeight: 200,
                onSizeChange: (zoom, visibleRect)=> {
                    this.zoom = zoom;
                    this.center = visibleRect.center;
                    this.connectionsManager.update(zoom, visibleRect);
                }
            });
        this.keyMap.enable(this.globalDiv, 'keydown');

        if(document.activeElement === document.body)
            this.globalDiv.focus();

        {
            const startPos = Vec2.zero;
            let shiftKey = false;
            const onMove = (evt, pos)=> {
                const selectionRect = Rect.createFromPoints(
                    [startPos, this.pixelToDesignCoordinatesTransform(pos)]);
                if (shiftKey)
                    this.select(...this.processes.filter(p => p.isInRect(selectionRect)));
                else this.setSelection(...this.processes.filter(p => p.isInRect(selectionRect)));
            };
            this.globalDiv.addEventListener('mousedown', dragListener.bind(this, {
                onStart: (evt, pos) => {
                    if(evt.target !== this.globalDiv)
                        return false;
                    this.pixelToDesignCoordinatesTransform(pos, startPos);
                    shiftKey = evt.shiftKey;
                    return evt.target === this.globalDiv;
                },
                onMove: onMove,
                onStop: onMove
            }));
            window.addEventListener('mousemove', (evt)=> {
                if(this.connectionCreator) {
                    const pos = new Vec2(evt.pageX, evt.pageY);
                    this.connectionCreator.update(
                        this.pixelToDesignCoordinatesTransform(pos, pos));
                }
            });
        }
    }

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
    /**
     * @param {*} object
     * @param {MouseEvent} evt
     */
    onObjectClick(object, evt) {
        if(evt.shiftKey)  this.toggleSelection(object);
        else this.setSelection(object);
    }

    moveSelected(delta) {
        this.selected.forEach(obj=> {
            if(obj.move)
                obj.move(delta);
        });
    }
    deleteSelected() {
        this.selected.forEach(obj=> {
            if(obj.delete) {
                obj.delete();
            }
        })
    }

//######################################################################################################################
//#                                                  CAMERA MOVEMENTS                                                  #
//######################################################################################################################

    set zoom(value) {
        this[zoomSym] = value;
        this.processDiv.style.transform = `scale(${value})`;
    }
    get zoom() {
        return this[zoomSym] || 1;
    }
    /**
     * @type {Vec2}
     */
    set center(value) {
        const {x, y} = value;
        if(!this[centerSym]) this[centerSym] = new Vec2(x, y);
        else this[centerSym].setXY(x, y);
        this.processDiv.style.left = `calc(50% - ${x}px)`;
        this.processDiv.style.top  = `calc(50% - ${y}px)`;
        this.processDiv.style.transformOrigin = `${x}px ${y}px`;
    }
    get center() {
        return this[centerSym].clone();
    }
    pixelToDesignCoordinatesTransform(pixel, out = Vec2.zero) {
        //TODO not very efficient
        const pixelCenterRect = this.processDiv.getBoundingClientRect();
        const pixelCenter = new Vec2(pixelCenterRect.x, pixelCenterRect.y);
        out.set(pixel).remove(pixelCenter).mul(1/this.zoom);
        return out;
    }

    /**
     * @param {DesignPort} port
     * @param {MouseEvent} evt
     */
    onPortBulletMouseEvent(port, evt) {
        if(this.connectionCreator)
            this.connectionCreator = this.connectionCreator.onPortMouseEvent(port, evt);
        else if (evt.type === 'mousedown' && !port.connectionFull)
            this.connectionCreator = new ConnectionCreator(this, port);
    }

    addProcess(process) {
        const idx = this.processes.indexOf(process);
        if(idx === -1) {
            this.processes.push(process);
            this.processDiv.appendChild(process.elmt);
        }
    }
    removeProcess(process) {
        const idx = this.processes.indexOf(process);
        if(idx >= 0) {
            this.processes.splice(idx, 1);
            this.processDiv.removeChild(process.elmt);
        }
    }
    addConnection(connection) {
        this.connectionsManager.addToUnselected(connection);
    }
    removeConnection(connection) {
        this.connectionsManager.removeConnection(connection);
    }

    save() {
        const processes = this.processes.map(p=>p.save());
        const connections = [];
        this.processes.forEach(p=>p.saveOutputConnections(connections));
        return {
            processes: processes,
            connections: connections
        };
    }
    exportJSON() {
        return JSON.stringify(this.save(), (key, value) => key === 'id' ? value.toString(16) : value);
    }
}

export default DesignBoard;