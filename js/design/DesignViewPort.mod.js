import {dragListener} from "./designUtils.mod.js";
import {MouseButton} from "../../../jsLibs_Modules/utils/input.mod.js";
import {Vec2, Rect} from "../../../jsLibs_Modules/geometry2d/geometry2d.mod.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const templateSVG = document.querySelector("#connections-template").content.firstElementChild;

const globalDivSym = Symbol();
const processesDivSym = Symbol();
const frontSvgSym = Symbol();
const backSvgSym = Symbol();

const uiElementsSym = Symbol();

const initCameraSym = Symbol();
const initDivSym = Symbol();
const updateElementsSym = Symbol();

class DesignViewPort {
    /**
     * @constructor
     * @param {HTMLDivElement} div
     * @param {number} minWidth
     * @param {number} minHeight
     * @param {Rect} maxRect
     * @param {function(zoom:number, visibleRect: Rect)} cameraListener
     */
    constructor(div,
                {
                    minWidth = 10,
                    minHeight = 10,
                    maxRect = null,
                    cameraListener
                }) {
        this[globalDivSym] = div;
        this.visibleRect = Rect.createFromCenterWidthHeight(Vec2.ZERO, div.clientWidth, div.clientHeight);
        this.minWidth = minWidth;
        this.minHeight = minHeight;
        this.maxRect = maxRect ? maxRect.clone() : this.visibleRect.clone();
        this.zoomFactor = 1;
        this.selectionRect = document.createElementNS(SVG_NS, 'rect');
        this.selectionRect.style.fill = "transparent";
        this.selectionRect.style.stroke = "white";
        this.selectionRect.style.strokeWidth = "2";
        this.setCameraListener(cameraListener);

        this[initCameraSym]();

        this[initDivSym]();

        this.background = {
            minGap: 20,
            divisions: 5
        };
        this.updateTransform();
    }

    /** @type {HTMLDivElement} */
    get globalDiv() {
        return this[globalDivSym];
    }
    /** @type {HTMLDivElement} */
    get processesDiv() {
        return this[processesDivSym];
    }

    pageToDesignCoordinatesTransform(pageX, pageY, out = Vec2.zero) {
        const divRect = this.globalDiv.getBoundingClientRect();
        return this.clientToDesignCoordinatesTransform(pageX - divRect.left, pageY - divRect.top, out);
    }
    clientToDesignCoordinatesTransform(clientX, clientY, out = Vec2.zero) {
        return out.setXY(clientX/this.zoomFactor + this.visibleRect.xMin, clientY/this.zoomFactor + this.visibleRect.yMin);
    }
    pixelToDesignVectorTransform(pixelX, pixelY, out = Vec2.zero) {
        return out.setXY(pixelX/this.zoomFactor, pixelY/this.zoomFactor);
    }
    /*
    pixelToDesignCoordinatesTransform(pixel, out = Vec2.zero) {
        //TODO not very efficient
        const pixelCenterRect = this.processDiv.getBoundingClientRect();
        const pixelCenter = new Vec2(pixelCenterRect.x, pixelCenterRect.y);
        out.set(pixel).remove(pixelCenter).mul(1/this.zoom);
        return out;
    }
    */

//######################################################################################################################
//#                                                  CAMERA MOVEMENTS                                                  #
//######################################################################################################################

    [initCameraSym]() {
        const cameraMoveListener = dragListener.bind(this,
            {
                buttonMask: MouseButton.MIDDLE,
                cursor: 'move',
                onMove: (evt, pos, delta)=> {
                    this.translate(this.pixelToDesignVectorTransform(delta.x, delta.y, delta).mul(-1));
                },
            });
        this.globalDiv.addEventListener('mousedown', cameraMoveListener);

        this.globalDiv.addEventListener('wheel', (evt) => {
            evt.preventDefault();
            let factor = 1.1;
            /*
            let factor = Math.min(1.9, Math.max(0.1, 1 + 0.001 * Math.abs(evt.deltaY)));
             */
            if (evt.deltaY > 0) factor = 1/factor;
            this.zoom(factor, this.pageToDesignCoordinatesTransform(evt.pageX, evt.pageY));

        });
        const resizeListener = (evt)=>{
            const {clientWidth: width, clientHeight: height} = this.globalDiv;
            this.visibleRect.setDimensions(width / this.zoomFactor, height / this.zoomFactor);
            this.updateTransform();
        };
        new ResizeObserver(resizeListener).observe(this.globalDiv);
        //window.removeEventListener('resize', resizeListener, false);
        //window.removeEventListener('fullscreenchange', resizeListener, false);
    }

    /**
     * @param {function(zoomFactor: number, visibleRect: Rect):void | undefined} listener
     */
    setCameraListener(listener) {
        this.onViewPortChanged = listener;
    }
    translate(delta) {
        this.visibleRect.move(delta);
        this.updateTransform();
    }
    zoom(factor, origin = this.visibleRect.center) {
        const {height: h, width: w} = this.visibleRect;
        if(factor > 1 && (w / factor <= this.minWidth || h / factor <= this.minHeight))
            factor = Math.min(w / this.minWidth, h / this.minHeight);

        if(factor !== 1) {
            this.visibleRect.relativeScale(origin, 1/factor);
            this.updateTransform();
        }
    }
    updateBackground() {
        const {minGap, divisions} = this.background;
        let smallGap = this.zoomFactor*minGap;
        while(smallGap < minGap) smallGap *= divisions;
        while(smallGap > minGap * divisions) smallGap /= divisions;
        const bigGap = smallGap * divisions;
        this.globalDiv.style.backgroundSize = `1px ${bigGap}px, ${bigGap}px 1px, 1px ${smallGap}px, ${smallGap}px 1px`;

        const offsetX = -this.visibleRect.xMin*this.zoomFactor % bigGap,
            offsetY = -this.visibleRect.yMin*this.zoomFactor % bigGap;
        const pos = `${offsetX}px ${offsetY}px`;
        this.globalDiv.style.backgroundPosition = [pos, pos, pos, pos].join(',');
    }
    updateTransform() {
        if(this.visibleRect.width < this.minWidth || this.visibleRect.height < this.minWidth) {
            let maxRatio = Math.max(
                this.minWidth / this.visibleRect.width,
                this.minHeight / this.visibleRect.height
            );
            this.visibleRect.scale(maxRatio);
        }
        else if(this.visibleRect.width > this.maxRect.width && this.visibleRect.height > this.maxRect.height) {
            let maxRatio = Math.max(
                this.maxRect.width  / this.visibleRect.width,
                this.maxRect.height / this.visibleRect.height);
            if(maxRatio > 1)
                maxRatio = 1;
            this.visibleRect.setCenterWidthHeight(this.maxRect.center,
                    this.visibleRect.width * maxRatio, this.visibleRect.height * maxRatio);
        } else {
            const delta = Vec2.zero;
            const dxMin = this.maxRect.xMin - this.visibleRect.xMin,
                dxMax = this.maxRect.xMax - this.visibleRect.xMax,
                dyMin = this.maxRect.yMin - this.visibleRect.yMin,
                dyMax = this.maxRect.yMax - this.visibleRect.yMax,
                dCenter = Vec2.translation(this.visibleRect.center, this.maxRect.center);

            switch(Math.sign(dCenter.x)) {
                case -1 : if(dxMax < 0) delta.x = Math.max(dxMax, dCenter.x); break;
                case 1 : if(dxMin > 0) delta.x = Math.min(dxMin, dCenter.x); break;
                case 0 : break;
            }
            switch(Math.sign(dCenter.y)) {
                case -1 : if(dyMax < 0) delta.y = Math.max(dyMax, dCenter.y); break;
                case 1 : if(dyMin > 0) delta.y = Math.min(dyMin, dCenter.y); break;
                case 0 : break;
            }
            if(!delta.isZero()) {
                this.visibleRect.move(delta);
            }
        }
        this.zoomFactor = this.globalDiv.clientWidth / this.visibleRect.width;
        this.updateBackground();

        const viewBox = `${this.visibleRect.xMin} ${this.visibleRect.yMin} ${this.visibleRect.width} ${this.visibleRect.height}`;
        this[backSvgSym].setAttribute("viewBox", viewBox);
        this[frontSvgSym].setAttribute("viewBox", viewBox);
        const center = this.visibleRect.center;
        this[processesDivSym].style.left = `calc(50% - ${center.x}px)`;
        this[processesDivSym].style.top  = `calc(50% - ${center.y}px)`;
        this[processesDivSym].style.transformOrigin = `${center.x}px ${center.y}px`;
        this[processesDivSym].style.transform = `scale(${this.zoomFactor})`;

        this.onViewPortChanged(this.zoomFactor, this.visibleRect);
    }

//######################################################################################################################
//#                                                ELEMENTS MANAGEMENT                                                 #
//######################################################################################################################

    [initDivSym]() {
        this[processesDivSym] = this.globalDiv.querySelector('.processes');
        this[backSvgSym] = templateSVG.cloneNode(true);
        this[frontSvgSym] = templateSVG.cloneNode(true);
        this[frontSvgSym].classList.add('selected');
        this.globalDiv.appendChild(this[backSvgSym]);
        this.globalDiv.appendChild(this[frontSvgSym]);
    }
    [updateElementsSym]() {
        const {x, y} = this.visibleRect.center;
        this[processesDivSym].style.transform = `scale(${this.zoomFactor})`;
        this[processesDivSym].style.left = `calc(50% - ${x}px)`; // TODO maybe 50% is useless
        this[processesDivSym].style.top  = `calc(50% - ${y}px)`;
        this[processesDivSym].style.transformOrigin = `${x}px ${y}px`;
    }

    /**
     * @param {DesignProcess} process
     */
    addProcess(process) {
        this.processesDiv.appendChild(process.elmt)
    }

    /**
     * @param {DesignProcess} process
     */
    removeProcess(process) {
        this.processesDiv.removeChild(process.elmt);
    }

    addConnection(connection, frontLayer = false) {
        this[frontLayer ? frontSvgSym : backSvgSym].appendChild(connection.path);
    }

    removeConnection(connection) {
        connection.path.parentElement.removeChild(connection.path);
    }
    showSelectionRect(rect) {
        this.selectionRect.setAttribute('x', rect.xMin);
        this.selectionRect.setAttribute('y', rect.yMin);
        this.selectionRect.setAttribute('width', rect.width);
        this.selectionRect.setAttribute('height', rect.height);
        this[frontSvgSym].appendChild(this.selectionRect);
    }
    hideSelectionRect() {
        if(this.selectionRect.parentElement)
            this.selectionRect.parentElement.removeChild(this.selectionRect);
    }
}

export default DesignViewPort;