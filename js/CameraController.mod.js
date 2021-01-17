import Rect from "../../jslib/geometry2d/Rect.mod.js";
import {Vec2} from "../../jslib/geometry2d/Vec2.mod.js";
import {MouseButton} from "../../jslib/utils/input.mod.js";
import {dragListener} from "./design/designUtils.mod.js";

const editorSym = Symbol("Editor");
const enabledSym = Symbol("camera controller enabled");
const dragButtonSym = Symbol("mouse button used to move the camera");
const minWidthSym = Symbol("minimum width");
const minHeightSym = Symbol("minimum height");
const maxRectSym = Symbol("camera borders");
const zoomFactorSym = Symbol("zoom factor");

const dragListenerSym = Symbol("drag listener");
const wheelListenerSym = Symbol("mouse wheel listener");
const resizeObserverSym = Symbol("design sheet div resize observer");

const registerListener = Symbol("register listener");
const unregisterListener = Symbol("unregister listener");
const requestTransformUpdate = Symbol("request design sheet transform update");

function wheelListener(evt) {
    evt.preventDefault();
    if(this.designSheet) {
        let factor = evt.deltaY > 0 ? this.zoomOutFactor : this.zoomInFactor;
        this.zoom(factor, this.designSheet.pageToFBPCoordinates(evt.pageX, evt.pageY));
    }
}

function requestCheck(evt) {
    setTimeout(this.checkVisibleRect);
}

class CameraController {

    [editorSym];
    [enabledSym] = false;
    [dragButtonSym];
    [zoomFactorSym];
    [minWidthSym];
    [minHeightSym];
    [maxRectSym];
    [dragListenerSym];
    [wheelListenerSym];
    [resizeObserverSym] = new ResizeObserver(requestCheck.bind(this));

    // noinspection DuplicatedCode
    /**
     * @param {Object} config
     * @param {MouseButton} config.dragButton
     * @param {boolean} config.wheelZoom
     * @param {number} config.zoomFactor
     * @param {number} config.minWidth
     * @param {number} config.minHeight
     * @param {Rect} config.maxRect
     */
    constructor({
        dragButton = MouseButton.MIDDLE,
        wheelZoom = true,
        dragMove = true,
        zoomFactor = 0.1,
        minWidth = 10,
        minHeight = 10,
        maxRect = undefined,
    }) {
        this[maxRectSym] = maxRect ? maxRect.clone() : undefined;
        this.minWidth = minWidth;
        this.minHeight = minHeight;
        this.dragMove = dragMove;
        this.wheelZoom = wheelZoom;
        this.dragButton = dragButton;
        this.dragMove = dragMove;
        this.zoomFactor = zoomFactor;
    }

//##############################################################################
//#                                 ACCESSORS                                  #
//##############################################################################

//___________________________________ links ____________________________________
//------------------------------------------------------------------------------

    get editor() { return this[editorSym]; }
    set editor(editor) {
        if(editor !== this.editor) {
            if (this.enabled) {
                this.disable();
                this[editorSym] = editor;
                this.enable();
            } else
                this[editorSym] = editor;
        }
    }

    /** @type {DesignSheet} */
    get designSheet() { return this.editor?.designSheet; }

//___________________________________ enable ___________________________________
//------------------------------------------------------------------------------

    /** @type {boolean} */
    get enabled() { return this[enabledSym]; }
    set enabled(value) {
        if (value) this.enable();
        else this.disable();
    }

    /** @type {boolean} */
    get active() { return this.enabled && (this.designSheet !== undefined); }

//___________________________________ config ___________________________________
//------------------------------------------------------------------------------

    /** @type {number} */
    get zoomFactor() { return this[zoomFactorSym]; }
    set zoomFactor(value) { this[zoomFactorSym] = value; }
    get zoomInFactor() { return 1+this.zoomFactor; }
    get zoomOutFactor() { return 1/this.zoomInFactor; }

    get maxRect() { return this[maxRectSym]; }
    set maxRect(rect) {
        if (this.active && !rect.containsRect(this[maxRectSym])) {
            this[maxRectSym].setRect(rect);
            this[requestTransformUpdate]();
        } else {
            this[maxRectSym].setRect(rect);
        }
    }

    /** @type {number} */
    get minWidth() { return this[minWidthSym]; }
    set minWidth(value) {
        if(this.active && value > this[minWidthSym]) {
            this[minWidthSym] = value;
            this[requestTransformUpdate]();
        } else {
            this[minWidthSym] = value;
        }
    }

    /** @type {number} */
    get minHeight() { return this[minHeightSym]; }
    set minHeight(value) {
        if(this.active && value > this[minHeightSym]) {
            this[minHeightSym] = value;
            this[requestTransformUpdate]();
        } else {
            this[minHeightSym] = value;
        }
    }

    /** @type {boolean} */
    get wheelZoom() { return !!this[wheelListenerSym]; }
    set wheelZoom(value) {
        if (this.wheelZoom === !!value)
            return;
        if (value) {
            this[wheelListenerSym] = wheelListener.bind(this);
            if(this.enabled)
                this[registerListener]('wheel', this[wheelListenerSym]);
        } else {
            if(this.enabled)
                this[unregisterListener]('wheel', this[wheelListenerSym]);
            this[wheelListenerSym] = undefined;
        }
    }

    /** @type {boolean} */
    get dragMove() { return !!this[dragListenerSym]; }
    set dragMove(value) {
        if (this.dragMove === !!value)
            return;
        if (value) {
            this[dragListenerSym] = dragListener.bind(this, {
                buttonMask: this.dragButton, cursor: 'move',
                onMove: (evt, pos, delta)=> {
                    if(this.designSheet) {
                        this.designSheet.pixelToFBPVector(-delta.x, -delta.y, delta);
                        this.move(delta);
                    }
                },
            });
            if(this.enabled)
                this[registerListener]('mousedown', this[dragListenerSym]);
        } else {
            if(this.enabled)
                this[unregisterListener]('mousedown', this[dragListenerSym]);
            this[dragListenerSym] = undefined;
        }
    }

    /** @type {MouseButton} */
    get dragButton() { return this[dragButtonSym]; }
    set dragButton(value) {
        if (value !== this.dragButton) {
            this[dragButtonSym] = value;
            if (this.dragMove) {
                this.dragMove = false;
                this.dragMove = true;
            }
        }
    }

//##############################################################################
//#                               PUBLIC METHODS                               #
//##############################################################################

//___________________________________ enable ___________________________________
//------------------------------------------------------------------------------

    enable() {
        if (this.enabled)
            return;
        this[enabledSym] = true;
        this.refreshListeners();
    }

    disable() {
        if (!this.enabled)
            return;
        this[unregisterListener]('mousedown', this[dragListenerSym]);
        this[unregisterListener]('wheel', this[wheelListenerSym]);
        this[resizeObserverSym].disconnect();
        this[enabledSym] = false;
    }

    refreshListeners() {
        this[resizeObserverSym].disconnect();
        if(!this.enable)
            return;
        this[registerListener]('mousedown', this[dragListenerSym]);
        this[registerListener]('wheel', this[wheelListenerSym]);
        this[resizeObserverSym].observe(this.editor.htmlDiv);
        this.checkVisibleRect();
    }

//________________________________ modify view _________________________________
//------------------------------------------------------------------------------

    zoom(factor, origin = this.designSheet.visibleRect.center) {
        if(!this.active)
            return;
        const sheet = this.designSheet;
        const {height: h, width: w} = sheet.visibleRect;
        const [minW, minH] = [this.minWidth, this.minHeight];
        if (factor > 1 && (w / factor <= minW || h / factor <= minH))
            factor = Math.min(w / minW, h / minH);
        if (factor !== 1) {
            sheet.zoom(factor, origin);
            this.checkVisibleRect();
        }
    }

    move(delta) {
        if(!this.active)
            return;
        this.designSheet.moveVisibleRect(delta);
        this.checkVisibleRect();
    }

//_________________________________ check view _________________________________
//------------------------------------------------------------------------------

    checkVisibleRect = ()=> {
        if (!(this.active))
            return;

        const rect = this.designSheet.visibleRect;
        const minWidth = this.minWidth;
        const minHeight = this.minHeight;
        const maxRect = this.maxRect || this.designSheet.getFBPBoundingRect()?.scale(2);
        if (rect.width < minWidth || rect.height < minWidth) {
            let maxRatio = Math.max(
                minWidth / rect.width,
                minHeight / rect.height
            );
            rect.scale(maxRatio);
        } else if (maxRect && rect.width > maxRect.width && rect.height > maxRect.height) {
            let maxRatio = Math.max(
                maxRect.width / rect.width,
                maxRect.height / rect.height);
            if (maxRatio > 1)
                maxRatio = 1;
            rect.setCenterWidthHeight(maxRect.center,
                rect.width * maxRatio, rect.height * maxRatio);
        } else if (maxRect) {
            const delta = Vec2.zero;
            const dxMin = maxRect.xMin - rect.xMin,
                dxMax = maxRect.xMax - rect.xMax,
                dyMin = maxRect.yMin - rect.yMin,
                dyMax = maxRect.yMax - rect.yMax,
                dCenter = Vec2.translation(rect.center, maxRect.center);

            switch (Math.sign(dCenter.x)) {
                case -1 : if (dxMax < 0) delta.x = Math.max(dxMax, dCenter.x); break;
                case 1 : if (dxMin > 0) delta.x = Math.min(dxMin, dCenter.x); break;
                case 0 : break;
            }
            switch (Math.sign(dCenter.y)) {
                case -1 : if (dyMax < 0) delta.y = Math.max(dyMax, dCenter.y); break;
                case 1 : if (dyMin > 0) delta.y = Math.min(dyMin, dCenter.y); break;
                case 0 : break;
            }
            if (!delta.isZero()) {
                rect.move(delta);
            }
        }
        this.designSheet.zoomFactor = this.designSheet.htmlDiv.clientWidth / rect.width;
    }

//##############################################################################
//#                              PRIVATE METHODS                               #
//##############################################################################

    [registerListener](event, listener) {
        if (this.editor.htmlDiv && listener) {
            this.editor.htmlDiv.addEventListener(event, listener);
        }
    }

    [unregisterListener](event, listener) {
        if (this.editor.htmlDiv && listener) {
            this.editor.htmlDiv.removeEventListener(event, listener);
        }
    }

    [requestTransformUpdate]() {
        this.designSheet?.requestTransformUpdate();
    }
}

export default CameraController;
export {
    CameraController
};