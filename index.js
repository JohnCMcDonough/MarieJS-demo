///<reference path="../typings/tsd.d.ts"/>
var app = angular.module("mariejs", ['ui.codemirror']);
var MainController = (function () {
    function MainController($scope, $rootScope) {
        var _this = this;
        this.$scope = $scope;
        this.$rootScope = $rootScope;
        this.interpreter = new MarieInterpreter();
        this.defaultCode = "LOAD a\nADD b\nOUTPUT\nHALT\na, DEC 10\nb, DEC 15";
        this.defaultmcdScript = "// Warning: \n// This is experimental...\n// There is no code linting....\n// There is no code validation....\n// This may not generate valid assembly...\n// There is no breakpoint debugging (as of yet)\n// most of all....\n\n// VARIABLES ARE DEFINED AT THE FUNCTION LEVEL, NOT BLOCK LEVEL.\n// ALSO, RECURSION DOESN'T WORK EITHER. THERE IS NO STACK.\n\n// THIS DOESN'T WORK\n//  var i = 0;\n//  var j = 0;\n//  for(var i = 0; i < 5; i++) {\n//     output(i);\t\n//   \tvar j = i; // this variable is NOT scoped.\n//    \toutput(j);\n//  }\n//  output(i); // this will print 5\n//  output(j); // this will print 4\n\n\n// Defined \"System\" functions.\n// input() // reads and returns a single character.\n// output(char) // writes out a single character.\n\n////////////////////////////////////////////////////////////////////\n/////////////////////////// EXAMPLE CODE ///////////////////////////\n////////////////////////////////////////////////////////////////////\n\n/*\nwriteline(\"Enter your name...\");\nvar name = new Array(20);\ngetstring(name);\nwrite(\"hello \");\nwriteline(name);\n*/\n\n/*\nvar string_name = new Array(20);\nvar string_age = new Array(20);\nvar age = 0;\nvar string_yearsUntil = new Array(20);\nvar yearsUntil = 0;\nwriteline(\"Please enter your name...\");\ngetstring(string_name);\nwriteline(\"Please enter your age...\");\ngetstring(string_age);\nage = parseInt(string_age);\nyearsUntil = 62 - age;\n\nintToString(yearsUntil,string_yearsUntil);\nwrite(string_name);\nwrite(\", you've got \");\nwrite(string_yearsUntil);\nwriteline(\" years until you get Social Security\");\n*/\n\n/*\n////////////////////////////////////////////////////////////////////\n//////////////////////// TUTORIAL FUNCTIONS ////////////////////////\n////////////////////////////////////////////////////////////////////\nfunction multiply(a,b) {\n  var count = 0;\n  for(var i = 0; i < b; i++) {\n    count = count + a;\n  }\n  return count;\n}\nvar mult = multiply(20,3);\noutput(mult)\n\n// for loops\nfor(var i = 0; i <= 10; i++) {\n    output(i)\n}\n\n// while loops\nvar x = 0;\nwhile(x < 10) {\n  x = x + x + 1;\n}\n\n// arrays\nvar array = new Array(15);\narray[5] = 5;\narray[10] = 10;\nfor(var i = 0; i < 15; i++) {\n  output(array[i])\n}\n\n// strings\nvar hello = \"hello world\"; // this is really a null terminated array\nfor(var i = 0; hello[i] != 0; i++) { // loop through the string until we hit a null character (end of string)\n output(hello[i]) \n}\noutput('\\n')\n\nvar waiting = \"waiting on input...\";\nfor(var i = 0; waiting[i] != 0; i++) {\n output(waiting[i]) \n}\noutput('\\n')\n\n// reading input\nfunction readInput(string_destination) {\n  var inp = input();\n  var index = 0;\n  while(inp != 0) {\n    string_destination[index] = inp;\n    index++;\n    inp = input()\n  }\n}\nvar input = new Array(15);\nreadInput(input);\nfor(var i = 0; input[i] != 0; i++) {\n output(input[i]) \n}\n*/\n\n////////////////////////////////////////////////////////////////////\n////////////////////////// HELPER FUNCTIONS ////////////////////////\n////////////////////////////////////////////////////////////////////\n\nfunction write(string) {\n    for(var i = 0; string[i] != 0; i++) {\n        output(string[i]);\n    }\n}\n\nfunction writeline(string) {\n    write(string);\n    output(\"\\n\");\n}\n\nfunction getstring(string_dest) {\n    var inp = input()\n    var index = 0;\n    while(inp != 0) {\n        string_dest[index] = inp;\n        index++;\n        inp = input()\n    }\n}\n\nfunction strlen(str) {\n\tvar length = 0;\n\tfor(var i = 0; str[i] != 0; i++) {\n    \tlength++;\t\n    }\n  return length;\n}\n\nfunction multiply(a,b) {\n  var count = 0;\n  for(var i = 0; i < b; i++) {\n    count = count + a;\n  }\n  return count;\n}\n\nfunction divide(num,denom) {\n  var count = 0;\n  num = num - denom;\n  while(num > 0) {\n    count++;\n    num = num - denom;\n  }\n  return count;\n}\n\nfunction mod(num,denom) {\n  var count = 0;\n  num = num - denom;\n  while(num > 0) {\n    count++;\n    num = num - denom;\n  }\n  return num + denom;\n}\n\nfunction parseInt(str) {\n  var num = 0;\n  var strlength = strlen(str);\n  for(var i = 0; i < strlength - 1; i++) {\n    num = num + multiply(multiply(10,strlength - i -1),str[i] - 48);\n  }\n  num = num + str[strlength - 1] - 48\n  return num;\n}\n\nfunction intToString(num,str) {\n  var places = new Array(10);\n  var count = 0;\n  while(num != 0) {\n    places[count] = num;\n    count++\n    num = divide(num,10);\n  }\n  var length = strlen(places);\n  count = length - 1;\n  for(var i = 0; i < length; i++) {\n    places[i] = places[i] - multiply(places[i+1],10);\n    str[count] = places[i] + 48;\n    count = count - 1;\n  }\n  str[count] = places[0] + 48\n}\n";
        this.lineError = -1;
        this.objectError = "";
        this.viewType = "HEX";
        this.debounceTimer = 0;
        this.instructionsCount = 0;
        this.defaultEditorOptions = {
            lineWrapping: true,
            lineNumbers: true,
            readOnly: false,
            gutters: ['breakpoint-gutter'],
            firstLineNumber: 0,
            lineNumberFormatter: function (ln) { return "0x" + ln.toString(16); },
            mode: ""
        };
        this.mcdScriptEditorOptions = {
            lineWrapping: true,
            lineNumbers: true,
            readOnly: false,
            gutters: ['breakpoint-gutter'],
            firstLineNumber: 1,
            lineNumberFormatter: function (ln) { return ln.toString(10); },
            mode: "text/javascript"
        };
        this.lintTimeout = 0;
        this.cpuFreq = 500;
        this.slowUI = false;
        this.breakpoints = [];
        this.currentEditorView = "assembly";
        $scope['mc'] = this;
        this.$scope['codemirrorLoaded'] = this.codemirrorLoaded.bind(this);
        // this.$scope.$watch('mc.code', () => {
        //     clearTimeout(this.lintTimeout);
        //     this.lintTimeout = setTimeout(this.lintCode.bind(this), 500);
        // })
        var freqToPeriod = function () {
            var EXP_GAIN = 1 / 10;
            _this.interpreter.delayInMS = 1000 * Math.pow(Math.E, -.005 * _this.cpuFreq);
        };
        this.$scope.$watch('mc.cpuFreq', freqToPeriod);
        freqToPeriod();
    }
    MainController.prototype.markComments = function () {
        var _this = this;
        if (this.currentEditorView == "assembly")
            this.editor.getDoc().eachLine(function (line) {
                var commentBeginsAt = line.text.indexOf("/");
                var lineNum = _this.editor.getDoc().getLineNumber(line);
                if (commentBeginsAt == -1)
                    return;
                _this.editor.getDoc().markText({ line: lineNum, ch: commentBeginsAt }, { line: lineNum, ch: line.text.length }, { className: "comment" });
            });
    };
    MainController.prototype.lintCode = function () {
        var _this = this;
        if (this.editor) {
            // this.editor.clearGutter("note-gutter");
            this.editor.getDoc().getAllMarks().forEach(function (mark) { return mark.clear(); });
        }
        this.codeErrors = [];
        this.instructionsCount = 0;
        if (this.interpreter && this.interpreter.pauseExecution) {
            this.interpreter.pauseExecution();
        }
        try {
            this.markComments();
            this.interpreter.lint(this.assemblyDocument.getValue());
            this.interpreter.onFinishedCompile = function () {
                _this.editor.setOption("readOnly", false);
                _this.$rootScope.$emit("setActiveMemory", -1, -1);
                _this.$rootScope.$emit("memoryUpdate", -1);
                _this.editor.refresh();
            };
            this.interpreter.onTick = function () {
                _this.instructionsCount++;
                if (!_this.debounceTimer) {
                    _this.debounceTimer = +setTimeout(function () {
                        var line = _this.interpreter.IRToLine[_this.interpreter.InstructionRegister] - 1;
                        if (_this.highlightedLine)
                            _this.editor.removeLineClass(_this.highlightedLine, "background", "active-line");
                        _this.highlightedLine = _this.editor.addLineClass(line, "background", "active-line");
                        _this.editor.scrollIntoView({ line: line, ch: 0 }, 100);
                        _this.$rootScope.$emit("setActiveMemory", _this.interpreter.MemoryAddressRegister, _this.interpreter.ProgramCounter);
                        // this.safeApply()
                        _this.$scope.$applyAsync();
                        _this.debounceTimer = null;
                    }, _this.slowUI ? 500 : 50);
                }
                var line = _this.interpreter.IRToLine[_this.interpreter.InstructionRegister] - 1;
                if (_this.breakpoints[line])
                    _this.interpreter.pauseExecution();
            };
            this.interpreter.onOutput = function () {
                // this.safeApply();
            };
            this.interpreter.onMemoryChangedDelegate = function (mar, mbr) {
                _this.$rootScope.$emit('memoryUpdate', mar, mbr);
            };
            this.interpreter.onExecutionFinished = function () {
                console.info(_this.interpreter.outputBuffer);
                _this.defaultEditorOptions.readOnly = false;
            };
        }
        catch (err) {
            if (err.map)
                this.codeErrors = err.map(function (err) {
                    err.lineNumber--;
                    var eString = "Error on Line 0x" + err.lineNumber.toString(16) + ": " + err.errorstring;
                    _this.objectError = (err).object;
                    if (_this.editor) {
                        var line = _this.assemblyDocument.getLine(err.lineNumber);
                        var char = line.indexOf(_this.objectError);
                        if (char != -1)
                            _this.assemblyDocument.markText({ line: err.lineNumber, ch: char }, { line: err.lineNumber, ch: char + _this.objectError.length }, { className: "line-error" });
                        else {
                            _this.assemblyDocument.markText({ line: err.lineNumber, ch: 0 }, { line: err.lineNumber, ch: line.length }, { className: "line-error" });
                        }
                    }
                    return eString;
                });
            else
                console.log(err);
        }
        this.safeApply();
    };
    MainController.prototype.assemble = function () {
        if (this.currentEditorView == 'mcdscript') {
            var ast = window["esprima"].parse(this.mcdscriptDocument.getValue());
            var comp = new Compiler(ast);
            var ins = comp.compile();
            var diff = ins.length;
            comp.optimize(ins);
            diff -= ins.length;
            console.log("optimized out " + diff + " instructions");
            var code = comp.instructionsToRaw(ins);
            this.assemblyDocument.setValue(code);
            this.switchDocument();
            return;
        }
        this.lintCode();
        if (this.editor && this.highlightedLine)
            this.editor.removeLineClass(this.highlightedLine, "background", "active-line");
        if (this.codeErrors.length == 0) {
            this.interpreter.performFullCompile(this.assemblyDocument.getValue());
        }
    };
    MainController.prototype.playPause = function () {
        if (this.interpreter.isRunning) {
            this.interpreter.pauseExecution();
        }
        else {
            if (this.interpreter.isFinishedExecuting) {
                this.assemble();
            }
            else {
                this.interpreter.resumeExecution();
                this.editor.setOption("readOnly", "nocursor");
                this.editor.refresh();
            }
        }
    };
    MainController.prototype.step = function () {
        this.$rootScope.$emit("memoryUpdate", -1);
        this.interpreter.step();
    };
    MainController.prototype.codemirrorLoaded = function (editor) {
        var _this = this;
        this.editor = editor;
        window["editor"] = editor;
        this.assemblyDocument = new CodeMirror.Doc(this.defaultCode);
        this.mcdscriptDocument = new CodeMirror.Doc(this.defaultmcdScript);
        this.editor.swapDoc(this.assemblyDocument);
        this.editor.refresh();
        this.editor.on("gutterClick", this.codeEditorGutterClick.bind(this));
        this.editor.on("change", this.rebuildBreakPoints.bind(this));
        this.editor.on("change", this.markComments.bind(this));
        this.editor.on("change", function () {
            clearTimeout(_this.lintTimeout);
            _this.lintTimeout = setTimeout(_this.lintCode.bind(_this), 500);
        });
    };
    MainController.prototype.codeEditorGutterClick = function (instance, line, gutter, clickEvent) {
        if (gutter == "CodeMirror-linenumbers")
            return;
        if (!this.breakpoints[line]) {
            var icon = document.createElement("i");
            icon.innerHTML = '<div style="padding: 2px 0 0 4px"><i class="fa fa-circle text-danger"></i></div>';
            instance.setGutterMarker(line, gutter, icon);
            this.breakpoints[line] = true;
        }
        else {
            instance.setGutterMarker(line, gutter, undefined);
            this.breakpoints[line] = false;
        }
    };
    MainController.prototype.rebuildBreakPoints = function () {
        var _this = this;
        this.breakpoints = [];
        var lineNum = 0;
        this.editor.getDoc().eachLine(function (l) {
            if (_this.editor.lineInfo(l)['gutterMarkers'] && _this.editor.lineInfo(l)['gutterMarkers']['breakpoint-gutter']) {
                _this.breakpoints[lineNum] = true;
            }
            // console.log(lineNum, l, this.editor.lineInfo(l), this.breakpoints[lineNum])
            lineNum++;
        });
    };
    MainController.prototype.safeApply = function (fn) {
        var phase = this.$scope.$root.$$phase;
        if (phase == '$apply' || phase == '$digest') {
            if (fn && (typeof (fn) === 'function')) {
                fn();
            }
        }
        else {
            this.$scope.$apply(fn);
        }
    };
    ;
    MainController.prototype.switchDocument = function () {
        this.currentEditorView = this.currentEditorView == 'assembly' ? "mcdscript" : "assembly";
        if (this.currentEditorView == "assembly")
            this.editor.swapDoc(this.assemblyDocument);
        else
            this.editor.swapDoc(this.mcdscriptDocument);
        var options = this.mcdScriptEditorOptions;
        if (this.currentEditorView == 'assembly') {
            options = this.defaultEditorOptions;
        }
        for (var key in options) {
            var val = options[key];
            this.editor.setOption(key, val);
        }
        this.lintCode();
    };
    return MainController;
}());
MainController.$inject = ["$scope", "$rootScope"];
app.controller("MainController", MainController);
app.directive('ngAllowTab', function () {
    return function (scope, element, attrs) {
        element.bind('keydown', function (event) {
            if (event.which == 9) {
                event.preventDefault();
                var start = this.selectionStart;
                var end = this.selectionEnd;
                element.val(element.val().substring(0, start)
                    + '\t' + element.val().substring(end));
                this.selectionStart = this.selectionEnd = start + 1;
                element.triggerHandler('change');
            }
        });
    };
});
app.directive('memoryTable', function () {
    return {
        restrict: 'A',
        scope: {
            memory: '=',
            viewtype: "="
        },
        template: "\n\t\t<div class=\"mariejs-memoryTable\">\n\t\t\t<table class=\"header\">\n\t\t\t\t<thead>\n\t\t\t\t\t<tr>\n\t\t\t\t\t\t<th></th>\n\t\t\t\t\t\t<th ng-repeat=\"col in cols\">+{{col | toHex}}</th>\n\t\t\t\t\t</tr>\n\t\t\t\t</thead>\n\t\t\t</table>\n\t\t\t<div class=\"scrollable\">\n\t\t\t\t<table class=\"table-striped\">\n\t\t\t\t\t<tbody>\n\t\t\t\t\t\t<tr ng-repeat=\"row in rows\">\n\t\t\t\t\t\t\t<th>{{row | toHex | padHex:3}}</th>\n\t\t\t\t\t\t\t<td ng-repeat=\"col in cols\" ng-class=\"{flash:WRITE == row+col,green:MAR == col + row,red:PC == col + row}\">\n\t\t\t\t\t\t\t\t<span ng-show=\"viewtype == 'HEX'\">{{memory[row + col] | toHex | padHex:4}}</span>\n\t\t\t\t\t\t\t\t<span ng-show=\"viewtype == 'ASCII'\">{{memory[row + col] | toASCII}}</span>\n\t\t\t\t\t\t\t\t<span ng-show=\"viewtype == 'DEC'\">{{memory[row + col]}}</span>\n\t\t\t\t\t\t\t</td>\n\t\t\t\t\t\t</tr>\n\t\t\t\t\t</tbody>\n\t\t\t\t</table>\n\t\t\t</div>\n\t\t</div>",
        controller: ["$scope", "$rootScope", function ($scope, $rootScope) {
                $scope['WRITE'] = -1;
                $scope['MAR'] = -1;
                $scope['PC'] = -1;
                function fillMemory() {
                    if (!$scope['memory']) {
                        $scope['memory'] = new Int16Array(2048);
                    }
                    $scope['cols'] = [];
                    for (var i = 0; i < 16; i++) {
                        $scope['cols'].push(i);
                    }
                    $scope['rows'] = [];
                    for (var i = 0; i < $scope['memory'].length; i += 16) {
                        $scope['rows'].push(i);
                    }
                }
                fillMemory();
                $rootScope.$on('memoryUpdate', function (e, address, newValue) {
                    $scope['WRITE'] = address;
                });
                $rootScope.$on('setActiveMemory', function (e, MAR, PC) {
                    $scope['MAR'] = MAR;
                    $scope['PC'] = PC;
                });
            }]
    };
});
app.filter('toASCII', function () { return function (x) {
    return String.fromCharCode(x);
}; });
app.filter('toHex', function () { return function (x) {
    if (x < 0) {
        x = 0xFFFFFFFF + x + 1;
    }
    return (x & 0xFFFF).toString(16).toUpperCase();
}; });
app.filter('padHex', function () { return function (x, padSize) {
    if (padSize === void 0) { padSize = 4; }
    var r = "";
    for (var i = 0; i < padSize - x.length; i++)
        r += "0";
    return r + x;
}; });
app.filter("toDec", function () { return function (num) { return num >> 15 ? 0xFFFFFFFFFFFF0000 | (num & 0xFFFF) : num; }; });
app.filter('numberArrayToString', function () { return function (x) { return x && x.map(function (v) { return String.fromCharCode(v); }).join(""); }; });
app.filter('numberArrayToHex', ["$filter", function ($filter) { return function (x) { x && x.map(function (v) { return "0x" + $filter("toHex")(v); }).join(); }; }]);
app.filter('numberArrayToDecimal', ["$filter", function ($filter) { return function (x) { return x && x.map(function (dec) { return $filter("toDec")(dec); }).join(); }; }]);
