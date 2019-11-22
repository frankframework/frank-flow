//an example configuration
let adapter = [
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

function edit(range, name) {
  editor.executeEdits("monacoContainer", [{
    range: range,
    text: name
  }]);
}

$('#beautify').click(function() {
  let prettyXML = beautify.xml(editor.getValue(), 4);
  editor.getModel().setValue(prettyXML);
});

function getCode() {
  fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.json', {
      method: 'GET'
    })
    .then(response => {
      return response.json()
    })
    .then(data => {
      // Work with JSON data here
      ibisdocJson = data;
      console.log("ibisdoc is loaded!");
    })
    .catch(err => {
      // Do something for an error here
    })
}

function getXsd() {
  fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.xsd', {
      method: 'GET'
    })
    .then(response => {
      return response.text()
    })
    .then(data => {
      // Work with JSON data here
      ibisdocXsd = data;
      console.log("xsd is loaded!, here");
    })
    .catch(err => {
      console.log("not loaded xsd", err);
      // Do something for an error here
    })
}

function toBeautifulSyntax(xml) {
	let matches = xml.match(/<pipe(\n\t*)?(\s\w*="(\s?\S)*"(\n\t*)?)*>[^]*?<\/pipe>/g),
	doc = xml,
	exits;
	if(matches == null) return;
	matches.forEach(function (item, index) {
		let oldPipe = item,
		newPipe = "";
		let className = oldPipe.match(/className=".*?"/)[0].match(/\.[^.]*?"/)[0].replace(/[".]/g, '');
		if(className.match(/.*?Pipe/) == null) {
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
	.replace(/<[\/]?[a-zA-Z]/g, function(txt){ return txt.toUpperCase()});
	
	exits = doc.match(/<Exits>[^]*?<\/Exits>/)[0].replace(/<\/?Exits>/g, '').replace(/\t/, '');
	doc = doc.replace(/<Exits>[^]*?<\/Exits>/, '')
	.replace(/<\/Pipeline>/g, exits + '\n \t\t\t</Pipeline>')
	.replace(/className=".*?"/g, "");
	return doc;
}

function addOptions(adapters) {
	let select = $('#adapterSelect'),
	option,
	name;
	adapters.forEach( function (item, index) {
		name = item.match(/<Adapter[^]*?name=".*?"/g);
		if(name != null) {
			name = name[0].match(/".*?"/g)[0].replace(/"/g, '');
			option = $('<option></option>').attr('value', index).text(name);
			$(select).append(option);		
		}
	});
}

function getConfigurations() {
	  fetch('../iaf/api/configurations', {
	      method: 'GET'
	    })
	    .then(response => {
	      return response.text();
	    })
	    .then(response => {
	    	let configurations = [],
	    	dom, obj;
	    	response.match(/<configuration[^]*?>[^]*?<\/configuration>/g).forEach(function (item, index) {
	    		item.match(/<adapter[^]*?>[^]*?<\/adapter>/g).forEach(function (item, index) {
	    			configurations.push(item);
	    		});
	    	})
	    	return configurations;
	    })
	    .then(response => {
	    	response.forEach(function (item, index) {
	    		response[index] = toBeautifulSyntax(item);
	    	});
	    	return response;
	    })
	    .then(data => {
	      // Work with JSON data here
	      adapters = data;
	      addOptions(adapters);
	    })
	    .catch(err => {
	      console.log('couldnt load configurations', err)
	    })
	}

$('#adapterSelect').on('change', function() {
	let adapter = $('#adapterSelect').val();
	editor.getModel().setValue(adapters[adapter]);
})

getCode();
getXsd();
getConfigurations();
let ibisdocJson = null,
adapters = null,
ibisdocXsd = null;

function validateConfiguration() {
  let validate = xmllint.validateXML({
    xml: editor.getValue().replace(/\sx=".*?"/g, '').replace(/\sy=".*?"/g, ''),
    schema: ibisdocXsd,
    TOTAL_MEMORY: 16777217
  });
  return validate;
}
let decorations;

function decorateLine(lineNumber) {
  decorations = editor.deltaDecorations([], [{
    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
    options: {
      glyphMarginClassName: 'myGlyphMarginClass'
    }
  }]);
}

function undoDecorations() {
  decorations = editor.deltaDecorations(editor.getModel().getAllDecorations(), [{
    range: new monaco.Range(1, 1, 1, 1),
    options: {}
  }]);
  editor.getModel().setValue(editor.getModel().getValue());
}


function changeName(oldWord, newWord) {
  let changed = changeNameCode('<[\\S]*?[^"/][pP]ipe(\\n\\t*)?\\s?name="\\w*"', oldWord, newWord);
  //changeClosingTag(oldWord, newWord);
  if (changed) {
    changeNameCode('<forward(\\n\\t*)?(\\s\\w*="(\\s?\\S)*"(\\n\\t*)?)*\\/>', oldWord, newWord);
  }
}

function changeClosingTag(oldTag, newTag) {
  let attributeObjectRegex = '[/][\\S]*?[^"/]Pipe';
  let matches = editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
  matches.forEach(function(item, index) {
    let tag = editor.getModel().getValueInRange(item.range);
    if (tag.slice(tag.indexOf('/') + 1) == oldTag + 'Pipe') {
      tag = tag.replace(oldTag, newTag)
    }
    edit(item.range, tag);
  });
}

//<pipe(\\n\\t*)?(\\s\\w*="(\\s?\\S)*"(\\n\\t*)?)*>
function changePossition(name, newX, newY) {
  let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>';
  let matches = editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
  matches.forEach(function(item, index) {
    let pipe = editor.getModel().getValueInRange(item.range);
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
      edit(item.range, pipe);
    }
  });
}

function changeExitPossition(name, newX, newY) {
	  let matches = editor.getModel().findMatches('<Exit [^]*?\\/>', false, true, false, false);
	  
	  matches.forEach(function (item, index) {
		 let exit = editor.getModel().getValueInRange(item.range);
		 if(exit.indexOf('path="' + name +  '"') != -1) {
			 if(exit.indexOf('x="') != -1) {
				 exit = exit.replace(/x="[0-9]*?"/g, 'x="' + newX +'"')
				 .replace(/y="[0-9]*?"/g, 'y="' + newY +'"');
			 } else {
				 let str = ' x="' + newX + '" y="' + newY + '"'
				 exit = exit.slice(0, exit.indexOf('/')) + str + exit.slice(exit.indexOf('/'));
			 }
		 edit(item.range, exit);
		 }
	  }); 
}
function changeNameCode(reg, oldWord, newWord) {
  let changed = false;
  let attributeObjectRegex = reg;
  let matches = editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
  matches.forEach(function(item, index) {
    let pipe = editor.getModel().getValueInRange(item.range);
    if (pipe.split('"').find(word => word === oldWord)) {
      let newPipe = pipe.replace(new RegExp(oldWord, 'g'), newWord);
      changed = true;
      edit(item.range, newPipe);
    }
  });
  return changed;
}

function changeAddForward(name, path) {
  let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>';
  let matches = editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
  matches.forEach(function(item, index) {
    let pipe = editor.getModel().getValueInRange(item.range);
    if (pipe.split(/[\s>]/).find(word => word === 'name="' + name + '"')) {
      pipe = pipe.slice(0, pipe.search(/<[/][\S]*?[^"/]Pipe/)) + '\t<Forward name="success" path="' + path + '"/>';
      let newLineRange = {
        endColumn: 1,
        endLineNumber: item.range.endLineNumber,
        startColumn: 1,
        startLineNumber: item.range.endLineNumber
      }
      edit(newLineRange, '\n');
      edit(item.range, pipe);
    }
  });
}

function deleteForward(name, path) {
  let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>';
  let matches = editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
  matches.forEach(function(item, index) {
    let pipe = editor.getModel().getValueInRange(item.range);
    if (pipe.split(/[\s>]/).find(word => word === 'name="' + name + '"')) {
      path.toLowerCase() == "exit" ? path = "Exit" : path = path;
      let newPipe = pipe.replace(new RegExp('<Forward[^/]*?path="' + path + '"[^]*?/>', 'gi'), "");
      edit(item.range, newPipe);
    }
  });
}

function changeAddPipe(name, possitions) {
  let attributeObjectRegex = '<\\/pipeline>';
  let matches = editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
  matches.forEach(function(item, index) {
    let range = item.range;
    range.startColumn = 1;
    range.endColumn = 1;
    edit(range, '\n');

    let newPipe = '\t\t<newPipe name="' + name + '" x="' + possitions.x + '" y="' + possitions.y + '">\n\t\t</newPipe>';
    edit(range, newPipe);
  });
}

function getTypes() {
  let types = {};
  let value = editor.getValue();
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

function createPipeAutoComplete() {
  let pipe, obj = null;
  let arr = [];

  if (ibisdocJson != null) {
    ibisdocJson[2].classes.forEach(function(item, index) {
      pipe = item;
      obj = {
        label: pipe.name.replace(/^((?!Pipe).)*$/, pipe.name + "Pipe"),
        kind: monaco.languages.CompletionItemKind.Function,
        documentation: pipe.packageName,
        insertText: '<' + pipe.name + ' name="yourPipe"> \n </' + pipe.name + '>'
      }
      arr.push(obj);
    });
  }

  obj = {
    label: 'Forward',
    kind: monaco.languages.CompletionItemKind.Function,
    documentation: "a forward",
    insertText: '<Forward name="forwardName" path="newPath" />'
  }
  arr.push(obj);
  return arr;
}


monaco.languages.registerCompletionItemProvider('xml', {
  provideCompletionItems: function(model, position) {
    // find out if we are completing a property in the 'dependencies' object.
      var textUntilPosition = model.getValueInRange({startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column});
      var match = textUntilPosition.match(/<[\S]*?[^"/][pP]ipe[\s\t\n][^]*?>[^]*?<[/][\S]*?[^"/]Pipe>/g);
      if(match == null) {
    	  return;
      }
      match.forEach(function (item, index) {
    	  let line = model.getLineContent(position.lineNumber - 1);
    	  console.log(line);
    	  if(item.indexOf(line) != -1) {
    		  suggestions = createPipeAutoComplete();
    	  } else {
    		  suggestions = [];
    	  }
      });
      return {
          suggestions: suggestions
      };
  }
});

let editor = monaco.editor.create(document.getElementById('monacoContainer'), {
  value: adapter.join('\n'),
  language: 'xml',
  theme: "vs-dark",
  glyphMargin: true,
  automaticLayout: true
});
