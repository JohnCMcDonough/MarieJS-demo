///<reference path="../typings/tsd.d.ts"/>
var app = angular.module("mariejs", ['ui.codemirror']);
var MainController = (function () {
    function MainController($scope, $rootScope) {
        var _this = this;
        this.$scope = $scope;
        this.$rootScope = $rootScope;
        this.interpreter = new MarieInterpreter();
        this.code = "LOAD a\nADD b\nOUTPUT\nHALT\na, DEC 10\nb, DEC 15";
        this.lineError = -1;
        this.objectError = "";
        this.viewType = "HEX";
        this.debounceTimer = 0;
        this.instructionsCount = 0;
        this.editorOptions = {
            lineWrapping: true,
            lineNumbers: true,
            readOnly: false,
            gutters: ['note-gutter'],
            firstLineNumber: 0,
            lineNumberFormatter: function (ln) { return "0x" + ln.toString(16); }
        };
        this.lintTimeout = 0;
        this.cpuFreq = 500;
        $scope['mc'] = this;
        this.$scope['codemirrorLoaded'] = this.codemirrorLoaded.bind(this);
        this.$scope.$watch('mc.code', function () {
            clearTimeout(_this.lintTimeout);
            _this.lintTimeout = setTimeout(_this.lintCode.bind(_this), 500);
        });
        this.$scope.$watch('mc.cpuFreq', function () {
            _this.interpreter.delayInMS = 1000 / _this.cpuFreq;
        });
        this.interpreter.delayInMS = 1000 / this.cpuFreq;
    }
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
            this.interpreter.lint(this.code);
            this.interpreter.onTick = function () {
                _this.instructionsCount++;
                if (_this.debounceTimer) {
                    clearTimeout(_this.debounceTimer);
                }
                _this.debounceTimer = setTimeout(_this.safeApply.bind(_this), 5);
                var line = _this.interpreter.IRToLine[_this.interpreter.InstructionRegister] - 1;
                if (_this.highlightedLine)
                    _this.editor.removeLineClass(_this.highlightedLine, "background", "active-line");
                _this.highlightedLine = _this.editor.addLineClass(line, "background", "active-line");
            };
            this.interpreter.onOutput = function () {
                // this.safeApply();
            };
            this.interpreter.onMemoryChangedDelegate = function (mar, mbr) {
                _this.$rootScope.$emit('memoryUpdate', mar, mbr);
            };
            this.interpreter.onExecutionFinished = function () {
                console.info(_this.interpreter.outputBuffer);
            };
        }
        catch (err) {
            this.codeErrors = err.map(function (err) {
                err.lineNumber--;
                var eString = "Error on Line 0x" + err.lineNumber.toString(16) + ": " + err.errorstring;
                _this.objectError = (err).object;
                if (_this.editor) {
                    var line = _this.editor.getDoc().getLine(err.lineNumber);
                    var char = line.indexOf(_this.objectError);
                    if (char != -1)
                        _this.editor.getDoc().markText({ line: err.lineNumber, ch: char }, { line: err.lineNumber, ch: char + _this.objectError.length }, { className: "line-error" });
                    else {
                        _this.editor.getDoc().markText({ line: err.lineNumber, ch: 0 }, { line: err.lineNumber, ch: line.length }, { className: "line-error" });
                    }
                }
                return eString;
            });
        }
        this.safeApply();
    };
    MainController.prototype.assemble = function () {
        this.lintCode();
        if (this.editor && this.highlightedLine)
            this.editor.removeLineClass(this.highlightedLine, "background", "active-line");
        if (this.codeErrors.length == 0) {
            this.interpreter.performFullCompile(this.code);
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
            }
        }
    };
    MainController.prototype.codemirrorLoaded = function (editor) {
        this.editor = editor;
        if (!editor.options.gutters)
            editor.gutters = [];
        editor.options.gutters.push("note-gutter");
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
    MainController.$inject = ["$scope", "$rootScope"];
    return MainController;
})();
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
        template: "\n\t\t<div class=\"mariejs-memoryTable\">\n\t\t\t<table class=\"header\">\n\t\t\t\t<thead>\n\t\t\t\t\t<tr>\n\t\t\t\t\t\t<th></th>\n\t\t\t\t\t\t<th ng-repeat=\"col in cols\">+{{col | toHex}}</th>\n\t\t\t\t\t</tr>\n\t\t\t\t</thead>\n\t\t\t</table>\n\t\t\t<div class=\"scrollable\">\n\t\t\t\t<table class=\"table-striped\">\n\t\t\t\t\t<tbody>\n\t\t\t\t\t\t<tr ng-repeat=\"row in rows\">\n\t\t\t\t\t\t\t<th>{{row | toHex | padHex:3}}</th>\n\t\t\t\t\t\t\t<td ng-repeat=\"col in cols\" ng-class=\"{flash:onChange[row+col]}\">\n\t\t\t\t\t\t\t\t<span ng-show=\"viewtype == 'HEX'\">{{memory[row + col] | toHex | padHex:4}}</span>\n\t\t\t\t\t\t\t\t<span ng-show=\"viewtype == 'ASCII'\">{{memory[row + col] | toASCII}}</span>\n\t\t\t\t\t\t\t\t<span ng-show=\"viewtype == 'DEC'\">{{memory[row + col]}}</span>\n\t\t\t\t\t\t\t</td>\n\t\t\t\t\t\t</tr>\n\t\t\t\t\t</tbody>\n\t\t\t\t</table>\n\t\t\t</div>\n\t\t</div>",
        controller: ["$scope", "$rootScope", function ($scope, $rootScope) {
                $scope['onChange'] = {};
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
                    $scope['onChange'][address] = true;
                    setTimeout(function () {
                        $scope['onChange'][address] = false;
                        $scope.$apply();
                    }, 50);
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
app.filter('numberArrayToString', function () { return function (x) { return x && x.map(function (v) { return String.fromCharCode(v); }).join(""); }; });
