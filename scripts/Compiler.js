Array.prototype['merge'] = function (other) {
    var _this = this;
    if (Array.isArray(other))
        other.forEach(function (item) { return _this.push(item); });
    else {
        this.push(other);
    }
    return this;
};
var Compiler = (function () {
    function Compiler(ast) {
        this.functions = [];
        this.hasReturn = {};
        this.variables = [];
        this.LITERAL_COUNT = 0;
        this.CONDITIONAL_COUNT = 0;
        this.WHILE_COUNT = 0;
        this.IF_COUNT = 0;
        this.ARRAY_COUNT = 0;
        this.ast = ast;
    }
    Compiler.prototype.compile = function (ast) {
        var _this = this;
        if (ast === void 0) { ast = this.ast; }
        var instructions;
        traverse(ast, { pre: function (node, parent) {
                _this.prepare(node);
                if (_this[node.type])
                    _this[node.type](node, false);
            },
            post: function (node, parent) {
                _this.prepare(node);
                if (_this[node.type])
                    _this[node.type](node, true);
                if (node == ast)
                    instructions = node.instructions;
            } });
        console.log("vars", this.variables);
        instructions.push({ opcode: "HALT", label: "END_OF_PROGRAM" });
        this.variables.push({ label: "LEFT", opcode: "DEC", param: 0 });
        this.variables.push({ label: "RIGHT", opcode: "DEC", param: 0 });
        this.variables.push({ label: "FUNCTION_RETURN", opcode: "DEC", param: 0 });
        this.variables.push({ label: "TEMP", opcode: "DEC", param: 0 });
        this.variables.push({ label: "ARRAY_INDEX", opcode: "DEC", param: 0 });
        this.variables.push({ label: "VALUE_1", opcode: "DEC", param: 1 });
        instructions.merge(this.variables);
        this.functions.forEach(function (f) {
            instructions.merge(f.instructions);
        });
        console.log(instructions);
        return instructions;
    };
    Compiler.prototype.instructionsToRaw = function (instructions) {
        var ins = "";
        instructions.forEach(function (i) {
            ins += (i.label ? i.label + "," : "") + "\t";
            ins += i.opcode + "\t";
            if (i.opcode == "DEC" && !i.param)
                i.param = "0";
            ins += (i.param ? i.param : "") + "\t\n";
        });
        return ins;
    };
    Compiler.prototype.instructionsFromOperator = function (operator, param) {
        switch (operator) {
            case "+": return { opcode: "ADD", param: param };
            case "-": return { opcode: "SUBT", param: param };
            case "*": throw new Error("Invalid symbol found");
            case "/": throw new Error("Invalid symbol found");
        }
    };
    Compiler.prototype.prepare = function (node) {
        if (!node.instructions)
            node.instructions = new Array();
        if (node.type == "BinaryExpression" &&
            (node.operator == ">=" || node.operator == "<=" ||
                node.operator == "<" || node.operator == ">" ||
                node.operator == "==" || node.operator == "!=")) {
            node.type = "ConditionalExpression";
        }
        if (node.type == "Literal" && typeof (node.value) == 'string' && node.value.length > 1) {
            node.type = "ArrayExpression";
            node.elements = [];
            for (var i = 0; i < node.value.length; i++) {
                node.elements.push({ type: "Literal", value: node.value.charAt(i) });
            }
            node.elements.push({ type: "Literal", value: "" });
            delete node.value;
            delete node.raw;
        }
        //  if(node.type == "FunctionDeclaration") {
        //      var hasReturn = false;
        //      traverse(node,{pre:(node)=>{
        //          if(node.type == "ReturnStatement")
        //             hasReturn = true;
        //      }});
        //      this.hasReturn[node.id.name] = hasReturn;
        //  }
    };
    Compiler.prototype.optimize = function (instructions) {
        for (var i = 0; i < instructions.length; i++) {
            if (instructions[i].opcode == "LOAD") {
                if (i - 1 >= 0 && (instructions[i - 1].opcode == "STORE" || instructions[i - 1].opcode == "LOAD")
                    && instructions[i - 1].param == instructions[i].param && (!instructions[i].label || instructions[i].label == "")) {
                    instructions.splice(i, 1);
                }
            }
        }
    };
    Compiler.prototype.scopeRename = function (instructions, name, rename) {
        // console.log(instructions);
        instructions.forEach(function (ins) {
            if (ins.param == name) {
                console.log("RENAMING...");
                ins.param = rename;
            }
        });
    };
    Compiler.prototype.handleSpecialFunction = function (node) {
        if (node.callee.name == "output" && node.arguments.length > 0) {
            return node.arguments[0].instructions.merge({ opcode: "OUTPUT" });
        }
        if (node.callee.name == "input") {
            return [{ opcode: "INPUT" }];
        }
        return undefined;
    };
    ///////////////////////////////////////////////////////////////////////////////////////////////////// 
    Compiler.prototype.Literal = function (node, isExiting) {
        if (isExiting)
            return;
        if (typeof (node.value) == "string") {
            node.value = node.value.charCodeAt(0);
        }
        var foundLiteral = undefined;
        // this.variables.forEach(ins=>{
        //     if(ins.param === node.value) {
        //         foundLiteral = ins;
        //     }
        // })
        // console.log(typeof(node.value));
        if (!foundLiteral)
            foundLiteral = { opcode: "DEC", param: node.value, label: "LITERAL_" + this.LITERAL_COUNT++ };
        node.name = foundLiteral.label;
        node.type = "Identifier";
        if (this.variables.filter(function (v) { return v.label == foundLiteral.label; }).length == 0)
            this.variables.push(foundLiteral);
    };
    Compiler.prototype.Identifier = function (node, isExiting) {
        if (isExiting)
            node.instructions.merge({ opcode: "LOAD", param: node.name });
    };
    Compiler.prototype.BinaryExpression = function (node, isExiting) {
        // console.log("FOUND BINARY EXPRESSION",node,isExiting);
        if (!isExiting)
            return;
        node.instructions.merge(node.left.instructions);
        // This identifier check can be left in for the purposes of optimization.
        if (node.right.type == "Identifier") {
            node.instructions.merge(this.instructionsFromOperator(node.operator, node.right.name));
        }
        else {
            node.instructions.merge({ opcode: "STORE", param: "LEFT" });
            node.instructions.merge({ opcode: "CLEAR" });
            node.instructions.merge(node.right.instructions);
            node.instructions.merge({ opcode: "STORE", param: "RIGHT" });
            node.instructions.merge({ opcode: "LOAD", param: "LEFT" });
            node.instructions.merge(this.instructionsFromOperator(node.operator, "RIGHT"));
        }
    };
    Compiler.prototype.AssignmentExpression = function (node, isExiting) {
        if (!isExiting)
            return;
        if (node.operator == "=") {
            node.instructions.merge(node.right.instructions);
        }
        if (node.operator != "=") {
            node.operator = node.operator.charAt(0);
            this.BinaryExpression(node, isExiting);
        }
        if (node.left.type == "MemberExpression") {
            node.instructions.merge(node.left.storeinstructions);
            node.instructions.merge({ opcode: "STOREI", param: "ARRAY_INDEX" });
        }
        else
            node.instructions.merge({ opcode: "STORE", param: node.left.name });
    };
    Compiler.prototype.UpdateExpression = function (node, isExiting) {
        if (!isExiting) {
            node.left = { type: "Identifier", name: node.argument.name };
            node.right = { type: "Literal", value: 1, raw: 1 };
            node.operator = node.operator.charAt(0) + "=";
        }
        else {
            this.AssignmentExpression(node, isExiting);
        }
    };
    Compiler.prototype.VariableDeclarator = function (node, isExiting) {
        if (!isExiting)
            return;
        if (this.variables.filter(function (v) { return v.label == node.id.name; }).length == 0)
            this.variables.push({ opcode: "DEC", label: node.id.name });
        if (node.init != null) {
            node.instructions.merge(node.init.instructions);
            node.instructions.push({ opcode: "STORE", param: node.id.name });
        }
        // node.instructions.merge(node.init.instructions);
        // node.instructions.merge({opcode:"STORE",param:node.id.name});
    };
    Compiler.prototype.VariableDeclaration = function (node, isExiting) {
        if (!isExiting)
            return;
        node.declarations.forEach(function (n) {
            node.instructions.merge(n.instructions);
        });
    };
    Compiler.prototype.Program = function (node, isExiting) {
        if (!isExiting)
            return;
        node.body.forEach(function (n) {
            node.instructions.merge(n.instructions);
        });
    };
    Compiler.prototype.ExpressionStatement = function (node, isExiting) {
        if (!isExiting)
            return;
        node.instructions.merge(node.expression.instructions);
    };
    Compiler.prototype.BlockStatement = function (node, isExiting) {
        if (!isExiting)
            return;
        node.body.forEach(function (item) { node.instructions.merge(item.instructions); });
    };
    Compiler.prototype.FunctionDeclaration = function (node, isExiting) {
        var _this = this;
        if (!isExiting) {
            node.toRename = node.toRename || [];
            traverse(node.body, { pre: function (node2, parent) {
                    if (node2.type == "VariableDeclarator") {
                        node.toRename.push(node2.id.name);
                        node2.id.name = node.id.name + "_VAR_" + node2.id.name;
                    }
                } });
        }
        else {
            var paramCount = 0;
            node.params.forEach(function (param) {
                var newName = node.id.name + "_PARAM_" + paramCount++;
                node.instructions.merge({ opcode: "DEC", label: newName });
                param.newName = newName;
                _this.scopeRename(node.body.instructions, param.name, newName);
            });
            if (node.toRename)
                node.toRename.forEach(function (name) {
                    _this.scopeRename(node.body.instructions, name, node.id.name + "_VAR_" + name);
                });
            node.instructions.merge({ opcode: "DEC", param: "0", label: node.id.name });
            node.instructions = node.instructions.merge(node.body.instructions);
            node.instructions.merge({ opcode: "JUMPI", param: node.id.name });
            node.instructions.forEach(function (i) {
                if (i.param && i.param == "FUNCTION_NAME_REPLACE") {
                    i.param = node.id.name;
                }
            });
            this.functions.push({ name: node.id.name, instructions: node.instructions, params: node.params });
            node.instructions = new Array();
        }
    };
    Compiler.prototype.CallExpression = function (node, isExiting) {
        if (!isExiting)
            return;
        var ins;
        if ((ins = this.handleSpecialFunction(node))) {
            node.instructions = ins;
            return;
        }
        var paramCount = 0;
        node.arguments.forEach(function (arg) {
            if (arg.type == "Identifier")
                node.instructions.push({ opcode: "LOAD", param: arg.name });
            else
                node.instructions.merge(arg.instructions);
            node.instructions.push({ opcode: "STORE", param: node.callee.name + "_PARAM_" + paramCount++ });
        });
        node.instructions.push({ opcode: "JNS", param: node.callee.name });
        // if(this.hasReturn[node.callee.name]) {
        //     node.instructions.push({opcode:"LOAD",param:"FUNCTION_RETURN"});
        // }
    };
    Compiler.prototype.ConditionalExpression = function (node, isExiting) {
        if (!isExiting)
            return;
        var true_condition = { opcode: "TRUE" };
        var false_condition = { opcode: "FALSE" };
        node.instructions.merge(node.left.instructions);
        // Optimization
        if (node.right.type == "Identifier") {
            node.instructions.merge({ opcode: "SUBT", param: node.right.name });
        }
        else {
            node.instructions.merge({ opcode: "STORE", param: "LEFT" });
            node.instructions.merge({ opcode: "CLEAR" });
            node.instructions.merge(node.right.instructions);
            node.instructions.merge({ opcode: "STORE", param: "RIGHT" });
            node.instructions.merge({ opcode: "LOAD", param: "LEFT" });
            node.instructions.merge({ opcode: "SUBT", param: "RIGHT" });
        }
        var instructions = [];
        switch (node.operator) {
            case "<":
                instructions = [
                    { opcode: "SKIPCOND", param: Compiler.SKIP_NEGATIVE },
                    { opcode: "FALSE" },
                    { opcode: "TRUE" }
                ];
                break;
            case ">":
                instructions = [
                    { opcode: "SKIPCOND", param: Compiler.SKIP_POSITIVE },
                    { opcode: "FALSE" },
                    { opcode: "TRUE" }
                ];
                break;
            case "<=":
                instructions = [
                    { opcode: "SKIPCOND", param: Compiler.SKIP_POSITIVE },
                    { opcode: "TRUE" },
                    { opcode: "FALSE" }
                ];
                break;
            case ">=":
                instructions = [
                    { opcode: "SKIPCOND", param: Compiler.SKIP_NEGATIVE },
                    { opcode: "TRUE" },
                    { opcode: "FALSE" }
                ];
                break;
            case "==":
                instructions = [
                    { opcode: "SKIPCOND", param: Compiler.SKIP_EQUAL },
                    { opcode: "FALSE" },
                    { opcode: "TRUE" }
                ];
                break;
            case "!=":
                instructions = [
                    { opcode: "SKIPCOND", param: Compiler.SKIP_POSITIVE },
                    { opcode: "JUMP", param: "IF" + this.CONDITIONAL_COUNT + "_OR" },
                    { opcode: "TRUE" },
                    { opcode: "SKIPCOND", param: Compiler.SKIP_NEGATIVE, label: "IF" + this.CONDITIONAL_COUNT + "_OR" },
                    { opcode: "FALSE" },
                    { opcode: "TRUE" }
                ];
                break;
        }
        node.instructions.merge(instructions);
        this.CONDITIONAL_COUNT++;
    };
    Compiler.prototype.IfStatement = function (node, isExiting) {
        if (!isExiting)
            return;
        node.instructions.merge(node.test.instructions);
        var true_label = "IF_" + this.IF_COUNT + "_TRUE";
        var false_label = "IF_" + this.IF_COUNT + "_FALSE";
        if (node.consequent && node.consequent.instructions[0]) {
            node.consequent.instructions[0].label = node.consequent.instructions[0].label || true_label;
            true_label = node.consequent.instructions[0].label;
            node.consequent.instructions.merge({ opcode: "JUMP", param: "IF_" + this.IF_COUNT + "_END" });
        }
        else {
            true_label = "IF_" + this.IF_COUNT + "_END";
        }
        if (node.alternate && node.alternate.instructions[0]) {
            node.alternate.instructions[0].label = node.alternate.instructions[0].label || false_label;
            false_label = node.alternate.instructions[0].label;
        }
        else {
            false_label = "IF_" + this.IF_COUNT + "_END";
        }
        if (node.consequent)
            node.instructions.merge(node.consequent.instructions);
        if (node.alternate)
            node.instructions.merge(node.alternate.instructions);
        node.instructions.merge({ opcode: "CLEAR", label: "IF_" + this.IF_COUNT++ + "_END" });
        node.instructions.forEach(function (ins) {
            if (ins.opcode == "TRUE") {
                ins.opcode = "JUMP";
                ins.param = true_label;
            }
            if (ins.opcode == "FALSE") {
                ins.opcode = "JUMP";
                ins.param = false_label;
            }
        });
    };
    Compiler.prototype.WhileStatement = function (node, isExiting) {
        var _this = this;
        if (!isExiting)
            return;
        var loop_true_label = (node.body.instructions[0] && node.body.instructions[0].label) || "DO_WHILE_" + this.WHILE_COUNT;
        var loop_begin = (node.test.instructions[0] && node.test.instructions[0].label) || "WHILE_" + this.WHILE_COUNT + "_BEGIN";
        node.test.instructions[0].label = loop_begin;
        node.instructions.merge(node.test.instructions);
        node.instructions.forEach(function (ins) {
            if (ins.opcode == "TRUE") {
                ins.opcode = "JUMP";
                ins.param = loop_true_label;
            }
            else if (ins.opcode == "FALSE") {
                ins.opcode = "JUMP";
                ins.param = "WHILE_" + _this.WHILE_COUNT + "_END";
            }
        });
        if (node.body.instructions.length == 0)
            return;
        node.body.instructions.push({ opcode: "JUMP", param: loop_begin });
        node.body.instructions.push({ opcode: "CLEAR", label: "WHILE_" + this.WHILE_COUNT + "_END" });
        var loop_true_label = (node.body.instructions[0] && node.body.instructions[0].label) || "DO_WHILE_" + this.WHILE_COUNT;
        node.body.instructions[0].label = loop_true_label;
        node.instructions.merge(node.body.instructions);
        this.WHILE_COUNT++;
    };
    Compiler.prototype.ForStatement = function (node, isExiting) {
        if (!isExiting) {
        }
        else {
            node.instructions.merge((node.init && node.init.instructions) || {});
            node.body.instructions.merge((node.update && node.update.instructions) || {});
            this.WhileStatement(node, isExiting);
        }
    };
    Compiler.prototype.ReturnStatement = function (node, isExiting) {
        if (!isExiting)
            return;
        // node.argument.instructions.merge({ opcode: "STORE", param: "FUNCTION_RETURN" })
        node.instructions.merge(node.argument.instructions);
        // node.instructions.push({opcode:"JUMPI",param:"FUNCTION_NAME_REPLACE"});
    };
    Compiler.prototype.ArrayExpression = function (node, isExiting) {
        if (!isExiting)
            return;
        if (!node.id)
            node.id = {};
        node.id.name = "ARRAY_" + this.ARRAY_COUNT++;
        this.variables.push({ opcode: "DEC", param: node.elements.length, label: node.id.name + "_LEN" });
        this.variables.push({ opcode: "JNS", param: node.id.name, label: node.id.name });
        for (var i = 0; i < node.elements.length; i++) {
            this.variables.push({ opcode: "DEC", label: node.id.name + "_" + i });
            node.instructions.merge(node.elements[i].instructions);
            node.instructions.merge({ opcode: "STORE", param: node.id.name + "_" + i });
        }
        node.instructions.merge({ opcode: "LOADI", param: node.id.name });
        return;
    };
    Compiler.prototype.NewExpression = function (node, isExiting) {
        if (node.callee.name == "Array") {
            if (!node.id)
                node.id = {};
            node.id.name = "ARRAY_" + this.ARRAY_COUNT++;
            this.variables.push({ opcode: "DEC", param: node.arguments.length, label: node.id.name + "_LEN" });
            this.variables.push({ opcode: "JNS", param: node.id.name, label: node.id.name });
            for (var i = 0; i < node.arguments[0].value; i++) {
                this.variables.push({ opcode: "DEC", label: node.id.name + "_" + i });
            }
            node.instructions.merge({ opcode: "LOADI", param: node.id.name });
        }
    };
    Compiler.prototype.MemberExpression = function (node, isExiting) {
        if (!isExiting)
            return;
        //console.log("instructions...",util.inspect(node,true,100,true));
        node.storeinstructions = [];
        node.storeinstructions.merge([
            { opcode: "STORE", param: "TEMP" },
        ]);
        node.storeinstructions.merge(node.property.instructions);
        node.storeinstructions.merge([
            { opcode: "ADD", param: node.object.name },
            { opcode: "ADD", param: "VALUE_1" },
            { opcode: "STORE", param: "ARRAY_INDEX" },
            { opcode: "LOAD", param: "TEMP" }
        ]);
        //////// HERE STARTS LOAD INS /////
        node.instructions.merge(node.property.instructions);
        node.instructions.merge([
            { opcode: "ADD", param: node.object.name },
            { opcode: "ADD", param: "VALUE_1" },
            { opcode: "STORE", param: "ARRAY_INDEX" },
            { opcode: "LOADI", param: "ARRAY_INDEX" }
        ]);
    };
    Compiler.SKIP_NEGATIVE = "0";
    Compiler.SKIP_EQUAL = "400";
    Compiler.SKIP_POSITIVE = "800";
    return Compiler;
}());
