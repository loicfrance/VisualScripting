import {Vec2, Rect, Circle} from "../../../jsLibs_Modules/geometry2d/geometry2d.mjs";
import DesignViewPort from "./DesignCameraManager.mod.js";
import {ConnectionCreator, ConnectionsManager} from "./DesignConnection.mod.js";
import {DesignProcess} from "./DesignProcess.mod.js";
import {dragListener} from "./designUtils.mod.js";

const zoomSym = Symbol("zoom");
const centerSym = Symbol("center");

class DesignBoard {
    /**
     * @constructor
     * @param {HTMLDivElement} div
     */
    constructor(div) {
        this.processes = [];
        this.globalDiv = div;
        this.processDiv = div.querySelector('.processes');
        this.connectionsManager = new ConnectionsManager();
        this.globalDiv.appendChild(this.connectionsManager.elmt);
        /**
         * @type {*[]}
         */
        this.selected = [];
        /**
         * @type {ConnectionCreator|undefined}
         */
        this.connectionCreator = undefined;
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
        this.currentAction = null;
        this.globalDiv.addEventListener('keydown',
            /** @param {KeyboardEvent} evt */
            (evt)=> {
            if(evt.isComposing) return; // skip event if typing
            switch(evt.code) {
                case 'Escape' : this.clearSelection(); break;
            }
        });
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
            obj.selected = false;
        });
        if(this.connectionCreator) {
            this.connectionCreator.destroy();
            this.connectionCreator = undefined;
        }
    }
    select(...objects) {
        objects.forEach(obj=> {
            const idx = this.selected.indexOf(obj);
            if(idx === -1) {
                this.selected.push(obj);
            }
            obj.selected = true;
        });
        if(this.connectionCreator) {
            this.connectionCreator.destroy();
            this.connectionCreator = undefined;
        }
    }

    /**
     * @param {*} object
     * @param {MouseEvent} evt
     */
    onObjectClick(object, evt) {

        if(evt.shiftKey) {
            this.toggleSelection(object);
        }
        else {
            this.setSelection(object);
        }
    }
    onProcessDrag(process, evt, delta = Vec2.ZERO) {
        if(process.selected === false) {
            if(evt.shiftKey) this.select(process);
            else this.setSelection(process);
        }
        if(!delta.isZero()) this.selected.forEach(obj=> {
            if(obj instanceof DesignProcess && obj !== process) {
                obj.move(delta);
            }
        });
        if(this.connectionCreator) {
            this.connectionCreator.destroy();
            this.connectionCreator = undefined;
        }
    }
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

    onPortBulletHover(port, evt) {
        if(this.connectionCreator) {
            if(this.connectionCreator.beginPort.canConnect(port)) {
                //TODO highlight connectionCreator to notify available connection
            }
            else {
                //TODO highlight connectionCreator to notify unavailable connection
            }
        }
    }
    onPortBulletClick(port, evt) {
        if(!port.connectionFull) {
            if(this.connectionCreator && this.connectionCreator.beginPort !== port) {
                if(this.connectionCreator.beginPort.canConnect(port)) {
                    this.connectionCreator.beginPort.connect(port);
                    if(!evt.shiftKey) {
                        this.connectionCreator.destroy();
                        this.connectionCreator = undefined;
                    }
                }
            } else if(this.connectionCreator === undefined) {
                this.connectionCreator = new ConnectionCreator(this, port);
            }
        }
        //TODO rebuild ports connection
        /*
        if(evt.shift) {
            const idx = this.selected.indexOf(port);
            if(idx >= 0) {
                this.selected.splice(idx, 1);
                port.selected = false;
            } else {
                this.selected.push(port);
                port.selected = true;
            }
        } else {
            if(this.selected.length > 0) {
                this.selected.forEach(p=> {if(p.canConnect(port)) p.connect(port); p.selected = false;});
                this.selected = [];
            } else {
                this.selected = [port];
                port.selected = true;
            }
        }
        */
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
    showConnection(connection) {
        this.connectionsManager.showConnection(connection);
    }
    hideConnection(connection) {
        this.connectionsManager.showConnection(connection);
    }
    /*
    startAnimation() {
        this.GM.start();
    }
    stopAnimation() {
        this.GM.stop();
    }
     */
}

export default DesignBoard;