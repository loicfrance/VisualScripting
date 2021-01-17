import Vec2 from "../../../jslib/geometry2d/Vec2.mod.js";
import {KeyMap} from "../../../jslib/utils/input.mod.js";
import {Settings as SettingsBase} from "../../../jslib/utils/Settings.mod.js";
import {loadString, requestFilesFromUser} from "../../../jslib/utils/tools.mod.js";
import Editor from "../Editor.mod.js";
import FbpEnvironment from "../FBP/FbpEnvironment.mod.js";
import {FbpSheet} from "../FBP/FbpSheet.mod.js";
import DesignSheet from "./DesignSheet.mod.js";


const settingsSym = Symbol("Settings");
const clipboardSym = Symbol("clipboard");
const editorsSym = Symbol("editors");
const lastFocusedEditorSym = Symbol("last focused editor");
const keyMapSym = Symbol("Key map");

const keyMapCallback = Symbol("keymap callback");

class Settings extends SettingsBase {
    static LANGUAGE = "lang";
    static THEME = "theme";
    constructor() {
        super();
        this.setDefaultValues([
            [Settings.LANGUAGE, "en"],
            [Settings.THEME, "dark"],
        ]);
    }
}
class DesignEnvironment extends FbpEnvironment {

    [clipboardSym];
    [editorsSym] = [];
    [lastFocusedEditorSym];
    [keyMapSym];

    constructor(environmentDiv) {
        super();
    }

//##############################################################################
//#                                  SETTINGS                                  #
//##############################################################################

    [settingsSym] = new Settings();

    get settings() {
        return this[settingsSym];
    }

//##############################################################################
//#                                  EDITORS                                   #
//##############################################################################

    /** @type Editor */
    get focusedEditor() {
        return this[lastFocusedEditorSym];
    }

    createSheet(name, open=true) {
        const fbpSheet = super.createSheet(name);
        if(open)
            this.editSheet(fbpSheet);
        return fbpSheet;
    }

    /**
     * Display the specified FBP sheet in the active editor.
     * @param {FbpSheet|string} fbpSheet
     */
    editSheet(fbpSheet) {
        if (fbpSheet.substr) {
            if(!this.hasSheet(fbpSheet))
                throw Error(`unknown fbp sheet ${fbpSheet}`);
            fbpSheet = this.getSheet(fbpSheet);
        }
        else if (!(fbpSheet instanceof FbpSheet))
            throw Error(`${fbpSheet} is not an FBP sheet or an FBP sheet name`);
        for (let editor of this[editorsSym]) {
            if (editor.fbpSheet === fbpSheet) {
                editor.focus();
                return;
            }
        }
        if(!this.focusedEditor) {
            const editor = new Editor(document.getElementsByClassName("board")[0]);
            this[editorsSym].push(editor);
            this[lastFocusedEditorSym] = editor;
        }
        this.focusedEditor.designSheet = new DesignSheet(fbpSheet);
    }

//##############################################################################
//#                             KEYBOARD SHORTCUTS                             #
//##############################################################################

    enableKeyboardShortcuts() {
        if(!this[keyMapSym])
            this[keyMapSym] = new KeyMap({callback: this[keyMapCallback]});
        this[keyMapSym].enable(document.body, 'keydown');
    }

    disableKeyboardShortcuts() {
        this[keyMapSym].disable(document.body, 'keydown');
    }

    setKeyboardShortcuts(mapping) {
        this[keyMapSym].setMapping(mapping);
    }

    [keyMapCallback] = (action, evt)=> {
        if(evt.isComposing || evt.target.isContentEditable || evt.defaultPrevented) return;
        switch(action) {
            case "cancel"       :
                //TODO
                break;
            case "undo"         : break;
            case "redo"         : break;
            case "copy"         : break;
            case "paste"        : break;
            case "cut"          : break;
            case "save"         :
                break;
            case "open"         :
                // noinspection JSIgnoredPromiseFromCall
                requestFilesFromUser({multiple:false, accept: "text/json"})
                    .then(async files=>{
                        if(files.length !== 1)
                            return;
                        const sheet = this.createSheet(files[0].name, true);
                        return sheet.importJSON(await files[0].text());
                    });
                evt.preventDefault();
                evt.stopPropagation();
                break;
            default : break;
        }
    }
}

export default DesignEnvironment;
export {DesignEnvironment, Settings}