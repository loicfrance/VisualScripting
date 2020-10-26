
import {Vec2} from "../../jsLibs_Modules/geometry2d/Vec2.mod.js";
import DesignBoard from "./design/DesignBoard.mod.js";
import {PortValueVisibility} from "./design/DesignPort.mod.js";
import {
    OperationProcess,
    Operator,
    UserConstantProcess,
    UserPacketLauncherProcess,
    ScriptProcess
} from "./design/premadeProcesses.mod.js";
import {FbpPortDirection, FbpProcess} from "./FBP/fbp.mod.js";
import {FbpSheet} from "./FBP/FbpSheet.mod.js";
import SidePanel from "./SidePanel.mod.js";
import {typesTable} from "./design/DesignType.mod.js";


function main() {

    const fbpSheet = new FbpSheet();
    const board = new DesignBoard(document.getElementsByClassName("board")[0]);
    board.fbpSheet = fbpSheet;
    //const testProcess_1 = new FbpProcess(fbpSheet, {name:"test_1"});
    //const testProcess_2 = new FbpProcess(fbpSheet, {name:"test_2"});


    //testProcess_1.createPort({passive: false, direction: FbpPortDirection.IN, type: typesTable["any"], name: "activate"});
    //testProcess_1.createPort({passive: false, direction: FbpPortDirection.OUT, type: typesTable["any"], name: "done"});
    //testProcess_2.createPort({passive: false, direction: FbpPortDirection.IN, type: typesTable["any"], name: "activate"});
    //testProcess_2.createPort({passive: false, direction: FbpPortDirection.OUT, type: typesTable["any"], name: "done"});
    //testProcess_1.getPort("done").connect(testProcess_2.getPort("activate"));



    const constantA = new UserConstantProcess(fbpSheet, {name:"A", type:"int", hideName: false, position: new Vec2(-250,-50), baseValue: 0});
    const constantB = new UserConstantProcess(fbpSheet, {name:"B", type:"int", hideName: false, position: new Vec2(-250,+50), baseValue: 0});

    const product = new OperationProcess(fbpSheet, {operator: Operator.PRODUCT, position: new Vec2(0, -60)});
    const sum = new OperationProcess(fbpSheet, {operator: Operator.SUM, position: new Vec2(0, +60)});

    const launch = new UserPacketLauncherProcess(fbpSheet, {name: "Launch", position: new Vec2(-100, -100)});

    const logger = new ScriptProcess(fbpSheet, {script: "console.log(process.getPort('arg0').value)", position: new Vec2(350,-30)});
    logger.createPort({name: 'execute', passive: false, direction: FbpPortDirection.IN, output: false, type: typesTable['void']});
    logger.createPort({name: 'arg0', passive: true, direction: FbpPortDirection.IN, valueVisibility: PortValueVisibility.VISIBLE, output: false, type: typesTable['any']});
/*
    const process3 = new OperationDesignProcess(board, Operator.PRODUCT, new Vec2(0,-30));
    board.addProcess(process3);

    const process4 =
    board.addProcess(process4);
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

    window.board = board;
    const infoPanel = new SidePanel(document.getElementById("info-panel"));
    const optionsPanel = new SidePanel(document.getElementById("options-panel"));

}
window.onload = main;