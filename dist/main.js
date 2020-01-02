/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./app/Controller/MainController.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./app/Controller/CodeController.js":
/*!******************************************!*\
  !*** ./app/Controller/CodeController.js ***!
  \******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return CodeController; });
/* harmony import */ var _Model_CodeModel_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Model/CodeModel.js */ "./app/Model/CodeModel.js");
/* harmony import */ var _View_codeView_CodeView_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../View/codeView/CodeView.js */ "./app/View/codeView/CodeView.js");
/* harmony import */ var _View_codeView_ToBeautifulSyntax_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../View/codeView/ToBeautifulSyntax.js */ "./app/View/codeView/ToBeautifulSyntax.js");
/* harmony import */ var file_saver__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! file-saver */ "./node_modules/file-saver/dist/FileSaver.min.js");
/* harmony import */ var file_saver__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(file_saver__WEBPACK_IMPORTED_MODULE_3__);




class CodeController {

  constructor(mainController) {
    this.mainController = mainController;
    this.codeModel = new _Model_CodeModel_js__WEBPACK_IMPORTED_MODULE_0__["default"]();
    this.codeView = new _View_codeView_CodeView_js__WEBPACK_IMPORTED_MODULE_1__["default"]();
    this.codeView.addListener(this);
    this.toBeautiful = new _View_codeView_ToBeautifulSyntax_js__WEBPACK_IMPORTED_MODULE_2__["default"]();
    this.notify({
      type: "getData"
    });
    this.notify({
      type: "setEditor"
    });
    this.editor = this.codeView.editor;
    this.initListeners();
  }

  notify(data) {
    switch (data.type) {
      case "getData":
        this.getXsd();
        this.getIbisdoc();
        this.getConfigurations();
        break;
      case "setEditor":
        this.codeView.makeEditor();
        break;
    }
  }

  saveFile() {
    var FileSaver = __webpack_require__(/*! file-saver */ "./node_modules/file-saver/dist/FileSaver.min.js");
    let fileData = this.editor.getModel().getValue();
    var blob = new Blob([fileData], {
      type: "text/xml"
    });
    FileSaver.saveAs(blob, "FrankConfiguration")
  }


  initListeners() {
    let cur = this;
    $('#adapterSelect').on('change', function(e) {
      let adapter = $('#adapterSelect').val();
      cur.editor.getModel().setValue(localStorage.getItem(adapter));
    });

    $('#fileReader').on('change', function(e) {
      var input = event.target;
      console.log(input);

      var reader = new FileReader();
      reader.onload = function() {
        var dataURL = reader.result;
        let xml = atob(dataURL.replace(/[^]*?,/, ''));
        xml = '<Configuration>\n' + xml + '\n</Configuration>'
        cur.editor.setValue(xml);
      }
      reader.readAsDataURL(input.files[0]);
    });

    $('#uploadFile').on('click', function(e) {
      cur.saveFile();
    })

    $('#adapterSelect').on('click', function(e) {
      let adapter = $('#adapterSelect').val();
      localStorage.setItem(adapter, cur.editor.getModel().getValue());
    });

    $('#beautify').click(function() {
      let prettyXML = beautify.xml(cur.editor.getValue(), 4);
      cur.editor.getModel().setValue(prettyXML);
    });

    cur.editor.onMouseDown(function(e) {
      e.target.range.startLineNumber = 1;
      e.target.range.startColumn = 1;
      let textPossition = cur.editor.getModel().getValueInRange(e.target.range);
      let adapters = textPossition.match(/<Adapter[^]*?name=".*?">/g);
      if (adapters != null) {
        let adapterName = adapters[adapters.length - 1].match(/name="[^]*?"/g)[0].match(/"[^]*?"/g)[0].replace(/"/g, '');
        localStorage.setItem("currentAdapter", adapterName);
        cur.mainController.generateFlow();
      }
    })

    this.editor.getModel().onDidChangeContent(function(e) {
      if (!cur.mainController.flowController.flowView.moving && !cur.mainController.flowController.flowView.adding) {
        try {
          $('#canvas').css('display', 'block');
          $('.customErrorMessage').remove();
          cur.mainController.generateFlow();
          // if(editor.getModel().getValue() == "") {
          //   undoDecorations();
          // }
        } catch (error) {
          console.log("error", error);
          cur.mainController.flowController.flowView.modifyFlow("error", error);
        }
      }
    })

    //run the xsd to the xml that is currently in the editor
    $('#runXsd').click(function() {
      let validate = cur.validateConfiguration(),
        lineNumber = 0;
      cur.undoDecorations();
      if (validate.errors !== null) {
        console.log(validate.errors);
        validate.errors.forEach(function(item, index) {
          lineNumber = item.match(/:.*?:/)[0].replace(/:/g, '');
          cur.decorateLine(lineNumber);
        });
      }
    })
  }

  selectPipe(name) {
    this.codeView.selectPipe(name);
  }
  getTypes() {
    return this.codeView.getTypes();
  }
  validateConfiguration() {
    return this.codeView.validateConfigurationView.validateConfiguration();
  }
  decorateLine(lineNumber) {
    this.codeView.validateConfigurationView.decorateLine(lineNumber);
  }
  undoDecorations() {
    this.codeView.validateConfigurationView.undoDecorations();
  }
  changeName(oldWord, newWord) {
    this.codeView.changeName(oldWord, newWord);
  }
  changePossition(name, newX, newY) {
    this.codeView.changePossition(name, newX, newY);
  }
  changeExitPossition(name, newX, newY) {
    this.codeView.changeExitPossition(name, newX, newY);
  }
  changeAddForward(name, path) {
    this.codeView.changeAddForward(name, path);
  }
  deleteForward(name, path) {
    this.codeView.deleteForward(name, path);
  }
  changeAddPipe(name, possitions, className) {
    this.codeView.changeAddPipe(name, possitions, className);
  }
  getPipes() {
    return this.codeView.ibisdocJson;
  }


  getIbisdoc() {
    let cur = this;
    fetch('../rest/ibisdoc/ibisdoc.json', {
        method: 'GET'
      })
      .then(response => {
        return response.json()
      })
      .then(data => {
        // Work with JSON data here
        cur.codeView.ibisdocJson = data;
        cur.mainController.setPipes(data);
      })
      .catch(err => {
        // Do something for an error here
        console.log("couldn't load ibisdoc, now switching to default ibisdoc");
        this.getDefaultIbisdoc();
      })
  }

  getDefaultIbisdoc() {
    let cur = this;
    fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.json', {
        method: 'GET'
      })
      .then(response => {
        return response.json()
      })
      .then(data => {
        // Work with JSON data here
        cur.codeView.ibisdocJson = data;
        cur.mainController.setPipes(data);
      })
      .catch(err => {
        // Do something for an error here
        console.log(err);

      })
  }

  getXsd() {
    fetch('../rest/ibisdoc/ibisdoc.xsd', {
        method: 'GET'
      })
      .then(response => {
        return response.text()
      })
      .then(data => {
        // Work with JSON data here
        localStorage.setItem("ibisdocXsd", data);
        console.log("xsd is loaded!, here");
      })
      .catch(err => {
        console.log("couldn't load xsd, now loading deafult xsd", err);
        this.getDefaultXsd();
        // Do something for an error here
      })
  }

  getDefaultXsd() {
    fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.xsd', {
        method: 'GET'
      })
      .then(response => {
        return response.text()
      })
      .then(data => {
        // Work with JSON data here
        localStorage.setItem("ibisdocXsd", data);
        console.log("xsd is loaded!, here");
      })
      .catch(err => {
        console.log("not loaded xsd", err);
        // Do something for an error here
      })
  }

  getConfigurations(secondTry) {
    let cur = this,
      path = '../iaf/api/configurations';
    if (secondTry) {
      path = '../' + path;
    }
    fetch(path, {
        method: 'GET'
      })
      .then(response => {
        return response.text();
      })
      .then(response => {
        let configurations = [],
          dom, obj;
        response.match(/<[cC]onfiguration[^]*?>[^]*?<\/[cC]onfiguration>|<IOS-Adaptering[^]*?>[^]*?<\/IOS-Adaptering>/g).forEach(function(item, index) {
          if (item != null) {
            configurations.push(item);
          } else {
            console.log('unknown configuration encountered');
          }
        })

        return configurations;
      })
      .then(response => {
        response.forEach(function(item, index) {
          if (item.match(/<Configuration/g) == null) {
            if (item.match(/IOS-Adaptering/g) != null) {
              item = item.replace(/IOS-Adaptering/g, 'Configuration');
            }
            response[index] = cur.toBeautiful.toBeautifulSyntax(item);
            localStorage.setItem(index, cur.toBeautiful.toBeautifulSyntax(item));
          } else {
            localStorage.setItem(index, item);
          }

        });
        return response;
      })
      .then(data => {
        // Work with JSON data here
        cur.codeView.addOptions(data);
      })
      .catch(err => {
        if (secondTry) {
          console.log('couldnt load configurations', err)
        } else {
          console.log("configurations path was incorrect, trying other path now...", err);
          //cur.getConfigurations(true);
        }
      })
  }
}


/***/ }),

/***/ "./app/Controller/FlowController.js":
/*!******************************************!*\
  !*** ./app/Controller/FlowController.js ***!
  \******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return FlowController; });
/* harmony import */ var _View_flowView_FlowView_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../View/flowView/FlowView.js */ "./app/View/flowView/FlowView.js");
/* harmony import */ var _View_flowView_PaletteView_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../View/flowView/PaletteView.js */ "./app/View/flowView/PaletteView.js");



class FlowController {

  constructor(mainController) {
    this.mainController = mainController;
    this.flowView = new _View_flowView_FlowView_js__WEBPACK_IMPORTED_MODULE_0__["default"]();
    this.flowView.addListener(this);
    this.paletteView = new _View_flowView_PaletteView_js__WEBPACK_IMPORTED_MODULE_1__["default"](this);
    this.paletteView.addListener(this);
    this.notify({type: "getPipes"});
    this.hoverSourceWindow = false;
    this.initHandlers();
  }

  notify(data) {
    if (data == null) {
      return;
    };
    switch (data.type) {
      case "convertConfiguration":
        this.flowView.transformedXml = this.mainController.convertConfiguration();
        break;
      case "getTypes":
        this.flowView.types = this.mainController.modifyCode("getTypes");
        break;
      case "changeName":
        this.mainController.modifyCode("changeName", data);
        break;
      case "changeAddPipe":
        this.mainController.modifyCode("changeAddPipe", data);
        break;
      case "changeAddForward":
        this.mainController.modifyCode("changeAddForward", data);
        break;
      case "drag":
        this.mainController.modifyCode("changePossition", data);
        break;
      case "dragExit":
        this.mainController.modifyCode("changeExitPossition", data);
        break;
      case "delete":
        this.mainController.modifyCode("deleteForward", data);
        break;
    }
  }

  initHandlers() {
    let cur = this;
    $('#addPipe').click(function() {
      cur.flowView.modifyFlow('add', {name: "newPipe", className: "customPipe"});
    });

    $('#downloadLink').click(function() {
      cur.flowView.getImage();
    })

    $('#setData').click(function() {
      cur.flowView.generateFlow(cur.flowView);
    });

    $('#lineChanges').click(function() {
      cur.flowView.toggleConnectorType(cur.flowView);
    });

    //toggle building the flow in horizontal mode.
    $('#toggleH').click(function() {
      let horizontalBuild = cur.flowView.horizontalBuild;
      if (!horizontalBuild) {
        cur.flowView.horizontalBuild = true;
        $('#toggleH').addClass('selectedItem');
      } else {
        cur.flowView.horizontalBuild = false;
        $('#toggleH').removeClass('selectedItem');
      }
      cur.flowView.generateFlow(cur.flowView);
    });

    //rename a pipe
    $("#canvas").on('dblclick', '#strong', function(e) {
      e.stopPropagation();
      console.log("dblclick!");
      if (this.innerHTML !== "EXIT") {
        cur.flowView.modifyFlow('edit', this);
      }
    });

    jsPlumb.on($('#canvas'), "mouseover", ".sourceWindow", function() {
      $panzoom.panzoom("disable");
    });

    jsPlumb.on($('#canvas'), "mouseout", ".sourceWindow", function() {
      $panzoom.panzoom("enable");
      $('#flowContainer').attr('style', '');
    });

    $('#canvas').on("click", ".sourceWindow", function(e) {
      e.preventDefault();
      cur.mainController.modifyCode("undoDecorations");
      cur.mainController.modifyCode("selectPipe", {
        name: this.lastElementChild.firstElementChild.innerHTML
      })
    })


    //make the bottom container draggable with mouseover
    jsPlumb.on($('#canvas'), "mouseover", ".bottomContainer", function() {
      let sourceDiv = this.parentElement;
      let dragData = {
        disabled: false,
        containment: '#canvas',
        drag: function() {
          //console.log(cur.flowView.modifyFlow);
          cur.flowView.moving = true;
          let dragObj = {
            x: $(sourceDiv).css('left'),
            y: $(sourceDiv).css('top'),
            name: sourceDiv.lastElementChild.firstElementChild.innerHTML
          }
          if ($(sourceDiv).hasClass('exit')) {
            cur.flowView.modifyFlow('dragExit', dragObj);
          } else {
            cur.flowView.modifyFlow('drag', dragObj);
          }
        },
        stop: function(event, ui) {
          cur.flowView.moving = false;
        }
      }
      instance.draggable(sourceDiv, dragData);
      if (instance.isSourceEnabled(sourceDiv)) {
        instance.toggleSourceEnabled(sourceDiv);
      }
      $(this).addClass("element-disabled");
    });


    //when leaving container not draggable
    jsPlumb.on($('#canvas'), "mouseout", ".bottomContainer", function() {
      let sourceDiv = this.parentElement;
      instance.draggable(sourceDiv, {
        disabled: true
      });
      if (!instance.isSourceEnabled(sourceDiv)) {
        instance.toggleSourceEnabled(sourceDiv);
      }
      $(this).removeClass("element-disabled");
    });

    //contain canvas to container.
    var minScaleX = $('#flowContainer').innerWidth();
    var minScaleY = $('#flowContainer').innerHeight();
    let $panzoom = $('#canvas').panzoom({
      minScale: 0.5,
      increment: 0.2
    });

    //make sure panzoom doesn't leave the container.
    $panzoom.on('panzoomend', function(e) {
      var current_pullY = parseInt($('#canvas').css('transform').split(',')[5]);
      var current_pullX = parseInt($('#canvas').css('transform').split(',')[4]);
      if (current_pullX >= 0) {
        $panzoom.panzoom('pan', 0, current_pullY);
      }
      if (current_pullY <= -Math.abs($('#canvas').css('height').replace('px', '')) + 1000) {
        $panzoom.panzoom('pan', current_pullX, -Math.abs($('#canvas').css('height').replace('px', '')) + 1000);
      }
      if (current_pullX <= -1540) {
        $panzoom.panzoom('pan', -1540, current_pullY);
      }
      if (current_pullY >= 0) {
        $panzoom.panzoom('pan', current_pullX, 0);
      }
      $('#flowContainer').attr('style', '');
    });

    //make zoom possible
    $panzoom.parent().on('mousewheel.focal', function(e) {
      if (!e.shiftKey) return;
      e.preventDefault();
      var delta = e.delta || e.originalEvent.wheelDelta;
      var zoomOut = delta ? delta < 0 : e.originalEvent.deltaY > 0;
      $panzoom.panzoom('zoom', zoomOut, {
        increment: 0.1,
        focal: e
      });
    });
  }
}


/***/ }),

/***/ "./app/Controller/MainController.js":
/*!******************************************!*\
  !*** ./app/Controller/MainController.js ***!
  \******************************************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _Model_ConfigurationConverter_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Model/ConfigurationConverter.js */ "./app/Model/ConfigurationConverter.js");
/* harmony import */ var _CodeController_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./CodeController.js */ "./app/Controller/CodeController.js");
/* harmony import */ var _FlowController_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./FlowController.js */ "./app/Controller/FlowController.js");





class MainController {

  constructor() {
    this.configurationConverter = new _Model_ConfigurationConverter_js__WEBPACK_IMPORTED_MODULE_0__["default"]();
    this.codeController = new _CodeController_js__WEBPACK_IMPORTED_MODULE_1__["default"](this);
    this.flowController = new _FlowController_js__WEBPACK_IMPORTED_MODULE_2__["default"](this);
    console.log(window.webkitRequestFileSystem);
  }

  convertConfiguration() {
    return this.configurationConverter.convertConfiguration(this.codeController.codeView.editor);
  }

  generateFlow() {
    this.flowController.flowView.modifyFlow("generate");
  }
  setPipes(data) {
    this.flowController.paletteView.generatePalettePipes(data[2].classes);
  }

  modifyCode(type, obj) {
    let codeController = this.codeController;
    switch (type) {
      case "getTypes":
        return codeController.getTypes();
        break;
      case "validateConfiguration":
        return codeController.validateConfiguration();
        break;
      case "decorateLine":
        codeController.decorateLine(obj.line);
        break;
      case "undoDecorations":
        codeController.undoDecorations();
        break;
      case "changeName":
        codeController.changeName(obj.oldTitle, obj.newTitle);
        break;
      case "changePossition":
        codeController.changePossition(obj.name, obj.x, obj.y);
        break;
      case "changeExitPossition":
        codeController.changeExitPossition(obj.name, obj.x, obj.y);
        break;
      case "changeAddForward":
        codeController.changeAddForward(obj.source, obj.target);
        break;
      case "deleteForward":
        codeController.deleteForward(obj.name, obj.target);
        break;
      case "changeAddPipe":
        codeController.changeAddPipe(obj.name, obj.possitions, obj.className);
        break;
      case "selectPipe":
        codeController.selectPipe(obj.name);
        break;
    }
  }
}


let mainController = new MainController();


/***/ }),

/***/ "./app/Model/CodeModel.js":
/*!********************************!*\
  !*** ./app/Model/CodeModel.js ***!
  \********************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return CodeModel; });
class CodeModel {
  constructor() {
    this.initAdapter();
  }

  initAdapter() {
    this.adapter = [
      '<Adapter',
      '	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      '	xsi:noNamespaceSchemaLocation="https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.xsd"',
      '	name="HelloWorld" ',
      '	description="Voorbeeld adapter">',

      '	<Receiver name="HelloWorld">',
      '		<ApiListener name="HelloWorld"',
      '			uriPattern="helloworld/{inputString}"',
      '			method = "get"',
      '		/>',
      '	</Receiver>',

      '	<Pipeline firstPipe="SwitchInput">',
      '		<XmlSwitchPipe name="SwitchInput"',
      '			getInputFromFixedValue="&lt;dummy/&gt;"',
      '			xpathExpression="$input" x="436" y="131">',
      '			<Param name="input" sessionKey="inputString"></Param>',
      '		</XmlSwitchPipe>\n\n',
      '		<FixedResultPipe',
      '			name="NFHelloWorld"',
      '			returnString="Hallo Ricardo !"',
      '		 	x="863" y="228">',
      '			<Forward name="success" path="Exit"/>',
      '		</FixedResultPipe>\n',

      '		<Exit path="ServerError" state="error" code="500"/>',
      '		<Exit path="Exit" state="success" code="201"/>',
      '	</Pipeline>',
      '</Adapter>'
    ];
  }
}


/***/ }),

/***/ "./app/Model/ConfigurationConverter.js":
/*!*********************************************!*\
  !*** ./app/Model/ConfigurationConverter.js ***!
  \*********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return ConfigurationConverter; });
class ConfigurationConverter {

  // a function that converts the xml to a readable json format and then generates a flow
  convertConfiguration(editor) {
    let value = editor.getValue();
    value = value.replace(/<[^\/][\S]*?[^"\/]Pipe/g, "<pipe");
    value = value.replace(/<[\/][\S]*?[^"\/]Pipe/g, "</pipe").replace(/&/g, '');
    value = value.replace(/<!--[^]*?-->/g, '')
    var getXml = new DOMParser();
    let xml = getXml.parseFromString(value, "text/xml");
    let transformedXml = JSON.parse(this.xml2json(xml).replace('undefined', ''));

    if (transformedXml.Configuration.Module == null && transformedXml.Configuration.Adapter != null) {
      transformedXml.Adapter = transformedXml.Configuration.Adapter;
    } else {
	      if(Array.isArray(transformedXml.Configuration.Module)) {
	      transformedXml.Configuration.Module.forEach(function(item, index) {
	        if (Array.isArray(item.Adapter)) {
	          item.Adapter.forEach(function(item, index) {
	            if (item["@name"] != null && item["@name"] == localStorage.getItem("currentAdapter")) {
	              transformedXml.Adapter = item;
	            }
	          })
	        } else {
	          if (item.Adapter != null && item.Adapter["@name"] != null && item.Adapter["@name"] == localStorage.getItem("currentAdapter")) {
	            transformedXml = item;
	          }
	        }
	      });
	    } else {
	    	transformedXml.Adapter = transformedXml.Configuration.Module.Adapter;
	    }
    }
    return transformedXml;
  }

  domParse(xml) {
    var getXml = new DOMParser();
    let domXml = getXml.parseFromString(xml, "text/xml");
    return domXml;
  }

  /*	This work is licensed under Creative Commons GNU LGPL License.

  License: http://creativecommons.org/licenses/LGPL/2.1/
   Version: 0.9
  Author:  Stefan Goessner/2006
  Web:     http://goessner.net/
  */
  xml2json(xml, tab) {
    var X = {
      toObj: function(xml) {
        var o = {};
        if (xml.nodeType == 1) { // element node ..
          if (xml.attributes.length) // element with attributes  ..
            for (var i = 0; i < xml.attributes.length; i++)
              o["@" + xml.attributes[i].nodeName] = (xml.attributes[i].nodeValue || "").toString();
          if (xml.firstChild) { // element has child nodes ..
            var textChild = 0,
              cdataChild = 0,
              hasElementChild = false;
            for (var n = xml.firstChild; n; n = n.nextSibling) {
              if (n.nodeType == 1) hasElementChild = true;
              else if (n.nodeType == 3 && n.nodeValue.match(/[^ \f\n\r\t\v]/)) textChild++; // non-whitespace text
              else if (n.nodeType == 4) cdataChild++; // cdata section node
            }
            if (hasElementChild) {
              if (textChild < 2 && cdataChild < 2) { // structured element with evtl. a single text or/and cdata node ..
                X.removeWhite(xml);
                for (var n = xml.firstChild; n; n = n.nextSibling) {
                  if (n.nodeType == 3) // text node
                    o["#text"] = X.escape(n.nodeValue);
                  else if (n.nodeType == 4) // cdata node
                    o["#cdata"] = X.escape(n.nodeValue);
                  else if (o[n.nodeName]) { // multiple occurence of element ..
                    if (o[n.nodeName] instanceof Array)
                      o[n.nodeName][o[n.nodeName].length] = X.toObj(n);
                    else
                      o[n.nodeName] = [o[n.nodeName], X.toObj(n)];
                  } else // first occurence of element..
                    o[n.nodeName] = X.toObj(n);
                }
              } else { // mixed content
                if (!xml.attributes.length)
                  o = X.escape(X.innerXml(xml));
                else
                  o["#text"] = X.escape(X.innerXml(xml));
              }
            } else if (textChild) { // pure text
              if (!xml.attributes.length)
                o = X.escape(X.innerXml(xml));
              else
                o["#text"] = X.escape(X.innerXml(xml));
            } else if (cdataChild) { // cdata
              if (cdataChild > 1)
                o = X.escape(X.innerXml(xml));
              else
                for (var n = xml.firstChild; n; n = n.nextSibling)
                  o["#cdata"] = X.escape(n.nodeValue);
            }
          }
          if (!xml.attributes.length && !xml.firstChild) o = null;
        } else if (xml.nodeType == 9) { // document.node
          o = X.toObj(xml.documentElement);
        }
        return o;
      },
      toJson: function(o, name, ind) {
        var json = name ? ("\"" + name + "\"") : "";
        if (o instanceof Array) {
          for (var i = 0, n = o.length; i < n; i++)
            o[i] = X.toJson(o[i], "", ind + "\t");
          json += (name ? ":[" : "[") + (o.length > 1 ? ("\n" + ind + "\t" + o.join(",\n" + ind + "\t") + "\n" + ind) : o.join("")) + "]";
        } else if (o == null)
          json += (name && ":") + "null";
        else if (typeof(o) == "object") {
          var arr = [];
          for (var m in o)
            arr[arr.length] = X.toJson(o[m], m, ind + "\t");
          json += (name ? ":{" : "{") + (arr.length > 1 ? ("\n" + ind + "\t" + arr.join(",\n" + ind + "\t") + "\n" + ind) : arr.join("")) + "}";
        } else if (typeof(o) == "string")
          json += (name && ":") + "\"" + o.toString() + "\"";
        else
          json += (name && ":") + o.toString();
        return json;
      },
      innerXml: function(node) {
        var s = ""
        if ("innerHTML" in node)
          s = node.innerHTML;
        else {
          var asXml = function(n) {
            var s = "";
            if (n.nodeType == 1) {
              s += "<" + n.nodeName;
              for (var i = 0; i < n.attributes.length; i++)
                s += " " + n.attributes[i].nodeName + "=\"" + (n.attributes[i].nodeValue || "").toString() + "\"";
              if (n.firstChild) {
                s += ">";
                for (var c = n.firstChild; c; c = c.nextSibling)
                  s += asXml(c);
                s += "</" + n.nodeName + ">";
              } else
                s += "/>";
            } else if (n.nodeType == 3)
              s += n.nodeValue;
            else if (n.nodeType == 4)
              s += "<![CDATA[" + n.nodeValue + "]]>";
            return s;
          };
          for (var c = node.firstChild; c; c = c.nextSibling)
            s += asXml(c);
        }
        return s;
      },
      escape: function(txt) {
        return txt.replace(/[\\]/g, "\\\\")
          .replace(/[\"]/g, '\\"')
          .replace(/[\n]/g, '\\n')
          .replace(/[\r]/g, '\\r');
      },
      removeWhite: function(e) {
        e.normalize();
        for (var n = e.firstChild; n;) {
          if (n.nodeType == 3) { // text node
            if (!n.nodeValue.match(/[^ \f\n\r\t\v]/)) { // pure whitespace text node
              var nxt = n.nextSibling;
              e.removeChild(n);
              n = nxt;
            } else
              n = n.nextSibling;
          } else if (n.nodeType == 1) { // element node
            X.removeWhite(n);
            n = n.nextSibling;
          } else // any other node
            n = n.nextSibling;
        }
        return e;
      }
    };
    if (xml.nodeType == 9) // document node
      xml = xml.documentElement;
    var json = X.toJson(X.toObj(X.removeWhite(xml)), xml.nodeName, "\t");
    return "{\n" + tab + (tab ? json.replace(/\t/g, tab) : json.replace(/\t|\n/g, "")) + "\n}";
  }
}


/***/ }),

/***/ "./app/View/ConsoleColorPick.js":
/*!**************************************!*\
  !*** ./app/View/ConsoleColorPick.js ***!
  \**************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return ConsoleColorPick; });
class ConsoleColorPick {
	constructor() {
		
	}
	
	getRedColor() {
		return 'color: #FF0000';
	}
	
	getDefaultColor() {
		return 'background: #222; color: #bada55';
	}
}

/***/ }),

/***/ "./app/View/codeView/CodeCompletionView.js":
/*!*************************************************!*\
  !*** ./app/View/codeView/CodeCompletionView.js ***!
  \*************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return CodeCompletionView; });
class CodeCompletionView {

  constructor(codeView) {
    this.codeView = codeView;
    //this.initProvider();
  }

  // //setup the autocomplete.
  // initProvider() {
  //   let cur = this,
  //     suggestions;
  //   console.log('autocomplete working');
  //   monaco.languages.registerCompletionItemProvider('xml', {
  //     provideCompletionItems: function(model, position) {
  //       // find out if we are completing a property in the 'dependencies' object.
  //       var textUntilPosition = model.getValueInRange({
  //         startLineNumber: 1,
  //         startColumn: 1,
  //         endLineNumber: position.lineNumber,
  //         endColumn: position.column
  //       });
  //       let desiredPipe = textUntilPosition.match(/<[^"\/][\S]*?[pP]ipe/g);
  //       var match = model.getValue().match(/<[\S]*?[^"/][pP]ipe[\s\t\n][^]*?>[^]*?<[/][\S]*?[^"/]Pipe>/g);
  //       if (match == null || desiredPipe == null) {
  //         return;
  //       }
  //       desiredPipe = desiredPipe[desiredPipe.length - 1].replace(/</g, '');
  //       match.forEach(function(item, index) {
  //         let line = model.getLineContent(position.lineNumber - 1);
  //         if (item.indexOf(line) != -1) {
  //           suggestions = cur.createPipeAutoComplete();
  //         } else {
  //           suggestions = cur.createAttributeAutocomplete(desiredPipe);
  //         }
  //       });
  //       return {
  //         suggestions: suggestions
  //       };
  //     }
  //   });
  // }
  //
  // createPipeAutoComplete() {
  //   let pipe, obj = null;
  //   let arr = [];
  //
  //   if (this.codeView.ibisdocJson != null) {
  //     this.ibisdocJson = this.codeView.ibisdocJson;
  //     this.ibisdocJson[2].classes.forEach(function(item, index) {
  //       pipe = item;
  //       obj = {
  //         label: pipe.name.replace(/^((?!Pipe).)*$/, pipe.name + "Pipe"),
  //         kind: monaco.languages.CompletionItemKind.Function,
  //         documentation: pipe.packageName,
  //         insertText: '<' + pipe.name + ' name="yourPipe"> \n </' + pipe.name + '>'
  //       }
  //       arr.push(obj);
  //     });
  //   }
  //
  //   obj = {
  //     label: 'Forward',
  //     kind: monaco.languages.CompletionItemKind.Function,
  //     documentation: "a forward",
  //     insertText: '<Forward name="forwardName" path="newPath" />'
  //   }
  //   arr.push(obj);
  //   return arr;
  // }
  // createAttributeAutocomplete(selectPipe) {
  //   let arr = [],
  //     obj;
  //   if (this.codeView.ibisdocJson != null) {
  //     this.ibisdocJson = this.codeView.ibisdocJson;
  //     this.ibisdocJson[2].classes.forEach(function(pipe, index) {
  //                 //console.log(pipe.name.length, pipe.name, selectPipe.length);
  //       if (pipe.name == selectPipe) {
  //         pipe.methods.forEach(function(attr, index) {
  //           obj = {
  //             label: attr.name,
  //             kind: monaco.languages.CompletionItemKind.Function,
  //             documentation: attr.description,
  //             insertText: attr.name + '="' + attr.defaultValue + '"'
  //           }
  //           arr.push(obj);
  //         });
  //       }
  //     });
  //   }
  //   return arr;
  // }

  initProvider() {

    this.schemaNode = this.stringToXml(localStorage.getItem('ibisdocXsd').replace(/xs\:/g, '')).childNodes[0];
    console.log(this.schemaNode, "hoi");
    monaco.languages.registerCompletionItemProvider('xml', this.getXmlCompletionProvider(monaco));
  }

  stringToXml(text) {
    var xmlDoc;

    if (window.DOMParser) {
      var parser = new DOMParser();
      xmlDoc = parser.parseFromString(text, 'text/xml');
    } else {
      xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
      xmlDoc.async = false;
      xmlDoc.loadXML(text);
    }
    return xmlDoc;
  }

  getLastOpenedTag(text) {
    // get all tags inside of the content
    var tags = text.match(/<\/*(?=\S*)([a-zA-Z-]+)/g);
    if (!tags) {
      return undefined;
    }
    // we need to know which tags are closed
    var closingTags = [];
    for (var i = tags.length - 1; i >= 0; i--) {
      if (tags[i].indexOf('</') === 0) {
        closingTags.push(tags[i].substring('</'.length));
      } else {
        // get the last position of the tag
        var tagPosition = text.lastIndexOf(tags[i]);
        var tag = tags[i].substring('<'.length);
        var closingBracketIdx = text.indexOf('/>', tagPosition);
        // if the tag wasn't closed
        if (closingBracketIdx === -1) {
          // if there are no closing tags or the current tag wasn't closed
          if (!closingTags.length || closingTags[closingTags.length - 1] !== tag) {
            // we found our tag, but let's get the information if we are looking for
            // a child element or an attribute
            text = text.substring(tagPosition);
            return {
              tagName: tag,
              isAttributeSearch: text.indexOf('<') > text.indexOf('>')
            };
          }
          // remove the last closed tag
          closingTags.splice(closingTags.length - 1, 1);
        }
        // remove the last checked tag and continue processing the rest of the content
        text = text.substring(0, tagPosition);
      }
    }
  }

  getAreaInfo(text) {
    // opening for strings, comments and CDATA
    var items = ['"', '\'', '<!--', '<![CDATA['];
    var isCompletionAvailable = true;
    // remove all comments, strings and CDATA
    text = text.replace(/"([^"\\]*(\\.[^"\\]*)*)"|\'([^\'\\]*(\\.[^\'\\]*)*)\'|<!--([\s\S])*?-->|<!\[CDATA\[(.*?)\]\]>/g, '');
    for (var i = 0; i < items.length; i++) {
      var itemIdx = text.indexOf(items[i]);
      if (itemIdx > -1) {
        // we are inside one of unavailable areas, so we remote that area
        // from our clear text
        text = text.substring(0, itemIdx);
        // and the completion is not available
        isCompletionAvailable = false;
      }
    }
    console.log("completion available: ", isCompletionAvailable, text)
    return {
      isCompletionAvailable: isCompletionAvailable,
      clearedText: text
    };
  }

  shouldSkipLevel(tagName) {
    // if we look at the XSD schema, these nodes are containers for elements,
    // so we can skip that level
    return tagName === 'complexType' || tagName === 'all' || tagName === 'sequence';
  }

  findElements(elements, elementName) {
    for (var i = 0; i < elements.length; i++) {
      // we are looking for elements, so we don't need to process annotations and attributes
      if (elements[i].tagName !== 'annotation' && elements[i].tagName !== 'attribute') {
        // if it is one of the nodes that do not have the info we need, skip it
        // and process that node's child items
        if (this.shouldSkipLevel(elements[i].tagName)) {
          var child = this.findElements(elements[i].children, elementName);
          // if child exists, return it
          if (child) {
            return child;
          }
        }
        // if there is no elementName, return all elements (we'll explain
        // this bit little later
        else if (!elementName) {
          return elements;
        }
        // find all the element attributes, and if is't name is the same
        // as the element we're looking for, return the element.
        else if (this.getElementAttributes(elements[i]).name === elementName) {
          return elements[i];
        }
      }
    }
  }

  findAttributes(elements) {
    var attrs = [];
    for (var i = 0; i < elements.length; i++) {
      // skip level if it is a 'complexType' tag
      if (elements[i].tagName === 'complexType') {
        var child = this.findAttributes(elements[i].children);
        if (child) {
          return child;
        }
      }
      // we need only those XSD elements that have a
      // tag 'attribute'
      else if (elements[i].tagName === 'attribute') {
        attrs.push(elements[i]);
      }
    }
    return attrs;
  }

  getElementAttributes(element) {
    var attrs = {};
    for (var i = 0; i < element.attributes.length; i++) {
      attrs[element.attributes[i].name] = element.attributes[i].value;
    }
    // return all attributes as an object
    return attrs;
  }

  getItemDocumentation(element) {
    for (var i = 0; i < element.children.length; i++) {
      // annotaion contains documentation, so calculate the
      // documentation from it's child elements
      if (element.children[i].tagName === 'annotation') {
        return this.getItemDocumentation(element.children[0]);
      }
      // if it's the documentation element, just get the value
      else if (element.children[i].tagName === 'documentation') {
        return element.children[i].textContent;
      }
    }
  }

  isItemAvailable(itemName, maxOccurs, items) {
    // the default for 'maxOccurs' is 1
    maxOccurs = maxOccurs || '1';
    // the element can appere infinite times, so it is availabel
    if (maxOccurs && maxOccurs === 'unbounded') {
      return true;
    }
    // count how many times the element appered
    var count = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i] === itemName) {
        count++;
      }
    }
    // if it didn't appear yet, or it can appear again, then it
    // is available, otherwise it't not
    return count === 0 || parseInt(maxOccurs) > count;
  }

  getAvailableElements(monaco, elements, usedItems) {
    var availableItems = [];
    var children;
    for (var i = 0; i < elements.length; i++) {
      // annotation element only contains documentation,
      // so no need to process it here
      if (elements[i].tagName !== 'annotation') {
        // get all child elements that have 'element' tag
        children = this.findElements([elements[i]])
      }
    }
    // if there are no such elements, then there are no suggestions
    if (!children) {
      return [];
    }
    for (var i = 0; i < children.length; i++) {
      // get all element attributes
      let elementAttrs = this.getElementAttributes(children[i]);
      // the element is a suggestion if it's available
      if (this.isItemAvailable(elementAttrs.name, elementAttrs.maxOccurs, usedItems)) {
        // mark it as a 'field', and get the documentation
        availableItems.push({
          label: elementAttrs.name,
          kind: monaco.languages.CompletionItemKind.Field,
          detail: elementAttrs.type,
          documentation: this.getItemDocumentation(children[i])
        });
      }
    }
    // return the suggestions we found
    return availableItems;
  }

  getAvailableAttribute(monaco, elements, usedChildTags) {
    var availableItems = [];
    var children;
    for (var i = 0; i < elements.length; i++) {
      // annotation element only contains documentation,
      // so no need to process it here
      if (elements[i].tagName !== 'annotation') {
        // get all child elements that have 'attribute' tag
        children = this.findAttributes([elements[i]])
      }
    }
    // if there are no attributes, then there are no
    // suggestions available
    if (!children) {
      return [];
    }
    for (var i = 0; i < children.length; i++) {
      // get all attributes for the element
      var attrs = this.getElementAttributes(children[i]);
      // accept it in a suggestion list only if it is available
      if (this.isItemAvailable(attrs.name, attrs.maxOccurs, usedChildTags)) {
        // mark it as a 'property', and get it's documentation
        availableItems.push({
          label: attrs.name,
          kind: monaco.languages.CompletionItemKind.Property,
          detail: attrs.type,
          documentation: this.getItemDocumentation(children[i])
        });
      }
    }
    // return the elements we found
    return availableItems;
  }

  getXmlCompletionProvider(monaco) {
    let cur = this;
    return {
      triggerCharacters: ['<'],
      provideCompletionItems: function(model, position) {
        // get editor content before the pointer
        var textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        // get content info - are we inside of the area where we don't want suggestions, what is the content without those areas
        var areaUntilPositionInfo = cur.getAreaInfo(textUntilPosition); // isCompletionAvailable, clearedText
        console.log("position: ", areaUntilPositionInfo);
        // if we don't want any suggestions, return empty array
        if (!areaUntilPositionInfo.isCompletionAvailable) {
          return [];
        }
        // if we want suggestions, inside of which tag are we?
        var lastOpenedTag = cur.getLastOpenedTag(areaUntilPositionInfo.clearedText);
        console.log("last opened tag: ", lastOpenedTag);
        // get opened tags to see what tag we should look for in the XSD schema
        var openedTags = [];
        // get the elements/attributes that are already mentioned in the element we're in
        var usedItems = [];
        var isAttributeSearch = lastOpenedTag && lastOpenedTag.isAttributeSearch;
        // no need to calculate the position in the XSD schema if we are in the root element
        if (lastOpenedTag) {
          // parse the content (not cleared text) into an xml document
          var xmlDoc = cur.stringToXml(model.getValue());
          var lastChild = xmlDoc.lastElementChild;
          console.log(xmlDoc);
          while (lastChild) {
            openedTags.push(lastChild.tagName);
            // if we found our last opened tag
            if (lastChild.tagName === lastOpenedTag.tagName) {
              // if we are looking for attributes, then used items should
              // be the attributes we already used
              if (lastOpenedTag.isAttributeSearch) {
                var attrs = lastChild.attributes;
                for (var i = 0; i < attrs.length; i++) {
                  usedItems.push(attrs[i].nodeName);
                }
              } else {
                // if we are looking for child elements, then used items
                // should be the elements that were already used
                var children = lastChild.children;
                for (var i = 0; i < children.length; i++) {
                  usedItems.push(children[i].tagName);
                }
              }
              break;
            }
            // we haven't found the last opened tag yet, so we move to
            // the next element
            lastChild = lastChild.lastElementChild;
          }
        }
        // find the last opened tag in the schema to see what elements/attributes it can have
        var currentItem = this.schemaNode;
        for (var i = 0; i < openedTags.length; i++) {
          if (currentItem) {
            currentItem = cur.findElements(currentItem.children, openedTags[i]);
          }
        }

        // return available elements/attributes if the tag exists in the schema, or an empty
        // array if it doesn't
        if (isAttributeSearch) {
          // get attributes completions
          return currentItem ? cur.getAvailableAttribute(monaco, currentItem.children, usedItems) : [];
        } else {
          // get elements completions
          return currentItem ? cur.getAvailableElements(monaco, currentItem.children, usedItems) : [];
        }
      }
    }
  }
}


/***/ }),

/***/ "./app/View/codeView/CodeView.js":
/*!***************************************!*\
  !*** ./app/View/codeView/CodeView.js ***!
  \***************************************/
/*! exports provided: logColor, default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "logColor", function() { return logColor; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return CodeView; });
/* harmony import */ var _ValidateConfigurationView_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ValidateConfigurationView.js */ "./app/View/codeView/ValidateConfigurationView.js");
/* harmony import */ var _CodeCompletionView_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./CodeCompletionView.js */ "./app/View/codeView/CodeCompletionView.js");



const logColor = 'background: #222; color: #bada55';

class CodeView {

  constructor() {
    this.listeners = [];
    this.ibisdocJson = null;
    this.decorations = null;
    this.decorations = null;
    this.validateConfigurationView;
    this.CodeCompletionView = new _CodeCompletionView_js__WEBPACK_IMPORTED_MODULE_1__["default"](this);
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  //make the editor.
  makeEditor(adapter) {
    this.editor = monaco.editor.create(document.getElementById('monacoContainer'), {
      value: adapter,
      language: 'xml',
      theme: "vs-dark",
      glyphMargin: true,
      automaticLayout: true
    });
    this.selectPipe("SwitchInput");
    this.validateConfigurationView = new _ValidateConfigurationView_js__WEBPACK_IMPORTED_MODULE_0__["default"](this.editor);
  }

  //function to edit the code in the editor.
  edit(range, name) {
    this.editor.executeEdits("monacoContainer", [{
      range: range,
      text: name
    }]);
  }

  //add options to the dropdown.
  addOptions(adapters) {
    let select = $('#adapterSelect'),
      option,
      name;
    adapters.forEach(function(item, index) {
      name = item.match(/<Configuration[^]*?name=".*?"/g);
      if (name != null) {
        name = name[0].match(/".*?"/g)[0].replace(/"/g, '');
        option = $('<option></option>').attr('value', index).text(name);
        $(select).append(option);
      }
    });
    this.editor.setValue(localStorage.getItem("0"));
  }

  //select a pipe.
  selectPipe(name) {
    let cur = this,
      attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>',
      selectPipe = null,
      matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.match('name="' + name + '"', 'g') !== null) {
        selectPipe = item.range;
      }
    });
    if (selectPipe == null) {
      return selectPipe;
    }
    this.decorations = this.editor.deltaDecorations([], [{
      range: selectPipe,
      options: {
        inlineClassName: 'myContentClass'
      }
    }]);
  }

  //change the name.
  changeName(oldWord, newWord) {
    let changed = this.changeNameCode('<[\\S]*?[^"/][pP]ipe(\\n\\t*)?\\s?name="\\w*"', oldWord, newWord);
    if (changed) {
      this.changeNameCode('<forward(\\n\\t*)?(\\s\\w*="(\\s?\\S)*"(\\n\\t*)?)*\\/>', oldWord, newWord);
    }
  }

  //change possition for pipes
  changePossition(name, newX, newY) {
    let cur = this;
    let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>|Receiver[\\s\\t\\n][^]*?>';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    name = name.replace('(receiver): ', '');
    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.split('"').find(word => word === name)) {
        let newPipe = "";
        if (pipe.split(/[\s=]/).find(word => word == 'x')) {
          pipe = pipe.replace(new RegExp('x="[0-9]*"', 'g'), 'x="' + newX + '"');
          pipe = pipe.replace(new RegExp('y="[0-9]*"', 'g'), 'y="' + newY + '"');
        } else {
          let str = ' x="' + newX + '" y="' + newY + '"';
          if (pipe.indexOf('/>') != -1) {
            pipe = pipe.slice(0, pipe.indexOf('/')) + str + pipe.slice(pipe.indexOf('/'));
          } else {
            pipe = pipe.slice(0, pipe.indexOf('>')) + str + pipe.slice(pipe.indexOf('>'));
          }
        }
        cur.edit(item.range, pipe);
      }
    });
  }

  //change the possitions for the exits
  changeExitPossition(name, newX, newY) {
    let cur = this;
    let adapterName = $('#canvas').text().match(/Adapter:\s.*?\s/g)[0].replace(/Adapter:\s/g, '').replace(' ', '');
    let attributeObjectRegex = '<Adapter[^>]*? name="' + localStorage.getItem("currentAdapter") + '"[\\s\\S\\n]*?<Exit [^]*?\\/>';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

    matches.forEach(function(item, index) {
      let exit = cur.editor.getModel().getValueInRange(item.range);
      exit = exit.match('<Exit [^]*?\\/>')[0];
      if (exit.indexOf('path="' + name + '"') != -1) {
        if (exit.indexOf('x="') != -1) {
          exit = '\t\t' + exit.replace(/x="[0-9]*?"/g, 'x="' + newX + '"')
            .replace(/y="[0-9]*?"/g, 'y="' + newY + '"');
        } else {
          let str = ' x="' + newX + '" y="' + newY + '"'
          exit = '\t\t' + exit.slice(0, exit.indexOf('/')) + str + exit.slice(exit.indexOf('/'));
        }
        item.range.startLineNumber = item.range.endLineNumber;
        cur.edit(item.range, exit);
      }
    });
  }

  //change the name of an pipe
  changeNameCode(reg, oldWord, newWord) {
    let cur = this;
    let editor = this.editor;
    let changed = false;
    let attributeObjectRegex = reg;
    let matches = editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    matches.forEach(function(item, index) {
      let pipe = editor.getModel().getValueInRange(item.range);
      if (pipe.split('"').find(word => word === oldWord)) {
        let newPipe = pipe.replace(new RegExp(oldWord, 'g'), newWord);
        changed = true;
        cur.edit(item.range, newPipe);
      }
    });
    return changed;
  }

  //add a forward
  changeAddForward(name, path) {
    let cur = this;
    let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.split(/[\s>]/).find(word => word === 'name="' + name + '"')) {
        pipe = pipe.slice(0, pipe.search(/<[/][\S]*?[^"/]Pipe/)) + '\t<Forward name="success" path="' + path + '"/>';
        let newLineRange = {
          endColumn: 1,
          endLineNumber: item.range.endLineNumber,
          startColumn: 1,
          startLineNumber: item.range.endLineNumber
        }
        cur.edit(newLineRange, '\n');
        cur.edit(item.range, pipe);
      }
    });
  }

  //delete a forward to an pipe.
  deleteForward(name, path) {
    let cur = this;
    let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.split(/[\s>]/).find(word => word === 'name="' + name + '"')) {
        path.toLowerCase() == "exit" ? path = "Exit" : path = path;
        let newPipe = pipe.replace(new RegExp('<Forward[^/]*?path="' + path + '"[^]*?/>', 'gi'), "");
        cur.edit(item.range, newPipe);
      }
    });
  }

  // a method to add a pipe by hand.
  changeAddPipe(name, possitions, className = "customPipe") {
    let cur = this;
    let adapterName = $('#canvas').text().match(/Adapter:\s.*?\s/g)[0].replace(/Adapter:\s/g, '').replace(' ', '');
    let attributeObjectRegex = '<Adapter name="' + localStorage.getItem("currentAdapter") + '"[\\s\\S\\n]*?<Exit';
    let matchString = this.editor.getModel().getValue().match(attributeObjectRegex);

    //'<Exit';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    matches.some(function(item, index) {
      let range = item.range;
      range.startColumn = 1;
      range.endColumn = 1;
      range.startLineNumber = range.endLineNumber
      cur.edit(range, '\n');

      let newPipe = '\t\t\t<' + className + ' name="' + name + '" x="' + possitions.x + '" y="' + possitions.y + '">\n\n\t\t\t</' + className + '>\n';
      cur.edit(range, newPipe);
      return true;
    });
  }

  //gives back the types of pipes with the name of the pipe.
  getTypes() {
    let types = {};
    let value = this.editor.getValue();
    let occurences = value.split(/[<>]/);
    let name, type = null;
    let receiver = value.match(/<Receiver[^]*?name=".*?"[^]*?>/g);
    if (receiver != null) {
      receiver = receiver[0].match(/".*?"/g)[0].replace(/"/g, '');
    } else {
      receiver = 'NO_RECEIVER_FOUND'
    }
    types['"receiver" ' + receiver] = "Receiver"
    occurences.forEach(function(item, index) {
      if (item.search(/[^/][\S]*?[^"/]Pipe[^]*?name=".*?"/) > -1) {
        if (item.charAt(0) != '/') {
          let tag = item.slice(item.search(/[^/][\S]*?[^"/]Pipe[^]*?name=".*?"/));
          if (tag.match(/name=".*?"/) != null) {
            name = tag.match(/name=".*?"/)[0].match(/".*?"/)[0].replace(/"/g, '');
          }
          if (tag.match(/[^]*?Pipe/) != null) {
            type = tag.match(/[^]*?Pipe/)[0];
          }
          if (type !== null && name !== null) {
            types[name] = type;
          }
        }
      }
    })
    return types;
  }
}


/***/ }),

/***/ "./app/View/codeView/ToBeautifulSyntax.js":
/*!************************************************!*\
  !*** ./app/View/codeView/ToBeautifulSyntax.js ***!
  \************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return ToBeautifulSyntax; });
class ToBeautifulSyntax {

  constructor() {
  }

  //convert ugly ibis code to beautiful syntax.
  toBeautifulSyntax(xml) {
    let matches = xml.match(/<pipe(\n\t*)?(\s\w*="(\s?\S)*"(\n\t*)?)*>[^]*?<\/pipe>/g),
      doc = xml,
      exits;
    if (matches == null) return xml;
    matches.forEach(function(item, index) {
      let oldPipe = item,
        newPipe = "";
      let className = oldPipe.match(/className=".*?"/)[0].match(/\.[^.]*?"/)[0].replace(/[".]/g, '');
      if (className.match(/.*?Pipe/) == null) {
        className = className + 'Pipe';
      }
      newPipe = oldPipe.replace(/className=".*?"/g, '');
      newPipe = newPipe.replace(/<pipe/g, '<' + className)
        .replace(/<\/pipe>/, '</' + className + '>')
      doc = doc.replace(oldPipe, newPipe);
    });
    doc = doc.replace(/<listener[^]*?className=".*?"[^]*?\/>/g, function(txt) {
        let className = txt.match(/className=".*?"/)[0].match(/\.[^.]*?"/)[0].replace(/[".]/g, '');
        txt = txt.replace(/className=".*?"/g, '');
        txt = '<' + txt.replace(/<.*? /g, className + " ");
        return txt;
      })
      .replace(/<[\/]?[a-zA-Z]/g, function(txt) {
        return txt.toUpperCase()
      });

    exits = doc.match(/<Exits>[^]*?<\/Exits>/)[0].replace(/<\/?Exits>/g, '').replace(/\t/, '');
    doc = doc.replace(/<Exits>[^]*?<\/Exits>/g, '')
      .replace(/<\/Pipeline>/g, exits + '\n \t\t</Pipeline>')
      .replace(/className=".*?"/g, "");
    
    return doc;
  }
}


/***/ }),

/***/ "./app/View/codeView/ValidateConfigurationView.js":
/*!********************************************************!*\
  !*** ./app/View/codeView/ValidateConfigurationView.js ***!
  \********************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return ValidateConfigurationView; });
class ValidateConfigurationView {

  constructor(editor) {
    this.editor = editor
  }
  //validate the configuration.
  validateConfiguration() {
    let cur = this;
    let validate = xmllint.validateXML({
      xml: cur.editor.getValue().replace(/\sx=".*?"/g, '').replace(/\sy=".*?"/g, ''),
      schema: localStorage.getItem("ibisdocXsd"),
      TOTAL_MEMORY: 16777217
    });
    return validate;
  }

  decorateLine(lineNumber) {
    this.decorations = this.editor.deltaDecorations([], [{
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        glyphMarginClassName: 'myGlyphMarginClass'
      }
    }]);
  }

  //undo all decorations.
  undoDecorations() {
    this.decorations = this.editor.deltaDecorations(this.editor.getModel().getAllDecorations(), [{
      range: new monaco.Range(1, 1, 1, 1),
      options: {}
    }]);
    this.editor.getModel().setValue(this.editor.getModel().getValue());
  }
}


/***/ }),

/***/ "./app/View/flowView/DescriptionView.js":
/*!**********************************************!*\
  !*** ./app/View/flowView/DescriptionView.js ***!
  \**********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return DescriptionView; });
class DescriptionView {

  constructor() {

  }

  addDescription(text, possitions, id) {
    let canvas = $('#canvas');
    let el = $("<div></div>").addClass("description").attr('id', 'description' + id);
    let descriptionText = $('<p></p>').text(text);
    el.append(descriptionText);
    console.log("desc Text:" + text, possitions);
    possitions.x = parseInt(possitions.x) + 300;
    $(el).css('left', possitions.x + 'px');
    $(el).css('top', possitions.y + 'px');
    canvas.append(el);
    instance.draggable(el);
  }
}


/***/ }),

/***/ "./app/View/flowView/FlowGenerator.js":
/*!********************************************!*\
  !*** ./app/View/flowView/FlowGenerator.js ***!
  \********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return FlowGenerator; });
/* harmony import */ var _PipeView_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./PipeView.js */ "./app/View/flowView/PipeView.js");
/* harmony import */ var _ConsoleColorPick_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../ConsoleColorPick.js */ "./app/View/ConsoleColorPick.js");




class FlowGenerator {
  constructor(flowView) {
    this.flowView = flowView;
    this.pipeView = new _PipeView_js__WEBPACK_IMPORTED_MODULE_0__["default"](flowView);
    this.consoleColor = new _ConsoleColorPick_js__WEBPACK_IMPORTED_MODULE_1__["default"]();
  }

  addPipe(name = "pipe" + (this.flowView.windows), possitions, extra = "", isExit, descText) {
    return this.pipeView.addPipe(name, possitions, extra, isExit, descText);
  }

  /*
  # if the pipeline is not null empty the canvas
  # for pipe is not null generate each pipe
  # if there is only one pipe only generate that one
  # push all forwards to the forwards array and generate the forwards
  */
  generateFlow(xml, windows) {
    this.flowView.resetWindows();
    let possitions = null;
    let transformedXml = xml;
    if (transformedXml != null && transformedXml.Adapter != null &&
      transformedXml.Adapter.Pipeline != null) {
      instance.reset();
      $('#canvas').empty();
      if (transformedXml.Adapter.Pipeline.pipe != null) {
        $('#canvas').text("Adapter: " + transformedXml.Adapter['@name'] + ' ');
        let pipe = transformedXml.Adapter.Pipeline.pipe;
        let forwards = [];
        if (Array.isArray(pipe)) {
          for (let p in pipe) {
            let name = pipe[p]['@name'],
              xpos = pipe[p]['@x'],
              ypos = pipe[p]['@y'],
              extraText = "",
              descText = null;
            possitions = this.checkPossitions(xpos, ypos);
            if (pipe[p]['@xpathExpression'] != null) {
              extraText = pipe[p]['@xpathExpression'].slice(0, 15) + '...';
            } else if (pipe[p].FixedQuerySender != null && pipe[p].FixedQuerySender['@query'] != null) {
              extraText = pipe[p].FixedQuerySender['@query'].slice(0, 15) + '...';
            }
            if(pipe[p].Documentation != null) {
              console.log(pipe[p].Documentation);
              descText = pipe[p].Documentation;
            }

            this.addPipe(name, possitions, extraText, null, descText);
            if (pipe[p].Forward != null) {
              let forwardData = null;
              if (Array.isArray(pipe[p].Forward)) {
                pipe[p].Forward.forEach(function(item, index) {
                  forwardData = {
                    sourcePipe: name,
                    targetPipe: item['@path'],
                    name: item['@name']
                  };
                  forwards.push(forwardData);
                });
              } else {
                forwardData = {
                  sourcePipe: name,
                  targetPipe: pipe[p].Forward['@path'],
                  name: pipe[p].Forward['@name']
                };
                forwards.push(forwardData);
              }
            } else {
              let nextPipe = parseInt(p) + 1;
              if (pipe[nextPipe] != null) {
                let forwardData = {
                  sourcePipe: name,
                  targetPipe: pipe[nextPipe]['@name'],
                  name: "success"
                }
                forwards.push(forwardData);
              }
            }
          }
        } else {
          let name = pipe['@name'];
          this.addPipe(name);
          if (pipe.Forward != null) {
            let forwardData = null;
            if (Array.isArray(pipe.Forward)) {
              pipe.Forward.forEach(function(item, index) {
                forwardData = {
                  sourcePipe: name,
                  targetPipe: item['@path'],
                  name: item['@name']
                };
                forwards.push(forwardData);
              });
            } else {
              forwardData = {
                sourcePipe: name,
                targetPipe: pipe.Forward['@path'],
                name: pipe.Forward['@name']
              };
              forwards.push(forwardData);
            }
          }
        }
        this.addExits(transformedXml.Adapter.Pipeline.Exit);
        if (possitions === null) {
          this.flowView.setOffsets(false);
        } else {
          this.flowView.setOffsets(true);
        }
        if (transformedXml.Adapter.Receiver != null) {
          let forwardData = this.addReceiver(transformedXml, forwards[0].sourcePipe);
          forwards.push(forwardData);
        }
        this.generateForwards(forwards);
      }
    } else {
      this.flowView.displayError(transformedXml);
    }
  }

  //check if possitions exist, if only one possition exists then duplicate the existing possitions.
  checkPossitions(xpos, ypos) {
    if (xpos == null && ypos != null) {
      xpos = ypos;
    } else if (ypos == null && xpos != null) {
      ypos = xpos;
    }
    if (xpos != null && ypos != null) {
      return {
        x: xpos,
        y: ypos
      }
    } else {
      return null;
    }
  }

  //method to add one receiver
  addReceiver(transformedXml, target) {
    this.addPipe('(receiver): ' + transformedXml.Adapter.Receiver['@name'], {
      x: "600",
      y: "400"
    });
    return {
      sourcePipe: '(receiver): ' + transformedXml.Adapter.Receiver['@name'],
      targetPipe: target,
      name: 'request'
    };
  }

  // method to add all exits
  addExits(exits) {
    let exit = exits,
      possitions,
      name,
      ypos,
      xpos;
    if (exit == null) {
      return;
    }
    if (Array.isArray(exit)) {
      let cur = this;
      exit.forEach(function(item, index) {
        name = exit[index]['@path'],
          xpos = exit[index]['@x'],
          ypos = exit[index]['@y'];
        if (xpos != null && ypos != null) {
          possitions = {
            x: xpos,
            y: ypos
          }
        }
        cur.addPipe(name, possitions, "", true);
      });
    } else {
      name = exit['@path'],
        xpos = exit['@x'],
        ypos = exit['@y'];
      if (xpos != null && ypos != null) {
        possitions = {
          x: xpos,
          y: ypos
        }
      }
      this.addPipe(name, possitions, "", true);
    }
  }

  /*
  # a function to search all of the forwards in the transformed json.
  # bind to each connection and update code editor.
  # connect all of the pipes according to the forwards given in this method.
  # @param forwards: a json object with all of the forwards.
  */
  generateForwards(forwards) {
    //when generating set to true and after generating to false.
    let generated = true;
    let cur = this;

    instance.bind("connection", function(i, c) {
      let counter = 0;
      instance.getAllConnections().forEach(function(conn) {
        if (conn.sourceId == i.connection.sourceId && conn.targetId == i.connection.targetId) {
          if (counter < 2) {
            counter++;
          }
        }
      });

      let source = i.sourceEndpoint.element.lastChild.firstElementChild.textContent;
      let target = i.targetEndpoint.element.lastChild.firstElementChild.textContent;
      i.connection.bind("dblclick", function(conn) {
        instance.deleteConnection(conn);
        cur.flowView.modifyFlow('delete', {
          name: source,
          target: target
        });
      })
      //connection already exists so delete the first connection.
      if (counter > 1) {
        instance.getAllConnections().some(function(conn) {
          if (conn.sourceId == i.connection.sourceId && conn.targetId == i.connection.targetId) {
            instance.deleteConnection(conn);
            return true;
          }
        });
        return;
      }

      if (!generated) {
        cur.flowView.modifyFlow('connection', {
          source: source,
          target: target
        });
      }
    });

    //loop over and connect the forwards.
    let sourcePipe = "";
    let targetPipe = "";
    generated = true;
    $(forwards).each(function(index, f) {
      sourcePipe = "";
      targetPipe = "";
      if (f.targetPipe == null) {
        f.targetPipe = f.name;
      }
      $(".sourceWindow").each(function(i, element) {
        var $element = $(element)[0];
        let refactoredText = $element.lastChild.firstChild.innerHTML;
        if (refactoredText == f.sourcePipe) {
          sourcePipe = $($element).attr('id');
        } else if (refactoredText == f.targetPipe) {
          targetPipe = $($element).attr('id');
        }
      });
      let paintStyle = {
        stroke: "#000000",
        strokeWidth: 3
      }
      if (f.name == 'failure' || f.name == 'exception') {
        paintStyle.stroke = "#FF0000";
      } else if (f.name == 'success') {
        paintStyle.stroke = "#22bb33"
      } else if (f.name == "request" || f.name == 'response') {
        paintStyle.dashstyle = "2 4";
      }
      if (sourcePipe != "" && targetPipe != "") {
        instance.connect({
          source: sourcePipe,
          target: targetPipe,
          paintStyle: paintStyle,
          overlays: [
            ["Label", {
              label: f.name,
              id: "label",
              location: 0.1,
              padding: 100
            }]
          ],
          connector: [this.connectorType, {
            stub: [40, 60],
            gap: 10,
            cornerRadius: 5,
            alwaysRespectStubs: true,
            midpoint: 0.0001
          }]
        });
      }
    });
    generated = false;
  }
}


/***/ }),

/***/ "./app/View/flowView/FlowView.js":
/*!***************************************!*\
  !*** ./app/View/flowView/FlowView.js ***!
  \***************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return FlowView; });
/* harmony import */ var _FlowGenerator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./FlowGenerator.js */ "./app/View/flowView/FlowGenerator.js");

class FlowView {

  constructor() {
    this.transformedXml = null;
    this.types = [];
    this.listeners = [];
    this.windows = 0;
    this.moving = false;
    this.adding = false;
    this.connectorType = "Flowchart";
    this.horizontalBuild = false;
    this.flowGenerator = new _FlowGenerator_js__WEBPACK_IMPORTED_MODULE_0__["default"](this);
    this.getInstance();
  }
  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  getImage() {
    var node = document.getElementById('canvas');

    domtoimage.toSvg(node)
      .then(function(dataUrl) {
        var link = document.createElement('a');;
        link.download = localStorage.getItem('currentAdapter') + '.svg';
        link.href = dataUrl;
        link.click();
      })
      .catch(function(error) {
        console.error('oops, something went wrong!', error);
      });
  }

  resetWindows() {
    this.windows = 0;
  }

  getInstance() {
    this.sourceAnchors = [
        "Top", "Right", "Left",
        [0.25, 1, 0, 1],
        [0.5, 1, 0, 1],
        [0.75, 1, 0, 1],
        [1, 1, 0, 1]
      ],
      this.instance = window.instance = jsPlumb.getInstance({
        // drag options
        DragOptions: {
          cursor: "pointer",
          zIndex: 2000
        },
        // default to a gradient stroke from blue to green.
        PaintStyle: {
          stroke: "#000000",
          strokeWidth: 3
        },
        //the arrow overlay for the connection
        ConnectionOverlays: [
          ["Arrow", {
            location: 1,
            visible: true,
            id: "ARROW",
            zIndex: 1000
          }]
        ],
        Container: "canvas"
      });

    let basicType = {
      connector: ["StateMachine", {
        stub: [40, 60],
        gap: 10,
        cornerRadius: 5,
        alwaysRespectStubs: true
      }]
    }
    this.instance.registerConnectionType("basic", basicType);
  }

  /*
   * one function to modify the flow and code at the same time.
   * @param change: insert here the action you want to do.
   * @param obj: insert an object with necessary information.
   */
  modifyFlow(change, obj) {
    switch (change) {
      case "generate":
        this.generateFlow();
        break;
      case 'add':
        this.notifyListeners(this.addCustomPipe(obj.name, obj.className));
        break;
      case 'edit':
        this.notifyListeners(this.editTitle(obj));
        break;
      case 'connection':
        this.adding = true;
        obj.type = "changeAddForward";
        this.notifyListeners(obj);
        this.adding = false;
        break;
      case 'drag':
        obj = this.cleanPossitions(obj);
        obj.type = "drag";
        this.notifyListeners(obj);
        break;
      case 'dragExit':
        obj = this.cleanPossitions(obj);
        obj.type = "dragExit";
        this.notifyListeners(obj);
        break;
      case 'delete':
        obj.type = "delete";
        this.notifyListeners(obj);
        break;
      case "error":
        this.displayError(obj);
        break;
    }
  }

  cleanPossitions(obj) {
    obj.x = obj.x.replace(/px/, '');
    obj.y = obj.y.replace(/px/, '');
    return obj;
  }

  editTitle(pipe) {
    let oldTitle = pipe.innerHTML;
    let newTitle = prompt("What is the new Title?", oldTitle);
    if (newTitle != null) {
      pipe.innerHTML = newTitle;
      return {
        oldTitle: oldTitle,
        newTitle: newTitle
      }
    }
    return null;
  }

  addCustomPipe(name, className) {
    let newPipe = this.addPipe(name, {
      x: 100,
      y: 100
    });

    return {
      type: "changeAddPipe",
      name: newPipe,
      possitions: {
        x: 100,
        y: 100
      },
      className: className
    }
  }

  toggleConnectorType(cur) {
    if (cur.connectorType === "Flowchart") {
      cur.connectorType = "StateMachine";
    } else {
      cur.connectorType = "Flowchart";
    }
    cur.generateFlow();
  }

  addPipe(name, possitions, extra, isExit) {
    return this.flowGenerator.addPipe(name, possitions, extra, isExit);
  }

  getTypes() {
    this.notifyListeners({
      type: "getTypes"
    });
    return this.types;
  }

  // a function to put distance between the pipes
  setOffsets(possitions) {
    let boxOffset = 0;
    let container = null;

    this.moving = true;
    for (let i = 1; i <= this.windows; i++) {
      boxOffset += 250;
      if (!possitions) {
        let box = $('#sourceWindow' + i);
        if (!this.horizontalBuild) {
          box.css("top", boxOffset + "px");
        } else {
          box.css("top", "100px");
          box.css("left", boxOffset + "px");
        }
        this.modifyFlow('drag', {
          name: box[0].lastChild.firstElementChild.textContent,
          x: box.css("left"),
          y: box.css("top")
        })
      }
      let totalLength, windowLength;
      if (!this.horizontalBuild) {
        totalLength = boxOffset + ((64 * i) - 1450);
        windowLength = parseInt($('#canvas').css('height').replace('px', ''));
        if (totalLength > windowLength) {
          $('#canvas').css('height', totalLength);
        }
      } else {
        totalLength = boxOffset + ((64 * i) - 1000);
        windowLength = parseInt($('#canvas').css('width').replace('px', ''));
        if (totalLength > windowLength) {
          $('#canvas').css('width', totalLength);
        }
      }
    }
    this.moving = false;
  }

  generateFlow() {
    this.notifyListeners({
      type: "convertConfiguration"
    });
    this.flowGenerator.generateFlow(this.transformedXml, this.windows);
  }

  displayError(e) {
    instance.reset();
    $('#canvas').empty();
    $('#canvas').css('display', 'none');
    $('.customErrorMessage').remove();
    $('#flowContainer').append($("<h1></h1>").text('Error' + e).addClass('customErrorMessage'));
  }
}


/***/ }),

/***/ "./app/View/flowView/PaletteView.js":
/*!******************************************!*\
  !*** ./app/View/flowView/PaletteView.js ***!
  \******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return PaletteView; });
/* harmony import */ var _PipeView_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./PipeView.js */ "./app/View/flowView/PipeView.js");



class PaletteView {
  constructor(flowController) {
    this.listeners = [];
    this.pipes = null;
    this.flowView = flowController.flowView;
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  generatePalettePipes(pipes) {
    let pipeView = new _PipeView_js__WEBPACK_IMPORTED_MODULE_0__["default"](this.flowView),
    // xmlButton = $('<button></button>').attr('type', 'button').addClass('collapsible listItem').text("xml pipes"),
    // xmlCollaps = $('<div></div>').addClass('content'),
    palette = $('#palette');
    // palette.append(xmlButton, xmlCollaps);
    pipes.forEach(function(item, index) {
      let img,
      strong = $('<strong></strong>').text(item.name),
      button = $('<button></button>').attr('type', 'button').addClass('collapsible listItem'),
      collapsBox = $('<div></div>').addClass('content'),
      buttonText = $('<span></span>').addClass('buttonText').text(item.name);
      img = pipeView.getTypeImage(item.name, true).attr('id', item.name );
      button.append(buttonText);
      collapsBox.append(img);
      // if(item.name.match(/Xml/g) != null) {
      //   xmlCollaps.append(button, collapsBox);
      //   return;
      // }
      palette.append(button, collapsBox);
    });
    this.setHandlers();
  }

  setHandlers() {
    let cur = this;
    var coll = document.getElementsByClassName("collapsible");
    var i;

    for (i = 0; i < coll.length; i++) {
      coll[i].addEventListener("click", function() {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (content.style.display === "block") {
          content.style.display = "none";
        } else {
          content.style.display = "block";
        }
      });
    }

    $('#canvas').on('dragover', function(ev) {
      ev.preventDefault();
      ev.stopPropagation()
    });
    $('#canvas').on('drop', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      let data = localStorage.getItem('dropPipe');
      cur.flowView.modifyFlow("add", {
        name: "new" + data,
        className: data
      });
      //insert pipe in editor
    })
    $('.typeImg').on('dragstart', function(ev) {
      console.log('drag');
      localStorage.setItem("dropPipe", ev.target.id);
    });
  }
}


/***/ }),

/***/ "./app/View/flowView/PipeView.js":
/*!***************************************!*\
  !*** ./app/View/flowView/PipeView.js ***!
  \***************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return PipeView; });
/* harmony import */ var _DescriptionView_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./DescriptionView.js */ "./app/View/flowView/DescriptionView.js");


class PipeView {

  constructor(flowView) {
    this.flowView = flowView;
    this.descriptionView = new _DescriptionView_js__WEBPACK_IMPORTED_MODULE_0__["default"]();
  }

  /*
  # function to manually add a Pipe
  # increment windows and create div
  # make element a source and a target
  # bind to connection
  */

  addPipe(name, possitions, extra, isExit, descText) {
    let flowView = this.flowView;
    let id = flowView.windows += 1;
    let canvas = $('#canvas');
    let el = $("<div></div>").addClass("window sourceWindow").attr("id", "sourceWindow" + id);
    let typeText = $("<strong></strong>").attr("id", "strong").text(flowView.getTypes()[name]);
    let typeWindow = $('<div></div>').addClass("typeWindow").append(this.getTypeImage(name), typeText);
    let bottomContainer = $('<div></div>').addClass("bottomContainer");
    let nameText = $("<strong></strong>").attr("id", "strong").text(name);
    let hr = $('<hr>');
    let extraText = $("<strong></strong>").attr("id", "strong").text(extra);
    isExit ? bottomContainer.append(nameText, extraText) : bottomContainer.append(nameText, hr, extraText);
    el.append(typeWindow, bottomContainer);
    if (possitions != null) {
      $(el).css('left', possitions.x + 'px');
      $(el).css('top', possitions.y + 'px');
      if(descText) {
        this.descriptionView.addDescription(descText, possitions, id);
      }
    }
    
    instance.makeTarget(el, {
        dropOptions: {
          hoverClass: "hover"
        },
        anchor: ["Left", "Top", "Right"],
        endpoint: ["Dot", {
          radius: 11,
          cssClass: "large-green"
        }]
      });
    
    if (isExit) {
      $(el).addClass('exit');
    } else {
	    instance.makeSource(el, {
	      filter: ".enableDisableSource",
	      filterExclude: true,
	      maxConnections: -1,
	      endpoint: ["Dot", {
	        radius: 7,
	        cssClass: "small-blue"
	      }],
	      anchor: flowView.sourceAnchors,
	      connector: [flowView.connectorType, {
	        stub: [40, 60],
	        gap: 10,
	        cornerRadius: 5,
	        alwaysRespectStubs: true,
	        midpoint: 0.0001
	      }]
	    });
    }

    canvas.append(el);
    if(descText) {
    instance.connect({source: "sourceWindow" + id, target: "description" + id});
    }
    return name;
  }

  getTypeImage(name, paletteImg) {
    let types = this.flowView.getTypes(),
      img,
      testImage = new Image(),
      url;
      if(paletteImg) {
        url = 'media/' + name + '.png';
      } else {
      url = 'media/' + types[name] + '.png';
      }
    if (url != null) {
      img = $('<img></img>').attr({
        src: url,
        alt: types[name],
        title: types[name]
      }).addClass("typeImg");
      testImage.src = url;
      testImage.onerror = function() {
        img.attr('src', 'media/basicPipe.png');
      }
      return img;
    }
  }
}


/***/ }),

/***/ "./node_modules/file-saver/dist/FileSaver.min.js":
/*!*******************************************************!*\
  !*** ./node_modules/file-saver/dist/FileSaver.min.js ***!
  \*******************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;(function(a,b){if(true)!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (b),
				__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
				(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));else {}})(this,function(){"use strict";function b(a,b){return"undefined"==typeof b?b={autoBom:!1}:"object"!=typeof b&&(console.warn("Deprecated: Expected third argument to be a object"),b={autoBom:!b}),b.autoBom&&/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a.type)?new Blob(["\uFEFF",a],{type:a.type}):a}function c(b,c,d){var e=new XMLHttpRequest;e.open("GET",b),e.responseType="blob",e.onload=function(){a(e.response,c,d)},e.onerror=function(){console.error("could not download file")},e.send()}function d(a){var b=new XMLHttpRequest;b.open("HEAD",a,!1);try{b.send()}catch(a){}return 200<=b.status&&299>=b.status}function e(a){try{a.dispatchEvent(new MouseEvent("click"))}catch(c){var b=document.createEvent("MouseEvents");b.initMouseEvent("click",!0,!0,window,0,0,0,80,20,!1,!1,!1,!1,0,null),a.dispatchEvent(b)}}var f="object"==typeof window&&window.window===window?window:"object"==typeof self&&self.self===self?self:"object"==typeof global&&global.global===global?global:void 0,a=f.saveAs||("object"!=typeof window||window!==f?function(){}:"download"in HTMLAnchorElement.prototype?function(b,g,h){var i=f.URL||f.webkitURL,j=document.createElement("a");g=g||b.name||"download",j.download=g,j.rel="noopener","string"==typeof b?(j.href=b,j.origin===location.origin?e(j):d(j.href)?c(b,g,h):e(j,j.target="_blank")):(j.href=i.createObjectURL(b),setTimeout(function(){i.revokeObjectURL(j.href)},4E4),setTimeout(function(){e(j)},0))}:"msSaveOrOpenBlob"in navigator?function(f,g,h){if(g=g||f.name||"download","string"!=typeof f)navigator.msSaveOrOpenBlob(b(f,h),g);else if(d(f))c(f,g,h);else{var i=document.createElement("a");i.href=f,i.target="_blank",setTimeout(function(){e(i)})}}:function(a,b,d,e){if(e=e||open("","_blank"),e&&(e.document.title=e.document.body.innerText="downloading..."),"string"==typeof a)return c(a,b,d);var g="application/octet-stream"===a.type,h=/constructor/i.test(f.HTMLElement)||f.safari,i=/CriOS\/[\d]+/.test(navigator.userAgent);if((i||g&&h)&&"object"==typeof FileReader){var j=new FileReader;j.onloadend=function(){var a=j.result;a=i?a:a.replace(/^data:[^;]*;/,"data:attachment/file;"),e?e.location.href=a:location=a,e=null},j.readAsDataURL(a)}else{var k=f.URL||f.webkitURL,l=k.createObjectURL(a);e?e.location=l:location.href=l,e=null,setTimeout(function(){k.revokeObjectURL(l)},4E4)}});f.saveAs=a.saveAs=a, true&&(module.exports=a)});

//# sourceMappingURL=FileSaver.min.js.map
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./node_modules/webpack/buildin/global.js":
/*!***********************************!*\
  !*** (webpack)/buildin/global.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || new Function("return this")();
} catch (e) {
	// This works if the window reference is available
	if (typeof window === "object") g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ })

/******/ });
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vLy4vYXBwL0NvbnRyb2xsZXIvQ29kZUNvbnRyb2xsZXIuanMiLCJ3ZWJwYWNrOi8vLy4vYXBwL0NvbnRyb2xsZXIvRmxvd0NvbnRyb2xsZXIuanMiLCJ3ZWJwYWNrOi8vLy4vYXBwL0NvbnRyb2xsZXIvTWFpbkNvbnRyb2xsZXIuanMiLCJ3ZWJwYWNrOi8vLy4vYXBwL01vZGVsL0NvZGVNb2RlbC5qcyIsIndlYnBhY2s6Ly8vLi9hcHAvTW9kZWwvQ29uZmlndXJhdGlvbkNvbnZlcnRlci5qcyIsIndlYnBhY2s6Ly8vLi9hcHAvVmlldy9Db25zb2xlQ29sb3JQaWNrLmpzIiwid2VicGFjazovLy8uL2FwcC9WaWV3L2NvZGVWaWV3L0NvZGVDb21wbGV0aW9uVmlldy5qcyIsIndlYnBhY2s6Ly8vLi9hcHAvVmlldy9jb2RlVmlldy9Db2RlVmlldy5qcyIsIndlYnBhY2s6Ly8vLi9hcHAvVmlldy9jb2RlVmlldy9Ub0JlYXV0aWZ1bFN5bnRheC5qcyIsIndlYnBhY2s6Ly8vLi9hcHAvVmlldy9jb2RlVmlldy9WYWxpZGF0ZUNvbmZpZ3VyYXRpb25WaWV3LmpzIiwid2VicGFjazovLy8uL2FwcC9WaWV3L2Zsb3dWaWV3L0Rlc2NyaXB0aW9uVmlldy5qcyIsIndlYnBhY2s6Ly8vLi9hcHAvVmlldy9mbG93Vmlldy9GbG93R2VuZXJhdG9yLmpzIiwid2VicGFjazovLy8uL2FwcC9WaWV3L2Zsb3dWaWV3L0Zsb3dWaWV3LmpzIiwid2VicGFjazovLy8uL2FwcC9WaWV3L2Zsb3dWaWV3L1BhbGV0dGVWaWV3LmpzIiwid2VicGFjazovLy8uL2FwcC9WaWV3L2Zsb3dWaWV3L1BpcGVWaWV3LmpzIiwid2VicGFjazovLy8uL25vZGVfbW9kdWxlcy9maWxlLXNhdmVyL2Rpc3QvRmlsZVNhdmVyLm1pbi5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL2J1aWxkaW4vZ2xvYmFsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7UUFBQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTs7O1FBR0E7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtRQUNBLDBDQUEwQyxnQ0FBZ0M7UUFDMUU7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7UUFDQSx3REFBd0Qsa0JBQWtCO1FBQzFFO1FBQ0EsaURBQWlELGNBQWM7UUFDL0Q7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBLHlDQUF5QyxpQ0FBaUM7UUFDMUUsZ0hBQWdILG1CQUFtQixFQUFFO1FBQ3JJO1FBQ0E7O1FBRUE7UUFDQTtRQUNBO1FBQ0EsMkJBQTJCLDBCQUEwQixFQUFFO1FBQ3ZELGlDQUFpQyxlQUFlO1FBQ2hEO1FBQ0E7UUFDQTs7UUFFQTtRQUNBLHNEQUFzRCwrREFBK0Q7O1FBRXJIO1FBQ0E7OztRQUdBO1FBQ0E7Ozs7Ozs7Ozs7Ozs7QUNsRkE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBOEM7QUFDTTtBQUNrQjtBQUdsRDtBQUNMOztBQUVmO0FBQ0E7QUFDQSx5QkFBeUIsMkRBQVM7QUFDbEMsd0JBQXdCLGtFQUFRO0FBQ2hDO0FBQ0EsMkJBQTJCLDJFQUFpQjtBQUM1QztBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLG9CQUFvQixtQkFBTyxDQUFDLG1FQUFZO0FBQ3hDO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQSxLQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTs7QUFFQSxPQUFPO0FBQ1A7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFXO0FBQ1g7QUFDQTtBQUNBLFNBQVM7O0FBRVQ7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFdBQVc7QUFDWDtBQUNBOztBQUVBLFNBQVM7QUFDVDtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBOzs7Ozs7Ozs7Ozs7O0FDclNBO0FBQUE7QUFBQTtBQUFBO0FBQW9EO0FBQ007O0FBRTNDOztBQUVmO0FBQ0E7QUFDQSx3QkFBd0Isa0VBQVE7QUFDaEM7QUFDQSwyQkFBMkIscUVBQVc7QUFDdEM7QUFDQSxpQkFBaUIsaUJBQWlCO0FBQ2xDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxzQ0FBc0MseUNBQXlDO0FBQy9FLEtBQUs7O0FBRUw7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQLEtBQUs7OztBQUdMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBVztBQUNYO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7O0FBR0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0E7Ozs7Ozs7Ozs7Ozs7QUM3TEE7QUFBQTtBQUFBO0FBQUE7QUFBd0U7QUFDdkI7QUFDQTs7O0FBR2pEOztBQUVBO0FBQ0Esc0NBQXNDLHdFQUFzQjtBQUM1RCw4QkFBOEIsMERBQWM7QUFDNUMsOEJBQThCLDBEQUFjO0FBQzVDO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUdBOzs7Ozs7Ozs7Ozs7O0FDbEVBO0FBQUE7QUFBZTtBQUNmO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0Esa0NBQWtDLFlBQVk7QUFDOUM7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxzQ0FBc0MsVUFBVTtBQUNoRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7QUN2Q0E7QUFBQTtBQUFlOztBQUVmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWTtBQUNaLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUixNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdDQUFnQztBQUNoQztBQUNBLDJCQUEyQiwyQkFBMkI7QUFDdEQ7QUFDQSwrQkFBK0I7QUFDL0I7QUFDQTtBQUNBO0FBQ0Esd0NBQXdDLEdBQUc7QUFDM0M7QUFDQSwyRkFBMkY7QUFDM0YscURBQXFEO0FBQ3JEO0FBQ0E7QUFDQSxvREFBb0Q7QUFDcEQ7QUFDQSw0Q0FBNEMsR0FBRztBQUMvQztBQUNBO0FBQ0E7QUFDQTtBQUNBLDJDQUEyQztBQUMzQztBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQjtBQUNuQjtBQUNBO0FBQ0EsZUFBZSxPQUFPO0FBQ3RCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhLHNCQUFzQjtBQUNuQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWEsdUJBQXVCO0FBQ3BDO0FBQ0E7QUFDQTtBQUNBLDRDQUE0QyxHQUFHO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyw4QkFBOEI7QUFDdkM7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBLHVDQUF1QyxPQUFPO0FBQzlDO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDZCQUE2QixNQUFNLDJHQUEyRztBQUM5SSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNkJBQTZCLHlCQUF5QjtBQUN0RDtBQUNBO0FBQ0E7QUFDQSwwQ0FBMEMsR0FBRztBQUM3QztBQUNBO0FBQ0EsZUFBZTtBQUNmO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1Q0FBdUMsR0FBRztBQUMxQztBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0Esa0NBQWtDLEdBQUc7QUFDckMsZ0NBQWdDO0FBQ2hDLHVEQUF1RDtBQUN2RDtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQSxXQUFXLDRCQUE0QjtBQUN2QztBQUNBO0FBQ0EsV0FBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhLGdGQUFnRjtBQUM3RjtBQUNBOzs7Ozs7Ozs7Ozs7O0FDekxBO0FBQUE7QUFBZTtBQUNmOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDJCQUEyQjtBQUMzQjtBQUNBLEM7Ozs7Ozs7Ozs7OztBQ1pBO0FBQUE7QUFBZTs7QUFFZjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVk7QUFDWjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWM7QUFDZDtBQUNBO0FBQ0EsWUFBWTtBQUNaO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYztBQUNkO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQyxRQUFRO0FBQ3pDO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixrQkFBa0I7QUFDckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxtQkFBbUIscUJBQXFCO0FBQ3hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsbUJBQW1CLHFCQUFxQjtBQUN4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLG1CQUFtQiwrQkFBK0I7QUFDbEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLG1CQUFtQiw2QkFBNkI7QUFDaEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsa0JBQWtCO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLHFCQUFxQjtBQUN4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLHFCQUFxQjtBQUN4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixxQkFBcUI7QUFDeEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLHFCQUFxQjtBQUN4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQSx1RUFBdUU7QUFDdkU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsK0JBQStCLGtCQUFrQjtBQUNqRDtBQUNBO0FBQ0EsZUFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBLCtCQUErQixxQkFBcUI7QUFDcEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLHVCQUF1QjtBQUM5QztBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7O0FDN1pBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBdUU7QUFDZDs7QUFFbEQsbUNBQW1DOztBQUUzQjs7QUFFZjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQ0FBa0MsOERBQWtCO0FBQ3BEOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBLHlDQUF5QyxxRUFBeUI7QUFDbEU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBLFdBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7O0FDMVBBO0FBQUE7QUFBZTs7QUFFZjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0EsT0FBTzs7QUFFUDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7QUN4Q0E7QUFBQTtBQUFlOztBQUVmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7O0FDakNBO0FBQUE7QUFBZTs7QUFFZjs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7OztBQ2xCQTtBQUFBO0FBQUE7QUFBQTtBQUFxQztBQUNpQjs7O0FBR3ZDO0FBQ2Y7QUFDQTtBQUNBLHdCQUF3QixvREFBUTtBQUNoQyw0QkFBNEIsNERBQWdCO0FBQzVDOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQixlQUFlO0FBQ2Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxlQUFlO0FBQ2YsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUCxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPOztBQUVQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNULE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFXO0FBQ1gsU0FBUztBQUNUO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7OztBQ3hTQTtBQUFBO0FBQUE7QUFBOEM7QUFDL0I7O0FBRWY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNkJBQTZCLHlEQUFhO0FBQzFDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBVztBQUNYO0FBQ0E7QUFDQSxPQUFPOztBQUVQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsbUJBQW1CLG1CQUFtQjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7QUM1T0E7QUFBQTtBQUFBO0FBQXFDOzs7QUFHdEI7QUFDZjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSx1QkFBdUIsb0RBQVE7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsZUFBZSxpQkFBaUI7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0EsT0FBTztBQUNQOztBQUVBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTs7Ozs7Ozs7Ozs7OztBQzlFQTtBQUFBO0FBQUE7QUFBbUQ7O0FBRXBDOztBQUVmO0FBQ0E7QUFDQSwrQkFBK0IsMkRBQWU7QUFDOUM7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNULE9BQU87O0FBRVA7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVE7QUFDUixNQUFNO0FBQ047O0FBRUE7QUFDQTtBQUNBLHNCQUFzQix3REFBd0Q7QUFDOUU7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7OztBQ3BHQSw2SkFBZSxHQUFHLElBQXFDLENBQUMsaUNBQU8sRUFBRSxvQ0FBQyxDQUFDO0FBQUE7QUFBQTtBQUFBLG9HQUFDLENBQUMsS0FBSyxFQUE2RSxDQUFDLGtCQUFrQixhQUFhLGdCQUFnQiwrQkFBK0IsV0FBVyw0RkFBNEYsV0FBVyxrRUFBa0UsNERBQTRELFlBQVksSUFBSSxrQkFBa0IseUJBQXlCLDBEQUEwRCxrQkFBa0Isc0JBQXNCLHlDQUF5QyxVQUFVLGNBQWMseUJBQXlCLG9CQUFvQixJQUFJLFNBQVMsVUFBVSxvQ0FBb0MsY0FBYyxJQUFJLHlDQUF5QyxTQUFTLDBDQUEwQywwRkFBMEYscU9BQXFPLDBEQUEwRCx1REFBdUQsaU5BQWlOLDBCQUEwQiw0QkFBNEIsS0FBSyxLQUFLLGdEQUFnRCxtRkFBbUYsc0JBQXNCLEtBQUssa0NBQWtDLGlEQUFpRCxLQUFLLEdBQUcsbUJBQW1CLDhIQUE4SCxvSUFBb0ksMkNBQTJDLHFCQUFxQix1QkFBdUIsZUFBZSwwQkFBMEIsR0FBRyx3QkFBd0IseUNBQXlDLG9CQUFvQixLQUFLLGdEQUFnRCw0REFBNEQscUJBQXFCLE9BQU8sRUFBRSxvQkFBb0IsS0FBMEIscUJBQXFCOztBQUVuZ0YseUM7Ozs7Ozs7Ozs7OztBQ0ZBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLENBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0EsQ0FBQztBQUNEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsNENBQTRDOztBQUU1QyIsImZpbGUiOiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pIHtcbiBcdFx0XHRyZXR1cm4gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0uZXhwb3J0cztcbiBcdFx0fVxuIFx0XHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuIFx0XHR2YXIgbW9kdWxlID0gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0gPSB7XG4gXHRcdFx0aTogbW9kdWxlSWQsXG4gXHRcdFx0bDogZmFsc2UsXG4gXHRcdFx0ZXhwb3J0czoge31cbiBcdFx0fTtcblxuIFx0XHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cbiBcdFx0bW9kdWxlc1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cbiBcdFx0Ly8gRmxhZyB0aGUgbW9kdWxlIGFzIGxvYWRlZFxuIFx0XHRtb2R1bGUubCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gZGVmaW5lIGdldHRlciBmdW5jdGlvbiBmb3IgaGFybW9ueSBleHBvcnRzXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSBmdW5jdGlvbihleHBvcnRzLCBuYW1lLCBnZXR0ZXIpIHtcbiBcdFx0aWYoIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBuYW1lKSkge1xuIFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBuYW1lLCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZ2V0dGVyIH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSBmdW5jdGlvbihleHBvcnRzKSB7XG4gXHRcdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuIFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuIFx0XHR9XG4gXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG4gXHR9O1xuXG4gXHQvLyBjcmVhdGUgYSBmYWtlIG5hbWVzcGFjZSBvYmplY3RcbiBcdC8vIG1vZGUgJiAxOiB2YWx1ZSBpcyBhIG1vZHVsZSBpZCwgcmVxdWlyZSBpdFxuIFx0Ly8gbW9kZSAmIDI6IG1lcmdlIGFsbCBwcm9wZXJ0aWVzIG9mIHZhbHVlIGludG8gdGhlIG5zXG4gXHQvLyBtb2RlICYgNDogcmV0dXJuIHZhbHVlIHdoZW4gYWxyZWFkeSBucyBvYmplY3RcbiBcdC8vIG1vZGUgJiA4fDE6IGJlaGF2ZSBsaWtlIHJlcXVpcmVcbiBcdF9fd2VicGFja19yZXF1aXJlX18udCA9IGZ1bmN0aW9uKHZhbHVlLCBtb2RlKSB7XG4gXHRcdGlmKG1vZGUgJiAxKSB2YWx1ZSA9IF9fd2VicGFja19yZXF1aXJlX18odmFsdWUpO1xuIFx0XHRpZihtb2RlICYgOCkgcmV0dXJuIHZhbHVlO1xuIFx0XHRpZigobW9kZSAmIDQpICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgJiYgdmFsdWUuX19lc01vZHVsZSkgcmV0dXJuIHZhbHVlO1xuIFx0XHR2YXIgbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuIFx0XHRfX3dlYnBhY2tfcmVxdWlyZV9fLnIobnMpO1xuIFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkobnMsICdkZWZhdWx0JywgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdmFsdWUgfSk7XG4gXHRcdGlmKG1vZGUgJiAyICYmIHR5cGVvZiB2YWx1ZSAhPSAnc3RyaW5nJykgZm9yKHZhciBrZXkgaW4gdmFsdWUpIF9fd2VicGFja19yZXF1aXJlX18uZChucywga2V5LCBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHZhbHVlW2tleV07IH0uYmluZChudWxsLCBrZXkpKTtcbiBcdFx0cmV0dXJuIG5zO1xuIFx0fTtcblxuIFx0Ly8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubiA9IGZ1bmN0aW9uKG1vZHVsZSkge1xuIFx0XHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cbiBcdFx0XHRmdW5jdGlvbiBnZXREZWZhdWx0KCkgeyByZXR1cm4gbW9kdWxlWydkZWZhdWx0J107IH0gOlxuIFx0XHRcdGZ1bmN0aW9uIGdldE1vZHVsZUV4cG9ydHMoKSB7IHJldHVybiBtb2R1bGU7IH07XG4gXHRcdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsICdhJywgZ2V0dGVyKTtcbiBcdFx0cmV0dXJuIGdldHRlcjtcbiBcdH07XG5cbiBcdC8vIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbFxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5vID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpOyB9O1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcblxuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IFwiLi9hcHAvQ29udHJvbGxlci9NYWluQ29udHJvbGxlci5qc1wiKTtcbiIsImltcG9ydCBDb2RlTW9kZWwgZnJvbSAnLi4vTW9kZWwvQ29kZU1vZGVsLmpzJztcclxuaW1wb3J0IENvZGVWaWV3IGZyb20gJy4uL1ZpZXcvY29kZVZpZXcvQ29kZVZpZXcuanMnO1xyXG5pbXBvcnQgVG9CZWF1dGlmdWxTeW50YXggZnJvbSAnLi4vVmlldy9jb2RlVmlldy9Ub0JlYXV0aWZ1bFN5bnRheC5qcyc7XHJcbmltcG9ydCB7XHJcbiAgc2F2ZUFzXHJcbn0gZnJvbSAnZmlsZS1zYXZlcic7XHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvZGVDb250cm9sbGVyIHtcclxuXHJcbiAgY29uc3RydWN0b3IobWFpbkNvbnRyb2xsZXIpIHtcclxuICAgIHRoaXMubWFpbkNvbnRyb2xsZXIgPSBtYWluQ29udHJvbGxlcjtcclxuICAgIHRoaXMuY29kZU1vZGVsID0gbmV3IENvZGVNb2RlbCgpO1xyXG4gICAgdGhpcy5jb2RlVmlldyA9IG5ldyBDb2RlVmlldygpO1xyXG4gICAgdGhpcy5jb2RlVmlldy5hZGRMaXN0ZW5lcih0aGlzKTtcclxuICAgIHRoaXMudG9CZWF1dGlmdWwgPSBuZXcgVG9CZWF1dGlmdWxTeW50YXgoKTtcclxuICAgIHRoaXMubm90aWZ5KHtcclxuICAgICAgdHlwZTogXCJnZXREYXRhXCJcclxuICAgIH0pO1xyXG4gICAgdGhpcy5ub3RpZnkoe1xyXG4gICAgICB0eXBlOiBcInNldEVkaXRvclwiXHJcbiAgICB9KTtcclxuICAgIHRoaXMuZWRpdG9yID0gdGhpcy5jb2RlVmlldy5lZGl0b3I7XHJcbiAgICB0aGlzLmluaXRMaXN0ZW5lcnMoKTtcclxuICB9XHJcblxyXG4gIG5vdGlmeShkYXRhKSB7XHJcbiAgICBzd2l0Y2ggKGRhdGEudHlwZSkge1xyXG4gICAgICBjYXNlIFwiZ2V0RGF0YVwiOlxyXG4gICAgICAgIHRoaXMuZ2V0WHNkKCk7XHJcbiAgICAgICAgdGhpcy5nZXRJYmlzZG9jKCk7XHJcbiAgICAgICAgdGhpcy5nZXRDb25maWd1cmF0aW9ucygpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwic2V0RWRpdG9yXCI6XHJcbiAgICAgICAgdGhpcy5jb2RlVmlldy5tYWtlRWRpdG9yKCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzYXZlRmlsZSgpIHtcclxuICAgIHZhciBGaWxlU2F2ZXIgPSByZXF1aXJlKCdmaWxlLXNhdmVyJyk7XHJcbiAgICBsZXQgZmlsZURhdGEgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlKCk7XHJcbiAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKFtmaWxlRGF0YV0sIHtcclxuICAgICAgdHlwZTogXCJ0ZXh0L3htbFwiXHJcbiAgICB9KTtcclxuICAgIEZpbGVTYXZlci5zYXZlQXMoYmxvYiwgXCJGcmFua0NvbmZpZ3VyYXRpb25cIilcclxuICB9XHJcblxyXG5cclxuICBpbml0TGlzdGVuZXJzKCkge1xyXG4gICAgbGV0IGN1ciA9IHRoaXM7XHJcbiAgICAkKCcjYWRhcHRlclNlbGVjdCcpLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGxldCBhZGFwdGVyID0gJCgnI2FkYXB0ZXJTZWxlY3QnKS52YWwoKTtcclxuICAgICAgY3VyLmVkaXRvci5nZXRNb2RlbCgpLnNldFZhbHVlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGFkYXB0ZXIpKTtcclxuICAgIH0pO1xyXG5cclxuICAgICQoJyNmaWxlUmVhZGVyJykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgdmFyIGlucHV0ID0gZXZlbnQudGFyZ2V0O1xyXG4gICAgICBjb25zb2xlLmxvZyhpbnB1dCk7XHJcblxyXG4gICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcclxuICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBkYXRhVVJMID0gcmVhZGVyLnJlc3VsdDtcclxuICAgICAgICBsZXQgeG1sID0gYXRvYihkYXRhVVJMLnJlcGxhY2UoL1teXSo/LC8sICcnKSk7XHJcbiAgICAgICAgeG1sID0gJzxDb25maWd1cmF0aW9uPlxcbicgKyB4bWwgKyAnXFxuPC9Db25maWd1cmF0aW9uPidcclxuICAgICAgICBjdXIuZWRpdG9yLnNldFZhbHVlKHhtbCk7XHJcbiAgICAgIH1cclxuICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoaW5wdXQuZmlsZXNbMF0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgJCgnI3VwbG9hZEZpbGUnKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGN1ci5zYXZlRmlsZSgpO1xyXG4gICAgfSlcclxuXHJcbiAgICAkKCcjYWRhcHRlclNlbGVjdCcpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgbGV0IGFkYXB0ZXIgPSAkKCcjYWRhcHRlclNlbGVjdCcpLnZhbCgpO1xyXG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShhZGFwdGVyLCBjdXIuZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAkKCcjYmVhdXRpZnknKS5jbGljayhmdW5jdGlvbigpIHtcclxuICAgICAgbGV0IHByZXR0eVhNTCA9IGJlYXV0aWZ5LnhtbChjdXIuZWRpdG9yLmdldFZhbHVlKCksIDQpO1xyXG4gICAgICBjdXIuZWRpdG9yLmdldE1vZGVsKCkuc2V0VmFsdWUocHJldHR5WE1MKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGN1ci5lZGl0b3Iub25Nb3VzZURvd24oZnVuY3Rpb24oZSkge1xyXG4gICAgICBlLnRhcmdldC5yYW5nZS5zdGFydExpbmVOdW1iZXIgPSAxO1xyXG4gICAgICBlLnRhcmdldC5yYW5nZS5zdGFydENvbHVtbiA9IDE7XHJcbiAgICAgIGxldCB0ZXh0UG9zc2l0aW9uID0gY3VyLmVkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlSW5SYW5nZShlLnRhcmdldC5yYW5nZSk7XHJcbiAgICAgIGxldCBhZGFwdGVycyA9IHRleHRQb3NzaXRpb24ubWF0Y2goLzxBZGFwdGVyW15dKj9uYW1lPVwiLio/XCI+L2cpO1xyXG4gICAgICBpZiAoYWRhcHRlcnMgIT0gbnVsbCkge1xyXG4gICAgICAgIGxldCBhZGFwdGVyTmFtZSA9IGFkYXB0ZXJzW2FkYXB0ZXJzLmxlbmd0aCAtIDFdLm1hdGNoKC9uYW1lPVwiW15dKj9cIi9nKVswXS5tYXRjaCgvXCJbXl0qP1wiL2cpWzBdLnJlcGxhY2UoL1wiL2csICcnKTtcclxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcImN1cnJlbnRBZGFwdGVyXCIsIGFkYXB0ZXJOYW1lKTtcclxuICAgICAgICBjdXIubWFpbkNvbnRyb2xsZXIuZ2VuZXJhdGVGbG93KCk7XHJcbiAgICAgIH1cclxuICAgIH0pXHJcblxyXG4gICAgdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS5vbkRpZENoYW5nZUNvbnRlbnQoZnVuY3Rpb24oZSkge1xyXG4gICAgICBpZiAoIWN1ci5tYWluQ29udHJvbGxlci5mbG93Q29udHJvbGxlci5mbG93Vmlldy5tb3ZpbmcgJiYgIWN1ci5tYWluQ29udHJvbGxlci5mbG93Q29udHJvbGxlci5mbG93Vmlldy5hZGRpbmcpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgJCgnI2NhbnZhcycpLmNzcygnZGlzcGxheScsICdibG9jaycpO1xyXG4gICAgICAgICAgJCgnLmN1c3RvbUVycm9yTWVzc2FnZScpLnJlbW92ZSgpO1xyXG4gICAgICAgICAgY3VyLm1haW5Db250cm9sbGVyLmdlbmVyYXRlRmxvdygpO1xyXG4gICAgICAgICAgLy8gaWYoZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKSA9PSBcIlwiKSB7XHJcbiAgICAgICAgICAvLyAgIHVuZG9EZWNvcmF0aW9ucygpO1xyXG4gICAgICAgICAgLy8gfVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImVycm9yXCIsIGVycm9yKTtcclxuICAgICAgICAgIGN1ci5tYWluQ29udHJvbGxlci5mbG93Q29udHJvbGxlci5mbG93Vmlldy5tb2RpZnlGbG93KFwiZXJyb3JcIiwgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSlcclxuXHJcbiAgICAvL3J1biB0aGUgeHNkIHRvIHRoZSB4bWwgdGhhdCBpcyBjdXJyZW50bHkgaW4gdGhlIGVkaXRvclxyXG4gICAgJCgnI3J1blhzZCcpLmNsaWNrKGZ1bmN0aW9uKCkge1xyXG4gICAgICBsZXQgdmFsaWRhdGUgPSBjdXIudmFsaWRhdGVDb25maWd1cmF0aW9uKCksXHJcbiAgICAgICAgbGluZU51bWJlciA9IDA7XHJcbiAgICAgIGN1ci51bmRvRGVjb3JhdGlvbnMoKTtcclxuICAgICAgaWYgKHZhbGlkYXRlLmVycm9ycyAhPT0gbnVsbCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHZhbGlkYXRlLmVycm9ycyk7XHJcbiAgICAgICAgdmFsaWRhdGUuZXJyb3JzLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaW5kZXgpIHtcclxuICAgICAgICAgIGxpbmVOdW1iZXIgPSBpdGVtLm1hdGNoKC86Lio/Oi8pWzBdLnJlcGxhY2UoLzovZywgJycpO1xyXG4gICAgICAgICAgY3VyLmRlY29yYXRlTGluZShsaW5lTnVtYmVyKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHNlbGVjdFBpcGUobmFtZSkge1xyXG4gICAgdGhpcy5jb2RlVmlldy5zZWxlY3RQaXBlKG5hbWUpO1xyXG4gIH1cclxuICBnZXRUeXBlcygpIHtcclxuICAgIHJldHVybiB0aGlzLmNvZGVWaWV3LmdldFR5cGVzKCk7XHJcbiAgfVxyXG4gIHZhbGlkYXRlQ29uZmlndXJhdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmNvZGVWaWV3LnZhbGlkYXRlQ29uZmlndXJhdGlvblZpZXcudmFsaWRhdGVDb25maWd1cmF0aW9uKCk7XHJcbiAgfVxyXG4gIGRlY29yYXRlTGluZShsaW5lTnVtYmVyKSB7XHJcbiAgICB0aGlzLmNvZGVWaWV3LnZhbGlkYXRlQ29uZmlndXJhdGlvblZpZXcuZGVjb3JhdGVMaW5lKGxpbmVOdW1iZXIpO1xyXG4gIH1cclxuICB1bmRvRGVjb3JhdGlvbnMoKSB7XHJcbiAgICB0aGlzLmNvZGVWaWV3LnZhbGlkYXRlQ29uZmlndXJhdGlvblZpZXcudW5kb0RlY29yYXRpb25zKCk7XHJcbiAgfVxyXG4gIGNoYW5nZU5hbWUob2xkV29yZCwgbmV3V29yZCkge1xyXG4gICAgdGhpcy5jb2RlVmlldy5jaGFuZ2VOYW1lKG9sZFdvcmQsIG5ld1dvcmQpO1xyXG4gIH1cclxuICBjaGFuZ2VQb3NzaXRpb24obmFtZSwgbmV3WCwgbmV3WSkge1xyXG4gICAgdGhpcy5jb2RlVmlldy5jaGFuZ2VQb3NzaXRpb24obmFtZSwgbmV3WCwgbmV3WSk7XHJcbiAgfVxyXG4gIGNoYW5nZUV4aXRQb3NzaXRpb24obmFtZSwgbmV3WCwgbmV3WSkge1xyXG4gICAgdGhpcy5jb2RlVmlldy5jaGFuZ2VFeGl0UG9zc2l0aW9uKG5hbWUsIG5ld1gsIG5ld1kpO1xyXG4gIH1cclxuICBjaGFuZ2VBZGRGb3J3YXJkKG5hbWUsIHBhdGgpIHtcclxuICAgIHRoaXMuY29kZVZpZXcuY2hhbmdlQWRkRm9yd2FyZChuYW1lLCBwYXRoKTtcclxuICB9XHJcbiAgZGVsZXRlRm9yd2FyZChuYW1lLCBwYXRoKSB7XHJcbiAgICB0aGlzLmNvZGVWaWV3LmRlbGV0ZUZvcndhcmQobmFtZSwgcGF0aCk7XHJcbiAgfVxyXG4gIGNoYW5nZUFkZFBpcGUobmFtZSwgcG9zc2l0aW9ucywgY2xhc3NOYW1lKSB7XHJcbiAgICB0aGlzLmNvZGVWaWV3LmNoYW5nZUFkZFBpcGUobmFtZSwgcG9zc2l0aW9ucywgY2xhc3NOYW1lKTtcclxuICB9XHJcbiAgZ2V0UGlwZXMoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jb2RlVmlldy5pYmlzZG9jSnNvbjtcclxuICB9XHJcblxyXG5cclxuICBnZXRJYmlzZG9jKCkge1xyXG4gICAgbGV0IGN1ciA9IHRoaXM7XHJcbiAgICBmZXRjaCgnLi4vcmVzdC9pYmlzZG9jL2liaXNkb2MuanNvbicsIHtcclxuICAgICAgICBtZXRob2Q6ICdHRVQnXHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpXHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgIC8vIFdvcmsgd2l0aCBKU09OIGRhdGEgaGVyZVxyXG4gICAgICAgIGN1ci5jb2RlVmlldy5pYmlzZG9jSnNvbiA9IGRhdGE7XHJcbiAgICAgICAgY3VyLm1haW5Db250cm9sbGVyLnNldFBpcGVzKGRhdGEpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICAvLyBEbyBzb21ldGhpbmcgZm9yIGFuIGVycm9yIGhlcmVcclxuICAgICAgICBjb25zb2xlLmxvZyhcImNvdWxkbid0IGxvYWQgaWJpc2RvYywgbm93IHN3aXRjaGluZyB0byBkZWZhdWx0IGliaXNkb2NcIik7XHJcbiAgICAgICAgdGhpcy5nZXREZWZhdWx0SWJpc2RvYygpO1xyXG4gICAgICB9KVxyXG4gIH1cclxuXHJcbiAgZ2V0RGVmYXVsdEliaXNkb2MoKSB7XHJcbiAgICBsZXQgY3VyID0gdGhpcztcclxuICAgIGZldGNoKCdodHRwczovL2NvcnMtYW55d2hlcmUuaGVyb2t1YXBwLmNvbS9odHRwczovL2liaXM0ZXhhbXBsZS5pYmlzc291cmNlLm9yZy9yZXN0L2liaXNkb2MvaWJpc2RvYy5qc29uJywge1xyXG4gICAgICAgIG1ldGhvZDogJ0dFVCdcclxuICAgICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKClcclxuICAgICAgfSlcclxuICAgICAgLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgLy8gV29yayB3aXRoIEpTT04gZGF0YSBoZXJlXHJcbiAgICAgICAgY3VyLmNvZGVWaWV3LmliaXNkb2NKc29uID0gZGF0YTtcclxuICAgICAgICBjdXIubWFpbkNvbnRyb2xsZXIuc2V0UGlwZXMoZGF0YSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgIC8vIERvIHNvbWV0aGluZyBmb3IgYW4gZXJyb3IgaGVyZVxyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcblxyXG4gICAgICB9KVxyXG4gIH1cclxuXHJcbiAgZ2V0WHNkKCkge1xyXG4gICAgZmV0Y2goJy4uL3Jlc3QvaWJpc2RvYy9pYmlzZG9jLnhzZCcsIHtcclxuICAgICAgICBtZXRob2Q6ICdHRVQnXHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UudGV4dCgpXHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgIC8vIFdvcmsgd2l0aCBKU09OIGRhdGEgaGVyZVxyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiaWJpc2RvY1hzZFwiLCBkYXRhKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhcInhzZCBpcyBsb2FkZWQhLCBoZXJlXCIpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcImNvdWxkbid0IGxvYWQgeHNkLCBub3cgbG9hZGluZyBkZWFmdWx0IHhzZFwiLCBlcnIpO1xyXG4gICAgICAgIHRoaXMuZ2V0RGVmYXVsdFhzZCgpO1xyXG4gICAgICAgIC8vIERvIHNvbWV0aGluZyBmb3IgYW4gZXJyb3IgaGVyZVxyXG4gICAgICB9KVxyXG4gIH1cclxuXHJcbiAgZ2V0RGVmYXVsdFhzZCgpIHtcclxuICAgIGZldGNoKCdodHRwczovL2NvcnMtYW55d2hlcmUuaGVyb2t1YXBwLmNvbS9odHRwczovL2liaXM0ZXhhbXBsZS5pYmlzc291cmNlLm9yZy9yZXN0L2liaXNkb2MvaWJpc2RvYy54c2QnLCB7XHJcbiAgICAgICAgbWV0aG9kOiAnR0VUJ1xyXG4gICAgICB9KVxyXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnRleHQoKVxyXG4gICAgICB9KVxyXG4gICAgICAudGhlbihkYXRhID0+IHtcclxuICAgICAgICAvLyBXb3JrIHdpdGggSlNPTiBkYXRhIGhlcmVcclxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcImliaXNkb2NYc2RcIiwgZGF0YSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJ4c2QgaXMgbG9hZGVkISwgaGVyZVwiKTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJub3QgbG9hZGVkIHhzZFwiLCBlcnIpO1xyXG4gICAgICAgIC8vIERvIHNvbWV0aGluZyBmb3IgYW4gZXJyb3IgaGVyZVxyXG4gICAgICB9KVxyXG4gIH1cclxuXHJcbiAgZ2V0Q29uZmlndXJhdGlvbnMoc2Vjb25kVHJ5KSB7XHJcbiAgICBsZXQgY3VyID0gdGhpcyxcclxuICAgICAgcGF0aCA9ICcuLi9pYWYvYXBpL2NvbmZpZ3VyYXRpb25zJztcclxuICAgIGlmIChzZWNvbmRUcnkpIHtcclxuICAgICAgcGF0aCA9ICcuLi8nICsgcGF0aDtcclxuICAgIH1cclxuICAgIGZldGNoKHBhdGgsIHtcclxuICAgICAgICBtZXRob2Q6ICdHRVQnXHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgICB9KVxyXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgbGV0IGNvbmZpZ3VyYXRpb25zID0gW10sXHJcbiAgICAgICAgICBkb20sIG9iajtcclxuICAgICAgICByZXNwb25zZS5tYXRjaCgvPFtjQ11vbmZpZ3VyYXRpb25bXl0qPz5bXl0qPzxcXC9bY0Ndb25maWd1cmF0aW9uPnw8SU9TLUFkYXB0ZXJpbmdbXl0qPz5bXl0qPzxcXC9JT1MtQWRhcHRlcmluZz4vZykuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gICAgICAgICAgaWYgKGl0ZW0gIT0gbnVsbCkge1xyXG4gICAgICAgICAgICBjb25maWd1cmF0aW9ucy5wdXNoKGl0ZW0pO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Vua25vd24gY29uZmlndXJhdGlvbiBlbmNvdW50ZXJlZCcpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIHJldHVybiBjb25maWd1cmF0aW9ucztcclxuICAgICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJlc3BvbnNlLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaW5kZXgpIHtcclxuICAgICAgICAgIGlmIChpdGVtLm1hdGNoKC88Q29uZmlndXJhdGlvbi9nKSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGlmIChpdGVtLm1hdGNoKC9JT1MtQWRhcHRlcmluZy9nKSAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgaXRlbSA9IGl0ZW0ucmVwbGFjZSgvSU9TLUFkYXB0ZXJpbmcvZywgJ0NvbmZpZ3VyYXRpb24nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXNwb25zZVtpbmRleF0gPSBjdXIudG9CZWF1dGlmdWwudG9CZWF1dGlmdWxTeW50YXgoaXRlbSk7XHJcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGluZGV4LCBjdXIudG9CZWF1dGlmdWwudG9CZWF1dGlmdWxTeW50YXgoaXRlbSkpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oaW5kZXgsIGl0ZW0pO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2U7XHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgIC8vIFdvcmsgd2l0aCBKU09OIGRhdGEgaGVyZVxyXG4gICAgICAgIGN1ci5jb2RlVmlldy5hZGRPcHRpb25zKGRhdGEpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICBpZiAoc2Vjb25kVHJ5KSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZygnY291bGRudCBsb2FkIGNvbmZpZ3VyYXRpb25zJywgZXJyKVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImNvbmZpZ3VyYXRpb25zIHBhdGggd2FzIGluY29ycmVjdCwgdHJ5aW5nIG90aGVyIHBhdGggbm93Li4uXCIsIGVycik7XHJcbiAgICAgICAgICAvL2N1ci5nZXRDb25maWd1cmF0aW9ucyh0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCBGbG93VmlldyBmcm9tICcuLi9WaWV3L2Zsb3dWaWV3L0Zsb3dWaWV3LmpzJztcclxuaW1wb3J0IFBhbGV0dGVWaWV3IGZyb20gJy4uL1ZpZXcvZmxvd1ZpZXcvUGFsZXR0ZVZpZXcuanMnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRmxvd0NvbnRyb2xsZXIge1xyXG5cclxuICBjb25zdHJ1Y3RvcihtYWluQ29udHJvbGxlcikge1xyXG4gICAgdGhpcy5tYWluQ29udHJvbGxlciA9IG1haW5Db250cm9sbGVyO1xyXG4gICAgdGhpcy5mbG93VmlldyA9IG5ldyBGbG93VmlldygpO1xyXG4gICAgdGhpcy5mbG93Vmlldy5hZGRMaXN0ZW5lcih0aGlzKTtcclxuICAgIHRoaXMucGFsZXR0ZVZpZXcgPSBuZXcgUGFsZXR0ZVZpZXcodGhpcyk7XHJcbiAgICB0aGlzLnBhbGV0dGVWaWV3LmFkZExpc3RlbmVyKHRoaXMpO1xyXG4gICAgdGhpcy5ub3RpZnkoe3R5cGU6IFwiZ2V0UGlwZXNcIn0pO1xyXG4gICAgdGhpcy5ob3ZlclNvdXJjZVdpbmRvdyA9IGZhbHNlO1xyXG4gICAgdGhpcy5pbml0SGFuZGxlcnMoKTtcclxuICB9XHJcblxyXG4gIG5vdGlmeShkYXRhKSB7XHJcbiAgICBpZiAoZGF0YSA9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH07XHJcbiAgICBzd2l0Y2ggKGRhdGEudHlwZSkge1xyXG4gICAgICBjYXNlIFwiY29udmVydENvbmZpZ3VyYXRpb25cIjpcclxuICAgICAgICB0aGlzLmZsb3dWaWV3LnRyYW5zZm9ybWVkWG1sID0gdGhpcy5tYWluQ29udHJvbGxlci5jb252ZXJ0Q29uZmlndXJhdGlvbigpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwiZ2V0VHlwZXNcIjpcclxuICAgICAgICB0aGlzLmZsb3dWaWV3LnR5cGVzID0gdGhpcy5tYWluQ29udHJvbGxlci5tb2RpZnlDb2RlKFwiZ2V0VHlwZXNcIik7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgXCJjaGFuZ2VOYW1lXCI6XHJcbiAgICAgICAgdGhpcy5tYWluQ29udHJvbGxlci5tb2RpZnlDb2RlKFwiY2hhbmdlTmFtZVwiLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBcImNoYW5nZUFkZFBpcGVcIjpcclxuICAgICAgICB0aGlzLm1haW5Db250cm9sbGVyLm1vZGlmeUNvZGUoXCJjaGFuZ2VBZGRQaXBlXCIsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwiY2hhbmdlQWRkRm9yd2FyZFwiOlxyXG4gICAgICAgIHRoaXMubWFpbkNvbnRyb2xsZXIubW9kaWZ5Q29kZShcImNoYW5nZUFkZEZvcndhcmRcIiwgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgXCJkcmFnXCI6XHJcbiAgICAgICAgdGhpcy5tYWluQ29udHJvbGxlci5tb2RpZnlDb2RlKFwiY2hhbmdlUG9zc2l0aW9uXCIsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwiZHJhZ0V4aXRcIjpcclxuICAgICAgICB0aGlzLm1haW5Db250cm9sbGVyLm1vZGlmeUNvZGUoXCJjaGFuZ2VFeGl0UG9zc2l0aW9uXCIsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwiZGVsZXRlXCI6XHJcbiAgICAgICAgdGhpcy5tYWluQ29udHJvbGxlci5tb2RpZnlDb2RlKFwiZGVsZXRlRm9yd2FyZFwiLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGluaXRIYW5kbGVycygpIHtcclxuICAgIGxldCBjdXIgPSB0aGlzO1xyXG4gICAgJCgnI2FkZFBpcGUnKS5jbGljayhmdW5jdGlvbigpIHtcclxuICAgICAgY3VyLmZsb3dWaWV3Lm1vZGlmeUZsb3coJ2FkZCcsIHtuYW1lOiBcIm5ld1BpcGVcIiwgY2xhc3NOYW1lOiBcImN1c3RvbVBpcGVcIn0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgJCgnI2Rvd25sb2FkTGluaycpLmNsaWNrKGZ1bmN0aW9uKCkge1xyXG4gICAgICBjdXIuZmxvd1ZpZXcuZ2V0SW1hZ2UoKTtcclxuICAgIH0pXHJcblxyXG4gICAgJCgnI3NldERhdGEnKS5jbGljayhmdW5jdGlvbigpIHtcclxuICAgICAgY3VyLmZsb3dWaWV3LmdlbmVyYXRlRmxvdyhjdXIuZmxvd1ZpZXcpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgJCgnI2xpbmVDaGFuZ2VzJykuY2xpY2soZnVuY3Rpb24oKSB7XHJcbiAgICAgIGN1ci5mbG93Vmlldy50b2dnbGVDb25uZWN0b3JUeXBlKGN1ci5mbG93Vmlldyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvL3RvZ2dsZSBidWlsZGluZyB0aGUgZmxvdyBpbiBob3Jpem9udGFsIG1vZGUuXHJcbiAgICAkKCcjdG9nZ2xlSCcpLmNsaWNrKGZ1bmN0aW9uKCkge1xyXG4gICAgICBsZXQgaG9yaXpvbnRhbEJ1aWxkID0gY3VyLmZsb3dWaWV3Lmhvcml6b250YWxCdWlsZDtcclxuICAgICAgaWYgKCFob3Jpem9udGFsQnVpbGQpIHtcclxuICAgICAgICBjdXIuZmxvd1ZpZXcuaG9yaXpvbnRhbEJ1aWxkID0gdHJ1ZTtcclxuICAgICAgICAkKCcjdG9nZ2xlSCcpLmFkZENsYXNzKCdzZWxlY3RlZEl0ZW0nKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjdXIuZmxvd1ZpZXcuaG9yaXpvbnRhbEJ1aWxkID0gZmFsc2U7XHJcbiAgICAgICAgJCgnI3RvZ2dsZUgnKS5yZW1vdmVDbGFzcygnc2VsZWN0ZWRJdGVtJyk7XHJcbiAgICAgIH1cclxuICAgICAgY3VyLmZsb3dWaWV3LmdlbmVyYXRlRmxvdyhjdXIuZmxvd1ZpZXcpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy9yZW5hbWUgYSBwaXBlXHJcbiAgICAkKFwiI2NhbnZhc1wiKS5vbignZGJsY2xpY2snLCAnI3N0cm9uZycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgY29uc29sZS5sb2coXCJkYmxjbGljayFcIik7XHJcbiAgICAgIGlmICh0aGlzLmlubmVySFRNTCAhPT0gXCJFWElUXCIpIHtcclxuICAgICAgICBjdXIuZmxvd1ZpZXcubW9kaWZ5RmxvdygnZWRpdCcsIHRoaXMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBqc1BsdW1iLm9uKCQoJyNjYW52YXMnKSwgXCJtb3VzZW92ZXJcIiwgXCIuc291cmNlV2luZG93XCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAkcGFuem9vbS5wYW56b29tKFwiZGlzYWJsZVwiKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGpzUGx1bWIub24oJCgnI2NhbnZhcycpLCBcIm1vdXNlb3V0XCIsIFwiLnNvdXJjZVdpbmRvd1wiLCBmdW5jdGlvbigpIHtcclxuICAgICAgJHBhbnpvb20ucGFuem9vbShcImVuYWJsZVwiKTtcclxuICAgICAgJCgnI2Zsb3dDb250YWluZXInKS5hdHRyKCdzdHlsZScsICcnKTtcclxuICAgIH0pO1xyXG5cclxuICAgICQoJyNjYW52YXMnKS5vbihcImNsaWNrXCIsIFwiLnNvdXJjZVdpbmRvd1wiLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgY3VyLm1haW5Db250cm9sbGVyLm1vZGlmeUNvZGUoXCJ1bmRvRGVjb3JhdGlvbnNcIik7XHJcbiAgICAgIGN1ci5tYWluQ29udHJvbGxlci5tb2RpZnlDb2RlKFwic2VsZWN0UGlwZVwiLCB7XHJcbiAgICAgICAgbmFtZTogdGhpcy5sYXN0RWxlbWVudENoaWxkLmZpcnN0RWxlbWVudENoaWxkLmlubmVySFRNTFxyXG4gICAgICB9KVxyXG4gICAgfSlcclxuXHJcblxyXG4gICAgLy9tYWtlIHRoZSBib3R0b20gY29udGFpbmVyIGRyYWdnYWJsZSB3aXRoIG1vdXNlb3ZlclxyXG4gICAganNQbHVtYi5vbigkKCcjY2FudmFzJyksIFwibW91c2VvdmVyXCIsIFwiLmJvdHRvbUNvbnRhaW5lclwiLCBmdW5jdGlvbigpIHtcclxuICAgICAgbGV0IHNvdXJjZURpdiA9IHRoaXMucGFyZW50RWxlbWVudDtcclxuICAgICAgbGV0IGRyYWdEYXRhID0ge1xyXG4gICAgICAgIGRpc2FibGVkOiBmYWxzZSxcclxuICAgICAgICBjb250YWlubWVudDogJyNjYW52YXMnLFxyXG4gICAgICAgIGRyYWc6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgLy9jb25zb2xlLmxvZyhjdXIuZmxvd1ZpZXcubW9kaWZ5Rmxvdyk7XHJcbiAgICAgICAgICBjdXIuZmxvd1ZpZXcubW92aW5nID0gdHJ1ZTtcclxuICAgICAgICAgIGxldCBkcmFnT2JqID0ge1xyXG4gICAgICAgICAgICB4OiAkKHNvdXJjZURpdikuY3NzKCdsZWZ0JyksXHJcbiAgICAgICAgICAgIHk6ICQoc291cmNlRGl2KS5jc3MoJ3RvcCcpLFxyXG4gICAgICAgICAgICBuYW1lOiBzb3VyY2VEaXYubGFzdEVsZW1lbnRDaGlsZC5maXJzdEVsZW1lbnRDaGlsZC5pbm5lckhUTUxcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICgkKHNvdXJjZURpdikuaGFzQ2xhc3MoJ2V4aXQnKSkge1xyXG4gICAgICAgICAgICBjdXIuZmxvd1ZpZXcubW9kaWZ5RmxvdygnZHJhZ0V4aXQnLCBkcmFnT2JqKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGN1ci5mbG93Vmlldy5tb2RpZnlGbG93KCdkcmFnJywgZHJhZ09iaik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzdG9wOiBmdW5jdGlvbihldmVudCwgdWkpIHtcclxuICAgICAgICAgIGN1ci5mbG93Vmlldy5tb3ZpbmcgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgaW5zdGFuY2UuZHJhZ2dhYmxlKHNvdXJjZURpdiwgZHJhZ0RhdGEpO1xyXG4gICAgICBpZiAoaW5zdGFuY2UuaXNTb3VyY2VFbmFibGVkKHNvdXJjZURpdikpIHtcclxuICAgICAgICBpbnN0YW5jZS50b2dnbGVTb3VyY2VFbmFibGVkKHNvdXJjZURpdik7XHJcbiAgICAgIH1cclxuICAgICAgJCh0aGlzKS5hZGRDbGFzcyhcImVsZW1lbnQtZGlzYWJsZWRcIik7XHJcbiAgICB9KTtcclxuXHJcblxyXG4gICAgLy93aGVuIGxlYXZpbmcgY29udGFpbmVyIG5vdCBkcmFnZ2FibGVcclxuICAgIGpzUGx1bWIub24oJCgnI2NhbnZhcycpLCBcIm1vdXNlb3V0XCIsIFwiLmJvdHRvbUNvbnRhaW5lclwiLCBmdW5jdGlvbigpIHtcclxuICAgICAgbGV0IHNvdXJjZURpdiA9IHRoaXMucGFyZW50RWxlbWVudDtcclxuICAgICAgaW5zdGFuY2UuZHJhZ2dhYmxlKHNvdXJjZURpdiwge1xyXG4gICAgICAgIGRpc2FibGVkOiB0cnVlXHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAoIWluc3RhbmNlLmlzU291cmNlRW5hYmxlZChzb3VyY2VEaXYpKSB7XHJcbiAgICAgICAgaW5zdGFuY2UudG9nZ2xlU291cmNlRW5hYmxlZChzb3VyY2VEaXYpO1xyXG4gICAgICB9XHJcbiAgICAgICQodGhpcykucmVtb3ZlQ2xhc3MoXCJlbGVtZW50LWRpc2FibGVkXCIpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy9jb250YWluIGNhbnZhcyB0byBjb250YWluZXIuXHJcbiAgICB2YXIgbWluU2NhbGVYID0gJCgnI2Zsb3dDb250YWluZXInKS5pbm5lcldpZHRoKCk7XHJcbiAgICB2YXIgbWluU2NhbGVZID0gJCgnI2Zsb3dDb250YWluZXInKS5pbm5lckhlaWdodCgpO1xyXG4gICAgbGV0ICRwYW56b29tID0gJCgnI2NhbnZhcycpLnBhbnpvb20oe1xyXG4gICAgICBtaW5TY2FsZTogMC41LFxyXG4gICAgICBpbmNyZW1lbnQ6IDAuMlxyXG4gICAgfSk7XHJcblxyXG4gICAgLy9tYWtlIHN1cmUgcGFuem9vbSBkb2Vzbid0IGxlYXZlIHRoZSBjb250YWluZXIuXHJcbiAgICAkcGFuem9vbS5vbigncGFuem9vbWVuZCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgdmFyIGN1cnJlbnRfcHVsbFkgPSBwYXJzZUludCgkKCcjY2FudmFzJykuY3NzKCd0cmFuc2Zvcm0nKS5zcGxpdCgnLCcpWzVdKTtcclxuICAgICAgdmFyIGN1cnJlbnRfcHVsbFggPSBwYXJzZUludCgkKCcjY2FudmFzJykuY3NzKCd0cmFuc2Zvcm0nKS5zcGxpdCgnLCcpWzRdKTtcclxuICAgICAgaWYgKGN1cnJlbnRfcHVsbFggPj0gMCkge1xyXG4gICAgICAgICRwYW56b29tLnBhbnpvb20oJ3BhbicsIDAsIGN1cnJlbnRfcHVsbFkpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChjdXJyZW50X3B1bGxZIDw9IC1NYXRoLmFicygkKCcjY2FudmFzJykuY3NzKCdoZWlnaHQnKS5yZXBsYWNlKCdweCcsICcnKSkgKyAxMDAwKSB7XHJcbiAgICAgICAgJHBhbnpvb20ucGFuem9vbSgncGFuJywgY3VycmVudF9wdWxsWCwgLU1hdGguYWJzKCQoJyNjYW52YXMnKS5jc3MoJ2hlaWdodCcpLnJlcGxhY2UoJ3B4JywgJycpKSArIDEwMDApO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChjdXJyZW50X3B1bGxYIDw9IC0xNTQwKSB7XHJcbiAgICAgICAgJHBhbnpvb20ucGFuem9vbSgncGFuJywgLTE1NDAsIGN1cnJlbnRfcHVsbFkpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChjdXJyZW50X3B1bGxZID49IDApIHtcclxuICAgICAgICAkcGFuem9vbS5wYW56b29tKCdwYW4nLCBjdXJyZW50X3B1bGxYLCAwKTtcclxuICAgICAgfVxyXG4gICAgICAkKCcjZmxvd0NvbnRhaW5lcicpLmF0dHIoJ3N0eWxlJywgJycpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy9tYWtlIHpvb20gcG9zc2libGVcclxuICAgICRwYW56b29tLnBhcmVudCgpLm9uKCdtb3VzZXdoZWVsLmZvY2FsJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBpZiAoIWUuc2hpZnRLZXkpIHJldHVybjtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB2YXIgZGVsdGEgPSBlLmRlbHRhIHx8IGUub3JpZ2luYWxFdmVudC53aGVlbERlbHRhO1xyXG4gICAgICB2YXIgem9vbU91dCA9IGRlbHRhID8gZGVsdGEgPCAwIDogZS5vcmlnaW5hbEV2ZW50LmRlbHRhWSA+IDA7XHJcbiAgICAgICRwYW56b29tLnBhbnpvb20oJ3pvb20nLCB6b29tT3V0LCB7XHJcbiAgICAgICAgaW5jcmVtZW50OiAwLjEsXHJcbiAgICAgICAgZm9jYWw6IGVcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IENvbmZpZ3VyYXRpb25Db252ZXJ0ZXIgZnJvbSAnLi4vTW9kZWwvQ29uZmlndXJhdGlvbkNvbnZlcnRlci5qcyc7XHJcbmltcG9ydCBDb2RlQ29udHJvbGxlciBmcm9tICcuL0NvZGVDb250cm9sbGVyLmpzJztcclxuaW1wb3J0IEZsb3dDb250cm9sbGVyIGZyb20gJy4vRmxvd0NvbnRyb2xsZXIuanMnO1xyXG5cclxuXHJcbmNsYXNzIE1haW5Db250cm9sbGVyIHtcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLmNvbmZpZ3VyYXRpb25Db252ZXJ0ZXIgPSBuZXcgQ29uZmlndXJhdGlvbkNvbnZlcnRlcigpO1xyXG4gICAgdGhpcy5jb2RlQ29udHJvbGxlciA9IG5ldyBDb2RlQ29udHJvbGxlcih0aGlzKTtcclxuICAgIHRoaXMuZmxvd0NvbnRyb2xsZXIgPSBuZXcgRmxvd0NvbnRyb2xsZXIodGhpcyk7XHJcbiAgICBjb25zb2xlLmxvZyh3aW5kb3cud2Via2l0UmVxdWVzdEZpbGVTeXN0ZW0pO1xyXG4gIH1cclxuXHJcbiAgY29udmVydENvbmZpZ3VyYXRpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uQ29udmVydGVyLmNvbnZlcnRDb25maWd1cmF0aW9uKHRoaXMuY29kZUNvbnRyb2xsZXIuY29kZVZpZXcuZWRpdG9yKTtcclxuICB9XHJcblxyXG4gIGdlbmVyYXRlRmxvdygpIHtcclxuICAgIHRoaXMuZmxvd0NvbnRyb2xsZXIuZmxvd1ZpZXcubW9kaWZ5RmxvdyhcImdlbmVyYXRlXCIpO1xyXG4gIH1cclxuICBzZXRQaXBlcyhkYXRhKSB7XHJcbiAgICB0aGlzLmZsb3dDb250cm9sbGVyLnBhbGV0dGVWaWV3LmdlbmVyYXRlUGFsZXR0ZVBpcGVzKGRhdGFbMl0uY2xhc3Nlcyk7XHJcbiAgfVxyXG5cclxuICBtb2RpZnlDb2RlKHR5cGUsIG9iaikge1xyXG4gICAgbGV0IGNvZGVDb250cm9sbGVyID0gdGhpcy5jb2RlQ29udHJvbGxlcjtcclxuICAgIHN3aXRjaCAodHlwZSkge1xyXG4gICAgICBjYXNlIFwiZ2V0VHlwZXNcIjpcclxuICAgICAgICByZXR1cm4gY29kZUNvbnRyb2xsZXIuZ2V0VHlwZXMoKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBcInZhbGlkYXRlQ29uZmlndXJhdGlvblwiOlxyXG4gICAgICAgIHJldHVybiBjb2RlQ29udHJvbGxlci52YWxpZGF0ZUNvbmZpZ3VyYXRpb24oKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBcImRlY29yYXRlTGluZVwiOlxyXG4gICAgICAgIGNvZGVDb250cm9sbGVyLmRlY29yYXRlTGluZShvYmoubGluZSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgXCJ1bmRvRGVjb3JhdGlvbnNcIjpcclxuICAgICAgICBjb2RlQ29udHJvbGxlci51bmRvRGVjb3JhdGlvbnMoKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBcImNoYW5nZU5hbWVcIjpcclxuICAgICAgICBjb2RlQ29udHJvbGxlci5jaGFuZ2VOYW1lKG9iai5vbGRUaXRsZSwgb2JqLm5ld1RpdGxlKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBcImNoYW5nZVBvc3NpdGlvblwiOlxyXG4gICAgICAgIGNvZGVDb250cm9sbGVyLmNoYW5nZVBvc3NpdGlvbihvYmoubmFtZSwgb2JqLngsIG9iai55KTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBcImNoYW5nZUV4aXRQb3NzaXRpb25cIjpcclxuICAgICAgICBjb2RlQ29udHJvbGxlci5jaGFuZ2VFeGl0UG9zc2l0aW9uKG9iai5uYW1lLCBvYmoueCwgb2JqLnkpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwiY2hhbmdlQWRkRm9yd2FyZFwiOlxyXG4gICAgICAgIGNvZGVDb250cm9sbGVyLmNoYW5nZUFkZEZvcndhcmQob2JqLnNvdXJjZSwgb2JqLnRhcmdldCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgXCJkZWxldGVGb3J3YXJkXCI6XHJcbiAgICAgICAgY29kZUNvbnRyb2xsZXIuZGVsZXRlRm9yd2FyZChvYmoubmFtZSwgb2JqLnRhcmdldCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgXCJjaGFuZ2VBZGRQaXBlXCI6XHJcbiAgICAgICAgY29kZUNvbnRyb2xsZXIuY2hhbmdlQWRkUGlwZShvYmoubmFtZSwgb2JqLnBvc3NpdGlvbnMsIG9iai5jbGFzc05hbWUpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwic2VsZWN0UGlwZVwiOlxyXG4gICAgICAgIGNvZGVDb250cm9sbGVyLnNlbGVjdFBpcGUob2JqLm5hbWUpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuXHJcbmxldCBtYWluQ29udHJvbGxlciA9IG5ldyBNYWluQ29udHJvbGxlcigpO1xyXG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBDb2RlTW9kZWwge1xyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgdGhpcy5pbml0QWRhcHRlcigpO1xyXG4gIH1cclxuXHJcbiAgaW5pdEFkYXB0ZXIoKSB7XHJcbiAgICB0aGlzLmFkYXB0ZXIgPSBbXHJcbiAgICAgICc8QWRhcHRlcicsXHJcbiAgICAgICdcdHhtbG5zOnhzaT1cImh0dHA6Ly93d3cudzMub3JnLzIwMDEvWE1MU2NoZW1hLWluc3RhbmNlXCInLFxyXG4gICAgICAnXHR4c2k6bm9OYW1lc3BhY2VTY2hlbWFMb2NhdGlvbj1cImh0dHBzOi8vaWJpczRleGFtcGxlLmliaXNzb3VyY2Uub3JnL3Jlc3QvaWJpc2RvYy9pYmlzZG9jLnhzZFwiJyxcclxuICAgICAgJ1x0bmFtZT1cIkhlbGxvV29ybGRcIiAnLFxyXG4gICAgICAnXHRkZXNjcmlwdGlvbj1cIlZvb3JiZWVsZCBhZGFwdGVyXCI+JyxcclxuXHJcbiAgICAgICdcdDxSZWNlaXZlciBuYW1lPVwiSGVsbG9Xb3JsZFwiPicsXHJcbiAgICAgICdcdFx0PEFwaUxpc3RlbmVyIG5hbWU9XCJIZWxsb1dvcmxkXCInLFxyXG4gICAgICAnXHRcdFx0dXJpUGF0dGVybj1cImhlbGxvd29ybGQve2lucHV0U3RyaW5nfVwiJyxcclxuICAgICAgJ1x0XHRcdG1ldGhvZCA9IFwiZ2V0XCInLFxyXG4gICAgICAnXHRcdC8+JyxcclxuICAgICAgJ1x0PC9SZWNlaXZlcj4nLFxyXG5cclxuICAgICAgJ1x0PFBpcGVsaW5lIGZpcnN0UGlwZT1cIlN3aXRjaElucHV0XCI+JyxcclxuICAgICAgJ1x0XHQ8WG1sU3dpdGNoUGlwZSBuYW1lPVwiU3dpdGNoSW5wdXRcIicsXHJcbiAgICAgICdcdFx0XHRnZXRJbnB1dEZyb21GaXhlZFZhbHVlPVwiJmx0O2R1bW15LyZndDtcIicsXHJcbiAgICAgICdcdFx0XHR4cGF0aEV4cHJlc3Npb249XCIkaW5wdXRcIiB4PVwiNDM2XCIgeT1cIjEzMVwiPicsXHJcbiAgICAgICdcdFx0XHQ8UGFyYW0gbmFtZT1cImlucHV0XCIgc2Vzc2lvbktleT1cImlucHV0U3RyaW5nXCI+PC9QYXJhbT4nLFxyXG4gICAgICAnXHRcdDwvWG1sU3dpdGNoUGlwZT5cXG5cXG4nLFxyXG4gICAgICAnXHRcdDxGaXhlZFJlc3VsdFBpcGUnLFxyXG4gICAgICAnXHRcdFx0bmFtZT1cIk5GSGVsbG9Xb3JsZFwiJyxcclxuICAgICAgJ1x0XHRcdHJldHVyblN0cmluZz1cIkhhbGxvIFJpY2FyZG8gIVwiJyxcclxuICAgICAgJ1x0XHQgXHR4PVwiODYzXCIgeT1cIjIyOFwiPicsXHJcbiAgICAgICdcdFx0XHQ8Rm9yd2FyZCBuYW1lPVwic3VjY2Vzc1wiIHBhdGg9XCJFeGl0XCIvPicsXHJcbiAgICAgICdcdFx0PC9GaXhlZFJlc3VsdFBpcGU+XFxuJyxcclxuXHJcbiAgICAgICdcdFx0PEV4aXQgcGF0aD1cIlNlcnZlckVycm9yXCIgc3RhdGU9XCJlcnJvclwiIGNvZGU9XCI1MDBcIi8+JyxcclxuICAgICAgJ1x0XHQ8RXhpdCBwYXRoPVwiRXhpdFwiIHN0YXRlPVwic3VjY2Vzc1wiIGNvZGU9XCIyMDFcIi8+JyxcclxuICAgICAgJ1x0PC9QaXBlbGluZT4nLFxyXG4gICAgICAnPC9BZGFwdGVyPidcclxuICAgIF07XHJcbiAgfVxyXG59XHJcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbmZpZ3VyYXRpb25Db252ZXJ0ZXIge1xyXG5cclxuICAvLyBhIGZ1bmN0aW9uIHRoYXQgY29udmVydHMgdGhlIHhtbCB0byBhIHJlYWRhYmxlIGpzb24gZm9ybWF0IGFuZCB0aGVuIGdlbmVyYXRlcyBhIGZsb3dcclxuICBjb252ZXJ0Q29uZmlndXJhdGlvbihlZGl0b3IpIHtcclxuICAgIGxldCB2YWx1ZSA9IGVkaXRvci5nZXRWYWx1ZSgpO1xyXG4gICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC88W15cXC9dW1xcU10qP1teXCJcXC9dUGlwZS9nLCBcIjxwaXBlXCIpO1xyXG4gICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC88W1xcL11bXFxTXSo/W15cIlxcL11QaXBlL2csIFwiPC9waXBlXCIpLnJlcGxhY2UoLyYvZywgJycpO1xyXG4gICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC88IS0tW15dKj8tLT4vZywgJycpXHJcbiAgICB2YXIgZ2V0WG1sID0gbmV3IERPTVBhcnNlcigpO1xyXG4gICAgbGV0IHhtbCA9IGdldFhtbC5wYXJzZUZyb21TdHJpbmcodmFsdWUsIFwidGV4dC94bWxcIik7XHJcbiAgICBsZXQgdHJhbnNmb3JtZWRYbWwgPSBKU09OLnBhcnNlKHRoaXMueG1sMmpzb24oeG1sKS5yZXBsYWNlKCd1bmRlZmluZWQnLCAnJykpO1xyXG5cclxuICAgIGlmICh0cmFuc2Zvcm1lZFhtbC5Db25maWd1cmF0aW9uLk1vZHVsZSA9PSBudWxsICYmIHRyYW5zZm9ybWVkWG1sLkNvbmZpZ3VyYXRpb24uQWRhcHRlciAhPSBudWxsKSB7XHJcbiAgICAgIHRyYW5zZm9ybWVkWG1sLkFkYXB0ZXIgPSB0cmFuc2Zvcm1lZFhtbC5Db25maWd1cmF0aW9uLkFkYXB0ZXI7XHJcbiAgICB9IGVsc2Uge1xyXG5cdCAgICAgIGlmKEFycmF5LmlzQXJyYXkodHJhbnNmb3JtZWRYbWwuQ29uZmlndXJhdGlvbi5Nb2R1bGUpKSB7XHJcblx0ICAgICAgdHJhbnNmb3JtZWRYbWwuQ29uZmlndXJhdGlvbi5Nb2R1bGUuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG5cdCAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXRlbS5BZGFwdGVyKSkge1xyXG5cdCAgICAgICAgICBpdGVtLkFkYXB0ZXIuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG5cdCAgICAgICAgICAgIGlmIChpdGVtW1wiQG5hbWVcIl0gIT0gbnVsbCAmJiBpdGVtW1wiQG5hbWVcIl0gPT0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJjdXJyZW50QWRhcHRlclwiKSkge1xyXG5cdCAgICAgICAgICAgICAgdHJhbnNmb3JtZWRYbWwuQWRhcHRlciA9IGl0ZW07XHJcblx0ICAgICAgICAgICAgfVxyXG5cdCAgICAgICAgICB9KVxyXG5cdCAgICAgICAgfSBlbHNlIHtcclxuXHQgICAgICAgICAgaWYgKGl0ZW0uQWRhcHRlciAhPSBudWxsICYmIGl0ZW0uQWRhcHRlcltcIkBuYW1lXCJdICE9IG51bGwgJiYgaXRlbS5BZGFwdGVyW1wiQG5hbWVcIl0gPT0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJjdXJyZW50QWRhcHRlclwiKSkge1xyXG5cdCAgICAgICAgICAgIHRyYW5zZm9ybWVkWG1sID0gaXRlbTtcclxuXHQgICAgICAgICAgfVxyXG5cdCAgICAgICAgfVxyXG5cdCAgICAgIH0pO1xyXG5cdCAgICB9IGVsc2Uge1xyXG5cdCAgICBcdHRyYW5zZm9ybWVkWG1sLkFkYXB0ZXIgPSB0cmFuc2Zvcm1lZFhtbC5Db25maWd1cmF0aW9uLk1vZHVsZS5BZGFwdGVyO1xyXG5cdCAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdHJhbnNmb3JtZWRYbWw7XHJcbiAgfVxyXG5cclxuICBkb21QYXJzZSh4bWwpIHtcclxuICAgIHZhciBnZXRYbWwgPSBuZXcgRE9NUGFyc2VyKCk7XHJcbiAgICBsZXQgZG9tWG1sID0gZ2V0WG1sLnBhcnNlRnJvbVN0cmluZyh4bWwsIFwidGV4dC94bWxcIik7XHJcbiAgICByZXR1cm4gZG9tWG1sO1xyXG4gIH1cclxuXHJcbiAgLypcdFRoaXMgd29yayBpcyBsaWNlbnNlZCB1bmRlciBDcmVhdGl2ZSBDb21tb25zIEdOVSBMR1BMIExpY2Vuc2UuXHJcblxyXG4gIExpY2Vuc2U6IGh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL2xpY2Vuc2VzL0xHUEwvMi4xL1xyXG4gICBWZXJzaW9uOiAwLjlcclxuICBBdXRob3I6ICBTdGVmYW4gR29lc3NuZXIvMjAwNlxyXG4gIFdlYjogICAgIGh0dHA6Ly9nb2Vzc25lci5uZXQvXHJcbiAgKi9cclxuICB4bWwyanNvbih4bWwsIHRhYikge1xyXG4gICAgdmFyIFggPSB7XHJcbiAgICAgIHRvT2JqOiBmdW5jdGlvbih4bWwpIHtcclxuICAgICAgICB2YXIgbyA9IHt9O1xyXG4gICAgICAgIGlmICh4bWwubm9kZVR5cGUgPT0gMSkgeyAvLyBlbGVtZW50IG5vZGUgLi5cclxuICAgICAgICAgIGlmICh4bWwuYXR0cmlidXRlcy5sZW5ndGgpIC8vIGVsZW1lbnQgd2l0aCBhdHRyaWJ1dGVzICAuLlxyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhtbC5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgICAgICAgIG9bXCJAXCIgKyB4bWwuYXR0cmlidXRlc1tpXS5ub2RlTmFtZV0gPSAoeG1sLmF0dHJpYnV0ZXNbaV0ubm9kZVZhbHVlIHx8IFwiXCIpLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICBpZiAoeG1sLmZpcnN0Q2hpbGQpIHsgLy8gZWxlbWVudCBoYXMgY2hpbGQgbm9kZXMgLi5cclxuICAgICAgICAgICAgdmFyIHRleHRDaGlsZCA9IDAsXHJcbiAgICAgICAgICAgICAgY2RhdGFDaGlsZCA9IDAsXHJcbiAgICAgICAgICAgICAgaGFzRWxlbWVudENoaWxkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGZvciAodmFyIG4gPSB4bWwuZmlyc3RDaGlsZDsgbjsgbiA9IG4ubmV4dFNpYmxpbmcpIHtcclxuICAgICAgICAgICAgICBpZiAobi5ub2RlVHlwZSA9PSAxKSBoYXNFbGVtZW50Q2hpbGQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgIGVsc2UgaWYgKG4ubm9kZVR5cGUgPT0gMyAmJiBuLm5vZGVWYWx1ZS5tYXRjaCgvW14gXFxmXFxuXFxyXFx0XFx2XS8pKSB0ZXh0Q2hpbGQrKzsgLy8gbm9uLXdoaXRlc3BhY2UgdGV4dFxyXG4gICAgICAgICAgICAgIGVsc2UgaWYgKG4ubm9kZVR5cGUgPT0gNCkgY2RhdGFDaGlsZCsrOyAvLyBjZGF0YSBzZWN0aW9uIG5vZGVcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaGFzRWxlbWVudENoaWxkKSB7XHJcbiAgICAgICAgICAgICAgaWYgKHRleHRDaGlsZCA8IDIgJiYgY2RhdGFDaGlsZCA8IDIpIHsgLy8gc3RydWN0dXJlZCBlbGVtZW50IHdpdGggZXZ0bC4gYSBzaW5nbGUgdGV4dCBvci9hbmQgY2RhdGEgbm9kZSAuLlxyXG4gICAgICAgICAgICAgICAgWC5yZW1vdmVXaGl0ZSh4bWwpO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgbiA9IHhtbC5maXJzdENoaWxkOyBuOyBuID0gbi5uZXh0U2libGluZykge1xyXG4gICAgICAgICAgICAgICAgICBpZiAobi5ub2RlVHlwZSA9PSAzKSAvLyB0ZXh0IG5vZGVcclxuICAgICAgICAgICAgICAgICAgICBvW1wiI3RleHRcIl0gPSBYLmVzY2FwZShuLm5vZGVWYWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG4ubm9kZVR5cGUgPT0gNCkgLy8gY2RhdGEgbm9kZVxyXG4gICAgICAgICAgICAgICAgICAgIG9bXCIjY2RhdGFcIl0gPSBYLmVzY2FwZShuLm5vZGVWYWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG9bbi5ub2RlTmFtZV0pIHsgLy8gbXVsdGlwbGUgb2NjdXJlbmNlIG9mIGVsZW1lbnQgLi5cclxuICAgICAgICAgICAgICAgICAgICBpZiAob1tuLm5vZGVOYW1lXSBpbnN0YW5jZW9mIEFycmF5KVxyXG4gICAgICAgICAgICAgICAgICAgICAgb1tuLm5vZGVOYW1lXVtvW24ubm9kZU5hbWVdLmxlbmd0aF0gPSBYLnRvT2JqKG4pO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICAgICAgIG9bbi5ub2RlTmFtZV0gPSBbb1tuLm5vZGVOYW1lXSwgWC50b09iaihuKV07XHJcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSAvLyBmaXJzdCBvY2N1cmVuY2Ugb2YgZWxlbWVudC4uXHJcbiAgICAgICAgICAgICAgICAgICAgb1tuLm5vZGVOYW1lXSA9IFgudG9PYmoobik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gbWl4ZWQgY29udGVudFxyXG4gICAgICAgICAgICAgICAgaWYgKCF4bWwuYXR0cmlidXRlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgICAgICAgIG8gPSBYLmVzY2FwZShYLmlubmVyWG1sKHhtbCkpO1xyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICBvW1wiI3RleHRcIl0gPSBYLmVzY2FwZShYLmlubmVyWG1sKHhtbCkpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIGlmICh0ZXh0Q2hpbGQpIHsgLy8gcHVyZSB0ZXh0XHJcbiAgICAgICAgICAgICAgaWYgKCF4bWwuYXR0cmlidXRlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgICAgICBvID0gWC5lc2NhcGUoWC5pbm5lclhtbCh4bWwpKTtcclxuICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICBvW1wiI3RleHRcIl0gPSBYLmVzY2FwZShYLmlubmVyWG1sKHhtbCkpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNkYXRhQ2hpbGQpIHsgLy8gY2RhdGFcclxuICAgICAgICAgICAgICBpZiAoY2RhdGFDaGlsZCA+IDEpXHJcbiAgICAgICAgICAgICAgICBvID0gWC5lc2NhcGUoWC5pbm5lclhtbCh4bWwpKTtcclxuICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBuID0geG1sLmZpcnN0Q2hpbGQ7IG47IG4gPSBuLm5leHRTaWJsaW5nKVxyXG4gICAgICAgICAgICAgICAgICBvW1wiI2NkYXRhXCJdID0gWC5lc2NhcGUobi5ub2RlVmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAoIXhtbC5hdHRyaWJ1dGVzLmxlbmd0aCAmJiAheG1sLmZpcnN0Q2hpbGQpIG8gPSBudWxsO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoeG1sLm5vZGVUeXBlID09IDkpIHsgLy8gZG9jdW1lbnQubm9kZVxyXG4gICAgICAgICAgbyA9IFgudG9PYmooeG1sLmRvY3VtZW50RWxlbWVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBvO1xyXG4gICAgICB9LFxyXG4gICAgICB0b0pzb246IGZ1bmN0aW9uKG8sIG5hbWUsIGluZCkge1xyXG4gICAgICAgIHZhciBqc29uID0gbmFtZSA/IChcIlxcXCJcIiArIG5hbWUgKyBcIlxcXCJcIikgOiBcIlwiO1xyXG4gICAgICAgIGlmIChvIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gby5sZW5ndGg7IGkgPCBuOyBpKyspXHJcbiAgICAgICAgICAgIG9baV0gPSBYLnRvSnNvbihvW2ldLCBcIlwiLCBpbmQgKyBcIlxcdFwiKTtcclxuICAgICAgICAgIGpzb24gKz0gKG5hbWUgPyBcIjpbXCIgOiBcIltcIikgKyAoby5sZW5ndGggPiAxID8gKFwiXFxuXCIgKyBpbmQgKyBcIlxcdFwiICsgby5qb2luKFwiLFxcblwiICsgaW5kICsgXCJcXHRcIikgKyBcIlxcblwiICsgaW5kKSA6IG8uam9pbihcIlwiKSkgKyBcIl1cIjtcclxuICAgICAgICB9IGVsc2UgaWYgKG8gPT0gbnVsbClcclxuICAgICAgICAgIGpzb24gKz0gKG5hbWUgJiYgXCI6XCIpICsgXCJudWxsXCI7XHJcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mKG8pID09IFwib2JqZWN0XCIpIHtcclxuICAgICAgICAgIHZhciBhcnIgPSBbXTtcclxuICAgICAgICAgIGZvciAodmFyIG0gaW4gbylcclxuICAgICAgICAgICAgYXJyW2Fyci5sZW5ndGhdID0gWC50b0pzb24ob1ttXSwgbSwgaW5kICsgXCJcXHRcIik7XHJcbiAgICAgICAgICBqc29uICs9IChuYW1lID8gXCI6e1wiIDogXCJ7XCIpICsgKGFyci5sZW5ndGggPiAxID8gKFwiXFxuXCIgKyBpbmQgKyBcIlxcdFwiICsgYXJyLmpvaW4oXCIsXFxuXCIgKyBpbmQgKyBcIlxcdFwiKSArIFwiXFxuXCIgKyBpbmQpIDogYXJyLmpvaW4oXCJcIikpICsgXCJ9XCI7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YobykgPT0gXCJzdHJpbmdcIilcclxuICAgICAgICAgIGpzb24gKz0gKG5hbWUgJiYgXCI6XCIpICsgXCJcXFwiXCIgKyBvLnRvU3RyaW5nKCkgKyBcIlxcXCJcIjtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBqc29uICs9IChuYW1lICYmIFwiOlwiKSArIG8udG9TdHJpbmcoKTtcclxuICAgICAgICByZXR1cm4ganNvbjtcclxuICAgICAgfSxcclxuICAgICAgaW5uZXJYbWw6IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICB2YXIgcyA9IFwiXCJcclxuICAgICAgICBpZiAoXCJpbm5lckhUTUxcIiBpbiBub2RlKVxyXG4gICAgICAgICAgcyA9IG5vZGUuaW5uZXJIVE1MO1xyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgdmFyIGFzWG1sID0gZnVuY3Rpb24obikge1xyXG4gICAgICAgICAgICB2YXIgcyA9IFwiXCI7XHJcbiAgICAgICAgICAgIGlmIChuLm5vZGVUeXBlID09IDEpIHtcclxuICAgICAgICAgICAgICBzICs9IFwiPFwiICsgbi5ub2RlTmFtZTtcclxuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG4uYXR0cmlidXRlcy5sZW5ndGg7IGkrKylcclxuICAgICAgICAgICAgICAgIHMgKz0gXCIgXCIgKyBuLmF0dHJpYnV0ZXNbaV0ubm9kZU5hbWUgKyBcIj1cXFwiXCIgKyAobi5hdHRyaWJ1dGVzW2ldLm5vZGVWYWx1ZSB8fCBcIlwiKS50b1N0cmluZygpICsgXCJcXFwiXCI7XHJcbiAgICAgICAgICAgICAgaWYgKG4uZmlyc3RDaGlsZCkge1xyXG4gICAgICAgICAgICAgICAgcyArPSBcIj5cIjtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGMgPSBuLmZpcnN0Q2hpbGQ7IGM7IGMgPSBjLm5leHRTaWJsaW5nKVxyXG4gICAgICAgICAgICAgICAgICBzICs9IGFzWG1sKGMpO1xyXG4gICAgICAgICAgICAgICAgcyArPSBcIjwvXCIgKyBuLm5vZGVOYW1lICsgXCI+XCI7XHJcbiAgICAgICAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgICAgICBzICs9IFwiLz5cIjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChuLm5vZGVUeXBlID09IDMpXHJcbiAgICAgICAgICAgICAgcyArPSBuLm5vZGVWYWx1ZTtcclxuICAgICAgICAgICAgZWxzZSBpZiAobi5ub2RlVHlwZSA9PSA0KVxyXG4gICAgICAgICAgICAgIHMgKz0gXCI8IVtDREFUQVtcIiArIG4ubm9kZVZhbHVlICsgXCJdXT5cIjtcclxuICAgICAgICAgICAgcmV0dXJuIHM7XHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgICAgZm9yICh2YXIgYyA9IG5vZGUuZmlyc3RDaGlsZDsgYzsgYyA9IGMubmV4dFNpYmxpbmcpXHJcbiAgICAgICAgICAgIHMgKz0gYXNYbWwoYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzO1xyXG4gICAgICB9LFxyXG4gICAgICBlc2NhcGU6IGZ1bmN0aW9uKHR4dCkge1xyXG4gICAgICAgIHJldHVybiB0eHQucmVwbGFjZSgvW1xcXFxdL2csIFwiXFxcXFxcXFxcIilcclxuICAgICAgICAgIC5yZXBsYWNlKC9bXFxcIl0vZywgJ1xcXFxcIicpXHJcbiAgICAgICAgICAucmVwbGFjZSgvW1xcbl0vZywgJ1xcXFxuJylcclxuICAgICAgICAgIC5yZXBsYWNlKC9bXFxyXS9nLCAnXFxcXHInKTtcclxuICAgICAgfSxcclxuICAgICAgcmVtb3ZlV2hpdGU6IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLm5vcm1hbGl6ZSgpO1xyXG4gICAgICAgIGZvciAodmFyIG4gPSBlLmZpcnN0Q2hpbGQ7IG47KSB7XHJcbiAgICAgICAgICBpZiAobi5ub2RlVHlwZSA9PSAzKSB7IC8vIHRleHQgbm9kZVxyXG4gICAgICAgICAgICBpZiAoIW4ubm9kZVZhbHVlLm1hdGNoKC9bXiBcXGZcXG5cXHJcXHRcXHZdLykpIHsgLy8gcHVyZSB3aGl0ZXNwYWNlIHRleHQgbm9kZVxyXG4gICAgICAgICAgICAgIHZhciBueHQgPSBuLm5leHRTaWJsaW5nO1xyXG4gICAgICAgICAgICAgIGUucmVtb3ZlQ2hpbGQobik7XHJcbiAgICAgICAgICAgICAgbiA9IG54dDtcclxuICAgICAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgICAgbiA9IG4ubmV4dFNpYmxpbmc7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKG4ubm9kZVR5cGUgPT0gMSkgeyAvLyBlbGVtZW50IG5vZGVcclxuICAgICAgICAgICAgWC5yZW1vdmVXaGl0ZShuKTtcclxuICAgICAgICAgICAgbiA9IG4ubmV4dFNpYmxpbmc7XHJcbiAgICAgICAgICB9IGVsc2UgLy8gYW55IG90aGVyIG5vZGVcclxuICAgICAgICAgICAgbiA9IG4ubmV4dFNpYmxpbmc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBlO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgaWYgKHhtbC5ub2RlVHlwZSA9PSA5KSAvLyBkb2N1bWVudCBub2RlXHJcbiAgICAgIHhtbCA9IHhtbC5kb2N1bWVudEVsZW1lbnQ7XHJcbiAgICB2YXIganNvbiA9IFgudG9Kc29uKFgudG9PYmooWC5yZW1vdmVXaGl0ZSh4bWwpKSwgeG1sLm5vZGVOYW1lLCBcIlxcdFwiKTtcclxuICAgIHJldHVybiBcIntcXG5cIiArIHRhYiArICh0YWIgPyBqc29uLnJlcGxhY2UoL1xcdC9nLCB0YWIpIDoganNvbi5yZXBsYWNlKC9cXHR8XFxuL2csIFwiXCIpKSArIFwiXFxufVwiO1xyXG4gIH1cclxufVxyXG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBDb25zb2xlQ29sb3JQaWNrIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHRnZXRSZWRDb2xvcigpIHtcclxuXHRcdHJldHVybiAnY29sb3I6ICNGRjAwMDAnO1xyXG5cdH1cclxuXHRcclxuXHRnZXREZWZhdWx0Q29sb3IoKSB7XHJcblx0XHRyZXR1cm4gJ2JhY2tncm91bmQ6ICMyMjI7IGNvbG9yOiAjYmFkYTU1JztcclxuXHR9XHJcbn0iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBDb2RlQ29tcGxldGlvblZpZXcge1xyXG5cclxuICBjb25zdHJ1Y3Rvcihjb2RlVmlldykge1xyXG4gICAgdGhpcy5jb2RlVmlldyA9IGNvZGVWaWV3O1xyXG4gICAgLy90aGlzLmluaXRQcm92aWRlcigpO1xyXG4gIH1cclxuXHJcbiAgLy8gLy9zZXR1cCB0aGUgYXV0b2NvbXBsZXRlLlxyXG4gIC8vIGluaXRQcm92aWRlcigpIHtcclxuICAvLyAgIGxldCBjdXIgPSB0aGlzLFxyXG4gIC8vICAgICBzdWdnZXN0aW9ucztcclxuICAvLyAgIGNvbnNvbGUubG9nKCdhdXRvY29tcGxldGUgd29ya2luZycpO1xyXG4gIC8vICAgbW9uYWNvLmxhbmd1YWdlcy5yZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIoJ3htbCcsIHtcclxuICAvLyAgICAgcHJvdmlkZUNvbXBsZXRpb25JdGVtczogZnVuY3Rpb24obW9kZWwsIHBvc2l0aW9uKSB7XHJcbiAgLy8gICAgICAgLy8gZmluZCBvdXQgaWYgd2UgYXJlIGNvbXBsZXRpbmcgYSBwcm9wZXJ0eSBpbiB0aGUgJ2RlcGVuZGVuY2llcycgb2JqZWN0LlxyXG4gIC8vICAgICAgIHZhciB0ZXh0VW50aWxQb3NpdGlvbiA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZSh7XHJcbiAgLy8gICAgICAgICBzdGFydExpbmVOdW1iZXI6IDEsXHJcbiAgLy8gICAgICAgICBzdGFydENvbHVtbjogMSxcclxuICAvLyAgICAgICAgIGVuZExpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIsXHJcbiAgLy8gICAgICAgICBlbmRDb2x1bW46IHBvc2l0aW9uLmNvbHVtblxyXG4gIC8vICAgICAgIH0pO1xyXG4gIC8vICAgICAgIGxldCBkZXNpcmVkUGlwZSA9IHRleHRVbnRpbFBvc2l0aW9uLm1hdGNoKC88W15cIlxcL11bXFxTXSo/W3BQXWlwZS9nKTtcclxuICAvLyAgICAgICB2YXIgbWF0Y2ggPSBtb2RlbC5nZXRWYWx1ZSgpLm1hdGNoKC88W1xcU10qP1teXCIvXVtwUF1pcGVbXFxzXFx0XFxuXVteXSo/PlteXSo/PFsvXVtcXFNdKj9bXlwiL11QaXBlPi9nKTtcclxuICAvLyAgICAgICBpZiAobWF0Y2ggPT0gbnVsbCB8fCBkZXNpcmVkUGlwZSA9PSBudWxsKSB7XHJcbiAgLy8gICAgICAgICByZXR1cm47XHJcbiAgLy8gICAgICAgfVxyXG4gIC8vICAgICAgIGRlc2lyZWRQaXBlID0gZGVzaXJlZFBpcGVbZGVzaXJlZFBpcGUubGVuZ3RoIC0gMV0ucmVwbGFjZSgvPC9nLCAnJyk7XHJcbiAgLy8gICAgICAgbWF0Y2guZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gIC8vICAgICAgICAgbGV0IGxpbmUgPSBtb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyIC0gMSk7XHJcbiAgLy8gICAgICAgICBpZiAoaXRlbS5pbmRleE9mKGxpbmUpICE9IC0xKSB7XHJcbiAgLy8gICAgICAgICAgIHN1Z2dlc3Rpb25zID0gY3VyLmNyZWF0ZVBpcGVBdXRvQ29tcGxldGUoKTtcclxuICAvLyAgICAgICAgIH0gZWxzZSB7XHJcbiAgLy8gICAgICAgICAgIHN1Z2dlc3Rpb25zID0gY3VyLmNyZWF0ZUF0dHJpYnV0ZUF1dG9jb21wbGV0ZShkZXNpcmVkUGlwZSk7XHJcbiAgLy8gICAgICAgICB9XHJcbiAgLy8gICAgICAgfSk7XHJcbiAgLy8gICAgICAgcmV0dXJuIHtcclxuICAvLyAgICAgICAgIHN1Z2dlc3Rpb25zOiBzdWdnZXN0aW9uc1xyXG4gIC8vICAgICAgIH07XHJcbiAgLy8gICAgIH1cclxuICAvLyAgIH0pO1xyXG4gIC8vIH1cclxuICAvL1xyXG4gIC8vIGNyZWF0ZVBpcGVBdXRvQ29tcGxldGUoKSB7XHJcbiAgLy8gICBsZXQgcGlwZSwgb2JqID0gbnVsbDtcclxuICAvLyAgIGxldCBhcnIgPSBbXTtcclxuICAvL1xyXG4gIC8vICAgaWYgKHRoaXMuY29kZVZpZXcuaWJpc2RvY0pzb24gIT0gbnVsbCkge1xyXG4gIC8vICAgICB0aGlzLmliaXNkb2NKc29uID0gdGhpcy5jb2RlVmlldy5pYmlzZG9jSnNvbjtcclxuICAvLyAgICAgdGhpcy5pYmlzZG9jSnNvblsyXS5jbGFzc2VzLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaW5kZXgpIHtcclxuICAvLyAgICAgICBwaXBlID0gaXRlbTtcclxuICAvLyAgICAgICBvYmogPSB7XHJcbiAgLy8gICAgICAgICBsYWJlbDogcGlwZS5uYW1lLnJlcGxhY2UoL14oKD8hUGlwZSkuKSokLywgcGlwZS5uYW1lICsgXCJQaXBlXCIpLFxyXG4gIC8vICAgICAgICAga2luZDogbW9uYWNvLmxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuRnVuY3Rpb24sXHJcbiAgLy8gICAgICAgICBkb2N1bWVudGF0aW9uOiBwaXBlLnBhY2thZ2VOYW1lLFxyXG4gIC8vICAgICAgICAgaW5zZXJ0VGV4dDogJzwnICsgcGlwZS5uYW1lICsgJyBuYW1lPVwieW91clBpcGVcIj4gXFxuIDwvJyArIHBpcGUubmFtZSArICc+J1xyXG4gIC8vICAgICAgIH1cclxuICAvLyAgICAgICBhcnIucHVzaChvYmopO1xyXG4gIC8vICAgICB9KTtcclxuICAvLyAgIH1cclxuICAvL1xyXG4gIC8vICAgb2JqID0ge1xyXG4gIC8vICAgICBsYWJlbDogJ0ZvcndhcmQnLFxyXG4gIC8vICAgICBraW5kOiBtb25hY28ubGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5GdW5jdGlvbixcclxuICAvLyAgICAgZG9jdW1lbnRhdGlvbjogXCJhIGZvcndhcmRcIixcclxuICAvLyAgICAgaW5zZXJ0VGV4dDogJzxGb3J3YXJkIG5hbWU9XCJmb3J3YXJkTmFtZVwiIHBhdGg9XCJuZXdQYXRoXCIgLz4nXHJcbiAgLy8gICB9XHJcbiAgLy8gICBhcnIucHVzaChvYmopO1xyXG4gIC8vICAgcmV0dXJuIGFycjtcclxuICAvLyB9XHJcbiAgLy8gY3JlYXRlQXR0cmlidXRlQXV0b2NvbXBsZXRlKHNlbGVjdFBpcGUpIHtcclxuICAvLyAgIGxldCBhcnIgPSBbXSxcclxuICAvLyAgICAgb2JqO1xyXG4gIC8vICAgaWYgKHRoaXMuY29kZVZpZXcuaWJpc2RvY0pzb24gIT0gbnVsbCkge1xyXG4gIC8vICAgICB0aGlzLmliaXNkb2NKc29uID0gdGhpcy5jb2RlVmlldy5pYmlzZG9jSnNvbjtcclxuICAvLyAgICAgdGhpcy5pYmlzZG9jSnNvblsyXS5jbGFzc2VzLmZvckVhY2goZnVuY3Rpb24ocGlwZSwgaW5kZXgpIHtcclxuICAvLyAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhwaXBlLm5hbWUubGVuZ3RoLCBwaXBlLm5hbWUsIHNlbGVjdFBpcGUubGVuZ3RoKTtcclxuICAvLyAgICAgICBpZiAocGlwZS5uYW1lID09IHNlbGVjdFBpcGUpIHtcclxuICAvLyAgICAgICAgIHBpcGUubWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHIsIGluZGV4KSB7XHJcbiAgLy8gICAgICAgICAgIG9iaiA9IHtcclxuICAvLyAgICAgICAgICAgICBsYWJlbDogYXR0ci5uYW1lLFxyXG4gIC8vICAgICAgICAgICAgIGtpbmQ6IG1vbmFjby5sYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkZ1bmN0aW9uLFxyXG4gIC8vICAgICAgICAgICAgIGRvY3VtZW50YXRpb246IGF0dHIuZGVzY3JpcHRpb24sXHJcbiAgLy8gICAgICAgICAgICAgaW5zZXJ0VGV4dDogYXR0ci5uYW1lICsgJz1cIicgKyBhdHRyLmRlZmF1bHRWYWx1ZSArICdcIidcclxuICAvLyAgICAgICAgICAgfVxyXG4gIC8vICAgICAgICAgICBhcnIucHVzaChvYmopO1xyXG4gIC8vICAgICAgICAgfSk7XHJcbiAgLy8gICAgICAgfVxyXG4gIC8vICAgICB9KTtcclxuICAvLyAgIH1cclxuICAvLyAgIHJldHVybiBhcnI7XHJcbiAgLy8gfVxyXG5cclxuICBpbml0UHJvdmlkZXIoKSB7XHJcblxyXG4gICAgdGhpcy5zY2hlbWFOb2RlID0gdGhpcy5zdHJpbmdUb1htbChsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnaWJpc2RvY1hzZCcpLnJlcGxhY2UoL3hzXFw6L2csICcnKSkuY2hpbGROb2Rlc1swXTtcclxuICAgIGNvbnNvbGUubG9nKHRoaXMuc2NoZW1hTm9kZSwgXCJob2lcIik7XHJcbiAgICBtb25hY28ubGFuZ3VhZ2VzLnJlZ2lzdGVyQ29tcGxldGlvbkl0ZW1Qcm92aWRlcigneG1sJywgdGhpcy5nZXRYbWxDb21wbGV0aW9uUHJvdmlkZXIobW9uYWNvKSk7XHJcbiAgfVxyXG5cclxuICBzdHJpbmdUb1htbCh0ZXh0KSB7XHJcbiAgICB2YXIgeG1sRG9jO1xyXG5cclxuICAgIGlmICh3aW5kb3cuRE9NUGFyc2VyKSB7XHJcbiAgICAgIHZhciBwYXJzZXIgPSBuZXcgRE9NUGFyc2VyKCk7XHJcbiAgICAgIHhtbERvYyA9IHBhcnNlci5wYXJzZUZyb21TdHJpbmcodGV4dCwgJ3RleHQveG1sJyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB4bWxEb2MgPSBuZXcgQWN0aXZlWE9iamVjdCgnTWljcm9zb2Z0LlhNTERPTScpO1xyXG4gICAgICB4bWxEb2MuYXN5bmMgPSBmYWxzZTtcclxuICAgICAgeG1sRG9jLmxvYWRYTUwodGV4dCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4geG1sRG9jO1xyXG4gIH1cclxuXHJcbiAgZ2V0TGFzdE9wZW5lZFRhZyh0ZXh0KSB7XHJcbiAgICAvLyBnZXQgYWxsIHRhZ3MgaW5zaWRlIG9mIHRoZSBjb250ZW50XHJcbiAgICB2YXIgdGFncyA9IHRleHQubWF0Y2goLzxcXC8qKD89XFxTKikoW2EtekEtWi1dKykvZyk7XHJcbiAgICBpZiAoIXRhZ3MpIHtcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxuICAgIC8vIHdlIG5lZWQgdG8ga25vdyB3aGljaCB0YWdzIGFyZSBjbG9zZWRcclxuICAgIHZhciBjbG9zaW5nVGFncyA9IFtdO1xyXG4gICAgZm9yICh2YXIgaSA9IHRhZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgaWYgKHRhZ3NbaV0uaW5kZXhPZignPC8nKSA9PT0gMCkge1xyXG4gICAgICAgIGNsb3NpbmdUYWdzLnB1c2godGFnc1tpXS5zdWJzdHJpbmcoJzwvJy5sZW5ndGgpKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBnZXQgdGhlIGxhc3QgcG9zaXRpb24gb2YgdGhlIHRhZ1xyXG4gICAgICAgIHZhciB0YWdQb3NpdGlvbiA9IHRleHQubGFzdEluZGV4T2YodGFnc1tpXSk7XHJcbiAgICAgICAgdmFyIHRhZyA9IHRhZ3NbaV0uc3Vic3RyaW5nKCc8Jy5sZW5ndGgpO1xyXG4gICAgICAgIHZhciBjbG9zaW5nQnJhY2tldElkeCA9IHRleHQuaW5kZXhPZignLz4nLCB0YWdQb3NpdGlvbik7XHJcbiAgICAgICAgLy8gaWYgdGhlIHRhZyB3YXNuJ3QgY2xvc2VkXHJcbiAgICAgICAgaWYgKGNsb3NpbmdCcmFja2V0SWR4ID09PSAtMSkge1xyXG4gICAgICAgICAgLy8gaWYgdGhlcmUgYXJlIG5vIGNsb3NpbmcgdGFncyBvciB0aGUgY3VycmVudCB0YWcgd2Fzbid0IGNsb3NlZFxyXG4gICAgICAgICAgaWYgKCFjbG9zaW5nVGFncy5sZW5ndGggfHwgY2xvc2luZ1RhZ3NbY2xvc2luZ1RhZ3MubGVuZ3RoIC0gMV0gIT09IHRhZykge1xyXG4gICAgICAgICAgICAvLyB3ZSBmb3VuZCBvdXIgdGFnLCBidXQgbGV0J3MgZ2V0IHRoZSBpbmZvcm1hdGlvbiBpZiB3ZSBhcmUgbG9va2luZyBmb3JcclxuICAgICAgICAgICAgLy8gYSBjaGlsZCBlbGVtZW50IG9yIGFuIGF0dHJpYnV0ZVxyXG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcodGFnUG9zaXRpb24pO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgIHRhZ05hbWU6IHRhZyxcclxuICAgICAgICAgICAgICBpc0F0dHJpYnV0ZVNlYXJjaDogdGV4dC5pbmRleE9mKCc8JykgPiB0ZXh0LmluZGV4T2YoJz4nKVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgLy8gcmVtb3ZlIHRoZSBsYXN0IGNsb3NlZCB0YWdcclxuICAgICAgICAgIGNsb3NpbmdUYWdzLnNwbGljZShjbG9zaW5nVGFncy5sZW5ndGggLSAxLCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gcmVtb3ZlIHRoZSBsYXN0IGNoZWNrZWQgdGFnIGFuZCBjb250aW51ZSBwcm9jZXNzaW5nIHRoZSByZXN0IG9mIHRoZSBjb250ZW50XHJcbiAgICAgICAgdGV4dCA9IHRleHQuc3Vic3RyaW5nKDAsIHRhZ1Bvc2l0aW9uKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZ2V0QXJlYUluZm8odGV4dCkge1xyXG4gICAgLy8gb3BlbmluZyBmb3Igc3RyaW5ncywgY29tbWVudHMgYW5kIENEQVRBXHJcbiAgICB2YXIgaXRlbXMgPSBbJ1wiJywgJ1xcJycsICc8IS0tJywgJzwhW0NEQVRBWyddO1xyXG4gICAgdmFyIGlzQ29tcGxldGlvbkF2YWlsYWJsZSA9IHRydWU7XHJcbiAgICAvLyByZW1vdmUgYWxsIGNvbW1lbnRzLCBzdHJpbmdzIGFuZCBDREFUQVxyXG4gICAgdGV4dCA9IHRleHQucmVwbGFjZSgvXCIoW15cIlxcXFxdKihcXFxcLlteXCJcXFxcXSopKilcInxcXCcoW15cXCdcXFxcXSooXFxcXC5bXlxcJ1xcXFxdKikqKVxcJ3w8IS0tKFtcXHNcXFNdKSo/LS0+fDwhXFxbQ0RBVEFcXFsoLio/KVxcXVxcXT4vZywgJycpO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICB2YXIgaXRlbUlkeCA9IHRleHQuaW5kZXhPZihpdGVtc1tpXSk7XHJcbiAgICAgIGlmIChpdGVtSWR4ID4gLTEpIHtcclxuICAgICAgICAvLyB3ZSBhcmUgaW5zaWRlIG9uZSBvZiB1bmF2YWlsYWJsZSBhcmVhcywgc28gd2UgcmVtb3RlIHRoYXQgYXJlYVxyXG4gICAgICAgIC8vIGZyb20gb3VyIGNsZWFyIHRleHRcclxuICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgaXRlbUlkeCk7XHJcbiAgICAgICAgLy8gYW5kIHRoZSBjb21wbGV0aW9uIGlzIG5vdCBhdmFpbGFibGVcclxuICAgICAgICBpc0NvbXBsZXRpb25BdmFpbGFibGUgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgY29uc29sZS5sb2coXCJjb21wbGV0aW9uIGF2YWlsYWJsZTogXCIsIGlzQ29tcGxldGlvbkF2YWlsYWJsZSwgdGV4dClcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlzQ29tcGxldGlvbkF2YWlsYWJsZTogaXNDb21wbGV0aW9uQXZhaWxhYmxlLFxyXG4gICAgICBjbGVhcmVkVGV4dDogdGV4dFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHNob3VsZFNraXBMZXZlbCh0YWdOYW1lKSB7XHJcbiAgICAvLyBpZiB3ZSBsb29rIGF0IHRoZSBYU0Qgc2NoZW1hLCB0aGVzZSBub2RlcyBhcmUgY29udGFpbmVycyBmb3IgZWxlbWVudHMsXHJcbiAgICAvLyBzbyB3ZSBjYW4gc2tpcCB0aGF0IGxldmVsXHJcbiAgICByZXR1cm4gdGFnTmFtZSA9PT0gJ2NvbXBsZXhUeXBlJyB8fCB0YWdOYW1lID09PSAnYWxsJyB8fCB0YWdOYW1lID09PSAnc2VxdWVuY2UnO1xyXG4gIH1cclxuXHJcbiAgZmluZEVsZW1lbnRzKGVsZW1lbnRzLCBlbGVtZW50TmFtZSkge1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAvLyB3ZSBhcmUgbG9va2luZyBmb3IgZWxlbWVudHMsIHNvIHdlIGRvbid0IG5lZWQgdG8gcHJvY2VzcyBhbm5vdGF0aW9ucyBhbmQgYXR0cmlidXRlc1xyXG4gICAgICBpZiAoZWxlbWVudHNbaV0udGFnTmFtZSAhPT0gJ2Fubm90YXRpb24nICYmIGVsZW1lbnRzW2ldLnRhZ05hbWUgIT09ICdhdHRyaWJ1dGUnKSB7XHJcbiAgICAgICAgLy8gaWYgaXQgaXMgb25lIG9mIHRoZSBub2RlcyB0aGF0IGRvIG5vdCBoYXZlIHRoZSBpbmZvIHdlIG5lZWQsIHNraXAgaXRcclxuICAgICAgICAvLyBhbmQgcHJvY2VzcyB0aGF0IG5vZGUncyBjaGlsZCBpdGVtc1xyXG4gICAgICAgIGlmICh0aGlzLnNob3VsZFNraXBMZXZlbChlbGVtZW50c1tpXS50YWdOYW1lKSkge1xyXG4gICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5maW5kRWxlbWVudHMoZWxlbWVudHNbaV0uY2hpbGRyZW4sIGVsZW1lbnROYW1lKTtcclxuICAgICAgICAgIC8vIGlmIGNoaWxkIGV4aXN0cywgcmV0dXJuIGl0XHJcbiAgICAgICAgICBpZiAoY2hpbGQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNoaWxkO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBpZiB0aGVyZSBpcyBubyBlbGVtZW50TmFtZSwgcmV0dXJuIGFsbCBlbGVtZW50cyAod2UnbGwgZXhwbGFpblxyXG4gICAgICAgIC8vIHRoaXMgYml0IGxpdHRsZSBsYXRlclxyXG4gICAgICAgIGVsc2UgaWYgKCFlbGVtZW50TmFtZSkge1xyXG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnRzO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBmaW5kIGFsbCB0aGUgZWxlbWVudCBhdHRyaWJ1dGVzLCBhbmQgaWYgaXMndCBuYW1lIGlzIHRoZSBzYW1lXHJcbiAgICAgICAgLy8gYXMgdGhlIGVsZW1lbnQgd2UncmUgbG9va2luZyBmb3IsIHJldHVybiB0aGUgZWxlbWVudC5cclxuICAgICAgICBlbHNlIGlmICh0aGlzLmdldEVsZW1lbnRBdHRyaWJ1dGVzKGVsZW1lbnRzW2ldKS5uYW1lID09PSBlbGVtZW50TmFtZSkge1xyXG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnRzW2ldO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZmluZEF0dHJpYnV0ZXMoZWxlbWVudHMpIHtcclxuICAgIHZhciBhdHRycyA9IFtdO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAvLyBza2lwIGxldmVsIGlmIGl0IGlzIGEgJ2NvbXBsZXhUeXBlJyB0YWdcclxuICAgICAgaWYgKGVsZW1lbnRzW2ldLnRhZ05hbWUgPT09ICdjb21wbGV4VHlwZScpIHtcclxuICAgICAgICB2YXIgY2hpbGQgPSB0aGlzLmZpbmRBdHRyaWJ1dGVzKGVsZW1lbnRzW2ldLmNoaWxkcmVuKTtcclxuICAgICAgICBpZiAoY2hpbGQpIHtcclxuICAgICAgICAgIHJldHVybiBjaGlsZDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLy8gd2UgbmVlZCBvbmx5IHRob3NlIFhTRCBlbGVtZW50cyB0aGF0IGhhdmUgYVxyXG4gICAgICAvLyB0YWcgJ2F0dHJpYnV0ZSdcclxuICAgICAgZWxzZSBpZiAoZWxlbWVudHNbaV0udGFnTmFtZSA9PT0gJ2F0dHJpYnV0ZScpIHtcclxuICAgICAgICBhdHRycy5wdXNoKGVsZW1lbnRzW2ldKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGF0dHJzO1xyXG4gIH1cclxuXHJcbiAgZ2V0RWxlbWVudEF0dHJpYnV0ZXMoZWxlbWVudCkge1xyXG4gICAgdmFyIGF0dHJzID0ge307XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVsZW1lbnQuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBhdHRyc1tlbGVtZW50LmF0dHJpYnV0ZXNbaV0ubmFtZV0gPSBlbGVtZW50LmF0dHJpYnV0ZXNbaV0udmFsdWU7XHJcbiAgICB9XHJcbiAgICAvLyByZXR1cm4gYWxsIGF0dHJpYnV0ZXMgYXMgYW4gb2JqZWN0XHJcbiAgICByZXR1cm4gYXR0cnM7XHJcbiAgfVxyXG5cclxuICBnZXRJdGVtRG9jdW1lbnRhdGlvbihlbGVtZW50KSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgLy8gYW5ub3RhaW9uIGNvbnRhaW5zIGRvY3VtZW50YXRpb24sIHNvIGNhbGN1bGF0ZSB0aGVcclxuICAgICAgLy8gZG9jdW1lbnRhdGlvbiBmcm9tIGl0J3MgY2hpbGQgZWxlbWVudHNcclxuICAgICAgaWYgKGVsZW1lbnQuY2hpbGRyZW5baV0udGFnTmFtZSA9PT0gJ2Fubm90YXRpb24nKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SXRlbURvY3VtZW50YXRpb24oZWxlbWVudC5jaGlsZHJlblswXSk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gaWYgaXQncyB0aGUgZG9jdW1lbnRhdGlvbiBlbGVtZW50LCBqdXN0IGdldCB0aGUgdmFsdWVcclxuICAgICAgZWxzZSBpZiAoZWxlbWVudC5jaGlsZHJlbltpXS50YWdOYW1lID09PSAnZG9jdW1lbnRhdGlvbicpIHtcclxuICAgICAgICByZXR1cm4gZWxlbWVudC5jaGlsZHJlbltpXS50ZXh0Q29udGVudDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaXNJdGVtQXZhaWxhYmxlKGl0ZW1OYW1lLCBtYXhPY2N1cnMsIGl0ZW1zKSB7XHJcbiAgICAvLyB0aGUgZGVmYXVsdCBmb3IgJ21heE9jY3VycycgaXMgMVxyXG4gICAgbWF4T2NjdXJzID0gbWF4T2NjdXJzIHx8ICcxJztcclxuICAgIC8vIHRoZSBlbGVtZW50IGNhbiBhcHBlcmUgaW5maW5pdGUgdGltZXMsIHNvIGl0IGlzIGF2YWlsYWJlbFxyXG4gICAgaWYgKG1heE9jY3VycyAmJiBtYXhPY2N1cnMgPT09ICd1bmJvdW5kZWQnKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgLy8gY291bnQgaG93IG1hbnkgdGltZXMgdGhlIGVsZW1lbnQgYXBwZXJlZFxyXG4gICAgdmFyIGNvdW50ID0gMDtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgaWYgKGl0ZW1zW2ldID09PSBpdGVtTmFtZSkge1xyXG4gICAgICAgIGNvdW50Kys7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIGlmIGl0IGRpZG4ndCBhcHBlYXIgeWV0LCBvciBpdCBjYW4gYXBwZWFyIGFnYWluLCB0aGVuIGl0XHJcbiAgICAvLyBpcyBhdmFpbGFibGUsIG90aGVyd2lzZSBpdCd0IG5vdFxyXG4gICAgcmV0dXJuIGNvdW50ID09PSAwIHx8IHBhcnNlSW50KG1heE9jY3VycykgPiBjb3VudDtcclxuICB9XHJcblxyXG4gIGdldEF2YWlsYWJsZUVsZW1lbnRzKG1vbmFjbywgZWxlbWVudHMsIHVzZWRJdGVtcykge1xyXG4gICAgdmFyIGF2YWlsYWJsZUl0ZW1zID0gW107XHJcbiAgICB2YXIgY2hpbGRyZW47XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIC8vIGFubm90YXRpb24gZWxlbWVudCBvbmx5IGNvbnRhaW5zIGRvY3VtZW50YXRpb24sXHJcbiAgICAgIC8vIHNvIG5vIG5lZWQgdG8gcHJvY2VzcyBpdCBoZXJlXHJcbiAgICAgIGlmIChlbGVtZW50c1tpXS50YWdOYW1lICE9PSAnYW5ub3RhdGlvbicpIHtcclxuICAgICAgICAvLyBnZXQgYWxsIGNoaWxkIGVsZW1lbnRzIHRoYXQgaGF2ZSAnZWxlbWVudCcgdGFnXHJcbiAgICAgICAgY2hpbGRyZW4gPSB0aGlzLmZpbmRFbGVtZW50cyhbZWxlbWVudHNbaV1dKVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBpZiB0aGVyZSBhcmUgbm8gc3VjaCBlbGVtZW50cywgdGhlbiB0aGVyZSBhcmUgbm8gc3VnZ2VzdGlvbnNcclxuICAgIGlmICghY2hpbGRyZW4pIHtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAvLyBnZXQgYWxsIGVsZW1lbnQgYXR0cmlidXRlc1xyXG4gICAgICBsZXQgZWxlbWVudEF0dHJzID0gdGhpcy5nZXRFbGVtZW50QXR0cmlidXRlcyhjaGlsZHJlbltpXSk7XHJcbiAgICAgIC8vIHRoZSBlbGVtZW50IGlzIGEgc3VnZ2VzdGlvbiBpZiBpdCdzIGF2YWlsYWJsZVxyXG4gICAgICBpZiAodGhpcy5pc0l0ZW1BdmFpbGFibGUoZWxlbWVudEF0dHJzLm5hbWUsIGVsZW1lbnRBdHRycy5tYXhPY2N1cnMsIHVzZWRJdGVtcykpIHtcclxuICAgICAgICAvLyBtYXJrIGl0IGFzIGEgJ2ZpZWxkJywgYW5kIGdldCB0aGUgZG9jdW1lbnRhdGlvblxyXG4gICAgICAgIGF2YWlsYWJsZUl0ZW1zLnB1c2goe1xyXG4gICAgICAgICAgbGFiZWw6IGVsZW1lbnRBdHRycy5uYW1lLFxyXG4gICAgICAgICAga2luZDogbW9uYWNvLmxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuRmllbGQsXHJcbiAgICAgICAgICBkZXRhaWw6IGVsZW1lbnRBdHRycy50eXBlLFxyXG4gICAgICAgICAgZG9jdW1lbnRhdGlvbjogdGhpcy5nZXRJdGVtRG9jdW1lbnRhdGlvbihjaGlsZHJlbltpXSlcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gcmV0dXJuIHRoZSBzdWdnZXN0aW9ucyB3ZSBmb3VuZFxyXG4gICAgcmV0dXJuIGF2YWlsYWJsZUl0ZW1zO1xyXG4gIH1cclxuXHJcbiAgZ2V0QXZhaWxhYmxlQXR0cmlidXRlKG1vbmFjbywgZWxlbWVudHMsIHVzZWRDaGlsZFRhZ3MpIHtcclxuICAgIHZhciBhdmFpbGFibGVJdGVtcyA9IFtdO1xyXG4gICAgdmFyIGNoaWxkcmVuO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAvLyBhbm5vdGF0aW9uIGVsZW1lbnQgb25seSBjb250YWlucyBkb2N1bWVudGF0aW9uLFxyXG4gICAgICAvLyBzbyBubyBuZWVkIHRvIHByb2Nlc3MgaXQgaGVyZVxyXG4gICAgICBpZiAoZWxlbWVudHNbaV0udGFnTmFtZSAhPT0gJ2Fubm90YXRpb24nKSB7XHJcbiAgICAgICAgLy8gZ2V0IGFsbCBjaGlsZCBlbGVtZW50cyB0aGF0IGhhdmUgJ2F0dHJpYnV0ZScgdGFnXHJcbiAgICAgICAgY2hpbGRyZW4gPSB0aGlzLmZpbmRBdHRyaWJ1dGVzKFtlbGVtZW50c1tpXV0pXHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIGlmIHRoZXJlIGFyZSBubyBhdHRyaWJ1dGVzLCB0aGVuIHRoZXJlIGFyZSBub1xyXG4gICAgLy8gc3VnZ2VzdGlvbnMgYXZhaWxhYmxlXHJcbiAgICBpZiAoIWNoaWxkcmVuKSB7XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgLy8gZ2V0IGFsbCBhdHRyaWJ1dGVzIGZvciB0aGUgZWxlbWVudFxyXG4gICAgICB2YXIgYXR0cnMgPSB0aGlzLmdldEVsZW1lbnRBdHRyaWJ1dGVzKGNoaWxkcmVuW2ldKTtcclxuICAgICAgLy8gYWNjZXB0IGl0IGluIGEgc3VnZ2VzdGlvbiBsaXN0IG9ubHkgaWYgaXQgaXMgYXZhaWxhYmxlXHJcbiAgICAgIGlmICh0aGlzLmlzSXRlbUF2YWlsYWJsZShhdHRycy5uYW1lLCBhdHRycy5tYXhPY2N1cnMsIHVzZWRDaGlsZFRhZ3MpKSB7XHJcbiAgICAgICAgLy8gbWFyayBpdCBhcyBhICdwcm9wZXJ0eScsIGFuZCBnZXQgaXQncyBkb2N1bWVudGF0aW9uXHJcbiAgICAgICAgYXZhaWxhYmxlSXRlbXMucHVzaCh7XHJcbiAgICAgICAgICBsYWJlbDogYXR0cnMubmFtZSxcclxuICAgICAgICAgIGtpbmQ6IG1vbmFjby5sYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5LFxyXG4gICAgICAgICAgZGV0YWlsOiBhdHRycy50eXBlLFxyXG4gICAgICAgICAgZG9jdW1lbnRhdGlvbjogdGhpcy5nZXRJdGVtRG9jdW1lbnRhdGlvbihjaGlsZHJlbltpXSlcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gcmV0dXJuIHRoZSBlbGVtZW50cyB3ZSBmb3VuZFxyXG4gICAgcmV0dXJuIGF2YWlsYWJsZUl0ZW1zO1xyXG4gIH1cclxuXHJcbiAgZ2V0WG1sQ29tcGxldGlvblByb3ZpZGVyKG1vbmFjbykge1xyXG4gICAgbGV0IGN1ciA9IHRoaXM7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB0cmlnZ2VyQ2hhcmFjdGVyczogWyc8J10sXHJcbiAgICAgIHByb3ZpZGVDb21wbGV0aW9uSXRlbXM6IGZ1bmN0aW9uKG1vZGVsLCBwb3NpdGlvbikge1xyXG4gICAgICAgIC8vIGdldCBlZGl0b3IgY29udGVudCBiZWZvcmUgdGhlIHBvaW50ZXJcclxuICAgICAgICB2YXIgdGV4dFVudGlsUG9zaXRpb24gPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2Uoe1xyXG4gICAgICAgICAgc3RhcnRMaW5lTnVtYmVyOiAxLFxyXG4gICAgICAgICAgc3RhcnRDb2x1bW46IDEsXHJcbiAgICAgICAgICBlbmRMaW5lTnVtYmVyOiBwb3NpdGlvbi5saW5lTnVtYmVyLFxyXG4gICAgICAgICAgZW5kQ29sdW1uOiBwb3NpdGlvbi5jb2x1bW5cclxuICAgICAgICB9KTtcclxuICAgICAgICAvLyBnZXQgY29udGVudCBpbmZvIC0gYXJlIHdlIGluc2lkZSBvZiB0aGUgYXJlYSB3aGVyZSB3ZSBkb24ndCB3YW50IHN1Z2dlc3Rpb25zLCB3aGF0IGlzIHRoZSBjb250ZW50IHdpdGhvdXQgdGhvc2UgYXJlYXNcclxuICAgICAgICB2YXIgYXJlYVVudGlsUG9zaXRpb25JbmZvID0gY3VyLmdldEFyZWFJbmZvKHRleHRVbnRpbFBvc2l0aW9uKTsgLy8gaXNDb21wbGV0aW9uQXZhaWxhYmxlLCBjbGVhcmVkVGV4dFxyXG4gICAgICAgIGNvbnNvbGUubG9nKFwicG9zaXRpb246IFwiLCBhcmVhVW50aWxQb3NpdGlvbkluZm8pO1xyXG4gICAgICAgIC8vIGlmIHdlIGRvbid0IHdhbnQgYW55IHN1Z2dlc3Rpb25zLCByZXR1cm4gZW1wdHkgYXJyYXlcclxuICAgICAgICBpZiAoIWFyZWFVbnRpbFBvc2l0aW9uSW5mby5pc0NvbXBsZXRpb25BdmFpbGFibGUpIHtcclxuICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gaWYgd2Ugd2FudCBzdWdnZXN0aW9ucywgaW5zaWRlIG9mIHdoaWNoIHRhZyBhcmUgd2U/XHJcbiAgICAgICAgdmFyIGxhc3RPcGVuZWRUYWcgPSBjdXIuZ2V0TGFzdE9wZW5lZFRhZyhhcmVhVW50aWxQb3NpdGlvbkluZm8uY2xlYXJlZFRleHQpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwibGFzdCBvcGVuZWQgdGFnOiBcIiwgbGFzdE9wZW5lZFRhZyk7XHJcbiAgICAgICAgLy8gZ2V0IG9wZW5lZCB0YWdzIHRvIHNlZSB3aGF0IHRhZyB3ZSBzaG91bGQgbG9vayBmb3IgaW4gdGhlIFhTRCBzY2hlbWFcclxuICAgICAgICB2YXIgb3BlbmVkVGFncyA9IFtdO1xyXG4gICAgICAgIC8vIGdldCB0aGUgZWxlbWVudHMvYXR0cmlidXRlcyB0aGF0IGFyZSBhbHJlYWR5IG1lbnRpb25lZCBpbiB0aGUgZWxlbWVudCB3ZSdyZSBpblxyXG4gICAgICAgIHZhciB1c2VkSXRlbXMgPSBbXTtcclxuICAgICAgICB2YXIgaXNBdHRyaWJ1dGVTZWFyY2ggPSBsYXN0T3BlbmVkVGFnICYmIGxhc3RPcGVuZWRUYWcuaXNBdHRyaWJ1dGVTZWFyY2g7XHJcbiAgICAgICAgLy8gbm8gbmVlZCB0byBjYWxjdWxhdGUgdGhlIHBvc2l0aW9uIGluIHRoZSBYU0Qgc2NoZW1hIGlmIHdlIGFyZSBpbiB0aGUgcm9vdCBlbGVtZW50XHJcbiAgICAgICAgaWYgKGxhc3RPcGVuZWRUYWcpIHtcclxuICAgICAgICAgIC8vIHBhcnNlIHRoZSBjb250ZW50IChub3QgY2xlYXJlZCB0ZXh0KSBpbnRvIGFuIHhtbCBkb2N1bWVudFxyXG4gICAgICAgICAgdmFyIHhtbERvYyA9IGN1ci5zdHJpbmdUb1htbChtb2RlbC5nZXRWYWx1ZSgpKTtcclxuICAgICAgICAgIHZhciBsYXN0Q2hpbGQgPSB4bWxEb2MubGFzdEVsZW1lbnRDaGlsZDtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKHhtbERvYyk7XHJcbiAgICAgICAgICB3aGlsZSAobGFzdENoaWxkKSB7XHJcbiAgICAgICAgICAgIG9wZW5lZFRhZ3MucHVzaChsYXN0Q2hpbGQudGFnTmFtZSk7XHJcbiAgICAgICAgICAgIC8vIGlmIHdlIGZvdW5kIG91ciBsYXN0IG9wZW5lZCB0YWdcclxuICAgICAgICAgICAgaWYgKGxhc3RDaGlsZC50YWdOYW1lID09PSBsYXN0T3BlbmVkVGFnLnRhZ05hbWUpIHtcclxuICAgICAgICAgICAgICAvLyBpZiB3ZSBhcmUgbG9va2luZyBmb3IgYXR0cmlidXRlcywgdGhlbiB1c2VkIGl0ZW1zIHNob3VsZFxyXG4gICAgICAgICAgICAgIC8vIGJlIHRoZSBhdHRyaWJ1dGVzIHdlIGFscmVhZHkgdXNlZFxyXG4gICAgICAgICAgICAgIGlmIChsYXN0T3BlbmVkVGFnLmlzQXR0cmlidXRlU2VhcmNoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYXR0cnMgPSBsYXN0Q2hpbGQuYXR0cmlidXRlcztcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0cnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgdXNlZEl0ZW1zLnB1c2goYXR0cnNbaV0ubm9kZU5hbWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBpZiB3ZSBhcmUgbG9va2luZyBmb3IgY2hpbGQgZWxlbWVudHMsIHRoZW4gdXNlZCBpdGVtc1xyXG4gICAgICAgICAgICAgICAgLy8gc2hvdWxkIGJlIHRoZSBlbGVtZW50cyB0aGF0IHdlcmUgYWxyZWFkeSB1c2VkXHJcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGRyZW4gPSBsYXN0Q2hpbGQuY2hpbGRyZW47XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgIHVzZWRJdGVtcy5wdXNoKGNoaWxkcmVuW2ldLnRhZ05hbWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyB3ZSBoYXZlbid0IGZvdW5kIHRoZSBsYXN0IG9wZW5lZCB0YWcgeWV0LCBzbyB3ZSBtb3ZlIHRvXHJcbiAgICAgICAgICAgIC8vIHRoZSBuZXh0IGVsZW1lbnRcclxuICAgICAgICAgICAgbGFzdENoaWxkID0gbGFzdENoaWxkLmxhc3RFbGVtZW50Q2hpbGQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGZpbmQgdGhlIGxhc3Qgb3BlbmVkIHRhZyBpbiB0aGUgc2NoZW1hIHRvIHNlZSB3aGF0IGVsZW1lbnRzL2F0dHJpYnV0ZXMgaXQgY2FuIGhhdmVcclxuICAgICAgICB2YXIgY3VycmVudEl0ZW0gPSB0aGlzLnNjaGVtYU5vZGU7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcGVuZWRUYWdzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBpZiAoY3VycmVudEl0ZW0pIHtcclxuICAgICAgICAgICAgY3VycmVudEl0ZW0gPSBjdXIuZmluZEVsZW1lbnRzKGN1cnJlbnRJdGVtLmNoaWxkcmVuLCBvcGVuZWRUYWdzW2ldKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJldHVybiBhdmFpbGFibGUgZWxlbWVudHMvYXR0cmlidXRlcyBpZiB0aGUgdGFnIGV4aXN0cyBpbiB0aGUgc2NoZW1hLCBvciBhbiBlbXB0eVxyXG4gICAgICAgIC8vIGFycmF5IGlmIGl0IGRvZXNuJ3RcclxuICAgICAgICBpZiAoaXNBdHRyaWJ1dGVTZWFyY2gpIHtcclxuICAgICAgICAgIC8vIGdldCBhdHRyaWJ1dGVzIGNvbXBsZXRpb25zXHJcbiAgICAgICAgICByZXR1cm4gY3VycmVudEl0ZW0gPyBjdXIuZ2V0QXZhaWxhYmxlQXR0cmlidXRlKG1vbmFjbywgY3VycmVudEl0ZW0uY2hpbGRyZW4sIHVzZWRJdGVtcykgOiBbXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gZ2V0IGVsZW1lbnRzIGNvbXBsZXRpb25zXHJcbiAgICAgICAgICByZXR1cm4gY3VycmVudEl0ZW0gPyBjdXIuZ2V0QXZhaWxhYmxlRWxlbWVudHMobW9uYWNvLCBjdXJyZW50SXRlbS5jaGlsZHJlbiwgdXNlZEl0ZW1zKSA6IFtdO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgVmFsaWRhdGVDb25maWd1cmF0aW9uVmlldyBmcm9tICcuL1ZhbGlkYXRlQ29uZmlndXJhdGlvblZpZXcuanMnO1xyXG5pbXBvcnQgQ29kZUNvbXBsZXRpb25WaWV3IGZyb20gJy4vQ29kZUNvbXBsZXRpb25WaWV3LmpzJztcclxuXHJcbmV4cG9ydCBjb25zdCBsb2dDb2xvciA9ICdiYWNrZ3JvdW5kOiAjMjIyOyBjb2xvcjogI2JhZGE1NSc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDb2RlVmlldyB7XHJcblxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcclxuICAgIHRoaXMuaWJpc2RvY0pzb24gPSBudWxsO1xyXG4gICAgdGhpcy5kZWNvcmF0aW9ucyA9IG51bGw7XHJcbiAgICB0aGlzLmRlY29yYXRpb25zID0gbnVsbDtcclxuICAgIHRoaXMudmFsaWRhdGVDb25maWd1cmF0aW9uVmlldztcclxuICAgIHRoaXMuQ29kZUNvbXBsZXRpb25WaWV3ID0gbmV3IENvZGVDb21wbGV0aW9uVmlldyh0aGlzKTtcclxuICB9XHJcblxyXG4gIGFkZExpc3RlbmVyKGxpc3RlbmVyKSB7XHJcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcclxuICB9XHJcblxyXG4gIG5vdGlmeUxpc3RlbmVycyhkYXRhKSB7XHJcbiAgICB0aGlzLmxpc3RlbmVycy5mb3JFYWNoKGwgPT4gbC5ub3RpZnkoZGF0YSkpO1xyXG4gIH1cclxuXHJcbiAgLy9tYWtlIHRoZSBlZGl0b3IuXHJcbiAgbWFrZUVkaXRvcihhZGFwdGVyKSB7XHJcbiAgICB0aGlzLmVkaXRvciA9IG1vbmFjby5lZGl0b3IuY3JlYXRlKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb25hY29Db250YWluZXInKSwge1xyXG4gICAgICB2YWx1ZTogYWRhcHRlcixcclxuICAgICAgbGFuZ3VhZ2U6ICd4bWwnLFxyXG4gICAgICB0aGVtZTogXCJ2cy1kYXJrXCIsXHJcbiAgICAgIGdseXBoTWFyZ2luOiB0cnVlLFxyXG4gICAgICBhdXRvbWF0aWNMYXlvdXQ6IHRydWVcclxuICAgIH0pO1xyXG4gICAgdGhpcy5zZWxlY3RQaXBlKFwiU3dpdGNoSW5wdXRcIik7XHJcbiAgICB0aGlzLnZhbGlkYXRlQ29uZmlndXJhdGlvblZpZXcgPSBuZXcgVmFsaWRhdGVDb25maWd1cmF0aW9uVmlldyh0aGlzLmVkaXRvcik7XHJcbiAgfVxyXG5cclxuICAvL2Z1bmN0aW9uIHRvIGVkaXQgdGhlIGNvZGUgaW4gdGhlIGVkaXRvci5cclxuICBlZGl0KHJhbmdlLCBuYW1lKSB7XHJcbiAgICB0aGlzLmVkaXRvci5leGVjdXRlRWRpdHMoXCJtb25hY29Db250YWluZXJcIiwgW3tcclxuICAgICAgcmFuZ2U6IHJhbmdlLFxyXG4gICAgICB0ZXh0OiBuYW1lXHJcbiAgICB9XSk7XHJcbiAgfVxyXG5cclxuICAvL2FkZCBvcHRpb25zIHRvIHRoZSBkcm9wZG93bi5cclxuICBhZGRPcHRpb25zKGFkYXB0ZXJzKSB7XHJcbiAgICBsZXQgc2VsZWN0ID0gJCgnI2FkYXB0ZXJTZWxlY3QnKSxcclxuICAgICAgb3B0aW9uLFxyXG4gICAgICBuYW1lO1xyXG4gICAgYWRhcHRlcnMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gICAgICBuYW1lID0gaXRlbS5tYXRjaCgvPENvbmZpZ3VyYXRpb25bXl0qP25hbWU9XCIuKj9cIi9nKTtcclxuICAgICAgaWYgKG5hbWUgIT0gbnVsbCkge1xyXG4gICAgICAgIG5hbWUgPSBuYW1lWzBdLm1hdGNoKC9cIi4qP1wiL2cpWzBdLnJlcGxhY2UoL1wiL2csICcnKTtcclxuICAgICAgICBvcHRpb24gPSAkKCc8b3B0aW9uPjwvb3B0aW9uPicpLmF0dHIoJ3ZhbHVlJywgaW5kZXgpLnRleHQobmFtZSk7XHJcbiAgICAgICAgJChzZWxlY3QpLmFwcGVuZChvcHRpb24pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHRoaXMuZWRpdG9yLnNldFZhbHVlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiMFwiKSk7XHJcbiAgfVxyXG5cclxuICAvL3NlbGVjdCBhIHBpcGUuXHJcbiAgc2VsZWN0UGlwZShuYW1lKSB7XHJcbiAgICBsZXQgY3VyID0gdGhpcyxcclxuICAgICAgYXR0cmlidXRlT2JqZWN0UmVnZXggPSAnPFtcXFxcU10qP1teXCIvXVtwUF1pcGVbXFxcXHNcXFxcdFxcXFxuXVteXSo/PlteXSo/PFsvXVtcXFxcU10qP1teXCIvXVBpcGU+JyxcclxuICAgICAgc2VsZWN0UGlwZSA9IG51bGwsXHJcbiAgICAgIG1hdGNoZXMgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmZpbmRNYXRjaGVzKGF0dHJpYnV0ZU9iamVjdFJlZ2V4LCBmYWxzZSwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcclxuXHJcbiAgICBtYXRjaGVzLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaW5kZXgpIHtcclxuICAgICAgbGV0IHBpcGUgPSBjdXIuZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWVJblJhbmdlKGl0ZW0ucmFuZ2UpO1xyXG4gICAgICBpZiAocGlwZS5tYXRjaCgnbmFtZT1cIicgKyBuYW1lICsgJ1wiJywgJ2cnKSAhPT0gbnVsbCkge1xyXG4gICAgICAgIHNlbGVjdFBpcGUgPSBpdGVtLnJhbmdlO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIGlmIChzZWxlY3RQaXBlID09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIHNlbGVjdFBpcGU7XHJcbiAgICB9XHJcbiAgICB0aGlzLmRlY29yYXRpb25zID0gdGhpcy5lZGl0b3IuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW3tcclxuICAgICAgcmFuZ2U6IHNlbGVjdFBpcGUsXHJcbiAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBpbmxpbmVDbGFzc05hbWU6ICdteUNvbnRlbnRDbGFzcydcclxuICAgICAgfVxyXG4gICAgfV0pO1xyXG4gIH1cclxuXHJcbiAgLy9jaGFuZ2UgdGhlIG5hbWUuXHJcbiAgY2hhbmdlTmFtZShvbGRXb3JkLCBuZXdXb3JkKSB7XHJcbiAgICBsZXQgY2hhbmdlZCA9IHRoaXMuY2hhbmdlTmFtZUNvZGUoJzxbXFxcXFNdKj9bXlwiL11bcFBdaXBlKFxcXFxuXFxcXHQqKT9cXFxccz9uYW1lPVwiXFxcXHcqXCInLCBvbGRXb3JkLCBuZXdXb3JkKTtcclxuICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgIHRoaXMuY2hhbmdlTmFtZUNvZGUoJzxmb3J3YXJkKFxcXFxuXFxcXHQqKT8oXFxcXHNcXFxcdyo9XCIoXFxcXHM/XFxcXFMpKlwiKFxcXFxuXFxcXHQqKT8pKlxcXFwvPicsIG9sZFdvcmQsIG5ld1dvcmQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy9jaGFuZ2UgcG9zc2l0aW9uIGZvciBwaXBlc1xyXG4gIGNoYW5nZVBvc3NpdGlvbihuYW1lLCBuZXdYLCBuZXdZKSB7XHJcbiAgICBsZXQgY3VyID0gdGhpcztcclxuICAgIGxldCBhdHRyaWJ1dGVPYmplY3RSZWdleCA9ICc8W1xcXFxTXSo/W15cIi9dW3BQXWlwZVtcXFxcc1xcXFx0XFxcXG5dW15dKj8+fFJlY2VpdmVyW1xcXFxzXFxcXHRcXFxcbl1bXl0qPz4nO1xyXG4gICAgbGV0IG1hdGNoZXMgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmZpbmRNYXRjaGVzKGF0dHJpYnV0ZU9iamVjdFJlZ2V4LCBmYWxzZSwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcclxuICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoJyhyZWNlaXZlcik6ICcsICcnKTtcclxuICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gICAgICBsZXQgcGlwZSA9IGN1ci5lZGl0b3IuZ2V0TW9kZWwoKS5nZXRWYWx1ZUluUmFuZ2UoaXRlbS5yYW5nZSk7XHJcbiAgICAgIGlmIChwaXBlLnNwbGl0KCdcIicpLmZpbmQod29yZCA9PiB3b3JkID09PSBuYW1lKSkge1xyXG4gICAgICAgIGxldCBuZXdQaXBlID0gXCJcIjtcclxuICAgICAgICBpZiAocGlwZS5zcGxpdCgvW1xccz1dLykuZmluZCh3b3JkID0+IHdvcmQgPT0gJ3gnKSkge1xyXG4gICAgICAgICAgcGlwZSA9IHBpcGUucmVwbGFjZShuZXcgUmVnRXhwKCd4PVwiWzAtOV0qXCInLCAnZycpLCAneD1cIicgKyBuZXdYICsgJ1wiJyk7XHJcbiAgICAgICAgICBwaXBlID0gcGlwZS5yZXBsYWNlKG5ldyBSZWdFeHAoJ3k9XCJbMC05XSpcIicsICdnJyksICd5PVwiJyArIG5ld1kgKyAnXCInKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbGV0IHN0ciA9ICcgeD1cIicgKyBuZXdYICsgJ1wiIHk9XCInICsgbmV3WSArICdcIic7XHJcbiAgICAgICAgICBpZiAocGlwZS5pbmRleE9mKCcvPicpICE9IC0xKSB7XHJcbiAgICAgICAgICAgIHBpcGUgPSBwaXBlLnNsaWNlKDAsIHBpcGUuaW5kZXhPZignLycpKSArIHN0ciArIHBpcGUuc2xpY2UocGlwZS5pbmRleE9mKCcvJykpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcGlwZSA9IHBpcGUuc2xpY2UoMCwgcGlwZS5pbmRleE9mKCc+JykpICsgc3RyICsgcGlwZS5zbGljZShwaXBlLmluZGV4T2YoJz4nKSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGN1ci5lZGl0KGl0ZW0ucmFuZ2UsIHBpcGUpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vY2hhbmdlIHRoZSBwb3NzaXRpb25zIGZvciB0aGUgZXhpdHNcclxuICBjaGFuZ2VFeGl0UG9zc2l0aW9uKG5hbWUsIG5ld1gsIG5ld1kpIHtcclxuICAgIGxldCBjdXIgPSB0aGlzO1xyXG4gICAgbGV0IGFkYXB0ZXJOYW1lID0gJCgnI2NhbnZhcycpLnRleHQoKS5tYXRjaCgvQWRhcHRlcjpcXHMuKj9cXHMvZylbMF0ucmVwbGFjZSgvQWRhcHRlcjpcXHMvZywgJycpLnJlcGxhY2UoJyAnLCAnJyk7XHJcbiAgICBsZXQgYXR0cmlidXRlT2JqZWN0UmVnZXggPSAnPEFkYXB0ZXJbXj5dKj8gbmFtZT1cIicgKyBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImN1cnJlbnRBZGFwdGVyXCIpICsgJ1wiW1xcXFxzXFxcXFNcXFxcbl0qPzxFeGl0IFteXSo/XFxcXC8+JztcclxuICAgIGxldCBtYXRjaGVzID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS5maW5kTWF0Y2hlcyhhdHRyaWJ1dGVPYmplY3RSZWdleCwgZmFsc2UsIHRydWUsIGZhbHNlLCBmYWxzZSk7XHJcblxyXG4gICAgbWF0Y2hlcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XHJcbiAgICAgIGxldCBleGl0ID0gY3VyLmVkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlSW5SYW5nZShpdGVtLnJhbmdlKTtcclxuICAgICAgZXhpdCA9IGV4aXQubWF0Y2goJzxFeGl0IFteXSo/XFxcXC8+JylbMF07XHJcbiAgICAgIGlmIChleGl0LmluZGV4T2YoJ3BhdGg9XCInICsgbmFtZSArICdcIicpICE9IC0xKSB7XHJcbiAgICAgICAgaWYgKGV4aXQuaW5kZXhPZigneD1cIicpICE9IC0xKSB7XHJcbiAgICAgICAgICBleGl0ID0gJ1xcdFxcdCcgKyBleGl0LnJlcGxhY2UoL3g9XCJbMC05XSo/XCIvZywgJ3g9XCInICsgbmV3WCArICdcIicpXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC95PVwiWzAtOV0qP1wiL2csICd5PVwiJyArIG5ld1kgKyAnXCInKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbGV0IHN0ciA9ICcgeD1cIicgKyBuZXdYICsgJ1wiIHk9XCInICsgbmV3WSArICdcIidcclxuICAgICAgICAgIGV4aXQgPSAnXFx0XFx0JyArIGV4aXQuc2xpY2UoMCwgZXhpdC5pbmRleE9mKCcvJykpICsgc3RyICsgZXhpdC5zbGljZShleGl0LmluZGV4T2YoJy8nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGl0ZW0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID0gaXRlbS5yYW5nZS5lbmRMaW5lTnVtYmVyO1xyXG4gICAgICAgIGN1ci5lZGl0KGl0ZW0ucmFuZ2UsIGV4aXQpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vY2hhbmdlIHRoZSBuYW1lIG9mIGFuIHBpcGVcclxuICBjaGFuZ2VOYW1lQ29kZShyZWcsIG9sZFdvcmQsIG5ld1dvcmQpIHtcclxuICAgIGxldCBjdXIgPSB0aGlzO1xyXG4gICAgbGV0IGVkaXRvciA9IHRoaXMuZWRpdG9yO1xyXG4gICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuICAgIGxldCBhdHRyaWJ1dGVPYmplY3RSZWdleCA9IHJlZztcclxuICAgIGxldCBtYXRjaGVzID0gZWRpdG9yLmdldE1vZGVsKCkuZmluZE1hdGNoZXMoYXR0cmlidXRlT2JqZWN0UmVnZXgsIGZhbHNlLCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xyXG4gICAgbWF0Y2hlcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XHJcbiAgICAgIGxldCBwaXBlID0gZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWVJblJhbmdlKGl0ZW0ucmFuZ2UpO1xyXG4gICAgICBpZiAocGlwZS5zcGxpdCgnXCInKS5maW5kKHdvcmQgPT4gd29yZCA9PT0gb2xkV29yZCkpIHtcclxuICAgICAgICBsZXQgbmV3UGlwZSA9IHBpcGUucmVwbGFjZShuZXcgUmVnRXhwKG9sZFdvcmQsICdnJyksIG5ld1dvcmQpO1xyXG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgIGN1ci5lZGl0KGl0ZW0ucmFuZ2UsIG5ld1BpcGUpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBjaGFuZ2VkO1xyXG4gIH1cclxuXHJcbiAgLy9hZGQgYSBmb3J3YXJkXHJcbiAgY2hhbmdlQWRkRm9yd2FyZChuYW1lLCBwYXRoKSB7XHJcbiAgICBsZXQgY3VyID0gdGhpcztcclxuICAgIGxldCBhdHRyaWJ1dGVPYmplY3RSZWdleCA9ICc8W1xcXFxTXSo/W15cIi9dW3BQXWlwZVtcXFxcc1xcXFx0XFxcXG5dW15dKj8+W15dKj88Wy9dW1xcXFxTXSo/W15cIi9dUGlwZT4nO1xyXG4gICAgbGV0IG1hdGNoZXMgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmZpbmRNYXRjaGVzKGF0dHJpYnV0ZU9iamVjdFJlZ2V4LCBmYWxzZSwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcclxuICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gICAgICBsZXQgcGlwZSA9IGN1ci5lZGl0b3IuZ2V0TW9kZWwoKS5nZXRWYWx1ZUluUmFuZ2UoaXRlbS5yYW5nZSk7XHJcbiAgICAgIGlmIChwaXBlLnNwbGl0KC9bXFxzPl0vKS5maW5kKHdvcmQgPT4gd29yZCA9PT0gJ25hbWU9XCInICsgbmFtZSArICdcIicpKSB7XHJcbiAgICAgICAgcGlwZSA9IHBpcGUuc2xpY2UoMCwgcGlwZS5zZWFyY2goLzxbL11bXFxTXSo/W15cIi9dUGlwZS8pKSArICdcXHQ8Rm9yd2FyZCBuYW1lPVwic3VjY2Vzc1wiIHBhdGg9XCInICsgcGF0aCArICdcIi8+JztcclxuICAgICAgICBsZXQgbmV3TGluZVJhbmdlID0ge1xyXG4gICAgICAgICAgZW5kQ29sdW1uOiAxLFxyXG4gICAgICAgICAgZW5kTGluZU51bWJlcjogaXRlbS5yYW5nZS5lbmRMaW5lTnVtYmVyLFxyXG4gICAgICAgICAgc3RhcnRDb2x1bW46IDEsXHJcbiAgICAgICAgICBzdGFydExpbmVOdW1iZXI6IGl0ZW0ucmFuZ2UuZW5kTGluZU51bWJlclxyXG4gICAgICAgIH1cclxuICAgICAgICBjdXIuZWRpdChuZXdMaW5lUmFuZ2UsICdcXG4nKTtcclxuICAgICAgICBjdXIuZWRpdChpdGVtLnJhbmdlLCBwaXBlKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvL2RlbGV0ZSBhIGZvcndhcmQgdG8gYW4gcGlwZS5cclxuICBkZWxldGVGb3J3YXJkKG5hbWUsIHBhdGgpIHtcclxuICAgIGxldCBjdXIgPSB0aGlzO1xyXG4gICAgbGV0IGF0dHJpYnV0ZU9iamVjdFJlZ2V4ID0gJzxbXFxcXFNdKj9bXlwiL11bcFBdaXBlW1xcXFxzXFxcXHRcXFxcbl1bXl0qPz5bXl0qPzxbL11bXFxcXFNdKj9bXlwiL11QaXBlPic7XHJcbiAgICBsZXQgbWF0Y2hlcyA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCkuZmluZE1hdGNoZXMoYXR0cmlidXRlT2JqZWN0UmVnZXgsIGZhbHNlLCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xyXG4gICAgbWF0Y2hlcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XHJcbiAgICAgIGxldCBwaXBlID0gY3VyLmVkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlSW5SYW5nZShpdGVtLnJhbmdlKTtcclxuICAgICAgaWYgKHBpcGUuc3BsaXQoL1tcXHM+XS8pLmZpbmQod29yZCA9PiB3b3JkID09PSAnbmFtZT1cIicgKyBuYW1lICsgJ1wiJykpIHtcclxuICAgICAgICBwYXRoLnRvTG93ZXJDYXNlKCkgPT0gXCJleGl0XCIgPyBwYXRoID0gXCJFeGl0XCIgOiBwYXRoID0gcGF0aDtcclxuICAgICAgICBsZXQgbmV3UGlwZSA9IHBpcGUucmVwbGFjZShuZXcgUmVnRXhwKCc8Rm9yd2FyZFteL10qP3BhdGg9XCInICsgcGF0aCArICdcIlteXSo/Lz4nLCAnZ2knKSwgXCJcIik7XHJcbiAgICAgICAgY3VyLmVkaXQoaXRlbS5yYW5nZSwgbmV3UGlwZSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gYSBtZXRob2QgdG8gYWRkIGEgcGlwZSBieSBoYW5kLlxyXG4gIGNoYW5nZUFkZFBpcGUobmFtZSwgcG9zc2l0aW9ucywgY2xhc3NOYW1lID0gXCJjdXN0b21QaXBlXCIpIHtcclxuICAgIGxldCBjdXIgPSB0aGlzO1xyXG4gICAgbGV0IGFkYXB0ZXJOYW1lID0gJCgnI2NhbnZhcycpLnRleHQoKS5tYXRjaCgvQWRhcHRlcjpcXHMuKj9cXHMvZylbMF0ucmVwbGFjZSgvQWRhcHRlcjpcXHMvZywgJycpLnJlcGxhY2UoJyAnLCAnJyk7XHJcbiAgICBsZXQgYXR0cmlidXRlT2JqZWN0UmVnZXggPSAnPEFkYXB0ZXIgbmFtZT1cIicgKyBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImN1cnJlbnRBZGFwdGVyXCIpICsgJ1wiW1xcXFxzXFxcXFNcXFxcbl0qPzxFeGl0JztcclxuICAgIGxldCBtYXRjaFN0cmluZyA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKS5tYXRjaChhdHRyaWJ1dGVPYmplY3RSZWdleCk7XHJcblxyXG4gICAgLy8nPEV4aXQnO1xyXG4gICAgbGV0IG1hdGNoZXMgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmZpbmRNYXRjaGVzKGF0dHJpYnV0ZU9iamVjdFJlZ2V4LCBmYWxzZSwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcclxuICAgIG1hdGNoZXMuc29tZShmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gICAgICBsZXQgcmFuZ2UgPSBpdGVtLnJhbmdlO1xyXG4gICAgICByYW5nZS5zdGFydENvbHVtbiA9IDE7XHJcbiAgICAgIHJhbmdlLmVuZENvbHVtbiA9IDE7XHJcbiAgICAgIHJhbmdlLnN0YXJ0TGluZU51bWJlciA9IHJhbmdlLmVuZExpbmVOdW1iZXJcclxuICAgICAgY3VyLmVkaXQocmFuZ2UsICdcXG4nKTtcclxuXHJcbiAgICAgIGxldCBuZXdQaXBlID0gJ1xcdFxcdFxcdDwnICsgY2xhc3NOYW1lICsgJyBuYW1lPVwiJyArIG5hbWUgKyAnXCIgeD1cIicgKyBwb3NzaXRpb25zLnggKyAnXCIgeT1cIicgKyBwb3NzaXRpb25zLnkgKyAnXCI+XFxuXFxuXFx0XFx0XFx0PC8nICsgY2xhc3NOYW1lICsgJz5cXG4nO1xyXG4gICAgICBjdXIuZWRpdChyYW5nZSwgbmV3UGlwZSk7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvL2dpdmVzIGJhY2sgdGhlIHR5cGVzIG9mIHBpcGVzIHdpdGggdGhlIG5hbWUgb2YgdGhlIHBpcGUuXHJcbiAgZ2V0VHlwZXMoKSB7XHJcbiAgICBsZXQgdHlwZXMgPSB7fTtcclxuICAgIGxldCB2YWx1ZSA9IHRoaXMuZWRpdG9yLmdldFZhbHVlKCk7XHJcbiAgICBsZXQgb2NjdXJlbmNlcyA9IHZhbHVlLnNwbGl0KC9bPD5dLyk7XHJcbiAgICBsZXQgbmFtZSwgdHlwZSA9IG51bGw7XHJcbiAgICBsZXQgcmVjZWl2ZXIgPSB2YWx1ZS5tYXRjaCgvPFJlY2VpdmVyW15dKj9uYW1lPVwiLio/XCJbXl0qPz4vZyk7XHJcbiAgICBpZiAocmVjZWl2ZXIgIT0gbnVsbCkge1xyXG4gICAgICByZWNlaXZlciA9IHJlY2VpdmVyWzBdLm1hdGNoKC9cIi4qP1wiL2cpWzBdLnJlcGxhY2UoL1wiL2csICcnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJlY2VpdmVyID0gJ05PX1JFQ0VJVkVSX0ZPVU5EJ1xyXG4gICAgfVxyXG4gICAgdHlwZXNbJ1wicmVjZWl2ZXJcIiAnICsgcmVjZWl2ZXJdID0gXCJSZWNlaXZlclwiXHJcbiAgICBvY2N1cmVuY2VzLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaW5kZXgpIHtcclxuICAgICAgaWYgKGl0ZW0uc2VhcmNoKC9bXi9dW1xcU10qP1teXCIvXVBpcGVbXl0qP25hbWU9XCIuKj9cIi8pID4gLTEpIHtcclxuICAgICAgICBpZiAoaXRlbS5jaGFyQXQoMCkgIT0gJy8nKSB7XHJcbiAgICAgICAgICBsZXQgdGFnID0gaXRlbS5zbGljZShpdGVtLnNlYXJjaCgvW14vXVtcXFNdKj9bXlwiL11QaXBlW15dKj9uYW1lPVwiLio/XCIvKSk7XHJcbiAgICAgICAgICBpZiAodGFnLm1hdGNoKC9uYW1lPVwiLio/XCIvKSAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgIG5hbWUgPSB0YWcubWF0Y2goL25hbWU9XCIuKj9cIi8pWzBdLm1hdGNoKC9cIi4qP1wiLylbMF0ucmVwbGFjZSgvXCIvZywgJycpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKHRhZy5tYXRjaCgvW15dKj9QaXBlLykgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0eXBlID0gdGFnLm1hdGNoKC9bXl0qP1BpcGUvKVswXTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICh0eXBlICE9PSBudWxsICYmIG5hbWUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdHlwZXNbbmFtZV0gPSB0eXBlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSlcclxuICAgIHJldHVybiB0eXBlcztcclxuICB9XHJcbn1cclxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVG9CZWF1dGlmdWxTeW50YXgge1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICB9XHJcblxyXG4gIC8vY29udmVydCB1Z2x5IGliaXMgY29kZSB0byBiZWF1dGlmdWwgc3ludGF4LlxyXG4gIHRvQmVhdXRpZnVsU3ludGF4KHhtbCkge1xyXG4gICAgbGV0IG1hdGNoZXMgPSB4bWwubWF0Y2goLzxwaXBlKFxcblxcdCopPyhcXHNcXHcqPVwiKFxccz9cXFMpKlwiKFxcblxcdCopPykqPlteXSo/PFxcL3BpcGU+L2cpLFxyXG4gICAgICBkb2MgPSB4bWwsXHJcbiAgICAgIGV4aXRzO1xyXG4gICAgaWYgKG1hdGNoZXMgPT0gbnVsbCkgcmV0dXJuIHhtbDtcclxuICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gICAgICBsZXQgb2xkUGlwZSA9IGl0ZW0sXHJcbiAgICAgICAgbmV3UGlwZSA9IFwiXCI7XHJcbiAgICAgIGxldCBjbGFzc05hbWUgPSBvbGRQaXBlLm1hdGNoKC9jbGFzc05hbWU9XCIuKj9cIi8pWzBdLm1hdGNoKC9cXC5bXi5dKj9cIi8pWzBdLnJlcGxhY2UoL1tcIi5dL2csICcnKTtcclxuICAgICAgaWYgKGNsYXNzTmFtZS5tYXRjaCgvLio/UGlwZS8pID09IG51bGwpIHtcclxuICAgICAgICBjbGFzc05hbWUgPSBjbGFzc05hbWUgKyAnUGlwZSc7XHJcbiAgICAgIH1cclxuICAgICAgbmV3UGlwZSA9IG9sZFBpcGUucmVwbGFjZSgvY2xhc3NOYW1lPVwiLio/XCIvZywgJycpO1xyXG4gICAgICBuZXdQaXBlID0gbmV3UGlwZS5yZXBsYWNlKC88cGlwZS9nLCAnPCcgKyBjbGFzc05hbWUpXHJcbiAgICAgICAgLnJlcGxhY2UoLzxcXC9waXBlPi8sICc8LycgKyBjbGFzc05hbWUgKyAnPicpXHJcbiAgICAgIGRvYyA9IGRvYy5yZXBsYWNlKG9sZFBpcGUsIG5ld1BpcGUpO1xyXG4gICAgfSk7XHJcbiAgICBkb2MgPSBkb2MucmVwbGFjZSgvPGxpc3RlbmVyW15dKj9jbGFzc05hbWU9XCIuKj9cIlteXSo/XFwvPi9nLCBmdW5jdGlvbih0eHQpIHtcclxuICAgICAgICBsZXQgY2xhc3NOYW1lID0gdHh0Lm1hdGNoKC9jbGFzc05hbWU9XCIuKj9cIi8pWzBdLm1hdGNoKC9cXC5bXi5dKj9cIi8pWzBdLnJlcGxhY2UoL1tcIi5dL2csICcnKTtcclxuICAgICAgICB0eHQgPSB0eHQucmVwbGFjZSgvY2xhc3NOYW1lPVwiLio/XCIvZywgJycpO1xyXG4gICAgICAgIHR4dCA9ICc8JyArIHR4dC5yZXBsYWNlKC88Lio/IC9nLCBjbGFzc05hbWUgKyBcIiBcIik7XHJcbiAgICAgICAgcmV0dXJuIHR4dDtcclxuICAgICAgfSlcclxuICAgICAgLnJlcGxhY2UoLzxbXFwvXT9bYS16QS1aXS9nLCBmdW5jdGlvbih0eHQpIHtcclxuICAgICAgICByZXR1cm4gdHh0LnRvVXBwZXJDYXNlKClcclxuICAgICAgfSk7XHJcblxyXG4gICAgZXhpdHMgPSBkb2MubWF0Y2goLzxFeGl0cz5bXl0qPzxcXC9FeGl0cz4vKVswXS5yZXBsYWNlKC88XFwvP0V4aXRzPi9nLCAnJykucmVwbGFjZSgvXFx0LywgJycpO1xyXG4gICAgZG9jID0gZG9jLnJlcGxhY2UoLzxFeGl0cz5bXl0qPzxcXC9FeGl0cz4vZywgJycpXHJcbiAgICAgIC5yZXBsYWNlKC88XFwvUGlwZWxpbmU+L2csIGV4aXRzICsgJ1xcbiBcXHRcXHQ8L1BpcGVsaW5lPicpXHJcbiAgICAgIC5yZXBsYWNlKC9jbGFzc05hbWU9XCIuKj9cIi9nLCBcIlwiKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIGRvYztcclxuICB9XHJcbn1cclxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVmFsaWRhdGVDb25maWd1cmF0aW9uVmlldyB7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGVkaXRvcikge1xyXG4gICAgdGhpcy5lZGl0b3IgPSBlZGl0b3JcclxuICB9XHJcbiAgLy92YWxpZGF0ZSB0aGUgY29uZmlndXJhdGlvbi5cclxuICB2YWxpZGF0ZUNvbmZpZ3VyYXRpb24oKSB7XHJcbiAgICBsZXQgY3VyID0gdGhpcztcclxuICAgIGxldCB2YWxpZGF0ZSA9IHhtbGxpbnQudmFsaWRhdGVYTUwoe1xyXG4gICAgICB4bWw6IGN1ci5lZGl0b3IuZ2V0VmFsdWUoKS5yZXBsYWNlKC9cXHN4PVwiLio/XCIvZywgJycpLnJlcGxhY2UoL1xcc3k9XCIuKj9cIi9nLCAnJyksXHJcbiAgICAgIHNjaGVtYTogbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJpYmlzZG9jWHNkXCIpLFxyXG4gICAgICBUT1RBTF9NRU1PUlk6IDE2Nzc3MjE3XHJcbiAgICB9KTtcclxuICAgIHJldHVybiB2YWxpZGF0ZTtcclxuICB9XHJcblxyXG4gIGRlY29yYXRlTGluZShsaW5lTnVtYmVyKSB7XHJcbiAgICB0aGlzLmRlY29yYXRpb25zID0gdGhpcy5lZGl0b3IuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW3tcclxuICAgICAgcmFuZ2U6IG5ldyBtb25hY28uUmFuZ2UobGluZU51bWJlciwgMSwgbGluZU51bWJlciwgMSksXHJcbiAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBnbHlwaE1hcmdpbkNsYXNzTmFtZTogJ215R2x5cGhNYXJnaW5DbGFzcydcclxuICAgICAgfVxyXG4gICAgfV0pO1xyXG4gIH1cclxuXHJcbiAgLy91bmRvIGFsbCBkZWNvcmF0aW9ucy5cclxuICB1bmRvRGVjb3JhdGlvbnMoKSB7XHJcbiAgICB0aGlzLmRlY29yYXRpb25zID0gdGhpcy5lZGl0b3IuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmdldEFsbERlY29yYXRpb25zKCksIFt7XHJcbiAgICAgIHJhbmdlOiBuZXcgbW9uYWNvLlJhbmdlKDEsIDEsIDEsIDEpLFxyXG4gICAgICBvcHRpb25zOiB7fVxyXG4gICAgfV0pO1xyXG4gICAgdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS5zZXRWYWx1ZSh0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlKCkpO1xyXG4gIH1cclxufVxyXG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBEZXNjcmlwdGlvblZpZXcge1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuXHJcbiAgfVxyXG5cclxuICBhZGREZXNjcmlwdGlvbih0ZXh0LCBwb3NzaXRpb25zLCBpZCkge1xyXG4gICAgbGV0IGNhbnZhcyA9ICQoJyNjYW52YXMnKTtcclxuICAgIGxldCBlbCA9ICQoXCI8ZGl2PjwvZGl2PlwiKS5hZGRDbGFzcyhcImRlc2NyaXB0aW9uXCIpLmF0dHIoJ2lkJywgJ2Rlc2NyaXB0aW9uJyArIGlkKTtcclxuICAgIGxldCBkZXNjcmlwdGlvblRleHQgPSAkKCc8cD48L3A+JykudGV4dCh0ZXh0KTtcclxuICAgIGVsLmFwcGVuZChkZXNjcmlwdGlvblRleHQpO1xyXG4gICAgY29uc29sZS5sb2coXCJkZXNjIFRleHQ6XCIgKyB0ZXh0LCBwb3NzaXRpb25zKTtcclxuICAgIHBvc3NpdGlvbnMueCA9IHBhcnNlSW50KHBvc3NpdGlvbnMueCkgKyAzMDA7XHJcbiAgICAkKGVsKS5jc3MoJ2xlZnQnLCBwb3NzaXRpb25zLnggKyAncHgnKTtcclxuICAgICQoZWwpLmNzcygndG9wJywgcG9zc2l0aW9ucy55ICsgJ3B4Jyk7XHJcbiAgICBjYW52YXMuYXBwZW5kKGVsKTtcclxuICAgIGluc3RhbmNlLmRyYWdnYWJsZShlbCk7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCBQaXBlVmlldyBmcm9tICcuL1BpcGVWaWV3LmpzJztcclxuaW1wb3J0IENvbnNvbGVDb2xvclBpY2sgZnJvbSAnLi4vQ29uc29sZUNvbG9yUGljay5qcyc7XHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRmxvd0dlbmVyYXRvciB7XHJcbiAgY29uc3RydWN0b3IoZmxvd1ZpZXcpIHtcclxuICAgIHRoaXMuZmxvd1ZpZXcgPSBmbG93VmlldztcclxuICAgIHRoaXMucGlwZVZpZXcgPSBuZXcgUGlwZVZpZXcoZmxvd1ZpZXcpO1xyXG4gICAgdGhpcy5jb25zb2xlQ29sb3IgPSBuZXcgQ29uc29sZUNvbG9yUGljaygpO1xyXG4gIH1cclxuXHJcbiAgYWRkUGlwZShuYW1lID0gXCJwaXBlXCIgKyAodGhpcy5mbG93Vmlldy53aW5kb3dzKSwgcG9zc2l0aW9ucywgZXh0cmEgPSBcIlwiLCBpc0V4aXQsIGRlc2NUZXh0KSB7XHJcbiAgICByZXR1cm4gdGhpcy5waXBlVmlldy5hZGRQaXBlKG5hbWUsIHBvc3NpdGlvbnMsIGV4dHJhLCBpc0V4aXQsIGRlc2NUZXh0KTtcclxuICB9XHJcblxyXG4gIC8qXHJcbiAgIyBpZiB0aGUgcGlwZWxpbmUgaXMgbm90IG51bGwgZW1wdHkgdGhlIGNhbnZhc1xyXG4gICMgZm9yIHBpcGUgaXMgbm90IG51bGwgZ2VuZXJhdGUgZWFjaCBwaXBlXHJcbiAgIyBpZiB0aGVyZSBpcyBvbmx5IG9uZSBwaXBlIG9ubHkgZ2VuZXJhdGUgdGhhdCBvbmVcclxuICAjIHB1c2ggYWxsIGZvcndhcmRzIHRvIHRoZSBmb3J3YXJkcyBhcnJheSBhbmQgZ2VuZXJhdGUgdGhlIGZvcndhcmRzXHJcbiAgKi9cclxuICBnZW5lcmF0ZUZsb3coeG1sLCB3aW5kb3dzKSB7XHJcbiAgICB0aGlzLmZsb3dWaWV3LnJlc2V0V2luZG93cygpO1xyXG4gICAgbGV0IHBvc3NpdGlvbnMgPSBudWxsO1xyXG4gICAgbGV0IHRyYW5zZm9ybWVkWG1sID0geG1sO1xyXG4gICAgaWYgKHRyYW5zZm9ybWVkWG1sICE9IG51bGwgJiYgdHJhbnNmb3JtZWRYbWwuQWRhcHRlciAhPSBudWxsICYmXHJcbiAgICAgIHRyYW5zZm9ybWVkWG1sLkFkYXB0ZXIuUGlwZWxpbmUgIT0gbnVsbCkge1xyXG4gICAgICBpbnN0YW5jZS5yZXNldCgpO1xyXG4gICAgICAkKCcjY2FudmFzJykuZW1wdHkoKTtcclxuICAgICAgaWYgKHRyYW5zZm9ybWVkWG1sLkFkYXB0ZXIuUGlwZWxpbmUucGlwZSAhPSBudWxsKSB7XHJcbiAgICAgICAgJCgnI2NhbnZhcycpLnRleHQoXCJBZGFwdGVyOiBcIiArIHRyYW5zZm9ybWVkWG1sLkFkYXB0ZXJbJ0BuYW1lJ10gKyAnICcpO1xyXG4gICAgICAgIGxldCBwaXBlID0gdHJhbnNmb3JtZWRYbWwuQWRhcHRlci5QaXBlbGluZS5waXBlO1xyXG4gICAgICAgIGxldCBmb3J3YXJkcyA9IFtdO1xyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBpcGUpKSB7XHJcbiAgICAgICAgICBmb3IgKGxldCBwIGluIHBpcGUpIHtcclxuICAgICAgICAgICAgbGV0IG5hbWUgPSBwaXBlW3BdWydAbmFtZSddLFxyXG4gICAgICAgICAgICAgIHhwb3MgPSBwaXBlW3BdWydAeCddLFxyXG4gICAgICAgICAgICAgIHlwb3MgPSBwaXBlW3BdWydAeSddLFxyXG4gICAgICAgICAgICAgIGV4dHJhVGV4dCA9IFwiXCIsXHJcbiAgICAgICAgICAgICAgZGVzY1RleHQgPSBudWxsO1xyXG4gICAgICAgICAgICBwb3NzaXRpb25zID0gdGhpcy5jaGVja1Bvc3NpdGlvbnMoeHBvcywgeXBvcyk7XHJcbiAgICAgICAgICAgIGlmIChwaXBlW3BdWydAeHBhdGhFeHByZXNzaW9uJ10gIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgIGV4dHJhVGV4dCA9IHBpcGVbcF1bJ0B4cGF0aEV4cHJlc3Npb24nXS5zbGljZSgwLCAxNSkgKyAnLi4uJztcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChwaXBlW3BdLkZpeGVkUXVlcnlTZW5kZXIgIT0gbnVsbCAmJiBwaXBlW3BdLkZpeGVkUXVlcnlTZW5kZXJbJ0BxdWVyeSddICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICBleHRyYVRleHQgPSBwaXBlW3BdLkZpeGVkUXVlcnlTZW5kZXJbJ0BxdWVyeSddLnNsaWNlKDAsIDE1KSArICcuLi4nO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmKHBpcGVbcF0uRG9jdW1lbnRhdGlvbiAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2cocGlwZVtwXS5Eb2N1bWVudGF0aW9uKTtcclxuICAgICAgICAgICAgICBkZXNjVGV4dCA9IHBpcGVbcF0uRG9jdW1lbnRhdGlvbjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5hZGRQaXBlKG5hbWUsIHBvc3NpdGlvbnMsIGV4dHJhVGV4dCwgbnVsbCwgZGVzY1RleHQpO1xyXG4gICAgICAgICAgICBpZiAocGlwZVtwXS5Gb3J3YXJkICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICBsZXQgZm9yd2FyZERhdGEgPSBudWxsO1xyXG4gICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBpcGVbcF0uRm9yd2FyZCkpIHtcclxuICAgICAgICAgICAgICAgIHBpcGVbcF0uRm9yd2FyZC5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XHJcbiAgICAgICAgICAgICAgICAgIGZvcndhcmREYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZVBpcGU6IG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGlwZTogaXRlbVsnQHBhdGgnXSxcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBpdGVtWydAbmFtZSddXHJcbiAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgIGZvcndhcmRzLnB1c2goZm9yd2FyZERhdGEpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGZvcndhcmREYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgICBzb3VyY2VQaXBlOiBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICB0YXJnZXRQaXBlOiBwaXBlW3BdLkZvcndhcmRbJ0BwYXRoJ10sXHJcbiAgICAgICAgICAgICAgICAgIG5hbWU6IHBpcGVbcF0uRm9yd2FyZFsnQG5hbWUnXVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIGZvcndhcmRzLnB1c2goZm9yd2FyZERhdGEpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBsZXQgbmV4dFBpcGUgPSBwYXJzZUludChwKSArIDE7XHJcbiAgICAgICAgICAgICAgaWYgKHBpcGVbbmV4dFBpcGVdICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGxldCBmb3J3YXJkRGF0YSA9IHtcclxuICAgICAgICAgICAgICAgICAgc291cmNlUGlwZTogbmFtZSxcclxuICAgICAgICAgICAgICAgICAgdGFyZ2V0UGlwZTogcGlwZVtuZXh0UGlwZV1bJ0BuYW1lJ10sXHJcbiAgICAgICAgICAgICAgICAgIG5hbWU6IFwic3VjY2Vzc1wiXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmb3J3YXJkcy5wdXNoKGZvcndhcmREYXRhKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbGV0IG5hbWUgPSBwaXBlWydAbmFtZSddO1xyXG4gICAgICAgICAgdGhpcy5hZGRQaXBlKG5hbWUpO1xyXG4gICAgICAgICAgaWYgKHBpcGUuRm9yd2FyZCAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgIGxldCBmb3J3YXJkRGF0YSA9IG51bGw7XHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBpcGUuRm9yd2FyZCkpIHtcclxuICAgICAgICAgICAgICBwaXBlLkZvcndhcmQuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gICAgICAgICAgICAgICAgZm9yd2FyZERhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICAgIHNvdXJjZVBpcGU6IG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgIHRhcmdldFBpcGU6IGl0ZW1bJ0BwYXRoJ10sXHJcbiAgICAgICAgICAgICAgICAgIG5hbWU6IGl0ZW1bJ0BuYW1lJ11cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBmb3J3YXJkcy5wdXNoKGZvcndhcmREYXRhKTtcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBmb3J3YXJkRGF0YSA9IHtcclxuICAgICAgICAgICAgICAgIHNvdXJjZVBpcGU6IG5hbWUsXHJcbiAgICAgICAgICAgICAgICB0YXJnZXRQaXBlOiBwaXBlLkZvcndhcmRbJ0BwYXRoJ10sXHJcbiAgICAgICAgICAgICAgICBuYW1lOiBwaXBlLkZvcndhcmRbJ0BuYW1lJ11cclxuICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgIGZvcndhcmRzLnB1c2goZm9yd2FyZERhdGEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYWRkRXhpdHModHJhbnNmb3JtZWRYbWwuQWRhcHRlci5QaXBlbGluZS5FeGl0KTtcclxuICAgICAgICBpZiAocG9zc2l0aW9ucyA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgdGhpcy5mbG93Vmlldy5zZXRPZmZzZXRzKGZhbHNlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5mbG93Vmlldy5zZXRPZmZzZXRzKHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHJhbnNmb3JtZWRYbWwuQWRhcHRlci5SZWNlaXZlciAhPSBudWxsKSB7XHJcbiAgICAgICAgICBsZXQgZm9yd2FyZERhdGEgPSB0aGlzLmFkZFJlY2VpdmVyKHRyYW5zZm9ybWVkWG1sLCBmb3J3YXJkc1swXS5zb3VyY2VQaXBlKTtcclxuICAgICAgICAgIGZvcndhcmRzLnB1c2goZm9yd2FyZERhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmdlbmVyYXRlRm9yd2FyZHMoZm9yd2FyZHMpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmZsb3dWaWV3LmRpc3BsYXlFcnJvcih0cmFuc2Zvcm1lZFhtbCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvL2NoZWNrIGlmIHBvc3NpdGlvbnMgZXhpc3QsIGlmIG9ubHkgb25lIHBvc3NpdGlvbiBleGlzdHMgdGhlbiBkdXBsaWNhdGUgdGhlIGV4aXN0aW5nIHBvc3NpdGlvbnMuXHJcbiAgY2hlY2tQb3NzaXRpb25zKHhwb3MsIHlwb3MpIHtcclxuICAgIGlmICh4cG9zID09IG51bGwgJiYgeXBvcyAhPSBudWxsKSB7XHJcbiAgICAgIHhwb3MgPSB5cG9zO1xyXG4gICAgfSBlbHNlIGlmICh5cG9zID09IG51bGwgJiYgeHBvcyAhPSBudWxsKSB7XHJcbiAgICAgIHlwb3MgPSB4cG9zO1xyXG4gICAgfVxyXG4gICAgaWYgKHhwb3MgIT0gbnVsbCAmJiB5cG9zICE9IG51bGwpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICB4OiB4cG9zLFxyXG4gICAgICAgIHk6IHlwb3NcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvL21ldGhvZCB0byBhZGQgb25lIHJlY2VpdmVyXHJcbiAgYWRkUmVjZWl2ZXIodHJhbnNmb3JtZWRYbWwsIHRhcmdldCkge1xyXG4gICAgdGhpcy5hZGRQaXBlKCcocmVjZWl2ZXIpOiAnICsgdHJhbnNmb3JtZWRYbWwuQWRhcHRlci5SZWNlaXZlclsnQG5hbWUnXSwge1xyXG4gICAgICB4OiBcIjYwMFwiLFxyXG4gICAgICB5OiBcIjQwMFwiXHJcbiAgICB9KTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHNvdXJjZVBpcGU6ICcocmVjZWl2ZXIpOiAnICsgdHJhbnNmb3JtZWRYbWwuQWRhcHRlci5SZWNlaXZlclsnQG5hbWUnXSxcclxuICAgICAgdGFyZ2V0UGlwZTogdGFyZ2V0LFxyXG4gICAgICBuYW1lOiAncmVxdWVzdCdcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvLyBtZXRob2QgdG8gYWRkIGFsbCBleGl0c1xyXG4gIGFkZEV4aXRzKGV4aXRzKSB7XHJcbiAgICBsZXQgZXhpdCA9IGV4aXRzLFxyXG4gICAgICBwb3NzaXRpb25zLFxyXG4gICAgICBuYW1lLFxyXG4gICAgICB5cG9zLFxyXG4gICAgICB4cG9zO1xyXG4gICAgaWYgKGV4aXQgPT0gbnVsbCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShleGl0KSkge1xyXG4gICAgICBsZXQgY3VyID0gdGhpcztcclxuICAgICAgZXhpdC5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XHJcbiAgICAgICAgbmFtZSA9IGV4aXRbaW5kZXhdWydAcGF0aCddLFxyXG4gICAgICAgICAgeHBvcyA9IGV4aXRbaW5kZXhdWydAeCddLFxyXG4gICAgICAgICAgeXBvcyA9IGV4aXRbaW5kZXhdWydAeSddO1xyXG4gICAgICAgIGlmICh4cG9zICE9IG51bGwgJiYgeXBvcyAhPSBudWxsKSB7XHJcbiAgICAgICAgICBwb3NzaXRpb25zID0ge1xyXG4gICAgICAgICAgICB4OiB4cG9zLFxyXG4gICAgICAgICAgICB5OiB5cG9zXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGN1ci5hZGRQaXBlKG5hbWUsIHBvc3NpdGlvbnMsIFwiXCIsIHRydWUpO1xyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIG5hbWUgPSBleGl0WydAcGF0aCddLFxyXG4gICAgICAgIHhwb3MgPSBleGl0WydAeCddLFxyXG4gICAgICAgIHlwb3MgPSBleGl0WydAeSddO1xyXG4gICAgICBpZiAoeHBvcyAhPSBudWxsICYmIHlwb3MgIT0gbnVsbCkge1xyXG4gICAgICAgIHBvc3NpdGlvbnMgPSB7XHJcbiAgICAgICAgICB4OiB4cG9zLFxyXG4gICAgICAgICAgeTogeXBvc1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICB0aGlzLmFkZFBpcGUobmFtZSwgcG9zc2l0aW9ucywgXCJcIiwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKlxyXG4gICMgYSBmdW5jdGlvbiB0byBzZWFyY2ggYWxsIG9mIHRoZSBmb3J3YXJkcyBpbiB0aGUgdHJhbnNmb3JtZWQganNvbi5cclxuICAjIGJpbmQgdG8gZWFjaCBjb25uZWN0aW9uIGFuZCB1cGRhdGUgY29kZSBlZGl0b3IuXHJcbiAgIyBjb25uZWN0IGFsbCBvZiB0aGUgcGlwZXMgYWNjb3JkaW5nIHRvIHRoZSBmb3J3YXJkcyBnaXZlbiBpbiB0aGlzIG1ldGhvZC5cclxuICAjIEBwYXJhbSBmb3J3YXJkczogYSBqc29uIG9iamVjdCB3aXRoIGFsbCBvZiB0aGUgZm9yd2FyZHMuXHJcbiAgKi9cclxuICBnZW5lcmF0ZUZvcndhcmRzKGZvcndhcmRzKSB7XHJcbiAgICAvL3doZW4gZ2VuZXJhdGluZyBzZXQgdG8gdHJ1ZSBhbmQgYWZ0ZXIgZ2VuZXJhdGluZyB0byBmYWxzZS5cclxuICAgIGxldCBnZW5lcmF0ZWQgPSB0cnVlO1xyXG4gICAgbGV0IGN1ciA9IHRoaXM7XHJcblxyXG4gICAgaW5zdGFuY2UuYmluZChcImNvbm5lY3Rpb25cIiwgZnVuY3Rpb24oaSwgYykge1xyXG4gICAgICBsZXQgY291bnRlciA9IDA7XHJcbiAgICAgIGluc3RhbmNlLmdldEFsbENvbm5lY3Rpb25zKCkuZm9yRWFjaChmdW5jdGlvbihjb25uKSB7XHJcbiAgICAgICAgaWYgKGNvbm4uc291cmNlSWQgPT0gaS5jb25uZWN0aW9uLnNvdXJjZUlkICYmIGNvbm4udGFyZ2V0SWQgPT0gaS5jb25uZWN0aW9uLnRhcmdldElkKSB7XHJcbiAgICAgICAgICBpZiAoY291bnRlciA8IDIpIHtcclxuICAgICAgICAgICAgY291bnRlcisrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBsZXQgc291cmNlID0gaS5zb3VyY2VFbmRwb2ludC5lbGVtZW50Lmxhc3RDaGlsZC5maXJzdEVsZW1lbnRDaGlsZC50ZXh0Q29udGVudDtcclxuICAgICAgbGV0IHRhcmdldCA9IGkudGFyZ2V0RW5kcG9pbnQuZWxlbWVudC5sYXN0Q2hpbGQuZmlyc3RFbGVtZW50Q2hpbGQudGV4dENvbnRlbnQ7XHJcbiAgICAgIGkuY29ubmVjdGlvbi5iaW5kKFwiZGJsY2xpY2tcIiwgZnVuY3Rpb24oY29ubikge1xyXG4gICAgICAgIGluc3RhbmNlLmRlbGV0ZUNvbm5lY3Rpb24oY29ubik7XHJcbiAgICAgICAgY3VyLmZsb3dWaWV3Lm1vZGlmeUZsb3coJ2RlbGV0ZScsIHtcclxuICAgICAgICAgIG5hbWU6IHNvdXJjZSxcclxuICAgICAgICAgIHRhcmdldDogdGFyZ2V0XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC8vY29ubmVjdGlvbiBhbHJlYWR5IGV4aXN0cyBzbyBkZWxldGUgdGhlIGZpcnN0IGNvbm5lY3Rpb24uXHJcbiAgICAgIGlmIChjb3VudGVyID4gMSkge1xyXG4gICAgICAgIGluc3RhbmNlLmdldEFsbENvbm5lY3Rpb25zKCkuc29tZShmdW5jdGlvbihjb25uKSB7XHJcbiAgICAgICAgICBpZiAoY29ubi5zb3VyY2VJZCA9PSBpLmNvbm5lY3Rpb24uc291cmNlSWQgJiYgY29ubi50YXJnZXRJZCA9PSBpLmNvbm5lY3Rpb24udGFyZ2V0SWQpIHtcclxuICAgICAgICAgICAgaW5zdGFuY2UuZGVsZXRlQ29ubmVjdGlvbihjb25uKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoIWdlbmVyYXRlZCkge1xyXG4gICAgICAgIGN1ci5mbG93Vmlldy5tb2RpZnlGbG93KCdjb25uZWN0aW9uJywge1xyXG4gICAgICAgICAgc291cmNlOiBzb3VyY2UsXHJcbiAgICAgICAgICB0YXJnZXQ6IHRhcmdldFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvL2xvb3Agb3ZlciBhbmQgY29ubmVjdCB0aGUgZm9yd2FyZHMuXHJcbiAgICBsZXQgc291cmNlUGlwZSA9IFwiXCI7XHJcbiAgICBsZXQgdGFyZ2V0UGlwZSA9IFwiXCI7XHJcbiAgICBnZW5lcmF0ZWQgPSB0cnVlO1xyXG4gICAgJChmb3J3YXJkcykuZWFjaChmdW5jdGlvbihpbmRleCwgZikge1xyXG4gICAgICBzb3VyY2VQaXBlID0gXCJcIjtcclxuICAgICAgdGFyZ2V0UGlwZSA9IFwiXCI7XHJcbiAgICAgIGlmIChmLnRhcmdldFBpcGUgPT0gbnVsbCkge1xyXG4gICAgICAgIGYudGFyZ2V0UGlwZSA9IGYubmFtZTtcclxuICAgICAgfVxyXG4gICAgICAkKFwiLnNvdXJjZVdpbmRvd1wiKS5lYWNoKGZ1bmN0aW9uKGksIGVsZW1lbnQpIHtcclxuICAgICAgICB2YXIgJGVsZW1lbnQgPSAkKGVsZW1lbnQpWzBdO1xyXG4gICAgICAgIGxldCByZWZhY3RvcmVkVGV4dCA9ICRlbGVtZW50Lmxhc3RDaGlsZC5maXJzdENoaWxkLmlubmVySFRNTDtcclxuICAgICAgICBpZiAocmVmYWN0b3JlZFRleHQgPT0gZi5zb3VyY2VQaXBlKSB7XHJcbiAgICAgICAgICBzb3VyY2VQaXBlID0gJCgkZWxlbWVudCkuYXR0cignaWQnKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHJlZmFjdG9yZWRUZXh0ID09IGYudGFyZ2V0UGlwZSkge1xyXG4gICAgICAgICAgdGFyZ2V0UGlwZSA9ICQoJGVsZW1lbnQpLmF0dHIoJ2lkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgICAgbGV0IHBhaW50U3R5bGUgPSB7XHJcbiAgICAgICAgc3Ryb2tlOiBcIiMwMDAwMDBcIixcclxuICAgICAgICBzdHJva2VXaWR0aDogM1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChmLm5hbWUgPT0gJ2ZhaWx1cmUnIHx8IGYubmFtZSA9PSAnZXhjZXB0aW9uJykge1xyXG4gICAgICAgIHBhaW50U3R5bGUuc3Ryb2tlID0gXCIjRkYwMDAwXCI7XHJcbiAgICAgIH0gZWxzZSBpZiAoZi5uYW1lID09ICdzdWNjZXNzJykge1xyXG4gICAgICAgIHBhaW50U3R5bGUuc3Ryb2tlID0gXCIjMjJiYjMzXCJcclxuICAgICAgfSBlbHNlIGlmIChmLm5hbWUgPT0gXCJyZXF1ZXN0XCIgfHwgZi5uYW1lID09ICdyZXNwb25zZScpIHtcclxuICAgICAgICBwYWludFN0eWxlLmRhc2hzdHlsZSA9IFwiMiA0XCI7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHNvdXJjZVBpcGUgIT0gXCJcIiAmJiB0YXJnZXRQaXBlICE9IFwiXCIpIHtcclxuICAgICAgICBpbnN0YW5jZS5jb25uZWN0KHtcclxuICAgICAgICAgIHNvdXJjZTogc291cmNlUGlwZSxcclxuICAgICAgICAgIHRhcmdldDogdGFyZ2V0UGlwZSxcclxuICAgICAgICAgIHBhaW50U3R5bGU6IHBhaW50U3R5bGUsXHJcbiAgICAgICAgICBvdmVybGF5czogW1xyXG4gICAgICAgICAgICBbXCJMYWJlbFwiLCB7XHJcbiAgICAgICAgICAgICAgbGFiZWw6IGYubmFtZSxcclxuICAgICAgICAgICAgICBpZDogXCJsYWJlbFwiLFxyXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiAwLjEsXHJcbiAgICAgICAgICAgICAgcGFkZGluZzogMTAwXHJcbiAgICAgICAgICAgIH1dXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgY29ubmVjdG9yOiBbdGhpcy5jb25uZWN0b3JUeXBlLCB7XHJcbiAgICAgICAgICAgIHN0dWI6IFs0MCwgNjBdLFxyXG4gICAgICAgICAgICBnYXA6IDEwLFxyXG4gICAgICAgICAgICBjb3JuZXJSYWRpdXM6IDUsXHJcbiAgICAgICAgICAgIGFsd2F5c1Jlc3BlY3RTdHViczogdHJ1ZSxcclxuICAgICAgICAgICAgbWlkcG9pbnQ6IDAuMDAwMVxyXG4gICAgICAgICAgfV1cclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBnZW5lcmF0ZWQgPSBmYWxzZTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IEZsb3dHZW5lcmF0b3IgZnJvbSAnLi9GbG93R2VuZXJhdG9yLmpzJ1xyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGbG93VmlldyB7XHJcblxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgdGhpcy50cmFuc2Zvcm1lZFhtbCA9IG51bGw7XHJcbiAgICB0aGlzLnR5cGVzID0gW107XHJcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xyXG4gICAgdGhpcy53aW5kb3dzID0gMDtcclxuICAgIHRoaXMubW92aW5nID0gZmFsc2U7XHJcbiAgICB0aGlzLmFkZGluZyA9IGZhbHNlO1xyXG4gICAgdGhpcy5jb25uZWN0b3JUeXBlID0gXCJGbG93Y2hhcnRcIjtcclxuICAgIHRoaXMuaG9yaXpvbnRhbEJ1aWxkID0gZmFsc2U7XHJcbiAgICB0aGlzLmZsb3dHZW5lcmF0b3IgPSBuZXcgRmxvd0dlbmVyYXRvcih0aGlzKTtcclxuICAgIHRoaXMuZ2V0SW5zdGFuY2UoKTtcclxuICB9XHJcbiAgYWRkTGlzdGVuZXIobGlzdGVuZXIpIHtcclxuICAgIHRoaXMubGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xyXG4gIH1cclxuXHJcbiAgbm90aWZ5TGlzdGVuZXJzKGRhdGEpIHtcclxuICAgIHRoaXMubGlzdGVuZXJzLmZvckVhY2gobCA9PiBsLm5vdGlmeShkYXRhKSk7XHJcbiAgfVxyXG5cclxuICBnZXRJbWFnZSgpIHtcclxuICAgIHZhciBub2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbnZhcycpO1xyXG5cclxuICAgIGRvbXRvaW1hZ2UudG9Tdmcobm9kZSlcclxuICAgICAgLnRoZW4oZnVuY3Rpb24oZGF0YVVybCkge1xyXG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpOztcclxuICAgICAgICBsaW5rLmRvd25sb2FkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRBZGFwdGVyJykgKyAnLnN2Zyc7XHJcbiAgICAgICAgbGluay5ocmVmID0gZGF0YVVybDtcclxuICAgICAgICBsaW5rLmNsaWNrKCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaChmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ29vcHMsIHNvbWV0aGluZyB3ZW50IHdyb25nIScsIGVycm9yKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXNldFdpbmRvd3MoKSB7XHJcbiAgICB0aGlzLndpbmRvd3MgPSAwO1xyXG4gIH1cclxuXHJcbiAgZ2V0SW5zdGFuY2UoKSB7XHJcbiAgICB0aGlzLnNvdXJjZUFuY2hvcnMgPSBbXHJcbiAgICAgICAgXCJUb3BcIiwgXCJSaWdodFwiLCBcIkxlZnRcIixcclxuICAgICAgICBbMC4yNSwgMSwgMCwgMV0sXHJcbiAgICAgICAgWzAuNSwgMSwgMCwgMV0sXHJcbiAgICAgICAgWzAuNzUsIDEsIDAsIDFdLFxyXG4gICAgICAgIFsxLCAxLCAwLCAxXVxyXG4gICAgICBdLFxyXG4gICAgICB0aGlzLmluc3RhbmNlID0gd2luZG93Lmluc3RhbmNlID0ganNQbHVtYi5nZXRJbnN0YW5jZSh7XHJcbiAgICAgICAgLy8gZHJhZyBvcHRpb25zXHJcbiAgICAgICAgRHJhZ09wdGlvbnM6IHtcclxuICAgICAgICAgIGN1cnNvcjogXCJwb2ludGVyXCIsXHJcbiAgICAgICAgICB6SW5kZXg6IDIwMDBcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8vIGRlZmF1bHQgdG8gYSBncmFkaWVudCBzdHJva2UgZnJvbSBibHVlIHRvIGdyZWVuLlxyXG4gICAgICAgIFBhaW50U3R5bGU6IHtcclxuICAgICAgICAgIHN0cm9rZTogXCIjMDAwMDAwXCIsXHJcbiAgICAgICAgICBzdHJva2VXaWR0aDogM1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLy90aGUgYXJyb3cgb3ZlcmxheSBmb3IgdGhlIGNvbm5lY3Rpb25cclxuICAgICAgICBDb25uZWN0aW9uT3ZlcmxheXM6IFtcclxuICAgICAgICAgIFtcIkFycm93XCIsIHtcclxuICAgICAgICAgICAgbG9jYXRpb246IDEsXHJcbiAgICAgICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgICAgIGlkOiBcIkFSUk9XXCIsXHJcbiAgICAgICAgICAgIHpJbmRleDogMTAwMFxyXG4gICAgICAgICAgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIENvbnRhaW5lcjogXCJjYW52YXNcIlxyXG4gICAgICB9KTtcclxuXHJcbiAgICBsZXQgYmFzaWNUeXBlID0ge1xyXG4gICAgICBjb25uZWN0b3I6IFtcIlN0YXRlTWFjaGluZVwiLCB7XHJcbiAgICAgICAgc3R1YjogWzQwLCA2MF0sXHJcbiAgICAgICAgZ2FwOiAxMCxcclxuICAgICAgICBjb3JuZXJSYWRpdXM6IDUsXHJcbiAgICAgICAgYWx3YXlzUmVzcGVjdFN0dWJzOiB0cnVlXHJcbiAgICAgIH1dXHJcbiAgICB9XHJcbiAgICB0aGlzLmluc3RhbmNlLnJlZ2lzdGVyQ29ubmVjdGlvblR5cGUoXCJiYXNpY1wiLCBiYXNpY1R5cGUpO1xyXG4gIH1cclxuXHJcbiAgLypcclxuICAgKiBvbmUgZnVuY3Rpb24gdG8gbW9kaWZ5IHRoZSBmbG93IGFuZCBjb2RlIGF0IHRoZSBzYW1lIHRpbWUuXHJcbiAgICogQHBhcmFtIGNoYW5nZTogaW5zZXJ0IGhlcmUgdGhlIGFjdGlvbiB5b3Ugd2FudCB0byBkby5cclxuICAgKiBAcGFyYW0gb2JqOiBpbnNlcnQgYW4gb2JqZWN0IHdpdGggbmVjZXNzYXJ5IGluZm9ybWF0aW9uLlxyXG4gICAqL1xyXG4gIG1vZGlmeUZsb3coY2hhbmdlLCBvYmopIHtcclxuICAgIHN3aXRjaCAoY2hhbmdlKSB7XHJcbiAgICAgIGNhc2UgXCJnZW5lcmF0ZVwiOlxyXG4gICAgICAgIHRoaXMuZ2VuZXJhdGVGbG93KCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2FkZCc6XHJcbiAgICAgICAgdGhpcy5ub3RpZnlMaXN0ZW5lcnModGhpcy5hZGRDdXN0b21QaXBlKG9iai5uYW1lLCBvYmouY2xhc3NOYW1lKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2VkaXQnOlxyXG4gICAgICAgIHRoaXMubm90aWZ5TGlzdGVuZXJzKHRoaXMuZWRpdFRpdGxlKG9iaikpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdjb25uZWN0aW9uJzpcclxuICAgICAgICB0aGlzLmFkZGluZyA9IHRydWU7XHJcbiAgICAgICAgb2JqLnR5cGUgPSBcImNoYW5nZUFkZEZvcndhcmRcIjtcclxuICAgICAgICB0aGlzLm5vdGlmeUxpc3RlbmVycyhvYmopO1xyXG4gICAgICAgIHRoaXMuYWRkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2RyYWcnOlxyXG4gICAgICAgIG9iaiA9IHRoaXMuY2xlYW5Qb3NzaXRpb25zKG9iaik7XHJcbiAgICAgICAgb2JqLnR5cGUgPSBcImRyYWdcIjtcclxuICAgICAgICB0aGlzLm5vdGlmeUxpc3RlbmVycyhvYmopO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdkcmFnRXhpdCc6XHJcbiAgICAgICAgb2JqID0gdGhpcy5jbGVhblBvc3NpdGlvbnMob2JqKTtcclxuICAgICAgICBvYmoudHlwZSA9IFwiZHJhZ0V4aXRcIjtcclxuICAgICAgICB0aGlzLm5vdGlmeUxpc3RlbmVycyhvYmopO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdkZWxldGUnOlxyXG4gICAgICAgIG9iai50eXBlID0gXCJkZWxldGVcIjtcclxuICAgICAgICB0aGlzLm5vdGlmeUxpc3RlbmVycyhvYmopO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwiZXJyb3JcIjpcclxuICAgICAgICB0aGlzLmRpc3BsYXlFcnJvcihvYmopO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY2xlYW5Qb3NzaXRpb25zKG9iaikge1xyXG4gICAgb2JqLnggPSBvYmoueC5yZXBsYWNlKC9weC8sICcnKTtcclxuICAgIG9iai55ID0gb2JqLnkucmVwbGFjZSgvcHgvLCAnJyk7XHJcbiAgICByZXR1cm4gb2JqO1xyXG4gIH1cclxuXHJcbiAgZWRpdFRpdGxlKHBpcGUpIHtcclxuICAgIGxldCBvbGRUaXRsZSA9IHBpcGUuaW5uZXJIVE1MO1xyXG4gICAgbGV0IG5ld1RpdGxlID0gcHJvbXB0KFwiV2hhdCBpcyB0aGUgbmV3IFRpdGxlP1wiLCBvbGRUaXRsZSk7XHJcbiAgICBpZiAobmV3VGl0bGUgIT0gbnVsbCkge1xyXG4gICAgICBwaXBlLmlubmVySFRNTCA9IG5ld1RpdGxlO1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIG9sZFRpdGxlOiBvbGRUaXRsZSxcclxuICAgICAgICBuZXdUaXRsZTogbmV3VGl0bGVcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBhZGRDdXN0b21QaXBlKG5hbWUsIGNsYXNzTmFtZSkge1xyXG4gICAgbGV0IG5ld1BpcGUgPSB0aGlzLmFkZFBpcGUobmFtZSwge1xyXG4gICAgICB4OiAxMDAsXHJcbiAgICAgIHk6IDEwMFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdHlwZTogXCJjaGFuZ2VBZGRQaXBlXCIsXHJcbiAgICAgIG5hbWU6IG5ld1BpcGUsXHJcbiAgICAgIHBvc3NpdGlvbnM6IHtcclxuICAgICAgICB4OiAxMDAsXHJcbiAgICAgICAgeTogMTAwXHJcbiAgICAgIH0sXHJcbiAgICAgIGNsYXNzTmFtZTogY2xhc3NOYW1lXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICB0b2dnbGVDb25uZWN0b3JUeXBlKGN1cikge1xyXG4gICAgaWYgKGN1ci5jb25uZWN0b3JUeXBlID09PSBcIkZsb3djaGFydFwiKSB7XHJcbiAgICAgIGN1ci5jb25uZWN0b3JUeXBlID0gXCJTdGF0ZU1hY2hpbmVcIjtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGN1ci5jb25uZWN0b3JUeXBlID0gXCJGbG93Y2hhcnRcIjtcclxuICAgIH1cclxuICAgIGN1ci5nZW5lcmF0ZUZsb3coKTtcclxuICB9XHJcblxyXG4gIGFkZFBpcGUobmFtZSwgcG9zc2l0aW9ucywgZXh0cmEsIGlzRXhpdCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZmxvd0dlbmVyYXRvci5hZGRQaXBlKG5hbWUsIHBvc3NpdGlvbnMsIGV4dHJhLCBpc0V4aXQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0VHlwZXMoKSB7XHJcbiAgICB0aGlzLm5vdGlmeUxpc3RlbmVycyh7XHJcbiAgICAgIHR5cGU6IFwiZ2V0VHlwZXNcIlxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlcztcclxuICB9XHJcblxyXG4gIC8vIGEgZnVuY3Rpb24gdG8gcHV0IGRpc3RhbmNlIGJldHdlZW4gdGhlIHBpcGVzXHJcbiAgc2V0T2Zmc2V0cyhwb3NzaXRpb25zKSB7XHJcbiAgICBsZXQgYm94T2Zmc2V0ID0gMDtcclxuICAgIGxldCBjb250YWluZXIgPSBudWxsO1xyXG5cclxuICAgIHRoaXMubW92aW5nID0gdHJ1ZTtcclxuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IHRoaXMud2luZG93czsgaSsrKSB7XHJcbiAgICAgIGJveE9mZnNldCArPSAyNTA7XHJcbiAgICAgIGlmICghcG9zc2l0aW9ucykge1xyXG4gICAgICAgIGxldCBib3ggPSAkKCcjc291cmNlV2luZG93JyArIGkpO1xyXG4gICAgICAgIGlmICghdGhpcy5ob3Jpem9udGFsQnVpbGQpIHtcclxuICAgICAgICAgIGJveC5jc3MoXCJ0b3BcIiwgYm94T2Zmc2V0ICsgXCJweFwiKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgYm94LmNzcyhcInRvcFwiLCBcIjEwMHB4XCIpO1xyXG4gICAgICAgICAgYm94LmNzcyhcImxlZnRcIiwgYm94T2Zmc2V0ICsgXCJweFwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5tb2RpZnlGbG93KCdkcmFnJywge1xyXG4gICAgICAgICAgbmFtZTogYm94WzBdLmxhc3RDaGlsZC5maXJzdEVsZW1lbnRDaGlsZC50ZXh0Q29udGVudCxcclxuICAgICAgICAgIHg6IGJveC5jc3MoXCJsZWZ0XCIpLFxyXG4gICAgICAgICAgeTogYm94LmNzcyhcInRvcFwiKVxyXG4gICAgICAgIH0pXHJcbiAgICAgIH1cclxuICAgICAgbGV0IHRvdGFsTGVuZ3RoLCB3aW5kb3dMZW5ndGg7XHJcbiAgICAgIGlmICghdGhpcy5ob3Jpem9udGFsQnVpbGQpIHtcclxuICAgICAgICB0b3RhbExlbmd0aCA9IGJveE9mZnNldCArICgoNjQgKiBpKSAtIDE0NTApO1xyXG4gICAgICAgIHdpbmRvd0xlbmd0aCA9IHBhcnNlSW50KCQoJyNjYW52YXMnKS5jc3MoJ2hlaWdodCcpLnJlcGxhY2UoJ3B4JywgJycpKTtcclxuICAgICAgICBpZiAodG90YWxMZW5ndGggPiB3aW5kb3dMZW5ndGgpIHtcclxuICAgICAgICAgICQoJyNjYW52YXMnKS5jc3MoJ2hlaWdodCcsIHRvdGFsTGVuZ3RoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdG90YWxMZW5ndGggPSBib3hPZmZzZXQgKyAoKDY0ICogaSkgLSAxMDAwKTtcclxuICAgICAgICB3aW5kb3dMZW5ndGggPSBwYXJzZUludCgkKCcjY2FudmFzJykuY3NzKCd3aWR0aCcpLnJlcGxhY2UoJ3B4JywgJycpKTtcclxuICAgICAgICBpZiAodG90YWxMZW5ndGggPiB3aW5kb3dMZW5ndGgpIHtcclxuICAgICAgICAgICQoJyNjYW52YXMnKS5jc3MoJ3dpZHRoJywgdG90YWxMZW5ndGgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdGhpcy5tb3ZpbmcgPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIGdlbmVyYXRlRmxvdygpIHtcclxuICAgIHRoaXMubm90aWZ5TGlzdGVuZXJzKHtcclxuICAgICAgdHlwZTogXCJjb252ZXJ0Q29uZmlndXJhdGlvblwiXHJcbiAgICB9KTtcclxuICAgIHRoaXMuZmxvd0dlbmVyYXRvci5nZW5lcmF0ZUZsb3codGhpcy50cmFuc2Zvcm1lZFhtbCwgdGhpcy53aW5kb3dzKTtcclxuICB9XHJcblxyXG4gIGRpc3BsYXlFcnJvcihlKSB7XHJcbiAgICBpbnN0YW5jZS5yZXNldCgpO1xyXG4gICAgJCgnI2NhbnZhcycpLmVtcHR5KCk7XHJcbiAgICAkKCcjY2FudmFzJykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcclxuICAgICQoJy5jdXN0b21FcnJvck1lc3NhZ2UnKS5yZW1vdmUoKTtcclxuICAgICQoJyNmbG93Q29udGFpbmVyJykuYXBwZW5kKCQoXCI8aDE+PC9oMT5cIikudGV4dCgnRXJyb3InICsgZSkuYWRkQ2xhc3MoJ2N1c3RvbUVycm9yTWVzc2FnZScpKTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IFBpcGVWaWV3IGZyb20gJy4vUGlwZVZpZXcuanMnO1xyXG5cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFBhbGV0dGVWaWV3IHtcclxuICBjb25zdHJ1Y3RvcihmbG93Q29udHJvbGxlcikge1xyXG4gICAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcclxuICAgIHRoaXMucGlwZXMgPSBudWxsO1xyXG4gICAgdGhpcy5mbG93VmlldyA9IGZsb3dDb250cm9sbGVyLmZsb3dWaWV3O1xyXG4gIH1cclxuXHJcbiAgYWRkTGlzdGVuZXIobGlzdGVuZXIpIHtcclxuICAgIHRoaXMubGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xyXG4gIH1cclxuXHJcbiAgbm90aWZ5TGlzdGVuZXJzKGRhdGEpIHtcclxuICAgIHRoaXMubGlzdGVuZXJzLmZvckVhY2gobCA9PiBsLm5vdGlmeShkYXRhKSk7XHJcbiAgfVxyXG5cclxuICBnZW5lcmF0ZVBhbGV0dGVQaXBlcyhwaXBlcykge1xyXG4gICAgbGV0IHBpcGVWaWV3ID0gbmV3IFBpcGVWaWV3KHRoaXMuZmxvd1ZpZXcpLFxyXG4gICAgLy8geG1sQnV0dG9uID0gJCgnPGJ1dHRvbj48L2J1dHRvbj4nKS5hdHRyKCd0eXBlJywgJ2J1dHRvbicpLmFkZENsYXNzKCdjb2xsYXBzaWJsZSBsaXN0SXRlbScpLnRleHQoXCJ4bWwgcGlwZXNcIiksXHJcbiAgICAvLyB4bWxDb2xsYXBzID0gJCgnPGRpdj48L2Rpdj4nKS5hZGRDbGFzcygnY29udGVudCcpLFxyXG4gICAgcGFsZXR0ZSA9ICQoJyNwYWxldHRlJyk7XHJcbiAgICAvLyBwYWxldHRlLmFwcGVuZCh4bWxCdXR0b24sIHhtbENvbGxhcHMpO1xyXG4gICAgcGlwZXMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xyXG4gICAgICBsZXQgaW1nLFxyXG4gICAgICBzdHJvbmcgPSAkKCc8c3Ryb25nPjwvc3Ryb25nPicpLnRleHQoaXRlbS5uYW1lKSxcclxuICAgICAgYnV0dG9uID0gJCgnPGJ1dHRvbj48L2J1dHRvbj4nKS5hdHRyKCd0eXBlJywgJ2J1dHRvbicpLmFkZENsYXNzKCdjb2xsYXBzaWJsZSBsaXN0SXRlbScpLFxyXG4gICAgICBjb2xsYXBzQm94ID0gJCgnPGRpdj48L2Rpdj4nKS5hZGRDbGFzcygnY29udGVudCcpLFxyXG4gICAgICBidXR0b25UZXh0ID0gJCgnPHNwYW4+PC9zcGFuPicpLmFkZENsYXNzKCdidXR0b25UZXh0JykudGV4dChpdGVtLm5hbWUpO1xyXG4gICAgICBpbWcgPSBwaXBlVmlldy5nZXRUeXBlSW1hZ2UoaXRlbS5uYW1lLCB0cnVlKS5hdHRyKCdpZCcsIGl0ZW0ubmFtZSApO1xyXG4gICAgICBidXR0b24uYXBwZW5kKGJ1dHRvblRleHQpO1xyXG4gICAgICBjb2xsYXBzQm94LmFwcGVuZChpbWcpO1xyXG4gICAgICAvLyBpZihpdGVtLm5hbWUubWF0Y2goL1htbC9nKSAhPSBudWxsKSB7XHJcbiAgICAgIC8vICAgeG1sQ29sbGFwcy5hcHBlbmQoYnV0dG9uLCBjb2xsYXBzQm94KTtcclxuICAgICAgLy8gICByZXR1cm47XHJcbiAgICAgIC8vIH1cclxuICAgICAgcGFsZXR0ZS5hcHBlbmQoYnV0dG9uLCBjb2xsYXBzQm94KTtcclxuICAgIH0pO1xyXG4gICAgdGhpcy5zZXRIYW5kbGVycygpO1xyXG4gIH1cclxuXHJcbiAgc2V0SGFuZGxlcnMoKSB7XHJcbiAgICBsZXQgY3VyID0gdGhpcztcclxuICAgIHZhciBjb2xsID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImNvbGxhcHNpYmxlXCIpO1xyXG4gICAgdmFyIGk7XHJcblxyXG4gICAgZm9yIChpID0gMDsgaSA8IGNvbGwubGVuZ3RoOyBpKyspIHtcclxuICAgICAgY29sbFtpXS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5jbGFzc0xpc3QudG9nZ2xlKFwiYWN0aXZlXCIpO1xyXG4gICAgICAgIHZhciBjb250ZW50ID0gdGhpcy5uZXh0RWxlbWVudFNpYmxpbmc7XHJcbiAgICAgICAgaWYgKGNvbnRlbnQuc3R5bGUuZGlzcGxheSA9PT0gXCJibG9ja1wiKSB7XHJcbiAgICAgICAgICBjb250ZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgY29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgJCgnI2NhbnZhcycpLm9uKCdkcmFnb3ZlcicsIGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpXHJcbiAgICB9KTtcclxuICAgICQoJyNjYW52YXMnKS5vbignZHJvcCcsIGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICBsZXQgZGF0YSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdkcm9wUGlwZScpO1xyXG4gICAgICBjdXIuZmxvd1ZpZXcubW9kaWZ5RmxvdyhcImFkZFwiLCB7XHJcbiAgICAgICAgbmFtZTogXCJuZXdcIiArIGRhdGEsXHJcbiAgICAgICAgY2xhc3NOYW1lOiBkYXRhXHJcbiAgICAgIH0pO1xyXG4gICAgICAvL2luc2VydCBwaXBlIGluIGVkaXRvclxyXG4gICAgfSlcclxuICAgICQoJy50eXBlSW1nJykub24oJ2RyYWdzdGFydCcsIGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdkcmFnJyk7XHJcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiZHJvcFBpcGVcIiwgZXYudGFyZ2V0LmlkKTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgRGVzY3JpcHRpb25WaWV3IGZyb20gJy4vRGVzY3JpcHRpb25WaWV3LmpzJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFBpcGVWaWV3IHtcclxuXHJcbiAgY29uc3RydWN0b3IoZmxvd1ZpZXcpIHtcclxuICAgIHRoaXMuZmxvd1ZpZXcgPSBmbG93VmlldztcclxuICAgIHRoaXMuZGVzY3JpcHRpb25WaWV3ID0gbmV3IERlc2NyaXB0aW9uVmlldygpO1xyXG4gIH1cclxuXHJcbiAgLypcclxuICAjIGZ1bmN0aW9uIHRvIG1hbnVhbGx5IGFkZCBhIFBpcGVcclxuICAjIGluY3JlbWVudCB3aW5kb3dzIGFuZCBjcmVhdGUgZGl2XHJcbiAgIyBtYWtlIGVsZW1lbnQgYSBzb3VyY2UgYW5kIGEgdGFyZ2V0XHJcbiAgIyBiaW5kIHRvIGNvbm5lY3Rpb25cclxuICAqL1xyXG5cclxuICBhZGRQaXBlKG5hbWUsIHBvc3NpdGlvbnMsIGV4dHJhLCBpc0V4aXQsIGRlc2NUZXh0KSB7XHJcbiAgICBsZXQgZmxvd1ZpZXcgPSB0aGlzLmZsb3dWaWV3O1xyXG4gICAgbGV0IGlkID0gZmxvd1ZpZXcud2luZG93cyArPSAxO1xyXG4gICAgbGV0IGNhbnZhcyA9ICQoJyNjYW52YXMnKTtcclxuICAgIGxldCBlbCA9ICQoXCI8ZGl2PjwvZGl2PlwiKS5hZGRDbGFzcyhcIndpbmRvdyBzb3VyY2VXaW5kb3dcIikuYXR0cihcImlkXCIsIFwic291cmNlV2luZG93XCIgKyBpZCk7XHJcbiAgICBsZXQgdHlwZVRleHQgPSAkKFwiPHN0cm9uZz48L3N0cm9uZz5cIikuYXR0cihcImlkXCIsIFwic3Ryb25nXCIpLnRleHQoZmxvd1ZpZXcuZ2V0VHlwZXMoKVtuYW1lXSk7XHJcbiAgICBsZXQgdHlwZVdpbmRvdyA9ICQoJzxkaXY+PC9kaXY+JykuYWRkQ2xhc3MoXCJ0eXBlV2luZG93XCIpLmFwcGVuZCh0aGlzLmdldFR5cGVJbWFnZShuYW1lKSwgdHlwZVRleHQpO1xyXG4gICAgbGV0IGJvdHRvbUNvbnRhaW5lciA9ICQoJzxkaXY+PC9kaXY+JykuYWRkQ2xhc3MoXCJib3R0b21Db250YWluZXJcIik7XHJcbiAgICBsZXQgbmFtZVRleHQgPSAkKFwiPHN0cm9uZz48L3N0cm9uZz5cIikuYXR0cihcImlkXCIsIFwic3Ryb25nXCIpLnRleHQobmFtZSk7XHJcbiAgICBsZXQgaHIgPSAkKCc8aHI+Jyk7XHJcbiAgICBsZXQgZXh0cmFUZXh0ID0gJChcIjxzdHJvbmc+PC9zdHJvbmc+XCIpLmF0dHIoXCJpZFwiLCBcInN0cm9uZ1wiKS50ZXh0KGV4dHJhKTtcclxuICAgIGlzRXhpdCA/IGJvdHRvbUNvbnRhaW5lci5hcHBlbmQobmFtZVRleHQsIGV4dHJhVGV4dCkgOiBib3R0b21Db250YWluZXIuYXBwZW5kKG5hbWVUZXh0LCBociwgZXh0cmFUZXh0KTtcclxuICAgIGVsLmFwcGVuZCh0eXBlV2luZG93LCBib3R0b21Db250YWluZXIpO1xyXG4gICAgaWYgKHBvc3NpdGlvbnMgIT0gbnVsbCkge1xyXG4gICAgICAkKGVsKS5jc3MoJ2xlZnQnLCBwb3NzaXRpb25zLnggKyAncHgnKTtcclxuICAgICAgJChlbCkuY3NzKCd0b3AnLCBwb3NzaXRpb25zLnkgKyAncHgnKTtcclxuICAgICAgaWYoZGVzY1RleHQpIHtcclxuICAgICAgICB0aGlzLmRlc2NyaXB0aW9uVmlldy5hZGREZXNjcmlwdGlvbihkZXNjVGV4dCwgcG9zc2l0aW9ucywgaWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGluc3RhbmNlLm1ha2VUYXJnZXQoZWwsIHtcclxuICAgICAgICBkcm9wT3B0aW9uczoge1xyXG4gICAgICAgICAgaG92ZXJDbGFzczogXCJob3ZlclwiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBhbmNob3I6IFtcIkxlZnRcIiwgXCJUb3BcIiwgXCJSaWdodFwiXSxcclxuICAgICAgICBlbmRwb2ludDogW1wiRG90XCIsIHtcclxuICAgICAgICAgIHJhZGl1czogMTEsXHJcbiAgICAgICAgICBjc3NDbGFzczogXCJsYXJnZS1ncmVlblwiXHJcbiAgICAgICAgfV1cclxuICAgICAgfSk7XHJcbiAgICBcclxuICAgIGlmIChpc0V4aXQpIHtcclxuICAgICAgJChlbCkuYWRkQ2xhc3MoJ2V4aXQnKTtcclxuICAgIH0gZWxzZSB7XHJcblx0ICAgIGluc3RhbmNlLm1ha2VTb3VyY2UoZWwsIHtcclxuXHQgICAgICBmaWx0ZXI6IFwiLmVuYWJsZURpc2FibGVTb3VyY2VcIixcclxuXHQgICAgICBmaWx0ZXJFeGNsdWRlOiB0cnVlLFxyXG5cdCAgICAgIG1heENvbm5lY3Rpb25zOiAtMSxcclxuXHQgICAgICBlbmRwb2ludDogW1wiRG90XCIsIHtcclxuXHQgICAgICAgIHJhZGl1czogNyxcclxuXHQgICAgICAgIGNzc0NsYXNzOiBcInNtYWxsLWJsdWVcIlxyXG5cdCAgICAgIH1dLFxyXG5cdCAgICAgIGFuY2hvcjogZmxvd1ZpZXcuc291cmNlQW5jaG9ycyxcclxuXHQgICAgICBjb25uZWN0b3I6IFtmbG93Vmlldy5jb25uZWN0b3JUeXBlLCB7XHJcblx0ICAgICAgICBzdHViOiBbNDAsIDYwXSxcclxuXHQgICAgICAgIGdhcDogMTAsXHJcblx0ICAgICAgICBjb3JuZXJSYWRpdXM6IDUsXHJcblx0ICAgICAgICBhbHdheXNSZXNwZWN0U3R1YnM6IHRydWUsXHJcblx0ICAgICAgICBtaWRwb2ludDogMC4wMDAxXHJcblx0ICAgICAgfV1cclxuXHQgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2FudmFzLmFwcGVuZChlbCk7XHJcbiAgICBpZihkZXNjVGV4dCkge1xyXG4gICAgaW5zdGFuY2UuY29ubmVjdCh7c291cmNlOiBcInNvdXJjZVdpbmRvd1wiICsgaWQsIHRhcmdldDogXCJkZXNjcmlwdGlvblwiICsgaWR9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBuYW1lO1xyXG4gIH1cclxuXHJcbiAgZ2V0VHlwZUltYWdlKG5hbWUsIHBhbGV0dGVJbWcpIHtcclxuICAgIGxldCB0eXBlcyA9IHRoaXMuZmxvd1ZpZXcuZ2V0VHlwZXMoKSxcclxuICAgICAgaW1nLFxyXG4gICAgICB0ZXN0SW1hZ2UgPSBuZXcgSW1hZ2UoKSxcclxuICAgICAgdXJsO1xyXG4gICAgICBpZihwYWxldHRlSW1nKSB7XHJcbiAgICAgICAgdXJsID0gJ21lZGlhLycgKyBuYW1lICsgJy5wbmcnO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICB1cmwgPSAnbWVkaWEvJyArIHR5cGVzW25hbWVdICsgJy5wbmcnO1xyXG4gICAgICB9XHJcbiAgICBpZiAodXJsICE9IG51bGwpIHtcclxuICAgICAgaW1nID0gJCgnPGltZz48L2ltZz4nKS5hdHRyKHtcclxuICAgICAgICBzcmM6IHVybCxcclxuICAgICAgICBhbHQ6IHR5cGVzW25hbWVdLFxyXG4gICAgICAgIHRpdGxlOiB0eXBlc1tuYW1lXVxyXG4gICAgICB9KS5hZGRDbGFzcyhcInR5cGVJbWdcIik7XHJcbiAgICAgIHRlc3RJbWFnZS5zcmMgPSB1cmw7XHJcbiAgICAgIHRlc3RJbWFnZS5vbmVycm9yID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaW1nLmF0dHIoJ3NyYycsICdtZWRpYS9iYXNpY1BpcGUucG5nJyk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGltZztcclxuICAgIH1cclxuICB9XHJcbn1cclxuIiwiKGZ1bmN0aW9uKGEsYil7aWYoXCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kKWRlZmluZShbXSxiKTtlbHNlIGlmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiBleHBvcnRzKWIoKTtlbHNle2IoKSxhLkZpbGVTYXZlcj17ZXhwb3J0czp7fX0uZXhwb3J0c319KSh0aGlzLGZ1bmN0aW9uKCl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gYihhLGIpe3JldHVyblwidW5kZWZpbmVkXCI9PXR5cGVvZiBiP2I9e2F1dG9Cb206ITF9Olwib2JqZWN0XCIhPXR5cGVvZiBiJiYoY29uc29sZS53YXJuKFwiRGVwcmVjYXRlZDogRXhwZWN0ZWQgdGhpcmQgYXJndW1lbnQgdG8gYmUgYSBvYmplY3RcIiksYj17YXV0b0JvbTohYn0pLGIuYXV0b0JvbSYmL15cXHMqKD86dGV4dFxcL1xcUyp8YXBwbGljYXRpb25cXC94bWx8XFxTKlxcL1xcUypcXCt4bWwpXFxzKjsuKmNoYXJzZXRcXHMqPVxccyp1dGYtOC9pLnRlc3QoYS50eXBlKT9uZXcgQmxvYihbXCJcXHVGRUZGXCIsYV0se3R5cGU6YS50eXBlfSk6YX1mdW5jdGlvbiBjKGIsYyxkKXt2YXIgZT1uZXcgWE1MSHR0cFJlcXVlc3Q7ZS5vcGVuKFwiR0VUXCIsYiksZS5yZXNwb25zZVR5cGU9XCJibG9iXCIsZS5vbmxvYWQ9ZnVuY3Rpb24oKXthKGUucmVzcG9uc2UsYyxkKX0sZS5vbmVycm9yPWZ1bmN0aW9uKCl7Y29uc29sZS5lcnJvcihcImNvdWxkIG5vdCBkb3dubG9hZCBmaWxlXCIpfSxlLnNlbmQoKX1mdW5jdGlvbiBkKGEpe3ZhciBiPW5ldyBYTUxIdHRwUmVxdWVzdDtiLm9wZW4oXCJIRUFEXCIsYSwhMSk7dHJ5e2Iuc2VuZCgpfWNhdGNoKGEpe31yZXR1cm4gMjAwPD1iLnN0YXR1cyYmMjk5Pj1iLnN0YXR1c31mdW5jdGlvbiBlKGEpe3RyeXthLmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJjbGlja1wiKSl9Y2F0Y2goYyl7dmFyIGI9ZG9jdW1lbnQuY3JlYXRlRXZlbnQoXCJNb3VzZUV2ZW50c1wiKTtiLmluaXRNb3VzZUV2ZW50KFwiY2xpY2tcIiwhMCwhMCx3aW5kb3csMCwwLDAsODAsMjAsITEsITEsITEsITEsMCxudWxsKSxhLmRpc3BhdGNoRXZlbnQoYil9fXZhciBmPVwib2JqZWN0XCI9PXR5cGVvZiB3aW5kb3cmJndpbmRvdy53aW5kb3c9PT13aW5kb3c/d2luZG93Olwib2JqZWN0XCI9PXR5cGVvZiBzZWxmJiZzZWxmLnNlbGY9PT1zZWxmP3NlbGY6XCJvYmplY3RcIj09dHlwZW9mIGdsb2JhbCYmZ2xvYmFsLmdsb2JhbD09PWdsb2JhbD9nbG9iYWw6dm9pZCAwLGE9Zi5zYXZlQXN8fChcIm9iamVjdFwiIT10eXBlb2Ygd2luZG93fHx3aW5kb3chPT1mP2Z1bmN0aW9uKCl7fTpcImRvd25sb2FkXCJpbiBIVE1MQW5jaG9yRWxlbWVudC5wcm90b3R5cGU/ZnVuY3Rpb24oYixnLGgpe3ZhciBpPWYuVVJMfHxmLndlYmtpdFVSTCxqPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO2c9Z3x8Yi5uYW1lfHxcImRvd25sb2FkXCIsai5kb3dubG9hZD1nLGoucmVsPVwibm9vcGVuZXJcIixcInN0cmluZ1wiPT10eXBlb2YgYj8oai5ocmVmPWIsai5vcmlnaW49PT1sb2NhdGlvbi5vcmlnaW4/ZShqKTpkKGouaHJlZik/YyhiLGcsaCk6ZShqLGoudGFyZ2V0PVwiX2JsYW5rXCIpKTooai5ocmVmPWkuY3JlYXRlT2JqZWN0VVJMKGIpLHNldFRpbWVvdXQoZnVuY3Rpb24oKXtpLnJldm9rZU9iamVjdFVSTChqLmhyZWYpfSw0RTQpLHNldFRpbWVvdXQoZnVuY3Rpb24oKXtlKGopfSwwKSl9OlwibXNTYXZlT3JPcGVuQmxvYlwiaW4gbmF2aWdhdG9yP2Z1bmN0aW9uKGYsZyxoKXtpZihnPWd8fGYubmFtZXx8XCJkb3dubG9hZFwiLFwic3RyaW5nXCIhPXR5cGVvZiBmKW5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKGIoZixoKSxnKTtlbHNlIGlmKGQoZikpYyhmLGcsaCk7ZWxzZXt2YXIgaT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtpLmhyZWY9ZixpLnRhcmdldD1cIl9ibGFua1wiLHNldFRpbWVvdXQoZnVuY3Rpb24oKXtlKGkpfSl9fTpmdW5jdGlvbihhLGIsZCxlKXtpZihlPWV8fG9wZW4oXCJcIixcIl9ibGFua1wiKSxlJiYoZS5kb2N1bWVudC50aXRsZT1lLmRvY3VtZW50LmJvZHkuaW5uZXJUZXh0PVwiZG93bmxvYWRpbmcuLi5cIiksXCJzdHJpbmdcIj09dHlwZW9mIGEpcmV0dXJuIGMoYSxiLGQpO3ZhciBnPVwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCI9PT1hLnR5cGUsaD0vY29uc3RydWN0b3IvaS50ZXN0KGYuSFRNTEVsZW1lbnQpfHxmLnNhZmFyaSxpPS9DcmlPU1xcL1tcXGRdKy8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtpZigoaXx8ZyYmaCkmJlwib2JqZWN0XCI9PXR5cGVvZiBGaWxlUmVhZGVyKXt2YXIgaj1uZXcgRmlsZVJlYWRlcjtqLm9ubG9hZGVuZD1mdW5jdGlvbigpe3ZhciBhPWoucmVzdWx0O2E9aT9hOmEucmVwbGFjZSgvXmRhdGE6W147XSo7LyxcImRhdGE6YXR0YWNobWVudC9maWxlO1wiKSxlP2UubG9jYXRpb24uaHJlZj1hOmxvY2F0aW9uPWEsZT1udWxsfSxqLnJlYWRBc0RhdGFVUkwoYSl9ZWxzZXt2YXIgaz1mLlVSTHx8Zi53ZWJraXRVUkwsbD1rLmNyZWF0ZU9iamVjdFVSTChhKTtlP2UubG9jYXRpb249bDpsb2NhdGlvbi5ocmVmPWwsZT1udWxsLHNldFRpbWVvdXQoZnVuY3Rpb24oKXtrLnJldm9rZU9iamVjdFVSTChsKX0sNEU0KX19KTtmLnNhdmVBcz1hLnNhdmVBcz1hLFwidW5kZWZpbmVkXCIhPXR5cGVvZiBtb2R1bGUmJihtb2R1bGUuZXhwb3J0cz1hKX0pO1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1GaWxlU2F2ZXIubWluLmpzLm1hcCIsInZhciBnO1xuXG4vLyBUaGlzIHdvcmtzIGluIG5vbi1zdHJpY3QgbW9kZVxuZyA9IChmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXM7XG59KSgpO1xuXG50cnkge1xuXHQvLyBUaGlzIHdvcmtzIGlmIGV2YWwgaXMgYWxsb3dlZCAoc2VlIENTUClcblx0ZyA9IGcgfHwgbmV3IEZ1bmN0aW9uKFwicmV0dXJuIHRoaXNcIikoKTtcbn0gY2F0Y2ggKGUpIHtcblx0Ly8gVGhpcyB3b3JrcyBpZiB0aGUgd2luZG93IHJlZmVyZW5jZSBpcyBhdmFpbGFibGVcblx0aWYgKHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCIpIGcgPSB3aW5kb3c7XG59XG5cbi8vIGcgY2FuIHN0aWxsIGJlIHVuZGVmaW5lZCwgYnV0IG5vdGhpbmcgdG8gZG8gYWJvdXQgaXQuLi5cbi8vIFdlIHJldHVybiB1bmRlZmluZWQsIGluc3RlYWQgb2Ygbm90aGluZyBoZXJlLCBzbyBpdCdzXG4vLyBlYXNpZXIgdG8gaGFuZGxlIHRoaXMgY2FzZS4gaWYoIWdsb2JhbCkgeyAuLi59XG5cbm1vZHVsZS5leHBvcnRzID0gZztcbiJdLCJzb3VyY2VSb290IjoiIn0=