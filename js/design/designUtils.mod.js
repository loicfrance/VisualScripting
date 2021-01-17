import {MouseButton} from "../../../jslib/utils/input.mod.js";
import {Vec2} from "../../../jslib/geometry2d/Vec2.mod.js";

/** @enum */
const DesignAction = {
    MOVE_SELECTED: "move-selected",
    DELETE_SELECTED: "delete-selected",
    CONNECTING: "connecting",
};

/**
 * @param {function(evt: Event)}onEditStart
 * @param {function(evt: Event)}onKeyDown
 * @param {function(evt: Event)}onInput
 * @param {function(evt: Event)}onFocusLost
 * @param evt
 */
function editorListener(
        {
            onEditStart = undefined,
            onKeyDown = undefined,
            onInput = undefined,
            onFocusLost = undefined,
        },
        evt) {

    evt.preventDefault();
    const defaultEditable = evt.target.isContentEditable;
    if(!defaultEditable)
        evt.target.contentEditable = "true";
    evt.target.focus();
    if(onEditStart)
        onEditStart(evt);
    if(onKeyDown)
        evt.target.addEventListener('keydown', onKeyDown);
    if(onInput != null)
        evt.target.addEventListener('input', onInput);

    const onBlur = (evt) => {
        if(!defaultEditable)
            evt.target.removeAttribute('contentEditable');

        evt.target.removeEventListener('blur', onBlur);
        if(onKeyDown)
            evt.target.removeEventListener('keydown', onKeyDown);
        if(onInput != null)
            evt.target.removeEventListener('input', onInput);
        if(onFocusLost)
            onFocusLost(evt);

    };
    evt.target.addEventListener('blur', onBlur);
}

const varNameRegex = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;

/**
 * @function
 * @param {string} text - the text to test
 * @return {boolean} <code>true</code> if the text is suitable as a variable name, <code>false</code> otherwise
 */
const validateVarName = RegExp.prototype.test.bind(varNameRegex);

/**
 * function to be used as mousedown listener to handle element drag, even when the mouse leaves the element.
 * all the parameters (except the last one) should bound before using the function as a listener
 * @param buttonMask
 * @param cursor
 * @param {function(evt:MouseEvent, pos:Vec2)} onStart
 * @param {function(evt:MouseEvent, pos:Vec2, delta: Vec2)} onMove
 * @param {function(evt:MouseEvent, pos:Vec2)} onStop
 * @param {function(evt:MouseEvent, pagePos:Vec2): Vec2} [positionTransform]
 * @param {MouseEvent} evt
 */
function dragListener(
        {
            buttonMask = MouseButton.LEFT,
            cursor = undefined,
            onStart = undefined,
            onMove = undefined,
            onStop = undefined,
            positionTransform = undefined
        },
        evt) {
    // noinspection JSBitwiseOperatorUsage
    const firstElmt = evt.target;
    const previousCursor = firstElmt.style.cursor;
    if((MouseButton.getEventSource(evt) & buttonMask) !== 0) {
        const lastPos = new Vec2(evt.pageX, evt.pageY);
        if(positionTransform)
            lastPos.set(positionTransform(evt, lastPos));

        const mouseMove = (evt) => {
            evt.preventDefault();
            const pos = new Vec2(evt.pageX, evt.pageY);
            if(positionTransform)
                pos.set(positionTransform(evt, pos));
            const delta = Vec2.translation(lastPos, pos);
            lastPos.set(pos);
            if(onMove)
                onMove(evt, pos, delta);
        };

        const mouseUp = (evt) => {
            if(cursor) {
                firstElmt.style.cursor = previousCursor;
            }
            window.removeEventListener('mousemove', mouseMove);
            window.removeEventListener('mouseup', mouseUp);
            if(onStop) {
                const pos = new Vec2(evt.pageX, evt.pageY);
                if(positionTransform)
                    pos.set(positionTransform(evt, pos));
                onStop(evt, pos);
            }
        };

        if(!onStart || !(onStart(evt, lastPos) === false)) {
            if(cursor) {
                firstElmt.style.cursor = cursor;
            }
            window.addEventListener('mousemove', mouseMove);
            window.addEventListener('mouseup', mouseUp);
        }
    }
}


export {
    DesignAction,
    editorListener,
    validateVarName,
    dragListener,

}