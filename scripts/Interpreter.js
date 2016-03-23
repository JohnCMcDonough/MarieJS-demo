var Opcode;
(function (Opcode) {
    Opcode[Opcode["JNS"] = 0] = "JNS";
    Opcode[Opcode["LOAD"] = 1] = "LOAD";
    Opcode[Opcode["STORE"] = 2] = "STORE";
    Opcode[Opcode["ADD"] = 3] = "ADD";
    Opcode[Opcode["SUBT"] = 4] = "SUBT";
    Opcode[Opcode["INPUT"] = 5] = "INPUT";
    Opcode[Opcode["OUTPUT"] = 6] = "OUTPUT";
    Opcode[Opcode["HALT"] = 7] = "HALT";
    Opcode[Opcode["SKIPCOND"] = 8] = "SKIPCOND";
    Opcode[Opcode["JUMP"] = 9] = "JUMP";
    Opcode[Opcode["CLEAR"] = 10] = "CLEAR";
    Opcode[Opcode["ADDI"] = 11] = "ADDI";
    Opcode[Opcode["JUMPI"] = 12] = "JUMPI";
    Opcode[Opcode["LOADI"] = 13] = "LOADI";
    Opcode[Opcode["STOREI"] = 14] = "STOREI";
    Opcode[Opcode["ORG"] = 20] = "ORG";
    Opcode[Opcode["HEX"] = 21] = "HEX";
    Opcode[Opcode["DEC"] = 22] = "DEC";
})(Opcode || (Opcode = {}));
var CompilerError = (function () {
    function CompilerError(lineNumber, errorstring, object) {
        this.lineNumber = lineNumber;
        this.errorstring = errorstring;
        this.object = object;
    }
    return CompilerError;
}());
var MarieInterpreter = (function () {
    // Convert to objects...
    // Build Symbol Table
    // Get Raw instructions before compile, and save them off
    // Create compiled instructions objects
    // Convert compiled instructions to memory.
    function MarieInterpreter(instructions) {
        this.Accumulator = 0x0000;
        this.InstructionRegister = 0x0000;
        this.MemoryAddressRegister = 0x0000;
        this.MemoryBufferRegister = 0x0000;
        this.ProgramCounter = 0x0000;
        this.Input = 0x0000;
        this.isRunning = false;
        this.isWaitingOnInput = false;
        this.isFinishedExecuting = true;
        this.memory = new Int16Array(2048);
        this.org = 0;
        this.outputBuffer = new Array();
        this.inputBuffer = new Array();
        this.delayInMS = 0;
        this.IRToLine = [];
        if (instructions) {
            this.performFullCompile(instructions);
        }
    }
    MarieInterpreter.prototype.lint = function (instructions) {
        var ins = this.tokenize(instructions);
        var symbols = this.buildSymbolTable(ins);
        var assembled = this.assemble(ins, symbols);
    };
    MarieInterpreter.prototype.reset = function () {
        this.isFinishedExecuting = false;
        this.isRunning = false;
        this.isWaitingOnInput = false;
        this.IRToLine = [];
        this.memory = undefined;
        this.Accumulator = 0;
        this.ProgramCounter = 0;
        this.Input = 0;
        this.MemoryBufferRegister = 0;
        this.MemoryAddressRegister = 0;
        this.InstructionRegister = 0;
        this.outputBuffer = [];
        this.inputBuffer = [];
    };
    MarieInterpreter.prototype.performFullCompile = function (instructions) {
        this.reset();
        var objects = this.tokenize(instructions);
        // console.log(objects);
        this.symbolTable = this.buildSymbolTable(objects);
        this.rawInstructions = objects;
        this.instructions = this.assemble(objects, this.symbolTable);
        this.memory = this.fillMemory(this.instructions);
        if (this.onFinishedCompile)
            this.onFinishedCompile();
    };
    MarieInterpreter.prototype.buildSymbolTable = function (instructions) {
        var map = {};
        for (var i = 0; i < instructions.length; i++) {
            if (instructions[i].label)
                map[instructions[i].label] = i + this.org;
        }
        return map;
    };
    MarieInterpreter.prototype.assemble = function (instructions, symbolTable) {
        instructions = JSON.parse(JSON.stringify(instructions));
        var errors = [];
        for (var i = 0; i < instructions.length; i++) {
            var opcode = Opcode[("" + instructions[i].opcode).toUpperCase()]; //this.opcodeStringToOpcode(<any>instructions[i].opcode);
            if (opcode === undefined) {
                errors.push(new CompilerError(instructions[i].linenumber, "Invalid Instruction " + instructions[i].opcode, "" + instructions[i].opcode));
                continue;
            }
            else
                instructions[i].opcode = opcode;
            if (instructions[i].label && /^[0-9]/g.test(instructions[i].label))
                errors.push(new CompilerError(instructions[i].linenumber, "Label can not begin with a number", instructions[i].label));
            if (opcode != Opcode.CLEAR && opcode != Opcode.OUTPUT && opcode != Opcode.INPUT && opcode != Opcode.HALT && opcode != Opcode.DEC && opcode != Opcode.HEX) {
                if (instructions[i].param === undefined) {
                    errors.push(new CompilerError(instructions[i].linenumber, "Missing parameter for opcode: " + Opcode[opcode], ("" + instructions[i].opcode)));
                    continue;
                }
                if (opcode != Opcode.SKIPCOND && symbolTable[("" + instructions[i].param).trim()] === undefined) {
                    errors.push(new CompilerError(instructions[i].linenumber, "Can't find symbol: " + instructions[i].param, ("" + instructions[i].param)));
                    continue;
                }
                else {
                    if (opcode != Opcode.SKIPCOND)
                        instructions[i].param = symbolTable[instructions[i].param];
                }
            }
        }
        if (errors && errors.length > 0)
            throw errors;
        return instructions;
    };
    MarieInterpreter.prototype.tokenize = function (instructions) {
        var ins = [];
        this.org = 0;
        instructions = instructions.replace("\r\n", "\n");
        instructions = instructions.replace("\r", "\n");
        instructions = instructions.replace(/\t+/g, " ");
        instructions = instructions.replace(/(\/.*)/g, "");
        var lines = instructions.split("\n");
        lines.forEach(function (line, index) {
            line = line.trim();
            if (!line)
                return;
            var i = { opcode: null, linenumber: null };
            if (line.indexOf(",") != -1) {
                var split = line.split(",");
                i.label = split[0].trim();
                line = split[1];
            }
            line = line.trim(); //line.replace(/(^\ )+/g, "");
            var split = line.split(" ");
            i.opcode = split[0];
            if (split.length >= 2)
                i.param = split[1];
            i.linenumber = index + 1;
            ins.push(i);
        });
        if (ins[0] && ins[0].opcode.toUpperCase() == "ORG") {
            this.org = Number(ins[0].param);
            ins.splice(0, 1);
            this.ProgramCounter = this.org;
        }
        return ins;
    };
    MarieInterpreter.prototype.fillMemory = function (instructions) {
        var memory = new Int16Array(1 << 11);
        for (var i = this.org; i < instructions.length + this.org; i++) {
            var index = i - this.org;
            if (instructions[index].opcode == Opcode.DEC) {
                memory[i] = parseInt("" + instructions[index].param, 10) & 0xFFFF;
            }
            else if (instructions[index].opcode == Opcode.HEX) {
                memory[i] = parseInt("" + instructions[index].param, 16) & 0xFFFF;
            }
            else if (instructions[index].opcode == Opcode.SKIPCOND) {
                memory[i] = (instructions[index].opcode & 0xF) << 12;
                memory[i] |= parseInt("" + instructions[index].param, 16) & 0x0FFF;
            }
            else {
                memory[i] = (instructions[index].opcode & 0xF) << 12;
                memory[i] |= instructions[index].param & 0x0FFF;
            }
            this.IRToLine[memory[i]] = this.instructions[index].linenumber;
        }
        return memory;
    };
    MarieInterpreter.prototype.setMemory = function () {
        this.memory[this.MemoryAddressRegister] = this.MemoryBufferRegister;
        if (this.onMemoryChangedDelegate)
            this.onMemoryChangedDelegate(this.MemoryAddressRegister, this.MemoryBufferRegister);
    };
    MarieInterpreter.prototype.getMemory = function () {
        this.MemoryBufferRegister = this.memory[this.MemoryAddressRegister];
    };
    MarieInterpreter.prototype.getInput = function () {
        if (this.inputBuffer.length > 0) {
            var value = this.inputBuffer.splice(0, 1)[0];
            // console.log("Getting input!",this.inputBuffer,value);
            if (typeof (value) == "string") {
                value = value.charCodeAt(0);
            }
            this.Accumulator = value;
        }
        else {
            this.isWaitingOnInput = true;
            if (this.onNeedsInputDelegate)
                this.onNeedsInputDelegate();
        }
    };
    MarieInterpreter.prototype.sendInput = function (input) {
        this.inputBuffer = this.inputBuffer.concat(input.split("")).concat([0]);
        if (this.inputBuffer.length > 0 && this.isWaitingOnInput) {
            // console.log("Got the input i've been waiting for. Resuming.");
            this.getInput();
            this.isWaitingOnInput = false;
        }
    };
    MarieInterpreter.prototype.pauseExecution = function () {
        this.isRunning = false;
        if (this.onExecutionPaused)
            this.onExecutionPaused();
    };
    MarieInterpreter.prototype.resumeExecution = function () {
        this.isRunning = true;
        if (this.onExecutionResumed)
            this.onExecutionResumed();
        this.run();
    };
    MarieInterpreter.prototype.clampValues = function () {
        this.Accumulator &= 0xFFFF;
        this.MemoryBufferRegister &= 0xFFFF;
        this.MemoryAddressRegister &= 0xFFFF;
        this.ProgramCounter &= 0xFFFF;
        this.Input &= 0xFFFF;
        this.InstructionRegister &= 0xFFFF;
    };
    MarieInterpreter.prototype.step = function () {
        // console.log(this.isRunning, this.isFinishedExecuting, this.isWaitingOnInput);
        if (!this.isWaitingOnInput && !this.isFinishedExecuting) {
            this.MemoryAddressRegister = this.ProgramCounter;
            this.InstructionRegister = this.memory[this.MemoryAddressRegister];
            this.ProgramCounter++;
            this.interpret();
            this.clampValues();
            if (this.onTick)
                this.onTick();
        }
    };
    MarieInterpreter.prototype.run = function () {
        // console.log("running...",this.isRunning);
        if (!this.isWaitingOnInput && this.isRunning && !this.isFinishedExecuting)
            this.step();
        if (this.isRunning && !this.isFinishedExecuting)
            setTimeout(this.run.bind(this), this.delayInMS);
    };
    MarieInterpreter.prototype.interpret = function () {
        var opcode = (this.InstructionRegister & 0xF000) >> 12;
        var param = this.InstructionRegister & 0x0FFF;
        // console.log(opcode,param);
        switch (opcode) {
            case Opcode.JNS:
                this.MemoryBufferRegister = this.ProgramCounter;
                this.MemoryAddressRegister = param;
                this.setMemory();
                this.ProgramCounter = param + 1;
                break;
            case Opcode.LOAD:
                this.MemoryAddressRegister = param;
                this.getMemory();
                this.Accumulator = this.MemoryBufferRegister;
                break;
            case Opcode.STORE:
                this.MemoryAddressRegister = param;
                this.MemoryBufferRegister = this.Accumulator;
                this.setMemory();
                break;
            case Opcode.ADD:
                this.MemoryAddressRegister = param;
                this.getMemory();
                this.Accumulator += this.MemoryBufferRegister;
                break;
            case Opcode.SUBT:
                this.MemoryAddressRegister = param;
                this.getMemory();
                this.Accumulator -= this.MemoryBufferRegister;
                break;
            case Opcode.INPUT:
                this.getInput();
                break;
            case Opcode.OUTPUT:
                this.outputBuffer.push(this.Accumulator);
                if (this.onOutput)
                    this.onOutput(String.fromCharCode(this.Accumulator));
                break;
            case Opcode.HALT:
                this.isFinishedExecuting = true;
                this.pauseExecution();
                if (this.onExecutionFinished)
                    this.onExecutionFinished();
                break;
            case Opcode.SKIPCOND:
                if (param >> 10 == 0x0002 && this.Accumulator > 0) {
                    // console.log(this.Accumulator,"> 0")
                    this.ProgramCounter++;
                }
                else if (param >> 10 == 0x0001 && this.Accumulator == 0) {
                    // console.log(this.Accumulator,"== 0")
                    this.ProgramCounter++;
                }
                else if (param >> 10 == 0x0000 && this.Accumulator < 0) {
                    // console.log(this.Accumulator,"< 0")
                    this.ProgramCounter++;
                }
                break;
            case Opcode.JUMP:
                this.ProgramCounter = param;
                break;
            case Opcode.CLEAR:
                this.Accumulator = 0;
                break;
            case Opcode.ADDI:
                this.MemoryAddressRegister = param;
                this.getMemory();
                this.MemoryAddressRegister = this.MemoryBufferRegister & 0x0FFF;
                this.getMemory();
                this.Accumulator += this.MemoryBufferRegister & 0xFFFF;
                break;
            case Opcode.JUMPI:
                this.MemoryAddressRegister = param;
                this.getMemory();
                this.ProgramCounter = this.MemoryBufferRegister & 0x0FFF;
                break;
            case Opcode.LOADI:
                this.MemoryAddressRegister = param;
                this.getMemory();
                this.MemoryAddressRegister = this.MemoryBufferRegister & 0x0FFF;
                this.getMemory();
                this.Accumulator = this.MemoryBufferRegister;
                break;
            case Opcode.STOREI:
                this.MemoryAddressRegister = param;
                this.getMemory();
                this.MemoryAddressRegister = this.MemoryBufferRegister & 0x0FFF;
                this.MemoryBufferRegister = this.Accumulator;
                this.setMemory();
                break;
        }
    };
    return MarieInterpreter;
}());
