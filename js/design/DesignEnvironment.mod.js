import Vec2 from "../../../jslib/geometry2d/Vec2.mod.js";
import {KeyMap} from "../../../jslib/utils/input.mod.js";
import {Settings as SettingsBase} from "../../../jslib/utils/Settings.mod.js";
import {loadString, requestFilesFromUser} from "../../../jslib/utils/tools.mod.js";
import SidePanel from "../SidePanel.mod.js";
import Editor from "./Editor.mod.js";
import FbpEnvironment from "../FBP/FbpEnvironment.mod.js";
import {FbpSheet} from "../FBP/FbpSheet.mod.js";
import DesignSheet from "./DesignSheet.mod.js";
import {createElement, createStyleSheet, htmlToElements} from "../../../jslib/utils/createHtml.mod.js";


const settingsSym = Symbol("Settings");
const clipboardSym = Symbol("clipboard");
const editorsSym = Symbol("editors");
const lastFocusedEditorSym = Symbol("last focused editor");
const keyMapSym = Symbol("Key map");

const environmentDivSym = Symbol("ide html div");
const themeCssSym = Symbol("theme stylesheet html link");
const leftPanelSym = Symbol("left resizeable panel");
const rightPanelSym = Symbol("right resizeable panel");
const topMenuUlSym = Symbol("main menu html div");
const leftMenuUlSym = Symbol("left menu html div");
const rightMenuUlSym = Symbol("right menu html div");
const bottomMenuUlSym = Symbol("bottom menu html div");
const contentDivSym = Symbol("content html div");

const keyMapCallback = Symbol("keymap callback");

const icons_dir = "assets/icons/";

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

    [environmentDivSym];
    [themeCssSym] = createStyleSheet("css/themes/dark.css");
    [leftPanelSym] = new SidePanel('left');
    [rightPanelSym] = new SidePanel( 'right');

    [topMenuUlSym] = createElement("ul",
        {class: "menu", position: "top"});
    [leftMenuUlSym] = createElement("ul",
        {class: "menu", position: "left"});
    [rightMenuUlSym] = createElement("ul",
        {class: "menu", position: "right"});
    [bottomMenuUlSym] = createElement("ul",
        {class: "menu", position: "bottom"});
    [contentDivSym] = createElement("div",
        {class: "content"});

    /**
     *
     * @param {HTMLDivElement} environmentDiv
     */
    constructor(environmentDiv) {
        super();
        this[environmentDivSym] = environmentDiv;
        environmentDiv.append(
            createStyleSheet("css/stylesheet.css"),
            this[themeCssSym],
            this.topMenuUl, this.leftMenuUl,
            this.rightMenuUl, this.bottomMenuUl,
            this.leftPanel.panelDiv,
            this.rightPanel.panelDiv,
            this.contentDiv);

        this.topMenuUl.append(
            createElement('li', {title: "Files"}, "Files"),
            createElement('li', {title: "Edit"}, "Edit"),
            createElement('li', {title: "View"}, "View"),
            createElement('li', {title: "Tools"}, "Tools")
        );
        this.addLeftTab('Project', "assets/icons/icon_process.svg");
        this.addLeftTab('Libraries', "assets/icons/icon_libraries.svg");
        this.addRightTab('Info', "assets/icons/icon_information.svg");
        this.addBottomTab('Problems');
        this.addBottomTab('Console');
    }

//##############################################################################
//#                                  SETTINGS                                  #
//##############################################################################

    [settingsSym] = new Settings();

    get settings() {
        return this[settingsSym];
    }

//##############################################################################
//#                                   MENUS                                    #
//##############################################################################

    get topMenuUl() { return this[topMenuUlSym]; }
    get leftMenuUl() { return this[leftMenuUlSym]; }
    get rightMenuUl() { return this[rightMenuUlSym]; }
    get bottomMenuUl() { return this[bottomMenuUlSym]; }

    get leftPanel() { return this[leftPanelSym]; }
    get rightPanel() { return this[rightPanelSym]; }

    get contentDiv() { return this[contentDivSym]; }

    addTab(position, name, icon) {
        let ul = undefined;
        switch(position) {
            case 'left' : ul = this.leftMenuUl; break;
            case 'right': ul = this.rightMenuUl; break;
            case 'bottom': ul = this.bottomMenuUl; break;
            default: throw Error(`illegal position ${position}`);
        }
        ul.appendChild(createElement('li', {title: name},
                icon ? createElement('img', {src: icon}) : name));
    }

    addLeftTab(name, icon) {
        this.addTab('left', name, icon);
    }
    addRightTab(name, icon) {
        this.addTab('right', name, icon);
    }
    addBottomTab(name, icon) {
        this.addTab('bottom', name, icon);
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
            const editor = new Editor();
            if(this.contentDiv.childElementCount === 0)
                this.contentDiv.appendChild(editor.htmlDiv);
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
            case "cancel":
                //TODO
                break;
            case "undo"  : break;
            case "redo"  : break;
            case "copy"  : break;
            case "paste" : break;
            case "cut"   : break;
            case "save"  : break;
            case "open"  :
                requestFilesFromUser({multiple:false, accept: "text/json"})
                    .then(async files=>{
                        if(files.length !== 1)
                            return;
                        const sheet = this.createSheet(files[0].name, true);
                        await sheet.importJSON(await files[0].text());
                        this.editSheet(sheet);
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