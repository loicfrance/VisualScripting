import {dragListener} from "./designUtils.mod.js";
import {MouseButton} from "../../../jsLibs_Modules/utils/input.mjs";
import {Vec2, Rect} from "../../../jsLibs_Modules/geometry2d/geometry2d.mjs";


const uiElementsSym = Symbol();

class DesignCameraManager {
    /**
     * @constructor
     * @param {HTMLDivElement} div
     * @param {number} minWidth
     * @param {number} minHeight
     * @param {Rect} maxRect
     * @param {function(zoom:number, visibleRect: Rect)} onSizeChange
     */
    constructor(div,
                {
                    minWidth = 10,
                    minHeight = 10,
                    maxRect = null,
                    onSizeChange
                }) {

        this.div = div;
        this.visibleRect = Rect.createFromCenterWidthHeight(Vec2.ZERO,
                parseFloat(div.clientWidth), parseFloat(div.clientHeight));
        this.minWidth = minWidth;
        this.minHeight = minHeight;
        this.maxRect = maxRect ? maxRect.clone() : this.visibleRect.clone();
        this.zoomFactor = 1;
        this.onSizeChange = onSizeChange;

        /**
         * @type {(DesignProcess|DesignConnection)[]}
         */
        this[uiElementsSym] = [];

        const cameraMoveListener = dragListener.bind(this,
            {
                buttonMask: MouseButton.MIDDLE,
                cursor: 'move',
                onMove: (evt, pos, delta)=> {
                    this.translate(this.pixelToDesignVectorTransform(delta.x, delta.y, delta).mul(-1));
                },
            });
        div.addEventListener('mousedown', cameraMoveListener);

        div.addEventListener('wheel', (evt) => {
            evt.preventDefault();
            let factor = 1.1;
            /*
            let factor = Math.min(1.9, Math.max(0.1, 1 + 0.001 * Math.abs(evt.deltaY)));
             */
            if (evt.deltaY > 0) factor = 1/factor;
            this.zoom(factor, this.pageToDesignCoordinatesTransform(evt.pageX, evt.pageY));

        });
        const resizeListener = (evt)=>{
            const {clientWidth: width, clientHeight: height} = this.div;
            this.visibleRect.setDimensions(width / this.zoomFactor, height / this.zoomFactor);
            this.updateTransform();
        };
        new ResizeObserver(resizeListener).observe(div);
        //window.removeEventListener('resize', resizeListener, false);
        //window.removeEventListener('fullscreenchange', resizeListener, false);
        this.background = {
            minGap: 20,
            divisions: 5
        };
        this.updateTransform();
    }
    pageToDesignCoordinatesTransform(pageX, pageY, out = Vec2.zero) {
        const divRect = this.div.getBoundingClientRect();
        return this.clientToDesignCoordinatesTransform(pageX - divRect.left, pageY - divRect.top);
    }
    clientToDesignCoordinatesTransform(clientX, clientY, out = Vec2.zero) {
        return out.setXY(clientX/this.zoomFactor + this.visibleRect.xMin, clientY/this.zoomFactor + this.visibleRect.yMin);
    }
    pixelToDesignVectorTransform(pixelX, pixelY, out = Vec2.zero) {
        return out.setXY(pixelX/this.zoomFactor, pixelY/this.zoomFactor);
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
        this.div.style.backgroundSize = `1px ${bigGap}px, ${bigGap}px 1px, 1px ${smallGap}px, ${smallGap}px 1px`;

        const offsetX = -this.visibleRect.xMin*this.zoomFactor % bigGap,
            offsetY = -this.visibleRect.yMin*this.zoomFactor % bigGap;
        const pos = `${offsetX}px ${offsetY}px`;
        this.div.style.backgroundPosition = [pos, pos, pos, pos].join(',');
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
        this.zoomFactor = this.div.clientWidth / this.visibleRect.width;
        this.updateBackground();
        this.onSizeChange(this.zoomFactor, this.visibleRect);
    }
}

export default DesignCameraManager;