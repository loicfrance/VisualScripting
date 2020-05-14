import {StandardViewer} from "../../../jsLibs_Modules/game/viewers.mjs";
import {InputManager, MouseButton, MouseEvents} from "../../../jsLibs_Modules/utils/input.mjs";
import {Vec2, Rect} from "../../../jsLibs_Modules/geometry2d/geometry2d.mjs";
import {dragListener} from "./designUtils.mod.js";


class DesignViewer extends StandardViewer {
    constructor(div, maxRect, minWidth, minHeight, parameters) {
        super(parameters);
        this.minWidth = minWidth;
        this.minHeight = minHeight;
        this.maxRect = maxRect.clone();

        this.moving_camera = false;
        this.lastPos = null;
        this.inputManager = new InputManager(div);
        const cameraMoveListener = dragListener.bind(this,
            {
                buttonMask: MouseButton.MIDDLE,
                cursor: 'move',
                onMove: (evt, pos, delta)=> {
                    this.translate(this.pixelToGameVectorTransform(delta).mul(-1));
                },
            });
        div.addEventListener('mousedown', cameraMoveListener);

        div.addEventListener('wheel', (evt) => {
            let factor = 1.1;
            /*
            let factor = Math.min(1.9, Math.max(0.1, 1 + 0.001 * Math.abs(evt.deltaY)));
             */
            if (evt.deltaY > 0) factor = 1/factor;
            this.zoom(factor, factor, this.pageToGameCoordinatesTransform(new Vec2(evt.pageX, evt.pageY)));

        });
        this.background = {
            lineColor: '#373737',
            minGap: 40,
            divisions: 4,
        };
        this.checkViewRect();
    }

    drawBackground() {
        const rect = this.visibleRect, ctx = this.context;
        ctx.strokeStyle =  this.background.lineColor;
        ctx.clearRect(rect.xMin, rect.yMin, rect.width, rect.height);
        //rect.draw(ctx, true);
        return;
        ctx.canvas.style.backgroundSize = "${"
        const scale = this.gameToPixelVectorTransform(new Vec2(1,0)).x;
        let minGap = this.background.minGap / scale;
        let gap =  this.background.minGap;
        while(gap < minGap)
            gap *=  this.background.divisions;
        while(gap > minGap *  this.background.divisions)
            gap /=  this.background.divisions;
        ctx.lineWidth /= scale;
        ctx.beginPath();
        let x = rect.xMin % gap;
        x = rect.xMin - (x < 0 ? gap + x : x) + gap;
        while(x < rect.xMax) {
            ctx.moveTo(x, rect.yMin);
            ctx.lineTo(x, rect.yMax);
            x += gap;
        }
        let y = rect.yMin % gap;
        y = rect.yMin - (y < 0 ? gap + y : y) + gap;
        while(y < rect.yMax) {
            ctx.moveTo(rect.xMin, y);
            ctx.lineTo(rect.xMax, y);
            y += gap;
        }
        ctx.stroke();

        ctx.lineWidth *= scale;
    }
    // noinspection JSSuspiciousNameCombination
    zoom(factorX, factorY = factorX, origin = this.inGameViewCenter) {
        if(factorX > 1) {
            if(this.inGameSpanX / factorX < this.minWidth || this.inGameSpanY / factorY < this.minHeight) {
                const minFactor = Math.min(this.minWidth / this.inGameSpanX, this.minHeight / this.inGameSpanY);
                if (minFactor > 1) {
                    super.zoom(minFactor, minFactor, origin);
                }
            } else {
                super.zoom(factorX, factorY, origin);
            }
        } else {
            super.zoom(factorX, factorY, origin);
            this.checkViewRect();
        }
    }
    translate(delta) {
        super.translate(delta);
        this.checkViewRect();
    }

    checkViewRect() {
        if(this.visibleRect.width > this.maxRect.width && this.visibleRect.height > this.maxRect.height) {
            let maxRatio = Math.max(
                this.maxRect.width  / this.visibleRect.width,
                this.maxRect.height / this.visibleRect.height);
            if(maxRatio > 1)
                maxRatio = 1;
            super.setTransform(0, this.mirrorH, this.mirrorV,
                this.visibleRect.width * maxRatio,
                this.visibleRect.height * maxRatio,
                this.maxRect.center);
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
                super.translate(delta);
            }
        }
    }
}

export default DesignViewer;