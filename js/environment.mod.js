
import DesignBoard from "./design/DesignBoard.mod.js";
import {UserConstantDesignProcess, UserPacketLauncherDesignProcess, Operator, OperationDesignProcess, ScriptDesignProcess} from "./design/premadeProcesses.mod.js";
import {Vec2} from "../../jsLibs_Modules/geometry2d/geometry2d.mod.js";
import {FbpPortDirection, FbpPacketPort} from "./FBP/fbp.mod.js";
import SidePanel from "./SidePanel.mod.js";
import {DesignPort, PortValueVisibility} from "./design/DesignPort.mod.js";
import {typesTable} from "./design/DesignType.mod.js";


function main() {

    const board = new DesignBoard(document.getElementsByClassName("board")[0]);

    const process1 = new UserConstantDesignProcess(board, {name:"A",type:"int", visibleName: true, position: new Vec2(-250,-50), baseValue: 0});
    board.addProcess(process1);
    const process2 = new UserConstantDesignProcess(board, {name:"B",type:"int", visibleName: true, position: new Vec2(-250,+50), baseValue: 0});
    board.addProcess(process2);

    const process3 = new OperationDesignProcess(board, Operator.PRODUCT, new Vec2(0,-30));
    board.addProcess(process3);

    const process4 = new ScriptDesignProcess(board, "console.log('Hello World!')", new Vec2(350,-30));
    process4.createPort({name: 'execute', passive: false, valueVisibility: PortValueVisibility.HIDDEN, output: false, type: 'void'});
    process4.createPort({name: 'arg0', passive: true, valueVisibility: PortValueVisibility.VISIBLE, output: false, type: 'any'});
    board.addProcess(process4);

    const process5 = new UserPacketLauncherDesignProcess(board, {name: "Launch", position: new Vec2(-100, -100)});
    board.addProcess(process5);
    /*
    const mux = new RouterDesignProcess(board,  2, 2, 'int', 'int', new Vec2(-500, 250));
    */
    //board.addProcess(mux);
    /*
    process1.outputPort(0).connect(process3.inputPort(1));
    process2.outputPort(0).connect(process3.inputPort(2));
    process3.outputPort(0).connect(process4.inputPort(0));
    process5.outputPort(0).connect(process3.inputPort(0));
    process3.outputPort(1).connect(process4.inputPort(1));
    */

    window.process1 = process1;
    window.board = board;
    const infoPanel = new SidePanel(document.getElementById("info-panel"));
    const optionsPanel = new SidePanel(document.getElementById("options-panel"));

}
window.onload = main;